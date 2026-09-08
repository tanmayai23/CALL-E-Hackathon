/**
 * skills/autonomous-incident-escalation/scripts/run_escalation.ts
 *
 * The escalation ladder, self-contained. Incident in, confirmed human
 * commitment out.
 *
 * Only dependency is `@call-e/calle`. All decision logic is vendored into
 * ./lib (generated from source — see the VENDORED banner in those files).
 *
 * ── Run it safely ────────────────────────────────────────────────────────────
 *
 *   CALLE_USE_MOCK=true npx ts-node scripts/run_escalation.ts
 *
 * That dials nobody and spends nothing. Change the outcome to watch the ladder
 * behave differently:
 *
 *   CALLE_USE_MOCK=true MOCK_OUTCOME=refuse npx ts-node scripts/run_escalation.ts
 *
 * ── Run it for real ──────────────────────────────────────────────────────────
 *
 * CALLE_USE_MOCK=false RINGS A REAL PHONE. Read references/safety.md first.
 */

import { createInitialState, lastStructuredResult, type EscalationState } from "./lib/state";
import { assessIncident, getSuppressReason } from "./lib/assessIncident";
import { selectBestResponder } from "./lib/selectResponder";
import { decide, needsBackup, etaOutsideSafeWindow } from "./lib/decide";
import { escalate } from "./lib/escalate";
import { buildTaskPrompt } from "./lib/prompt";
import { ESCALATION_RESULT_SCHEMA } from "./lib/schema";
import {
  pollCallToCompletion,
  withRetry,
  toSentinelCallState,
  DEFAULT_CALL_TIMEOUT_MS,
  type CallProgressHooks,
  type PollableCall,
} from "./lib/progress";
import type {
  Responder,
  Facility,
  Severity,
  EscalationContext,
  EscalationStructuredResult,
  CallStatus,
} from "./lib/types";

import sampleRoster from "../assets/sample-roster.json";

// ─── Inputs ───────────────────────────────────────────────────────────────────

export interface IncidentInput {
  assetId: string;
  assetType: string;
  location: string;
  metric: string;
  value: number;
  unit: string;
  threshold: number;
  severity: Severity;
  safeWindowMinutes: number;
  consequence: string;
  incidentId?: string;
  traceId?: string;
}

export interface CallResult {
  status: string;
  taskCompleted: boolean | null;
  completionConfidence: { score: number; label: string } | null;
  evidence: string[];
  structuredResult: EscalationStructuredResult | null;
}

export interface RunEscalationInput {
  incident: IncidentInput;
  facility: Facility;
  roster: Responder[];
  requiredSkill: string;
  requiredZone: string;

  /**
   * FR-10.5 — checked immediately before EVERY dial. Fails closed: omit it and
   * nothing is called. See references/safety.md.
   */
  isKillSwitchActive?: () => Promise<boolean>;

  maxRungs?: number;
  /** Independent of the rung cap — callbacks and retries burn calls too. */
  maxCallsPerIncident?: number;
  callTimeoutMs?: number;

  /** Swap the call layer. Defaults to the real CALL-E SDK. */
  placeCall?: (params: {
    task: string;
    responder: Responder;
    hooks: CallProgressHooks;
    timeoutMs: number;
  }) => Promise<CallResult>;

  hooks?: CallProgressHooks;
  onEvent?: (event: { node: string; decision: string; reason: string }) => void;
}

export interface EscalationOutcome {
  resolved: boolean;
  requiresHumanReview: boolean;
  rungsAttempted: number;
  attemptedResponders: string[];
  callsPlaced: number;
  committedResponder: Responder | null;
  etaMinutes: number | null;
  backupRequired: boolean;
  structuredResult: EscalationStructuredResult | null;
  terminalNode: "resolve" | "verify" | "schedule_callback" | "human_review" | "unresolved" | "suppressed";
}

// ─── The real CALL-E call layer ───────────────────────────────────────────────

