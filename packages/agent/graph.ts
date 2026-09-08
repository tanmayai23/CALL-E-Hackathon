/**
 * packages/agent/graph.ts
 * LangGraph escalation agent — main graph definition.
 * Owner: Aryan
 *
 * Graph topology:
 *
 *   assess_incident
 *        │
 *   ┌────┴────┐
 * suppress   select_responder
 *   │              │
 *  END         plan_call
 *                  │
 *             execute_call ──► CALL-E SDK (real phone call)
 *                  │
 *               decide
 *         ┌───────┼──────────┬──────────────┐
 *       resolve  escalate  human_review  schedule_callback
 *         │        │                         │
 *        END  select_responder (loop)       END
 *               │
 *         [ladder exhausted] → unresolved → END
 *
 * Every node emits an SSE event and an agent_events row via callbacks.
 *
 * State channels use Annotation.Root — each field is a last-value channel,
 * so a node's returned update replaces the previous value. Do NOT hand-roll
 * `{ value: (x) => x }` reducers: LangGraph invokes a channel reducer as
 * `reducer(current, incoming)`, so a single-argument identity silently
 * discards every update after the first.
 */

import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import type { EscalationState } from "./state";
import { lastStructuredResult, lastConfidence } from "./state";
import { assessIncident, getSuppressReason } from "./nodes/assessIncident";
import { selectBestResponder } from "./nodes/selectResponder";
import { executeCall, type PersistCallFn } from "./nodes/executeCall";
import { decide, explainDecision } from "./nodes/decide";
import { escalate } from "./nodes/escalate";
import { resolve, type ResolveCallbacks } from "./nodes/resolve";
import { unresolved, type UnresolvedCallbacks } from "./nodes/unresolved";
import { verify, type VerifyCallbacks } from "./nodes/verify";
import { humanReview, type HumanReviewCallbacks } from "./nodes/humanReview";
import { scheduleCallback, type ScheduleCallbackCallbacks } from "./nodes/scheduleCallback";
import { buildCallPlanSummary, getMustAskQuestions } from "../calle/prompt";
import type {
  Responder,
  Asset,
  Reading,
  Facility,
  Severity,
  CallRecord,
  EscalationStructuredResult,
  Outcome,
  EscalationContext,
  CallStatus,
} from "../types";

// ─── State channels ───────────────────────────────────────────────────────────
// One channel per EscalationState field. Bare `Annotation<T>` = last value wins.

export const EscalationAnnotation = Annotation.Root({
  incidentId: Annotation<string>,
  traceId: Annotation<string>,
  severity: Annotation<Severity>,
  safeWindowMinutes: Annotation<number>,
  consequence: Annotation<string>,
  asset: Annotation<Asset>,
  reading: Annotation<Reading>,
  facility: Annotation<Facility>,
  escalationRung: Annotation<number>,
  maxRungs: Annotation<number>,
  attemptedResponders: Annotation<string[]>,
  currentResponder: Annotation<Responder | null>,
  callHistory: Annotation<CallRecord[]>,
  structuredResults: Annotation<EscalationStructuredResult[]>,
  confidenceHistory: Annotation<{ score: number; label: string }[]>,
  finalOutcome: Annotation<Outcome | null>,
  requiresHumanReview: Annotation<boolean>,
  suppressReason: Annotation<string | null>,
  callError: Annotation<string | null>,
  ladderExhausted: Annotation<boolean>,
  route: Annotation<string | null>,
});

// Compile-time guard: the annotation and EscalationState must not drift.
type AnnotationState = typeof EscalationAnnotation.State;
type AssertExtends<A extends B, B> = true;
export type _StateMatchesAnnotation = AssertExtends<AnnotationState, EscalationState> &
  AssertExtends<EscalationState, AnnotationState>;

// ─── Graph dependencies (injected by Sameer's backend) ───────────────────────
// The agent never touches the DB or SSE directly. All side effects
// are callbacks — this keeps the graph pure and replayable.

export interface AgentDependencies {
  // Roster to select responders from
  getRoster: (facilityId: string) => Promise<Responder[]>;
  requiredSkill: string;
  requiredZone: string;

  // Persistence (Sameer implements these)
  persistCall: PersistCallFn;
  resolveCallbacks: ResolveCallbacks;
  unresolvedCallbacks: UnresolvedCallbacks;
  verifyCallbacks: VerifyCallbacks;
  humanReviewCallbacks: HumanReviewCallbacks;
  scheduleCallbackCallbacks: ScheduleCallbackCallbacks;

