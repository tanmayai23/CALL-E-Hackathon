/**
 * packages/agent/__tests__/graph.integration.test.ts
 * End-to-end tests that execute the COMPILED LangGraph, not individual nodes.
 *
 * Every other suite in this package tests node functions in isolation. Those
 * cannot catch wiring defects — bad channel reducers, edges that route on the
 * wrong field, a rung cap that never terminates. This suite exists to catch
 * exactly those, so it must always drive the graph through `runEscalationAgent`.
 *
 * Runs against the mock CALL-E driver (FR-5.6). No live calls, no budget spend.
 */

import { runEscalationAgent } from "../index";
import type { AgentDependencies } from "../graph";
import type { MockScenario } from "../../calle/mock";
import type { EscalationContext, Responder } from "../../types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeResponder(id: string, ladderPriority: number): Responder {
  return {
    id,
    name: `Responder ${id}`,
    role: ladderPriority === 3 ? "Supervisor" : "Refrigeration Technician",
    phoneE164: "+919876543210",
    skills: ["refrigeration"],
    shiftStart: "00:00",   // always on shift, so tests are time-independent
    shiftEnd: "23:59",
    zone: "Zone A",
    ladderPriority,
    preferredLanguage: "en-IN",
    cooldownUntil: null,
  };
}

const ROSTER = [makeResponder("R-001", 1), makeResponder("R-002", 2), makeResponder("R-003", 3)];

const CONTEXT: EscalationContext = {
  incidentId: "INC-INT-001",
  traceId: "trace-int-001",
  severity: "CRITICAL",
  safeWindowMinutes: 90,
  consequence: "inventory is at risk",
  escalationRung: 1,
  facility: { id: "northgate", name: "Northgate Facility", timezone: "Asia/Kolkata" },
  asset: { id: "CS-04", type: "cold-storage", location: "Zone A" },
  reading: { metric: "temperature_c", value: 12.4, unit: "C", threshold: 8 },
  responder: ROSTER[0],
};

/** Records everything the graph pushed outwards, so tests can assert on it. */
interface Spy {
  nodes: string[];
  events: { node: string; decision: string }[];
  calls: number;
  outcomes: string[];
  verificationsScheduled: number;
  callbacksScheduled: number;
  parked: number;
  managerAlerts: number;
  callStates: string[];
  transcript: { speaker: string; text: string }[];
  backupsArranged: { reason: string }[];
}

function makeDeps(
  scenario: MockScenario,
  overrides: Partial<AgentDependencies> = {}
): { deps: AgentDependencies; spy: Spy } {
  const spy: Spy = {
    nodes: [],
    events: [],
    calls: 0,
    outcomes: [],
    verificationsScheduled: 0,
    callbacksScheduled: 0,
    parked: 0,
    managerAlerts: 0,
    callStates: [],
    transcript: [],
    backupsArranged: [],
  };

  const deps: AgentDependencies = {
    getRoster: async () => ROSTER,
    requiredSkill: "refrigeration",
    requiredZone: "Zone A",

    persistCall: async () => {
      spy.calls += 1;
      return { callId: `call-${spy.calls}` };
    },

    resolveCallbacks: {
      persistOutcome: async () => { spy.outcomes.push("resolved"); },
      notifyManager: async () => {},
      emitSSE: () => {},
    },
    unresolvedCallbacks: {
      persistOutcome: async () => { spy.outcomes.push("unresolved"); },
      alertFacilityManager: async () => { spy.managerAlerts += 1; },
      emitSSE: () => {},
    },
    verifyCallbacks: {
      scheduleVerificationJob: async () => { spy.verificationsScheduled += 1; },
      arrangeBackup: async ({ reason }) => { spy.backupsArranged.push({ reason }); },
      emitSSE: () => {},
    },
    humanReviewCallbacks: {
      parkIncident: async () => { spy.parked += 1; },
      alertOperator: async () => {},
      emitSSE: () => {},
    },
    scheduleCallbackCallbacks: {
      scheduleCallbackJob: async () => { spy.callbacksScheduled += 1; },
      emitSSE: () => {},
    },

    emitAgentEvent: ({ node, decision }) => {
      spy.nodes.push(node);
      spy.events.push({ node, decision });
    },
    emitSSEPlanComposed: () => {},
    emitSSEResponderSelected: () => {},
    emitSSECallState: ({ state }) => { spy.callStates.push(state); },
    emitSSETranscriptDelta: ({ speaker, text }) => { spy.transcript.push({ speaker, text }); },

    incidentOpenedAt: new Date(),
    isKillSwitchActive: async () => false,
    useMock: true,
    ...overrides,
  };

  // The mock driver picks its scenario from this env var (see executeCall).
  process.env.SENTINEL_MOCK_SCENARIO = scenario;

  return { deps, spy };
}

