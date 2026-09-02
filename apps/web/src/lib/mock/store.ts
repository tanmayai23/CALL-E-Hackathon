/**
 * In-memory mock backend.
 *
 * Holds incidents and replays scenario scripts in real time. Survives Fast
 * Refresh by hanging off `globalThis`, so a scenario running in one tab is not
 * destroyed by an edit in another.
 *
 * This is the dev harness described in FR-5.6 and CLAUDE.md Rule 1: it exists
 * so the dashboard can be built and rehearsed without touching the 20-call
 * CALL-E budget. It is never the demo path.
 */

import type { Incident, IncidentStatus } from "@/lib/contracts/domain";
import type { SentinelEvent } from "@/lib/contracts/events";
import { ASSETS, FACILITY, assetById } from "./facility";
import { SCENARIOS, scenarioById, type ScriptStep } from "./scenarios";

export interface Run {
  incident: Incident;
  steps: ScriptStep[];
  emitted: SentinelEvent[];
  startedAt: number;
  finished: boolean;
  timers: ReturnType<typeof setTimeout>[];
  subscribers: Set<(event: SentinelEvent) => void>;
}

interface Store {
  runs: Map<string, Run>;
  killSwitch: boolean;
  seeded: boolean;
  counter: number;
}

declare global {
  var __sentinelStore: Store | undefined;
}

const store: Store =
  globalThis.__sentinelStore ??
  (globalThis.__sentinelStore = {
    runs: new Map(),
    killSwitch: false,
    seeded: false,
    counter: 0,
  });

/* -------------------------------------------------------------------------- */

function nextId(): { id: string; traceId: string } {
  store.counter += 1;
  const n = String(store.counter).padStart(4, "0");
  const rand = Math.random().toString(36).slice(2, 8);
  return { id: `INC-${n}`, traceId: `tr_${rand}${Date.now().toString(36).slice(-4)}` };
}

function makeIncident(scenarioId: string, openedAt: string): Incident {
  const scenario = scenarioById(scenarioId);
  if (!scenario) throw new Error(`Unknown scenario: ${scenarioId}`);
  const asset = assetById(scenario.assetId);
  const { id, traceId } = nextId();

  return {
    id,
    traceId,
    facility: FACILITY,
    asset,
    severity: scenario.severity,
    status: "OPEN",
    openedAt,
    closedAt: null,
    safeWindowMinutes: asset.safeWindowMinutes,
    escalationRung: 1,
    maxRungs: 3,
    reading: {
      metric: asset.metric,
      value: scenario.baseline[scenario.baseline.length - 1],
      unit: scenario.unit,
      threshold: scenario.threshold,
    },
    scenarioId,
    finalOutcome: null,
    timeSavedMinutes: null,
  };
}

/**
 * Server-side projection of an event onto incident summary state, so the
 * incident list endpoint stays cheap. The client derives its own richer view
 * from the same event stream.
 */
function project(incident: Incident, event: SentinelEvent): void {
  switch (event.type) {
    case "signal.received":
      incident.reading = { ...incident.reading, value: event.value };
      break;
    case "incident.opened":
      incident.severity = event.severity;
      incident.safeWindowMinutes = event.safeWindowMinutes;
      incident.status = "OPEN";
      break;
    case "incident.suppressed":
      incident.status = "RESOLVED";
      incident.finalOutcome = "Suppressed by correlation — no call placed";
      incident.closedAt = new Date().toISOString();
      incident.timeSavedMinutes = 0;
      break;
    case "responder.selected":
      incident.escalationRung = event.rung;
      break;
    case "call.state":
      incident.status = event.state === "completed" ? incident.status : "CALLING";
      break;
    case "incident.escalated":
      incident.escalationRung = event.toRung;
      break;
    case "result.extracted":
      if (event.confidence.score < 0.7) incident.status = "HUMAN_REVIEW";
      break;
    case "incident.resolved":
      incident.status = "RESOLVED";
      incident.finalOutcome = event.outcome;
      incident.timeSavedMinutes = event.timeSavedMinutes;
      incident.closedAt = new Date().toISOString();
      break;
    case "incident.unresolved":
      incident.status = "UNRESOLVED";
      incident.finalOutcome = event.reason;
      incident.closedAt = new Date().toISOString();
      break;
  }
}

/* -------------------------------------------------------------------------- */

export function isKillSwitchEngaged(): boolean {
  return store.killSwitch;
}

export function setKillSwitch(engaged: boolean): boolean {
  store.killSwitch = engaged;
  if (engaged) {
    // Rule 3: the kill switch always works. Halt every in-flight run.
    for (const run of store.runs.values()) {
      if (run.finished) continue;
      run.timers.forEach(clearTimeout);
      run.timers = [];
      run.finished = true;
      run.incident.status = "UNRESOLVED";
      run.incident.finalOutcome = "Halted by kill switch — outbound calling stopped";
      run.incident.closedAt = new Date().toISOString();
      const event: SentinelEvent = {
        type: "incident.unresolved",
        incidentId: run.incident.id,
        reason: "Halted by kill switch — outbound calling stopped",
      };
      run.emitted.push(event);
      run.subscribers.forEach((fn) => fn(event));
    }
  }
  return store.killSwitch;
}

