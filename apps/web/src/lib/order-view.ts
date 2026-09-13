/**
 * The order projection — the pure half of the realtime layer.
 *
 * Folds the `SentinelEvent` stream into the view state every panel of the order
 * screen renders from. Deliberately free of React and of any I/O: given the
 * same ordered events it always produces the same view, so a whole order can be
 * replayed from its event log and asserted against without a browser.
 *
 * Timeline node names follow the agent graph in PRD v2.0 §10.1.
 * The hook that drives this lives in `hooks/useOrderStream.ts`.
 */

import type { SentinelEvent } from "@/lib/contracts/events";
import type {
  AgentEvent,
  ApprovalRequest,
  CallState,
  Confidence,
  Contact,
  FollowUp,
  LadderRung,
  OrderStatus,
  TranscriptTurn,
  TriggerType,
  Urgency,
  WholesaleResult,
} from "@/lib/contracts/domain";
import { HUMAN_REVIEW_THRESHOLD } from "@/lib/contracts/domain";

export interface CallPlan {
  summary: string;
  mustAsk: string[];
  rung: number;
}

export interface ExtractedResult {
  structured: WholesaleResult;
  confidence: Confidence;
  evidence: string[];
}

export interface OrderUpdate {
  status: OrderStatus;
  confirmedQuantity: number | null;
  remainingQuantity: number | null;
  /** The agreed unit price, when this update changed it. */
  unitPrice: number | null;
  summary: string;
  operatorMinutesSaved: number | null;
}

export interface OrderView {
  trigger: { type: TriggerType; summary: string; ts: string } | null;
  urgency: Urgency | null;
  requiredBy: string | null;
  status: OrderStatus | null;
  suppression: { reason: string; duplicateOf?: string } | null;
  contact: Contact | null;
  rung: number;
  ladder: LadderRung[];
  plan: CallPlan | null;
  callId: string | null;
  callState: CallState | null;
  /** Epoch ms at which the current call connected — drives the call timer. */
  connectedAt: number | null;
  /** Epoch ms at which the conversation ended, so a finished call keeps its duration. */
  endedAt: number | null;
  turns: TranscriptTurn[];
  result: ExtractedResult | null;
  approval: ApprovalRequest | null;
  followUps: FollowUp[];
  update: OrderUpdate | null;
  unresolved: { reason: string } | null;
  timeline: AgentEvent[];
  /** Frames that failed Zod validation. Surfaced honestly in the UI. */
  dropped: number;
}

export const EMPTY_VIEW: OrderView = {
  trigger: null,
  urgency: null,
  requiredBy: null,
  status: null,
  suppression: null,
  contact: null,
  rung: 1,
  ladder: [],
  plan: null,
  callId: null,
  callState: null,
  connectedAt: null,
  endedAt: null,
  turns: [],
  result: null,
  approval: null,
  followUps: [],
  update: null,
  unresolved: null,
  timeline: [],
  dropped: 0,
};

export type OrderViewAction =
  | { kind: "event"; event: SentinelEvent }
  | { kind: "dropped" }
  | { kind: "ladder"; contacts: Contact[] }
  | { kind: "reset" };

/** Statuses after which nothing on this order is still in motion. */
export const TERMINAL_STATUSES: ReadonlySet<OrderStatus> = new Set([
  "CONFIRMED",
  "PARTIALLY_CONFIRMED",
  "CALLBACK_SCHEDULED",
  "HUMAN_REVIEW",
  "UNRESOLVED",
  "SUPPRESSED",
]);

const CALL_LABEL: Record<CallState, string> = {
  queued: "Call queued",
  dialling: "Dialling…",
  connected: "Connected",
  in_conversation: "In conversation",
  extracting: "Extracting result",
  completed: "Call completed",
  failed: "Call failed",
  no_answer: "No answer",
};

const UPDATE_LABEL: Record<OrderStatus, string> = {
  AWAITING_CONFIRMATION: "Awaiting confirmation",
  CALLING: "Calling",
  CONFIRMED: "Order confirmed",
  PARTIALLY_CONFIRMED: "Order partially confirmed",
  APPROVAL_REQUIRED: "Held for approval",
  CALLBACK_SCHEDULED: "Callback scheduled",
  HUMAN_REVIEW: "Sent to human review",
  UNRESOLVED: "Unresolved",
  SUPPRESSED: "Suppressed",
};

