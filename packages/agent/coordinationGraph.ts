/**
 * packages/agent/coordinationGraph.ts
 * LangGraph wholesale coordination agent — main graph definition.
 * Owner: Aryan
 *
 * Graph topology:
 *
 *   select_contact ──────────────┐
 *        │         └──────────────╫──► human_review  (off-hours, no product
 *        │                        │                   match, cooldown — all
 *    plan_call                    │ (nobody left      true at every rung, so
 *        │                        │  to try)          climbing would not help)
 *   execute_call ──► CALL-E SDK (real phone call)
 *        │                       │
 *     decide                     │
 *   ┌────┼────────┬──────────┬───┴──────────────┐
 * confirm partial │      escalate ──► select_contact (loop)
 *   │      │      │          │
 *  END    END     │   [ladder exhausted] → unresolved → END
 *                 │
 *   ┌─────────────┴──────────────┐
 * human_review  schedule_callback  request_approval
 *   │                 │                  │
 *  END               END                END
 *
 * Every node emits an SSE event and an agent_events row via callbacks, each
 * carrying the order's `traceId` (Rule 7).
 *
 * State channels use Annotation.Root — each field is a last-value channel, so a
 * node's returned update replaces the previous value. Do NOT hand-roll
 * `{ value: (x) => x }` reducers: LangGraph invokes a channel reducer as
 * `reducer(current, incoming)`, so a single-argument identity silently discards
 * every update after the first.
 */

import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import type { CoordinationState, CoordinationCallRecord } from "./coordinationState";
import { lastWholesaleResult, lastCoordinationConfidence } from "./coordinationState";
import { selectContactWithReason } from "./nodes/selectContact";
import {
  executeCoordinationCall,
  type PersistCoordinationCallFn,
} from "./nodes/executeCoordinationCall";
import {
  decideCoordination,
  explainCoordinationDecision,
} from "./nodes/decideCoordination";
import { buildWholesaleTaskPrompt } from "../calle/wholesale";
import type {
  Order,
  Contact,
  Confidence,
  WholesaleResult,
  Urgency,
  CallState,
  Speaker,
} from "../types/wholesale";

// ─── State channels ───────────────────────────────────────────────────────────
// One channel per CoordinationState field. Bare `Annotation<T>` = last value wins.

export const CoordinationAnnotation = Annotation.Root({
  orderId: Annotation<string>,
  traceId: Annotation<string>,
  order: Annotation<Order>,
  urgency: Annotation<Urgency>,
  rung: Annotation<number>,
  maxRungs: Annotation<number>,
  attemptedContacts: Annotation<string[]>,
  currentContact: Annotation<Contact | null>,
  callHistory: Annotation<CoordinationCallRecord[]>,
  structuredResults: Annotation<WholesaleResult[]>,
  confidenceHistory: Annotation<Confidence[]>,
  finalOutcome: Annotation<string | null>,
  requiresHumanReview: Annotation<boolean>,
  approvalRequired: Annotation<boolean>,
  suppressReason: Annotation<string | null>,
  callError: Annotation<string | null>,
  ladderExhausted: Annotation<boolean>,
  route: Annotation<string | null>,
});

// Compile-time guard: the annotation and CoordinationState must not drift.
type AnnotationState = typeof CoordinationAnnotation.State;
type AssertExtends<A extends B, B> = true;
export type _CoordinationStateMatchesAnnotation = AssertExtends<
  AnnotationState,
  CoordinationState
> &
  AssertExtends<CoordinationState, AnnotationState>;

// ─── Graph dependencies (injected by the backend) ────────────────────────────
// The agent never touches the DB or SSE directly. All side effects are
// callbacks — this keeps the graph pure and replayable.

export interface CoordinationDependencies {
  /** The consented contact directory for the seller organisation. */
  getDirectory: (sellerOrgId: string) => Promise<Contact[]>;

  /** Persistence — the backend owns every write. */
  persistCall: PersistCoordinationCallFn;