async function placeCallViaCalle(params: {
  task: string;
  responder: Responder;
  hooks: CallProgressHooks;
  timeoutMs: number;
}): Promise<CallResult> {
  // @call-e/calle is ESM-only (no "require" condition in its exports map).
  // A plain `await import()` is downlevelled to require() under CommonJS and
  // fails with ERR_PACKAGE_PATH_NOT_EXPORTED, so route through Function to
  // keep it a genuine dynamic ESM import.
  const importEsm = new Function("s", "return import(s);") as (
    s: string
  ) => Promise<typeof import("@call-e/calle")>;
  const { CalleClient } = await importEsm("@call-e/calle");

  if (!process.env.CALLE_API_KEY) {
    throw new Error(
      "CALLE_API_KEY is not set. Get one from dashboard.heycall-e.com/account/api-keys"
    );
  }

  const calle = new CalleClient({ apiKey: process.env.CALLE_API_KEY });

  // create() + poll rather than createAndWait(), so live state can be streamed
  // while the phone is ringing.
  const created = await calle.calls.create({
    task: params.task,
    recipient: {
      phone: params.responder.phoneE164,
      locale: params.responder.preferredLanguage,
    },
    resultSchema: ESCALATION_RESULT_SCHEMA as unknown as Record<string, unknown>,
  });

  params.hooks.onState?.(
    toSentinelCallState(created as unknown as PollableCall),
    created.id
  );

  const final = await pollCallToCompletion(
    created.id,
    async (id) => (await calle.calls.get(id)) as unknown as PollableCall,
    params.hooks,
    { timeoutMs: params.timeoutMs }
  );

  const call = final as unknown as {
    status: string;
    taskCompleted: boolean | null;
    completionConfidence: { score: number; label: string } | null;
    evidence: string[];
    structuredResult: unknown;
  };

  return {
    status: call.status,
    taskCompleted: call.taskCompleted,
    completionConfidence: call.completionConfidence,
    evidence: call.evidence ?? [],
    structuredResult: (call.structuredResult as EscalationStructuredResult) ?? null,
  };
}

// ─── The ladder ───────────────────────────────────────────────────────────────