function stamp(): string {
  return new Date().toISOString();
}

function pushTimeline(
  timeline: AgentEvent[],
  entry: Omit<AgentEvent, "id" | "ts">,
): AgentEvent[] {
  const settled = timeline.map((e) => (e.state === "live" ? { ...e, state: "done" as const } : e));
  return [...settled, { ...entry, id: `${entry.node}-${timeline.length}`, ts: stamp() }];
}

function setRung(ladder: LadderRung[], rung: number, patch: Partial<LadderRung>): LadderRung[] {
  return ladder.map((r) => (r.rung === rung ? { ...r, ...patch } : r));
}

/**
 * Whether a result may stand as what the supplier committed to. Below the
 * review floor it is a claim for a person to check, whatever its fields say.
 */
export function isTrusted(result: ExtractedResult): boolean {
  return result.confidence.score >= HUMAN_REVIEW_THRESHOLD;
}

/** How the rung that just spoke should be marked, given what it said. */
function rungOutcome(result: WholesaleResult, confidence: Confidence): Pick<LadderRung, "state" | "detail"> {
  if (result.contact_reached === "voicemail") return { state: "no_answer", detail: "Voicemail" };
  if (result.contact_reached !== "yes") return { state: "declined", detail: "Not reached" };
  if (confidence.score < HUMAN_REVIEW_THRESHOLD) return { state: "deferred", detail: "Unclear · review" };
  if (result.next_action === "ESCALATE_NEXT_CONTACT") return { state: "declined", detail: "Declined" };
  if (result.next_action === "SCHEDULE_CALLBACK") return { state: "deferred", detail: "Callback" };
  if (result.confirmed_quantity != null) {
    return { state: "committed", detail: `${result.confirmed_quantity} confirmed` };
  }
  return { state: "committed", detail: "Answered" };
}