  /** Terminal-state callbacks. Each one closes or parks the order. */
  onConfirmed: (params: {
    orderId: string;
    traceId: string;
    result: WholesaleResult;
    minutesSaved: number;
  }) => Promise<void>;
  onPartial: (params: {
    orderId: string;
    traceId: string;
    result: WholesaleResult;
  }) => Promise<void>;
  onApprovalRequired: (params: {
    orderId: string;
    traceId: string;
    result: WholesaleResult;
  }) => Promise<void>;
  onCallbackScheduled: (params: {
    orderId: string;
    traceId: string;
    dueAt: string;
    contactId: string;
  }) => Promise<void>;
  onHumanReview: (params: {
    orderId: string;
    traceId: string;
    reason: string;
  }) => Promise<void>;
  onUnresolved: (params: {
    orderId: string;
    traceId: string;
    reason: string;
  }) => Promise<void>;

  /** Audit trail — one row per node, all carrying traceId. */
  emitAgentEvent: (params: {
    orderId: string;
    node: string;
    decision: string;
    reason: string;
    traceId: string;
  }) => void;

  emitContactSelected?: (params: {
    orderId: string;
    contact: Contact;
    rung: number;
    traceId: string;
  }) => void;

  emitPlanComposed?: (params: {
    orderId: string;
    summary: string;
    mustAsk: string[];
    traceId: string;
  }) => void;

  /** FR-5.2 — live call lifecycle, drives the call theatre visuals. */
  emitCallState?: (params: {
    orderId: string;
    callId: string;
    state: CallState;
    traceId: string;
  }) => void;

  /** FR-5.2 — transcript turns as CALL-E reports them. */
  emitTranscriptDelta?: (params: {
    orderId: string;
    speaker: Speaker;
    text: string;
    ts: string;
    traceId: string;
  }) => void;

  /** When the order was raised — used to compute operator minutes saved. */
  orderOpenedAt: Date;

  /**
   * FR-10.5 — the global kill switch. Checked immediately before every dial.
   *
   * If this is not supplied the agent FAILS CLOSED and refuses to call: a
   * missing kill switch is a broken kill switch, and SAFETY.md promises this
   * check exists.
   */
  isKillSwitchActive?: () => Promise<boolean>;

  /**
   * FR-7.3 — hard ceiling on total calls per order, independent of the rung
   * cap. Enforced in code so no prompt or model output can raise it.
   */
  maxCallsPerOrder?: number;

  /** FR-5.4 — hard ceiling on any single call's duration. */
  callTimeoutMs?: number;

  /** Dev harness only. CLAUDE.md Rule 1 keeps this false everywhere it counts. */
  useMock?: boolean;
}

/** PRD §4.1 — default max 5 calls per order. */
export const DEFAULT_MAX_CALLS_PER_ORDER = 5;

/**
 * Minutes a person would have spent working this order by phone themselves.
 * Deliberately conservative: one dial, one conversation, one write-up per rung.
 */
function estimateMinutesSaved(state: CoordinationState): number {
  const MINUTES_PER_CALL_ATTEMPT = 7;
  return Math.max(1, state.callHistory.length * MINUTES_PER_CALL_ATTEMPT);
}

