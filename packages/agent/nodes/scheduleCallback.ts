/**
 * packages/agent/nodes/scheduleCallback.ts
 * Node: schedule_callback
 * Owner: Aryan
 *
 * Responder asked to be called back at a specific time.
 * Schedules a BullMQ retry job via Sameer's queue.
 *
 * For CRITICAL severity: also starts a parallel rung (FR-7.5).
 */

import type { EscalationState } from "../state";
import { lastStructuredResult } from "../state";

export interface ScheduleCallbackCallbacks {
  scheduleCallbackJob: (params: {
    incidentId: string;
    traceId: string;
    responderId: string;
    callbackAt: string; // ISO-8601
    escalationRung: number;
  }) => Promise<void>;
  triggerParallelRung?: (incidentId: string) => Promise<void>;
  emitSSE: (incidentId: string, callbackAt: string) => void;
}

export async function scheduleCallback(
  state: EscalationState,
  callbacks: ScheduleCallbackCallbacks
): Promise<Partial<EscalationState>> {
  const result = lastStructuredResult(state);

  // Fall back to 30 minutes from now if no time was extracted
  const callbackAt =
    result?.callback_requested_at ??
    new Date(Date.now() + 30 * 60 * 1000).toISOString();

  await callbacks.scheduleCallbackJob({
    incidentId: state.incidentId,
    traceId: state.traceId,
    responderId: state.currentResponder?.id ?? "",
    callbackAt,
    escalationRung: state.escalationRung,
  });

  // For CRITICAL incidents, also start a parallel rung immediately
  // so we don't just wait — we try the next responder too (FR-7.5)
  if (state.severity === "CRITICAL" && callbacks.triggerParallelRung) {
    await callbacks.triggerParallelRung(state.incidentId);
  }

  callbacks.emitSSE(state.incidentId, callbackAt);

  return {};
}