  // SSE emitters (Sameer implements these)
  emitAgentEvent: (params: {
    incidentId: string;
    node: string;
    decision: string;
    reason: string;
    traceId: string;
  }) => void;
  emitSSEPlanComposed: (params: {
    incidentId: string;
    summary: string;
    mustAsk: string[];
  }) => void;
  emitSSEResponderSelected: (params: {
    incidentId: string;
    responder: Responder;
    rung: number;
  }) => void;

  /** FR-5.2 — live call lifecycle, drives the Live Call Theatre visuals. */
  emitSSECallState?: (params: {
    incidentId: string;
    callId: string;
    state: CallStatus;
    traceId: string;
  }) => void;

  /** FR-5.2 — transcript turns as CALL-E reports them. */
  emitSSETranscriptDelta?: (params: {
    incidentId: string;
    speaker: "AGENT" | "HUMAN";
    text: string;
    ts: string;
    traceId: string;
  }) => void;

  // Incident opened timestamp — used to compute time_saved
  incidentOpenedAt: Date;

  /**
   * FR-10.5 — the global kill switch. Checked immediately before every dial.
   *
   * If this is not supplied the agent FAILS CLOSED and refuses to call: a
   * missing kill switch is a broken kill switch, and SAFETY.md promises this
   * check exists. Sameer's backend wires it to POST /api/v1/killswitch.
   */
  isKillSwitchActive?: () => Promise<boolean>;

  /**
   * FR-7.3 — hard ceiling on total calls per incident, independent of the rung
   * cap. Enforced in code so no prompt or model output can raise it.
   */
  maxCallsPerIncident?: number;

  /** FR-5.4 — hard ceiling on any single call's duration. */
  callTimeoutMs?: number;

  // Use mock CALL-E? (dev only)
  useMock?: boolean;
}

/** PRD §4.1 — default max 5 calls per incident. */
export const DEFAULT_MAX_CALLS_PER_INCIDENT = 5;