export function buildCoordinationGraph(deps: CoordinationDependencies) {
  const graph = new StateGraph(CoordinationAnnotation)

    // ── Node: select_contact ─────────────────────────────────────────────────
    .addNode("select_contact", async (state) => {
      const directory = await deps.getDirectory(state.order.seller.id);
      const { contact, reason, detail } = selectContactWithReason(state, directory);

      if (!contact) {
        deps.emitAgentEvent({
          orderId: state.orderId,
          node: "select_contact",
          decision: reason ?? "no_contact_available",
          reason: detail,
          traceId: state.traceId,
        });

        // Walking the rungs only helps when the NEXT rung might be different.
        // Nobody being on shift, or nobody handling the product, is true of
        // every rung — climbing the ladder would just repeat the same rejection
        // and report it as an exhausted ladder, which is not what happened.
        const sameAtEveryRung =
          reason === "outside_working_hours" ||
          reason === "no_product_match" ||
          reason === "none_at_seller" ||
          reason === "in_cooldown";

        if (sameAtEveryRung) {
          return { route: "human_review", currentContact: null, callError: detail };
        }

        return { route: "escalate", currentContact: null };
      }

      deps.emitAgentEvent({
        orderId: state.orderId,
        node: "select_contact",
        decision: `rung_${state.rung}`,
        reason: `Selected ${contact.name} (${contact.role}) at rung ${state.rung}.`,
        traceId: state.traceId,
      });

      deps.emitContactSelected?.({
        orderId: state.orderId,
        contact,
        rung: state.rung,
        traceId: state.traceId,
      });

      return { currentContact: contact, route: "plan_call" };
    })

    // ── Node: plan_call ──────────────────────────────────────────────────────
    // Composes the task prompt for THIS contact at THIS rung. A static prompt
    // is a robocall (CLAUDE.md §6.4) — the prompt is rebuilt every call.
    .addNode("plan_call", async (state) => {
      const contact = state.currentContact!;

      const summary =
        `Call ${contact.name} at ${state.order.seller.name} to confirm ` +
        `${state.order.item.requestedQuantity} ${state.order.item.unit} of ` +
        `${state.order.item.description} for order ${state.order.reference}.`;

      const mustAsk = [
        "How many units are available now?",
        "What quantity can be dispatched, and on what date?",
        "If partial, when is the remainder available?",
        "Has the unit price changed?",
      ];

      deps.emitAgentEvent({
        orderId: state.orderId,
        node: "plan_call",
        decision: "plan_ready",
        reason: summary,
        traceId: state.traceId,
      });

      deps.emitPlanComposed?.({
        orderId: state.orderId,
        summary,
        mustAsk,
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
          orderId: state.orderId,
          node: "execute_call",
          decision: "kill_switch_active",
          reason,
          traceId: state.traceId,
        });

        return { callError: reason };
      }

      // FR-7.3 — call cap, enforced before dialling. Separate from the rung
      // cap: callbacks and retries burn calls without advancing a rung.
      const maxCalls = deps.maxCallsPerOrder ?? DEFAULT_MAX_CALLS_PER_ORDER;
      if (state.callHistory.length >= maxCalls) {
        const reason =
          `Call cap reached (${state.callHistory.length}/${maxCalls}) for order ` +
          `${state.orderId} — refusing to dial again.`;

        deps.emitAgentEvent({
          orderId: state.orderId,
          node: "execute_call",
          decision: "call_cap_reached",
          reason,
          traceId: state.traceId,
        });

        return { callError: reason };
      }

      try {
        const startedAt = new Date().toISOString();

        const { callId, result } = await executeCoordinationCall(
          state,
          deps.persistCall,
          {
            useMock: deps.useMock,
            timeoutMs: deps.callTimeoutMs,
            hooks: {
              onState: (callState, calleCallId) =>
                deps.emitCallState?.({
                  orderId: state.orderId,
                  callId: calleCallId,
                  state: callState as CallState,
                  traceId: state.traceId,
                }),
              onTranscript: (turn) =>
                deps.emitTranscriptDelta?.({
                  orderId: state.orderId,
                  speaker: turn.speaker,
                  text: turn.text,
                  ts: new Date().toISOString(),
                  traceId: state.traceId,
                }),
            },
          }
        );

        const structuredResult =
          (result.structuredResult as WholesaleResult | null) ?? null;
        const confidence = result.completionConfidence ?? { score: 0, label: "none" };

        deps.emitAgentEvent({
          orderId: state.orderId,
          node: "execute_call",
          decision: result.status,
          reason: `taskCompleted=${result.taskCompleted}, confidence=${confidence.score}`,
          traceId: state.traceId,
        });

        return {
          structuredResults: structuredResult
            ? [...state.structuredResults, structuredResult]
            : state.structuredResults,
          confidenceHistory: [...state.confidenceHistory, confidence],
          transcript: result.transcript ? result.transcript.map((t) => ({ speaker: t.speaker, text: t.text })) : [],
          callHistory: [
            ...state.callHistory,
            {
              callId,
              contactId: state.currentContact!.id,
              rung: state.rung,
              status: result.status,
              startedAt,
              endedAt: new Date().toISOString(),
            },
          ],
          attemptedContacts: [...state.attemptedContacts, state.currentContact!.id],
          callError: null,
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);

        deps.emitAgentEvent({
          orderId: state.orderId,
          node: "execute_call",
          decision: "call_error",
          reason: errorMsg,
          traceId: state.traceId,
        });

        // The contact still counts as attempted — a consent or dial failure
        // must not put us in a loop redialling the same person.
        return {
          callError: errorMsg,
          attemptedContacts: state.currentContact
            ? [...state.attemptedContacts, state.currentContact.id]
            : state.attemptedContacts,
        };
      }
    })

    // ── Node: decide ─────────────────────────────────────────────────────────
    .addNode("decide", async (state) => {
      // If execute_call failed outright, route to human review (F10).
      if (state.callError) {
        deps.emitAgentEvent({
          orderId: state.orderId,
          node: "decide",
          decision: "human_review",
          reason: `Call error: ${state.callError}`,
          traceId: state.traceId,
        });
        return { requiresHumanReview: true, route: "human_review" };
      }

      const decision = decideCoordination(state);
      const reason = explainCoordinationDecision(state, decision);

      deps.emitAgentEvent({
        orderId: state.orderId,
        node: "decide",
        decision,
        reason,
        traceId: state.traceId,
      });

      return {
        requiresHumanReview: decision === "human_review",
        approvalRequired: decision === "request_approval",
        route: decision,
      };
    })

    // ── Node: escalate ───────────────────────────────────────────────────────
    .addNode("escalate", async (state) => {
      const exhausted = state.rung >= state.maxRungs;

      deps.emitAgentEvent({
        orderId: state.orderId,
        node: "escalate",
        decision: exhausted ? "ladder_exhausted" : `rung_${state.rung}_to_${state.rung + 1}`,
        reason: exhausted
          ? `Rung cap reached (${state.rung}/${state.maxRungs}) — routing to unresolved.`
          : `Advancing from rung ${state.rung} to ${state.rung + 1}.`,
        traceId: state.traceId,
      });

      if (exhausted) {
        return { ladderExhausted: true, route: "unresolved" };
      }

      return {
        rung: state.rung + 1,
        currentContact: null,
        callError: null,
        ladderExhausted: false,
        route: "select_contact",
      };
    })

    // ── Terminal: confirm ────────────────────────────────────────────────────
    .addNode("confirm", async (state) => {
      const result = lastWholesaleResult(state)!;
      const minutesSaved = estimateMinutesSaved(state);

      await deps.onConfirmed({
        orderId: state.orderId,
        traceId: state.traceId,
        result,
        minutesSaved,
      });

      deps.emitAgentEvent({
        orderId: state.orderId,
        node: "confirm",
        decision: "confirmed",
        reason:
          `Order confirmed${result.dispatch_date ? `, dispatching ${result.dispatch_date}` : ""}. ` +
          `Operator minutes saved: ${minutesSaved}.`,
        traceId: state.traceId,
      });

      return { finalOutcome: "CONFIRMED" };
    })

    // ── Terminal: partial ────────────────────────────────────────────────────
    .addNode("partial", async (state) => {
      const result = lastWholesaleResult(state)!;

      await deps.onPartial({
        orderId: state.orderId,
        traceId: state.traceId,
        result,
      });

      deps.emitAgentEvent({
        orderId: state.orderId,
        node: "partial",
        decision: "partially_confirmed",
        reason:
          `${result.confirmed_quantity ?? "Some"} units confirmed, ` +
          `${result.remaining_quantity ?? "the balance"} outstanding.`,
        traceId: state.traceId,
      });

      return { finalOutcome: "PARTIALLY_CONFIRMED" };
    })

    // ── Terminal: request_approval ───────────────────────────────────────────
    // FR-5.3 — the agent heard a commercial change it may not accept.
    .addNode("request_approval", async (state) => {
      const result = lastWholesaleResult(state)!;

      await deps.onApprovalRequired({
        orderId: state.orderId,
        traceId: state.traceId,
        result,
      });

      deps.emitAgentEvent({
        orderId: state.orderId,
        node: "request_approval",
        decision: "approval_required",
        reason: explainCoordinationDecision(state, "request_approval"),
        traceId: state.traceId,
      });

      return { finalOutcome: "APPROVAL_REQUIRED", approvalRequired: true };
    })

    // ── Terminal: schedule_callback ──────────────────────────────────────────
    .addNode("schedule_callback", async (state) => {
      const result = lastWholesaleResult(state)!;
      const dueAt = result.callback_requested_at ?? defaultCallbackTime();

      await deps.onCallbackScheduled({
        orderId: state.orderId,
        traceId: state.traceId,
        dueAt,
        contactId: state.currentContact?.id ?? "",
      });

      deps.emitAgentEvent({
        orderId: state.orderId,
        node: "schedule_callback",
        decision: "callback_scheduled",
        reason: `Callback scheduled for ${dueAt}.`,
        traceId: state.traceId,
      });

      return { finalOutcome: "CALLBACK_SCHEDULED" };
    })

    // ── Terminal: human_review ───────────────────────────────────────────────
    .addNode("human_review", async (state) => {
      const confidence = lastCoordinationConfidence(state);
      const reason =
        state.callError ??
        (confidence
          ? `Extraction confidence ${Math.round(confidence.score * 100)}% — a person must confirm.`
          : "No usable result was extracted from the call.");

      await deps.onHumanReview({
        orderId: state.orderId,
        traceId: state.traceId,
        reason,
      });

      deps.emitAgentEvent({
        orderId: state.orderId,
        node: "human_review",
        decision: "parked_for_operator",
        reason,
        traceId: state.traceId,
      });

      return { finalOutcome: "HUMAN_REVIEW", requiresHumanReview: true };
    })

    // ── Terminal: unresolved ─────────────────────────────────────────────────
    .addNode("unresolved", async (state) => {
      const reason =
        `Contact ladder exhausted for order ${state.order.reference} after ` +
        `${state.callHistory.length} call(s) across ${state.rung} rung(s).`;

      await deps.onUnresolved({
        orderId: state.orderId,
        traceId: state.traceId,
        reason,
      });

      deps.emitAgentEvent({
        orderId: state.orderId,
        node: "unresolved",
        decision: "unresolved",
        reason,
        traceId: state.traceId,
      });

      return { finalOutcome: "UNRESOLVED", ladderExhausted: true };
    });

  // ── Edges ──────────────────────────────────────────────────────────────────

  graph.addEdge(START, "select_contact" as never);

  graph.addConditionalEdges(
    "select_contact" as never,
    (state: CoordinationState) => {
      if (state.route === "escalate") return "escalate";
      if (state.route === "human_review") return "human_review";
      return "plan_call";
    },
    {
      plan_call: "plan_call",
      escalate: "escalate",
      human_review: "human_review",
    } as never
  );

  graph.addEdge("plan_call" as never, "execute_call" as never);
  graph.addEdge("execute_call" as never, "decide" as never);

  graph.addConditionalEdges(
    "decide" as never,
    (state: CoordinationState) => state.route ?? "human_review",
    {
      confirm: "confirm",
      partial: "partial",
      escalate: "escalate",
      human_review: "human_review",
      schedule_callback: "schedule_callback",
      request_approval: "request_approval",
    } as never
  );

  // The loop: escalate either dials the next rung or gives up loudly.
  graph.addConditionalEdges(
    "escalate" as never,
    (state: CoordinationState) =>
      state.route === "unresolved" ? "unresolved" : "select_contact",
    { select_contact: "select_contact", unresolved: "unresolved" } as never
  );

  graph.addEdge("confirm" as never, END);
  graph.addEdge("partial" as never, END);
  graph.addEdge("request_approval" as never, END);
  graph.addEdge("schedule_callback" as never, END);
  graph.addEdge("human_review" as never, END);
  graph.addEdge("unresolved" as never, END);

  return graph.compile();
}

/** A callback with no stated time is retried in an hour, not abandoned. */
function defaultCallbackTime(): string {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString();
}