export async function runEscalation(input: RunEscalationInput): Promise<EscalationOutcome> {
  const emit = input.onEvent ?? (() => {});
  const maxCalls = input.maxCallsPerIncident ?? 5;
  const timeoutMs = input.callTimeoutMs ?? DEFAULT_CALL_TIMEOUT_MS;
  const placeCall = input.placeCall ?? placeCallViaCalle;

  const { incident, facility } = input;

  let state: EscalationState = createInitialState(
    incident.incidentId ?? `INC-${Date.now()}`,
    incident.traceId ?? `trace-${Date.now()}`,
    incident.severity,
    incident.safeWindowMinutes,
    incident.consequence,
    { id: incident.assetId, type: incident.assetType, location: incident.location },
    {
      metric: incident.metric,
      value: incident.value,
      unit: incident.unit,
      threshold: incident.threshold,
    },
    facility,
    input.maxRungs ?? 3
  );

  const outcome = (
    terminalNode: EscalationOutcome["terminalNode"]
  ): EscalationOutcome => {
    const result = lastStructuredResult(state);
    return {
      resolved: terminalNode === "resolve" || terminalNode === "verify",
      requiresHumanReview: terminalNode === "human_review",
      rungsAttempted: state.escalationRung,
      attemptedResponders: state.attemptedResponders,
      callsPlaced: state.callHistory.length,
      committedResponder:
        terminalNode === "resolve" || terminalNode === "verify"
          ? state.currentResponder
          : null,
      etaMinutes: result?.eta_minutes ?? null,
      backupRequired:
        (terminalNode === "verify" || terminalNode === "resolve") && needsBackup(state),
      structuredResult: result,
      terminalNode,
    };
  };

  // ── assess_incident ────────────────────────────────────────────────────────
  const assessment = assessIncident(state);
  emit({
    node: "assess_incident",
    decision: assessment,
    reason: assessment === "suppress"
      ? getSuppressReason(state)
      : "Incident assessed as call-worthy.",
  });
  if (assessment === "suppress") return outcome("suppressed");

  // ── the ladder ─────────────────────────────────────────────────────────────
  for (;;) {
    // select_responder
    const responder = selectBestResponder(
      state,
      input.roster,
      input.requiredSkill,
      input.requiredZone
    );
    if (!responder) {
      emit({
        node: "select_responder",
        decision: "no_responder",
        reason: `No eligible responder for skill=${input.requiredSkill}, zone=${input.requiredZone}.`,
      });
      return outcome("unresolved");
    }
    state = { ...state, currentResponder: responder };
    emit({
      node: "select_responder",
      decision: "responder_found",
      reason: `Selected ${responder.name} (${responder.role}) — rung ${state.escalationRung}`,
    });

    // FR-10.5 — kill switch, before every dial, fails closed.
    let killSwitchActive = true;
    if (input.isKillSwitchActive) {
      try {
        killSwitchActive = await input.isKillSwitchActive();
      } catch {
        killSwitchActive = true;
      }
    }
    if (killSwitchActive) {
      emit({
        node: "execute_call",
        decision: "kill_switch_active",
        reason: input.isKillSwitchActive
          ? "Outbound calling is halted by the global kill switch."
          : "No kill switch check supplied — refusing to dial (fail-closed).",
      });
      return outcome("human_review");
    }

    // FR-7.3 — call cap
    if (state.callHistory.length >= maxCalls) {
      emit({
        node: "execute_call",
        decision: "call_cap_reached",
        reason: `Call cap reached (${state.callHistory.length}/${maxCalls}) — refusing to dial again.`,
      });
      return outcome("human_review");
    }

    // plan_call
    const ctx: EscalationContext = {
      incidentId: state.incidentId,
      traceId: state.traceId,
      severity: state.severity,
      safeWindowMinutes: state.safeWindowMinutes,
      consequence: state.consequence,
      escalationRung: state.escalationRung,
      facility: state.facility,
      asset: state.asset,
      reading: state.reading,
      responder,
    };
    const task = buildTaskPrompt(ctx);
    emit({
      node: "plan_call",
      decision: "plan_ready",
      reason: `Rung ${state.escalationRung}: call ${responder.name} re: ${state.asset.id}`,
    });

    // execute_call — F10 retry, FR-5.4 timeout
    let call: CallResult;
    try {
      call = await withRetry(() =>
        placeCall({ task, responder, hooks: input.hooks ?? {}, timeoutMs })
      );
    } catch (err) {
      emit({
        node: "execute_call",
        decision: "call_error",
        reason: err instanceof Error ? err.message : String(err),
      });
      return outcome("human_review");
    }

    const confidence = call.completionConfidence ?? { score: 0, label: "none" };
    state = {
      ...state,
      structuredResults: call.structuredResult
        ? [...state.structuredResults, call.structuredResult]
        : state.structuredResults,
      confidenceHistory: [...state.confidenceHistory, confidence],
      callHistory: [
        ...state.callHistory,
        {
          callId: `call-${state.callHistory.length + 1}`,
          incidentId: state.incidentId,
          responderId: responder.id,
          escalationRung: state.escalationRung,
          status: call.status as CallStatus,
          taskCompleted: call.taskCompleted ?? false,
          confidenceScore: confidence.score,
          confidenceLabel: confidence.label,
          evidence: call.evidence,
          structuredResult: call.structuredResult,
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          durationSeconds: null,
          traceId: state.traceId,
        },
      ],
    };
    emit({
      node: "execute_call",
      decision: call.status,
      reason: `taskCompleted=${call.taskCompleted}, confidence=${confidence.score}`,
    });

    // decide
    const decision = decide(state);
    emit({
      node: "decide",
      decision,
      reason: `next_action="${lastStructuredResult(state)?.next_action}", confidence=${confidence.score}`,
    });

    switch (decision) {
      case "resolve":
        return outcome("resolve");

      case "verify":
        // FR-6.4 — accept the commitment, but a late ETA needs a backup too.
        if (etaOutsideSafeWindow(state)) {
          emit({
            node: "verify",
            decision: "backup_required",
            reason:
              `ETA ${lastStructuredResult(state)?.eta_minutes ?? "unknown"}min exceeds ` +
              `the ${state.safeWindowMinutes}min safe window.`,
          });
        }
        return outcome("verify");

      case "schedule_callback":
        return outcome("schedule_callback");

      case "human_review":
        return outcome("human_review");

      case "escalate": {
        const { nextNode, updatedState } = escalate(state);
        state = { ...state, ...updatedState };
        emit({
          node: "escalate",
          decision: nextNode === "unresolved" ? "ladder_exhausted" : `rung_${state.escalationRung}`,
          reason:
            nextNode === "unresolved"
              ? `Rung cap reached (${state.escalationRung}/${state.maxRungs}).`
              : `Advancing to rung ${state.escalationRung}.`,
        });
        if (nextNode === "unresolved") return outcome("unresolved");
        break;
      }
    }
  }
}

// ─── Runnable demo ────────────────────────────────────────────────────────────