/** Builds the EscalationContext the prompt + call layers consume. */
function toContext(state: EscalationState, responder: Responder): EscalationContext {
  return {
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
}

// ─── Build the graph ──────────────────────────────────────────────────────────

export function buildEscalationGraph(deps: AgentDependencies) {
  const graph = new StateGraph(EscalationAnnotation)

    // ── Node: assess_incident ────────────────────────────────────────────────
    .addNode("assess_incident", async (state) => {
      const route = assessIncident(state);
      const suppressReason = route === "suppress" ? getSuppressReason(state) : null;

      deps.emitAgentEvent({
        incidentId: state.incidentId,
        node: "assess_incident",
        decision: route,
        reason: suppressReason ?? "Incident assessed as call-worthy.",
        traceId: state.traceId,
      });

      return { suppressReason, route };
    })

    // ── Node: select_responder ───────────────────────────────────────────────
    .addNode("select_responder", async (state) => {
      const roster = await deps.getRoster(state.facility.id);
      const responder = selectBestResponder(
        state,
        roster,
        deps.requiredSkill,
        deps.requiredZone
      );

      if (responder) {
        deps.emitSSEResponderSelected({
          incidentId: state.incidentId,
          responder,
          rung: state.escalationRung,
        });
      }

      deps.emitAgentEvent({
        incidentId: state.incidentId,
        node: "select_responder",
        decision: responder ? "responder_found" : "no_responder",
        reason: responder
          ? `Selected ${responder.name} (${responder.role}) — rung ${state.escalationRung}`
          : `No eligible responder for skill=${deps.requiredSkill}, zone=${deps.requiredZone}`,
        traceId: state.traceId,
      });

      return {
        currentResponder: responder ?? null,
        route: responder ? "plan_call" : "unresolved",
      };
    })

    // ── Node: plan_call ──────────────────────────────────────────────────────
    .addNode("plan_call", async (state) => {
      // Guaranteed non-null: select_responder routes here only when set.
      const ctx = toContext(state, state.currentResponder!);
      const summary = buildCallPlanSummary(ctx);
      const mustAsk = getMustAskQuestions(ctx);

      deps.emitSSEPlanComposed({
        incidentId: state.incidentId,
        summary,
        mustAsk,
      });

      deps.emitAgentEvent({
        incidentId: state.incidentId,
        node: "plan_call",
        decision: "plan_ready",
        reason: summary,
        traceId: state.traceId,
      });

      return {};
    })

    // ── Node: execute_call ───────────────────────────────────────────────────
    .addNode("execute_call", async (state) => {
      // ── FR-10.5 — kill switch. Nothing dials past this point. ──────────────
      // Fails closed: if the check itself errors, or was never wired up, we
      // treat the switch as ACTIVE. A safety control that silently degrades to
      // "allow" is not a safety control.
      let killSwitchActive: boolean;
      if (!deps.isKillSwitchActive) {
        killSwitchActive = true;
      } else {
        try {
          killSwitchActive = await deps.isKillSwitchActive();
        } catch {
          killSwitchActive = true;
        }
      }

      if (killSwitchActive) {
        const reason = deps.isKillSwitchActive
          ? "Outbound calling is halted by the global kill switch."
          : "No kill switch check was wired into the agent — refusing to dial (fail-closed).";

        deps.emitAgentEvent({
          incidentId: state.incidentId,
          node: "execute_call",
          decision: "kill_switch_active",
          reason,
          traceId: state.traceId,
        });

        return { callError: reason };
      }

      // FR-7.3 — call cap, enforced before dialling. This is separate from the
      // rung cap: callbacks and retries can burn calls without advancing a rung.
      const maxCalls = deps.maxCallsPerIncident ?? DEFAULT_MAX_CALLS_PER_INCIDENT;
      if (state.callHistory.length >= maxCalls) {
        const reason =
          `Call cap reached (${state.callHistory.length}/${maxCalls}) for incident ` +
          `${state.incidentId} — refusing to dial again.`;

        deps.emitAgentEvent({
          incidentId: state.incidentId,
          node: "execute_call",
          decision: "call_cap_reached",
          reason,
          traceId: state.traceId,
        });

        return { callError: reason };
      }

      try {
        const { callId, result } = await executeCall(state, deps.persistCall, {
          useMock: deps.useMock,
          timeoutMs: deps.callTimeoutMs,
          hooks: {
            onState: (callState, calleCallId) =>
              deps.emitSSECallState?.({
                incidentId: state.incidentId,
                callId: calleCallId,
                state: callState,
                traceId: state.traceId,
              }),
            onTranscript: (turn, _calleCallId) =>
              deps.emitSSETranscriptDelta?.({
                incidentId: state.incidentId,
                speaker: turn.speaker,
                text: turn.text,
                ts: new Date().toISOString(),
                traceId: state.traceId,
              }),
          },
        });

        const structuredResult =
          (result.structuredResult as EscalationStructuredResult | null) ?? null;
        const confidence = result.completionConfidence ?? { score: 0, label: "none" };

        deps.emitAgentEvent({
          incidentId: state.incidentId,
          node: "execute_call",
          decision: result.status,
          reason: `taskCompleted=${result.taskCompleted}, confidence=${confidence.score}`,
          traceId: state.traceId,
        });

        const startedAt = new Date().toISOString();

        return {
          structuredResults: structuredResult
            ? [...state.structuredResults, structuredResult]
            : state.structuredResults,
          confidenceHistory: [...state.confidenceHistory, confidence],
          callHistory: [
            ...state.callHistory,
            {
              callId,
              incidentId: state.incidentId,
              responderId: state.currentResponder!.id,
              escalationRung: state.escalationRung,
              status: result.status as CallStatus,
              taskCompleted: result.taskCompleted ?? false,
              confidenceScore: confidence.score,
              confidenceLabel: confidence.label,
              evidence: result.evidence,
              structuredResult,
              startedAt,
              endedAt: startedAt,
              durationSeconds: null,
              traceId: state.traceId,
            },
          ],
          callError: null,
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);

        deps.emitAgentEvent({
          incidentId: state.incidentId,
          node: "execute_call",
          decision: "call_error",
          reason: errorMsg,
          traceId: state.traceId,
        });

        return { callError: errorMsg };
      }
    })

    // ── Node: decide ─────────────────────────────────────────────────────────
    .addNode("decide", async (state) => {
      // If execute_call failed outright, route to human review (F10).
      if (state.callError) {
        deps.emitAgentEvent({
          incidentId: state.incidentId,
          node: "decide",
          decision: "human_review",
          reason: `Call error: ${state.callError}`,
          traceId: state.traceId,
        });
        return { requiresHumanReview: true, route: "human_review" };
      }

      const decision = decide(state);
      const reason = explainDecision(state, decision);

      deps.emitAgentEvent({
        incidentId: state.incidentId,
        node: "decide",
        decision,
        reason,
        traceId: state.traceId,
      });

      return {
        requiresHumanReview: decision === "human_review",
        route: decision,
      };
    })

    // ── Node: escalate ───────────────────────────────────────────────────────
    .addNode("escalate", async (state) => {
      const { nextNode, updatedState } = escalate(state);
      const exhausted = nextNode === "unresolved";

      deps.emitAgentEvent({
        incidentId: state.incidentId,
        node: "escalate",
        decision: exhausted
          ? "ladder_exhausted"
          : `rung_${state.escalationRung}_to_${state.escalationRung + 1}`,
        reason: exhausted
          ? `Rung cap reached (${state.escalationRung}/${state.maxRungs}) — routing to unresolved.`
          : `Advancing from rung ${state.escalationRung} to ${state.escalationRung + 1}`,
        traceId: state.traceId,
      });

      return { ...updatedState, ladderExhausted: exhausted, route: nextNode };
    })

    // ── Node: resolve ────────────────────────────────────────────────────────
    .addNode("resolve", async (state) => {
      const updates = await resolve(state, deps.incidentOpenedAt, deps.resolveCallbacks);

      deps.emitAgentEvent({
        incidentId: state.incidentId,
        node: "resolve",
        decision: "resolved",
        reason: `Incident resolved. ETA: ${lastStructuredResult(state)?.eta_minutes ?? "N/A"}min. Time saved: ${updates.finalOutcome?.timeSavedMinutes ?? 0}min.`,
        traceId: state.traceId,
      });

      return updates;
    })

    // ── Node: verify ─────────────────────────────────────────────────────────
    .addNode("verify", async (state) => {
      const updates = await verify(state, deps.verifyCallbacks);
      const result = lastStructuredResult(state);

      deps.emitAgentEvent({
        incidentId: state.incidentId,
        node: "verify",
        decision: "verification_scheduled",
        reason: `Verification call scheduled at T+${(result?.eta_minutes ?? 60) + 5}min.`,
        traceId: state.traceId,
      });

      return updates;
    })

    // ── Node: human_review ───────────────────────────────────────────────────
    .addNode("human_review", async (state) => {
      const updates = await humanReview(state, deps.humanReviewCallbacks);

      deps.emitAgentEvent({
        incidentId: state.incidentId,
        node: "human_review",
        decision: "parked",
        reason: `Parked for operator review. Confidence: ${lastConfidence(state)?.score ?? "N/A"}`,
        traceId: state.traceId,
      });

      return updates;
    })

    // ── Node: schedule_callback ──────────────────────────────────────────────
    .addNode("schedule_callback", async (state) => {
      const updates = await scheduleCallback(state, deps.scheduleCallbackCallbacks);
      const result = lastStructuredResult(state);

      deps.emitAgentEvent({
        incidentId: state.incidentId,
        node: "schedule_callback",
        decision: "callback_scheduled",
        reason: `Callback scheduled at ${result?.callback_requested_at ?? "requested time"}`,
        traceId: state.traceId,
      });

      return updates;
    })

    // ── Node: unresolved ─────────────────────────────────────────────────────
    .addNode("unresolved", async (state) => {
      const updates = await unresolved(state, deps.unresolvedCallbacks);

      deps.emitAgentEvent({
        incidentId: state.incidentId,
        node: "unresolved",
        decision: "unresolved",
        reason: `Ladder exhausted after ${state.escalationRung} rung(s).`,
        traceId: state.traceId,
      });

      return updates;
    })

    // ── Edges ────────────────────────────────────────────────────────────────
    // Each edge reads `state.route`, written by the node that just ran, so the
    // branch taken is always the same value emitted to the audit log.

    .addEdge(START, "assess_incident")

    .addConditionalEdges(
      "assess_incident",
      (state) => (state.route === "suppress" ? "suppress" : "select_responder"),
      { suppress: END, select_responder: "select_responder" }
    )

    .addConditionalEdges(
      "select_responder",
      (state) => (state.currentResponder ? "plan_call" : "unresolved"),
      { plan_call: "plan_call", unresolved: "unresolved" }
    )

    .addEdge("plan_call", "execute_call")
    .addEdge("execute_call", "decide")

    .addConditionalEdges(
      "decide",
      (state) => state.route ?? "human_review",
      {
        resolve: "resolve",
        escalate: "escalate",
        human_review: "human_review",
        schedule_callback: "schedule_callback",
        verify: "verify",
      }
    )

    // The rung cap is decided inside escalate() and carried on ladderExhausted.
    // Never re-derive it from escalationRung here: after a successful advance
    // the rung already equals the value the next call should use.
    .addConditionalEdges(
      "escalate",
      (state) => (state.ladderExhausted ? "unresolved" : "select_responder"),
      { select_responder: "select_responder", unresolved: "unresolved" }
    )

    .addEdge("resolve", END)
    .addEdge("verify", END)
    .addEdge("human_review", END)
    .addEdge("schedule_callback", END)
    .addEdge("unresolved", END);

  return graph.compile();
}