export function trigger(scenarioId: string): Run {
  const scenario = scenarioById(scenarioId);
  if (!scenario) throw new Error(`Unknown scenario: ${scenarioId}`);

  seed();

  const incident = makeIncident(scenarioId, new Date().toISOString());
  const steps = scenario.build(incident.id);

  const run: Run = {
    incident,
    steps,
    emitted: [],
    startedAt: Date.now(),
    finished: false,
    timers: [],
    subscribers: new Set(),
  };
  store.runs.set(incident.id, run);

  const last = steps.reduce((max, s) => Math.max(max, s.at), 0);
  for (const step of steps) {
    run.timers.push(
      setTimeout(() => {
        run.emitted.push(step.event);
        project(run.incident, step.event);
        run.subscribers.forEach((fn) => fn(step.event));
      }, step.at),
    );
  }
  run.timers.push(setTimeout(() => (run.finished = true), last + 400));

  return run;
}

export function getRun(incidentId: string): Run | undefined {
  seed();
  return store.runs.get(incidentId);
}

export function listIncidents(): Incident[] {
  seed();
  return [...store.runs.values()]
    .map((r) => r.incident)
    .sort((a, b) => b.openedAt.localeCompare(a.openedAt));
}

export function clearAll(): void {
  for (const run of store.runs.values()) run.timers.forEach(clearTimeout);
  store.runs.clear();
  store.counter = 0;
  store.seeded = false;
}

/**
 * Reset to just the seeded history — used by the simulator's "clear live runs"
 * control so the empty and populated states are both reachable on demand.
 */
export function resetToSeed(): void {
  clearAll();
  seed();
}

export function subscribe(run: Run, fn: (event: SentinelEvent) => void): () => void {
  run.subscribers.add(fn);
  return () => run.subscribers.delete(fn);
}

/* --------------------------------------------------------------------------
   Seeded history — a cold dashboard with zero incidents reads as broken on
   camera. These are closed incidents only; nothing here is ever "live".
   -------------------------------------------------------------------------- */

const SEED: Array<{
  scenarioId: string;
  minutesAgo: number;
  status: IncidentStatus;
  outcome: string;
  timeSaved: number | null;
  rung: number;
}> = [
  {
    scenarioId: "cold-chain-critical",
    minutesAgo: 184,
    status: "RESOLVED",
    outcome: "Commitment secured — Ravi Sharma, ETA 35 min. Verified on arrival at T+38.",
    timeSaved: 12.4,
    rung: 1,
  },
  {
    scenarioId: "transient-spike",
    minutesAgo: 96,
    status: "RESOLVED",
    outcome: "Suppressed by correlation — defrost signature, no sustained excursion",
    timeSaved: 0,
    rung: 1,
  },
  {
    scenarioId: "refusal-escalation",
    minutesAgo: 61,
    status: "UNRESOLVED",
    outcome: "Ladder exhausted after 3 rungs — escalated to facility manager on shift",
    timeSaved: null,
    rung: 3,
  },
  {
    scenarioId: "sensor-offline",
    minutesAgo: 27,
    status: "HUMAN_REVIEW",
    outcome: "Extraction confidence 0.61 — ETA stated as “soon”, held for operator review",
    timeSaved: null,
    rung: 2,
  },
];

function seed(): void {
  if (store.seeded) return;
  store.seeded = true;

  for (const s of SEED) {
    const openedAt = new Date(Date.now() - s.minutesAgo * 60_000).toISOString();
    const incident = makeIncident(s.scenarioId, openedAt);
    incident.status = s.status;
    incident.finalOutcome = s.outcome;
    incident.timeSavedMinutes = s.timeSaved;
    incident.escalationRung = s.rung;
    incident.closedAt = new Date(
      Date.now() - (s.minutesAgo - 3) * 60_000,
    ).toISOString();

    store.runs.set(incident.id, {
      incident,
      steps: [],
      emitted: [],
      startedAt: Date.parse(openedAt),
      finished: true,
      timers: [],
      subscribers: new Set(),
    });
  }
}

export { SCENARIOS, ASSETS };

/**
 * FR-6.6 — operator correction of extracted fields before final commit.
 * Re-emits `result.extracted` with the corrected values; confidence and
 * evidence are left untouched, because they came from CALL-E and an operator
 * edit does not change what was actually said.
 */
export function overrideResult(
  incidentId: string,
  patch: Record<string, unknown>,
): SentinelEvent | null {
  const run = store.runs.get(incidentId);
  if (!run) return null;

  const last = [...run.emitted]
    .reverse()
    .find((e): e is Extract<SentinelEvent, { type: "result.extracted" }> =>
      e.type === "result.extracted",
    );
  if (!last) return null;

  const event: SentinelEvent = {
    ...last,
    structured: { ...last.structured, ...patch },
  };

  run.emitted.push(event);
  project(run.incident, event);
  run.incident.status = "RESOLVED";
  run.subscribers.forEach((fn) => fn(event));
  return event;
}