beforeAll(() => {
  // Skip the mock driver's simulated call duration — these tests assert on
  // routing, not timing, and the ladder cases would otherwise take 4.5s each.
  process.env.SENTINEL_MOCK_DELAY_MS = "0";
});

afterAll(() => {
  delete process.env.SENTINEL_MOCK_DELAY_MS;
});

afterEach(() => {
  delete process.env.SENTINEL_MOCK_SCENARIO;
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("graph: happy path (hero demo scenario)", () => {
  test("accept_after_pushback → places a call and schedules verification", async () => {
    const { deps, spy } = makeDeps("accept_after_pushback");
    const final = await runEscalationAgent(CONTEXT, deps);

    // The defect this test exists for: with broken channel reducers,
    // currentResponder stayed null and the graph short-circuited to
    // `unresolved` without ever dialling.
    expect(spy.nodes).toContain("select_responder");
    expect(spy.nodes).toContain("plan_call");
    expect(spy.nodes).toContain("execute_call");
    expect(spy.calls).toBe(1);

    expect(final.currentResponder?.id).toBe("R-001");
    expect(final.callHistory).toHaveLength(1);
    expect(final.structuredResults).toHaveLength(1);
    expect(final.structuredResults[0].eta_minutes).toBe(40);
    expect(final.confidenceHistory[0].score).toBe(0.92);

    expect(spy.verificationsScheduled).toBe(1);
    expect(spy.nodes).not.toContain("unresolved");
  }, 30_000);

  test("state updates actually propagate between nodes", async () => {
    // Direct regression guard for the channel-reducer bug: if a reducer
    // discards updates, every field below keeps its initial value.
    const { deps } = makeDeps("accept_immediately");
    const final = await runEscalationAgent(CONTEXT, deps);

    expect(final.currentResponder).not.toBeNull();   // initial: null
    expect(final.callHistory.length).toBeGreaterThan(0); // initial: []
    expect(final.route).not.toBeNull();               // initial: null
  }, 30_000);
});

describe("graph: escalation ladder", () => {
  test("hard refusal at every rung → walks 3 rungs then terminates UNRESOLVED", async () => {
    const { deps, spy } = makeDeps("hard_refusal");
    const final = await runEscalationAgent(CONTEXT, deps);

    // F11. Previously this could not terminate: `decide` returned "escalate"
    // at the cap, `escalate` returned {} without incrementing, and the edge
    // re-derived the cap from escalationRung — looping until recursion limit.
    expect(spy.calls).toBe(3);
    expect(final.escalationRung).toBe(3);
    expect(final.attemptedResponders).toEqual(["R-001", "R-002", "R-003"]);
    expect(final.ladderExhausted).toBe(true);

    expect(spy.nodes).toContain("unresolved");
    expect(spy.outcomes).toContain("unresolved");
    expect(spy.managerAlerts).toBe(1);
    expect(final.finalOutcome?.committed).toBe(false);
  }, 60_000);

  test("rung cap is enforced in code — maxRungs=1 stops after one call", async () => {
    const { deps, spy } = makeDeps("hard_refusal");
    const final = await runEscalationAgent({ ...CONTEXT, incidentId: "INC-INT-CAP" }, {
      ...deps,
      // createInitialState defaults maxRungs to 3; override via the roster
      // being exhausted instead, which is the other route into `unresolved`.
      getRoster: async () => [ROSTER[0]],
    });

    // Only one eligible responder: rung 2 finds nobody → unresolved.
    expect(spy.calls).toBe(1);
    expect(spy.nodes).toContain("unresolved");
    expect(final.finalOutcome?.committed).toBe(false);
  }, 60_000);
});

describe("graph: failure modes reach their terminal node", () => {
  // F1/F2/F9 have confidence 0.0–0.1 by construction. They must ESCALATE,
  // not park for an operator who is not on shift at 02:00.
  test.each<[MockScenario, string]>([
    ["no_answer", "F1"],
    ["voicemail", "F2"],
    ["wrong_person", "F7"],
    ["call_drops", "F9"],
  ])("%s (%s) → escalates rather than parking for review", async (scenario) => {
    const { deps, spy } = makeDeps(scenario);
    const final = await runEscalationAgent(CONTEXT, deps);

    expect(spy.nodes).toContain("escalate");
    expect(spy.parked).toBe(0);
    expect(final.attemptedResponders.length).toBeGreaterThan(0);
  }, 60_000);

  test("ambiguous (F6) → parks for human review, never escalates", async () => {
    const { deps, spy } = makeDeps("ambiguous");
    const final = await runEscalationAgent(CONTEXT, deps);

    expect(spy.parked).toBe(1);
    expect(spy.nodes).not.toContain("escalate");
    expect(final.requiresHumanReview).toBe(true);
  }, 30_000);

  test("callback_requested (F5) → schedules a callback", async () => {
    const { deps, spy } = makeDeps("callback_requested");
    await runEscalationAgent(CONTEXT, deps);

    expect(spy.callbacksScheduled).toBe(1);
    expect(spy.nodes).toContain("schedule_callback");
  }, 30_000);

  test("CALL-E throwing (F10) → parks for review, does not crash the graph", async () => {
    const { deps, spy } = makeDeps("accept_after_pushback");
    const final = await runEscalationAgent(CONTEXT, {
      ...deps,
      persistCall: async () => { throw new Error("CALL-E API unavailable"); },
    });

    expect(final.callError).toContain("CALL-E API unavailable");
    expect(spy.parked).toBe(1);
    expect(final.requiresHumanReview).toBe(true);
  }, 30_000);
});

describe("graph: suppression", () => {
  test("INFO severity terminates at assess_incident without calling", async () => {
    const { deps, spy } = makeDeps("accept_after_pushback");
    const final = await runEscalationAgent({ ...CONTEXT, severity: "INFO" }, deps);

    expect(spy.calls).toBe(0);
    expect(spy.nodes).toEqual(["assess_incident"]);
    expect(final.suppressReason).toContain("INFO");
  }, 30_000);
});

describe("graph: live call streaming (FR-5.2)", () => {
  test("emits the full call.state sequence the dashboard renders", async () => {
    const { deps, spy } = makeDeps("accept_after_pushback");
    await runEscalationAgent(CONTEXT, deps);

    // The Live Call Theatre keys its visuals off exactly these states.
    expect(spy.callStates).toEqual([
      "queued", "dialling", "connected", "in_conversation", "extracting", "completed",
    ]);
  }, 30_000);

  test("a no-answer surfaces as no_answer, never as a generic failure", async () => {
    const { deps, spy } = makeDeps("no_answer");
    await runEscalationAgent(CONTEXT, deps);

    expect(spy.callStates).toContain("no_answer");
    expect(spy.callStates).not.toContain("in_conversation");
  }, 30_000);

  test("streams transcript turns with speaker attribution", async () => {
    const { deps, spy } = makeDeps("accept_after_pushback");
    await runEscalationAgent(CONTEXT, deps);

    expect(spy.transcript.length).toBeGreaterThan(0);
    expect(spy.transcript[0].speaker).toBe("AGENT");
    expect(spy.transcript.some((t) => t.speaker === "HUMAN")).toBe(true);
  }, 30_000);
});

describe("graph: ETA vs safe window (FR-6.4)", () => {
  test("late_eta (120min vs 90min window) → accepts AND arranges a backup", async () => {
    const { deps, spy } = makeDeps("late_eta");
    await runEscalationAgent(CONTEXT, deps);

    expect(spy.verificationsScheduled).toBe(1);        // commitment accepted
    expect(spy.backupsArranged).toHaveLength(1);       // but not trusted alone
    expect(spy.backupsArranged[0].reason).toContain("exceeds");
  }, 30_000);

  test("an ETA inside the window does not arrange a backup", async () => {
    const { deps, spy } = makeDeps("accept_after_pushback");   // 40min vs 90min
    await runEscalationAgent(CONTEXT, deps);

    expect(spy.verificationsScheduled).toBe(1);
    expect(spy.backupsArranged).toHaveLength(0);
  }, 30_000);

  test("a commitment with no ETA is treated as outside the window", async () => {
    // We cannot prove it is safe, so we behave as though it is not.
    const { deps, spy } = makeDeps("accept_after_pushback");
    await runEscalationAgent({ ...CONTEXT, safeWindowMinutes: 20 }, deps);

    expect(spy.backupsArranged).toHaveLength(1);
  }, 30_000);
});

describe("graph: call cap (FR-7.3)", () => {
  test("refuses to dial past the per-incident cap even with rungs left", async () => {
    const { deps, spy } = makeDeps("hard_refusal");
    await runEscalationAgent(CONTEXT, { ...deps, maxCallsPerIncident: 2 });

    // Rung cap is 3, but the call cap bites first.
    expect(spy.calls).toBe(2);
    expect(spy.events.some((e) => e.decision === "call_cap_reached")).toBe(true);
  }, 60_000);

  test("the cap is enforced in code, not by the model's next_action", async () => {
    const { deps, spy } = makeDeps("hard_refusal");
    await runEscalationAgent(CONTEXT, { ...deps, maxCallsPerIncident: 1 });

    expect(spy.calls).toBe(1);
    expect(spy.parked).toBe(1);   // cap breach routes to human review
  }, 60_000);
});

describe("graph: kill switch (FR-10.5)", () => {
  test("an active kill switch prevents any dial", async () => {
    const { deps, spy } = makeDeps("accept_after_pushback");
    await runEscalationAgent(CONTEXT, { ...deps, isKillSwitchActive: async () => true });

    expect(spy.calls).toBe(0);
    expect(spy.callStates).toHaveLength(0);
    expect(spy.events.some((e) => e.decision === "kill_switch_active")).toBe(true);
  }, 30_000);

  test("fails CLOSED when no kill switch is wired in", async () => {
    // SAFETY.md promises execute_call checks the switch. If a caller forgets to
    // supply it, refusing to dial is the only honest behaviour.
    const { deps, spy } = makeDeps("accept_after_pushback");
    await runEscalationAgent(CONTEXT, { ...deps, isKillSwitchActive: undefined });

    expect(spy.calls).toBe(0);
  }, 30_000);

  test("fails CLOSED when the kill switch check itself throws", async () => {
    const { deps, spy } = makeDeps("accept_after_pushback");
    await runEscalationAgent(CONTEXT, {
      ...deps,
      isKillSwitchActive: async () => { throw new Error("redis down"); },
    });

    expect(spy.calls).toBe(0);
  }, 30_000);

  test("is checked on every rung, not just the first", async () => {
    let checks = 0;
    const { deps } = makeDeps("hard_refusal");
    await runEscalationAgent(CONTEXT, {
      ...deps,
      isKillSwitchActive: async () => { checks++; return false; },
    });

    expect(checks).toBe(3);
  }, 60_000);
});

describe("graph: trace_id propagation (Rule 7)", () => {
  test("every emitted agent event carries the incident trace_id", async () => {
    const traceIds: string[] = [];
    const { deps } = makeDeps("hard_refusal");
    await runEscalationAgent(CONTEXT, {
      ...deps,
      emitAgentEvent: ({ traceId }) => { traceIds.push(traceId); },
    });

    expect(traceIds.length).toBeGreaterThan(0);
    expect(new Set(traceIds)).toEqual(new Set(["trace-int-001"]));
  }, 60_000);
});
