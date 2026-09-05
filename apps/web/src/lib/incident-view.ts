/**
 * The incident projection — the pure half of the realtime layer.
 *
 * Folds the frozen `SentinelEvent` union (CLAUDE.md §8.3) into the view state
 * every panel of the Live Call Theatre renders from. Deliberately free of React
 * and of any I/O: given the same ordered events it always produces the same
 * view, so a whole incident can be replayed from its event log and asserted
 * against without a browser.
 *
 * The hook that drives it lives in `hooks/useIncidentStream.ts`.
 */

import type { SentinelEvent } from "@/lib/contracts/events";
import type {
  AgentEvent,
  CallState,
  Confidence,
  Incident,
  LadderRung,
  Responder,
  TranscriptTurn,
} from "@/lib/contracts/domain";

export interface TelemetryPoint {
  value: number;
  ts: string;
}

export interface CallPlan {
  summary: string;
  mustAsk: string[];
  rung: number;
}

export interface ExtractedResult {
  structured: Record<string, unknown>;
  confidence: Confidence;
  evidence: string[];
}

export interface IncidentView {
  telemetry: TelemetryPoint[];
  severity: Incident["severity"] | null;
  safeWindowMinutes: number | null;
  suppression: { assetId: string; reason: string } | null;
  responder: Responder | null;
  rung: number;
  ladder: LadderRung[];
  plan: CallPlan | null;
  callId: string | null;
  callState: CallState | null;
  /** Epoch ms at which the current call connected — drives the call timer. */
  connectedAt: number | null;
  turns: TranscriptTurn[];
  result: ExtractedResult | null;
  resolved: { outcome: string; timeSavedMinutes: number } | null;
  unresolved: { reason: string } | null;
  timeline: AgentEvent[];
  /** Frames that failed Zod validation. Surfaced honestly in the UI. */
  dropped: number;
}

export const EMPTY_VIEW: IncidentView = {
  telemetry: [],
  severity: null,
  safeWindowMinutes: null,
  suppression: null,
  responder: null,
  rung: 1,
  ladder: [],
  plan: null,
  callId: null,
  callState: null,
  connectedAt: null,
  turns: [],
  result: null,
  resolved: null,
  unresolved: null,
  timeline: [],
  dropped: 0,
};

export type IncidentViewAction =
  | { kind: "event"; event: SentinelEvent }
  | { kind: "dropped" }
  | { kind: "ladder"; responders: Responder[] }
  | { kind: "reset" };

function stamp(): string {
  return new Date().toISOString();
}

function pushTimeline(timeline: AgentEvent[], entry: Omit<AgentEvent, "id" | "ts">): AgentEvent[] {
  const settled = timeline.map((e) => (e.state === "live" ? { ...e, state: "done" as const } : e));
  return [
    ...settled,
    { ...entry, id: `${entry.node}-${timeline.length}`, ts: stamp() },
  ];
}

function setRung(ladder: LadderRung[], rung: number, patch: Partial<LadderRung>): LadderRung[] {
  return ladder.map((r) => (r.rung === rung ? { ...r, ...patch } : r));
}