const MOCK_OUTCOMES: Record<string, CallResult> = {
  accept: {
    status: "completed",
    taskCompleted: true,
    completionConfidence: { score: 0.92, label: "high" },
    evidence: [
      "[MOCK] Initially indicated being on another job.",
      "[MOCK] When pressed for an ETA, committed to 40 minutes.",
    ],
    structuredResult: {
      responder_available: "conditional",
      eta_minutes: 40,
      acknowledged_severity: true,
      requires_backup: false,
      decline_reason: "none",
      verbatim_commitment: "[MOCK] Give me about forty minutes.",
      next_action: "SCHEDULE_VERIFICATION_CALL",
    },
  },
  refuse: {
    status: "completed",
    taskCompleted: true,
    completionConfidence: { score: 0.91, label: "high" },
    evidence: ["[MOCK] Clearly stated they are on another job."],
    structuredResult: {
      responder_available: "no",
      acknowledged_severity: true,
      decline_reason: "on_another_job",
      verbatim_commitment: "[MOCK] I'm on another job, I can't come.",
      next_action: "ESCALATE_NEXT_RUNG",
    },
  },
  no_answer: {
    status: "no_answer",
    taskCompleted: false,
    completionConfidence: { score: 0, label: "none" },
    evidence: ["[MOCK] Call was not answered."],
    structuredResult: {
      responder_available: "unknown",
      acknowledged_severity: false,
      next_action: "ESCALATE_NEXT_RUNG",
    },
  },
  late_eta: {
    status: "completed",
    taskCompleted: true,
    completionConfidence: { score: 0.88, label: "high" },
    evidence: ["[MOCK] Committed, but quoted 120 minutes."],
    structuredResult: {
      responder_available: "conditional",
      eta_minutes: 120,
      acknowledged_severity: true,
      requires_backup: false,
      decline_reason: "none",
      verbatim_commitment: "[MOCK] I can be there in two hours.",
      next_action: "SCHEDULE_VERIFICATION_CALL",
    },
  },
};

async function main() {
  const useMock = process.env.CALLE_USE_MOCK === "true";
  if (!useMock) {
    console.warn(
      "\n  CALLE_USE_MOCK is not 'true'. This will place a REAL phone call.\n" +
      "  Read references/safety.md, then re-run deliberately.\n"
    );
  }

  const roster = sampleRoster as Responder[];
  const mockOutcome = MOCK_OUTCOMES[process.env.MOCK_OUTCOME ?? "accept"];

  const result = await runEscalation({
    incident: {
      assetId: "CS-04",
      assetType: "cold-storage",
      location: "Zone A",
      metric: "temperature_c",
      value: 12.4,
      unit: "C",
      threshold: 8,
      severity: "CRITICAL",
      safeWindowMinutes: 90,
      consequence: "inventory is at risk",
    },
    facility: { id: "northgate", name: "Northgate Facility", timezone: "Asia/Kolkata" },
    roster,
    requiredSkill: "refrigeration",
    requiredZone: "Zone A",
    isKillSwitchActive: async () => false,

    placeCall: useMock
      ? async ({ hooks }) => {
          for (const s of ["queued", "dialling", "connected", "in_conversation", "completed"] as CallStatus[]) {
            hooks.onState?.(s, "mock-call");
          }
          return mockOutcome;
        }
      : undefined,

    hooks: {
      onState: (s) => console.log(`  [state] ${s}`),
      onTranscript: (t) => console.log(`  ${t.speaker}: ${t.text}`),
    },
    onEvent: ({ node, decision, reason }) =>
      console.log(`[${node}] ${decision} — ${reason}`),
  });

  console.log("\n─── Result ───");
  console.log("Terminal state:   ", result.terminalNode);
  console.log("Rungs attempted:  ", result.rungsAttempted);
  console.log("Responders tried: ", result.attemptedResponders.join(", ") || "none");
  console.log("Calls placed:     ", result.callsPlaced);
  console.log("Committed:        ", result.committedResponder?.name ?? "nobody");
  console.log("ETA:              ", result.etaMinutes ?? "n/a");
  console.log("Backup required:  ", result.backupRequired);
}

// Run the demo when this file is executed directly, not when imported.
// `require.main` rather than `import.meta` — this file is compiled as
// CommonJS (see tsconfig.json), where import.meta is unavailable.
declare const require: { main?: unknown } | undefined;
declare const module: unknown;

if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) {
  main().catch((err) => {
    console.error("Escalation failed:", err);
    process.exit(1);
  });
}