export function reduceOrderView(view: OrderView, action: OrderViewAction): OrderView {
  if (action.kind === "reset") return EMPTY_VIEW;
  if (action.kind === "dropped") return { ...view, dropped: view.dropped + 1 };
  if (action.kind === "ladder") {
    return {
      ...view,
      ladder: action.contacts.map((contact, i) => ({
        rung: i + 1,
        contact,
        state: "pending" as const,
      })),
    };
  }

  const event = action.event;

  switch (event.type) {
    case "event.received":
      return {
        ...view,
        trigger: { type: event.triggerType, summary: event.summary, ts: event.ts },
        timeline: pushTimeline(view.timeline, {
          node: "ingest",
          label: "Event received",
          detail: event.summary,
          state: "done",
        }),
      };

    case "order.opened":
      return {
        ...view,
        urgency: event.urgency,
        requiredBy: event.requiredBy,
        status: "AWAITING_CONFIRMATION",
        timeline: pushTimeline(view.timeline, {
          node: "assess_order",
          label: `Confirmation needed · ${event.urgency.toLowerCase()}`,
          detail: "Recorded stock is not a commitment — a person has to confirm it",
          state: "done",
        }),
      };

    case "order.suppressed":
      return {
        ...view,
        status: "SUPPRESSED",
        suppression: { reason: event.reason, duplicateOf: event.duplicateOf },
        timeline: pushTimeline(view.timeline, {
          node: "assess_order",
          label: "Suppressed — no call placed",
          detail: event.reason,
          state: "done",
        }),
      };

    case "contact.selected": {
      const ladder = view.ladder.length
        ? setRung(view.ladder, event.rung, { state: "active" })
        : [{ rung: event.rung, contact: event.contact, state: "active" as const }];
      return {
        ...view,
        status: "CALLING",
        contact: event.contact,
        rung: event.rung,
        ladder,
        timeline: pushTimeline(view.timeline, {
          node: "select_contact",
          label: `Contact: ${event.contact.name}`,
          detail: `Rung ${event.rung} · ${event.contact.role} · ${event.contact.region}`,
          state: "done",
        }),
      };
    }

    case "plan.composed":
      return {
        ...view,
        plan: { summary: event.summary, mustAsk: event.mustAsk, rung: view.rung },
        timeline: pushTimeline(view.timeline, {
          node: "plan_call",
          label: "Call plan composed",
          detail: `${event.mustAsk.length} questions · rung ${view.rung}`,
          state: "done",
        }),
      };

    case "call.state": {
      const isLive = event.state === "dialling" || event.state === "in_conversation";
      const failed = event.state === "failed" || event.state === "no_answer";
      const redial = event.state === "queued" || event.state === "dialling";
      const talking = event.state === "connected" || event.state === "in_conversation";
      // The event's own time when the backend sends one, so a replay keeps real durations.
      const at = event.ts ? Date.parse(event.ts) : Date.now();
      return {
        ...view,
        callId: event.callId,
        callState: event.state,
        connectedAt: event.state === "connected" ? at : redial ? null : view.connectedAt,
        endedAt: redial || talking ? null : (view.endedAt ?? at),
        // The result panel describes the current call, so a new dial clears it.
        // The transcript is kept: across an escalation it is the audit trail.
        result: event.state === "dialling" ? null : view.result,
        ladder: failed
          ? setRung(view.ladder, view.rung, { state: "no_answer", detail: "No answer" })
          : view.ladder,
        timeline: pushTimeline(view.timeline, {
          node: "execute_call",
          label: CALL_LABEL[event.state],
          detail: event.callId,
          state: failed ? "failed" : isLive ? "live" : "done",
        }),
      };
    }

    case "transcript.delta": {
      const turns = [...view.turns];
      const last = turns[turns.length - 1];
      if (last && last.speaker === event.speaker && last.ts === event.ts) {
        turns[turns.length - 1] = { ...last, text: last.text + event.text };
      } else {
        turns.push({
          id: `${event.speaker}-${event.ts}`,
          speaker: event.speaker,
          text: event.text,
          ts: event.ts,
        });
      }
      return { ...view, turns };
    }

    case "result.extracted":
      return {
        ...view,
        result: {
          structured: event.structured,
          confidence: event.confidence,
          evidence: event.evidence,
        },
        ladder: setRung(view.ladder, view.rung, rungOutcome(event.structured, event.confidence)),
        timeline: pushTimeline(view.timeline, {
          node: "decide",
          label: `Result · ${event.confidence.label} ${event.confidence.score.toFixed(2)}`,
          detail: event.structured.next_action,
          state: "done",
        }),
      };

    case "order.escalated":
      return {
        ...view,
        rung: event.toRung,
        timeline: pushTimeline(view.timeline, {
          node: "escalate",
          label: `Escalated → rung ${event.toRung}`,
          detail: event.reason,
          state: "done",
        }),
      };

    case "approval.required":
      return {
        ...view,
        status: "APPROVAL_REQUIRED",
        approval: {
          reason: event.reason,
          previousUnitPrice: event.previousUnitPrice,
          proposedUnitPrice: event.proposedUnitPrice,
          currency: event.currency,
        },
        timeline: pushTimeline(view.timeline, {
          node: "human_review",
          label: "Approval required",
          detail: event.reason,
          state: "live",
        }),
      };

    case "followup.scheduled":
      return {
        ...view,
        followUps: [...view.followUps.filter((f) => f.id !== event.followUp.id), event.followUp],
        timeline: pushTimeline(view.timeline, {
          node: "verify",
          label: "Follow-up scheduled",
          detail: event.followUp.note,
          state: "done",
        }),
      };

    case "order.updated":
      return {
        ...view,
        status: event.status,
        // An approval is settled the moment the order moves on from it.
        approval: event.status === "APPROVAL_REQUIRED" ? view.approval : null,
        update: {
          status: event.status,
          confirmedQuantity: event.confirmedQuantity,
          remainingQuantity: event.remainingQuantity,
          unitPrice: event.unitPrice ?? view.update?.unitPrice ?? null,
          summary: event.summary,
          operatorMinutesSaved: event.operatorMinutesSaved,
        },
        timeline: pushTimeline(view.timeline, {
          node: event.status === "HUMAN_REVIEW" ? "human_review" : "confirm",
          label: UPDATE_LABEL[event.status],
          detail: event.summary,
          state: "done",
        }),
      };

    case "order.unresolved":
      return {
        ...view,
        status: "UNRESOLVED",
        unresolved: { reason: event.reason },
        timeline: pushTimeline(view.timeline, {
          node: "escalate",
          label: "Unresolved — a person must take this",
          detail: event.reason,
          state: "failed",
        }),
      };

    default:
      return view;
  }
}