export function reduceIncidentView(
  view: IncidentView,
  action: IncidentViewAction,
): IncidentView {
  if (action.kind === "reset") return EMPTY_VIEW;
  if (action.kind === "dropped") return { ...view, dropped: view.dropped + 1 };
  if (action.kind === "ladder") {
    return {
      ...view,
      ladder: action.responders.map((responder, i) => ({
        rung: i + 1,
        responder,
        state: "pending" as const,
      })),
    };
  }

  const event = action.event;

  switch (event.type) {
    case "signal.received":
      return {
        ...view,
        telemetry: [...view.telemetry, { value: event.value, ts: event.ts }],
        timeline:
          view.timeline.length === 0
            ? pushTimeline(view.timeline, {
                node: "ingest",
                label: "Signal received",
                detail: "MQTT · sentinel/northgate telemetry",
                state: "done",
              })
            : view.timeline,
      };

    case "incident.opened":
      return {
        ...view,
        severity: event.severity,
        safeWindowMinutes: event.safeWindowMinutes,
        timeline: pushTimeline(
          pushTimeline(view.timeline, {
            node: "correlate",
            label: `Correlated ${Math.max(view.telemetry.length, 1)} readings`,
            detail: "Sustained excursion — not a transient",
            state: "done",
          }),
          {
            node: "assess",
            label: `Severity: ${event.severity}`,
            detail: `${event.safeWindowMinutes} min safe window`,
            state: "done",
          },
        ),
      };

    case "incident.suppressed":
      return {
        ...view,
        suppression: { assetId: event.assetId, reason: event.reason },
        timeline: pushTimeline(view.timeline, {
          node: "suppress",
          label: "Suppressed — no call placed",
          detail: event.reason,
          state: "done",
        }),
      };

    case "responder.selected": {
      const ladder = view.ladder.length
        ? setRung(view.ladder, event.rung, { state: "active" })
        : [{ rung: event.rung, responder: event.responder, state: "active" as const }];
      return {
        ...view,
        responder: event.responder,
        rung: event.rung,
        ladder,
        timeline: pushTimeline(view.timeline, {
          node: "select_responder",
          label: `Responder: ${event.responder.name}`,
          detail: `Rung ${event.rung} · ${event.responder.role} · zone ${event.responder.zone}`,
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
          detail: `${event.mustAsk.length} must-ask questions · rung ${view.rung} urgency`,
          state: "done",
        }),
      };

    case "call.state": {
      const label: Record<CallState, string> = {
        queued: "Call queued",
        dialling: "Dialling…",
        connected: "Connected",
        in_conversation: "In conversation",
        extracting: "Extracting result",
        completed: "Call completed",
        failed: "Call failed",
        no_answer: "No answer",
      };
      const isLive = event.state === "dialling" || event.state === "in_conversation";
      const failed = event.state === "failed" || event.state === "no_answer";

      let ladder = view.ladder;
      if (failed) ladder = setRung(ladder, view.rung, { state: "no_answer", detail: "No answer" });

      return {
        ...view,
        callId: event.callId,
        callState: event.state,
        connectedAt:
          event.state === "connected" ? Date.now() : event.state === "queued" ? null : view.connectedAt,
        ladder,
        timeline: pushTimeline(view.timeline, {
          node: "execute_call",
          label: label[event.state],
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

    case "result.extracted": {
      const evidenceSet = new Set(event.evidence.map((e) => e.trim()));
      return {
        ...view,
        result: {
          structured: event.structured,
          confidence: event.confidence,
          evidence: event.evidence,
        },
        turns: view.turns.map((t) => ({ ...t, evidence: evidenceSet.has(t.text.trim()) })),
        ladder:
          event.structured.responder_available === "no"
            ? setRung(view.ladder, view.rung, {
                state: "declined",
                detail: String(event.structured.decline_reason ?? "declined").replace(/_/g, " "),
              })
            : setRung(view.ladder, view.rung, {
                state: "committed",
                detail:
                  event.structured.eta_minutes != null
                    ? `ETA ${event.structured.eta_minutes} min`
                    : undefined,
              }),
        timeline: pushTimeline(view.timeline, {
          node: "decide",
          label: `Result extracted · ${event.confidence.label} ${event.confidence.score.toFixed(2)}`,
          detail: String(event.structured.next_action ?? ""),
          state: "done",
        }),
      };
    }

    case "incident.escalated":
      return {
        ...view,
        rung: event.toRung,
        timeline: pushTimeline(view.timeline, {
          node: "escalate",
          label: `Escalated → rung ${event.toRung}`,
          detail: `Rung ${event.fromRung} did not produce a commitment`,
          state: "done",
        }),
      };

    case "incident.resolved":
      return {
        ...view,
        resolved: { outcome: event.outcome, timeSavedMinutes: event.timeSavedMinutes },
        timeline: pushTimeline(view.timeline, {
          node: "resolve",
          label: "Incident closed",
          detail: event.outcome,
          state: "done",
        }),
      };

    case "incident.unresolved":
      return {
        ...view,
        unresolved: { reason: event.reason },
        timeline: pushTimeline(view.timeline, {
          node: "unresolved",
          label: "UNRESOLVED — human intervention required",
          detail: event.reason,
          state: "failed",
        }),
      };

    default:
      return view;
  }
}

