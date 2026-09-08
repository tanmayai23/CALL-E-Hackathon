/**
 * packages/agent/nodes/unresolved.ts
 * Node: unresolved
 * Owner: Aryan
 *
 * Ladder exhausted — no responder committed after maxRungs attempts.
 * Raises a loud human alert. Exits to: END.
 *
 * This is the worst-case terminal state. The facility manager
 * must be alerted immediately regardless of quiet hours (CRITICAL override).
 */

import type { EscalationState } from "../state";
import type { Outcome } from "../../types";

export type UnresolvedCallbacks = {
  persistOutcome: (outcome: Outcome) => Promise<void>;
  alertFacilityManager: (incidentId: string, reason: string) => Promise<void>;
  emitSSE: (incidentId: string, reason: string) => void;
};

export async function unresolved(
  state: EscalationState,
  callbacks: UnresolvedCallbacks
): Promise<Partial<EscalationState>> {
  const reason =
    `Escalation ladder exhausted after ${state.escalationRung} rung(s). ` +
    `Attempted responders: ${state.attemptedResponders.join(", ") || "none"}.`;

  const outcome: Outcome = {
    incidentId: state.incidentId,
    responderId: null,
    committed: false,
    etaMinutes: null,
    verifiedAt: null,
    verificationResult: null,
    notifiedAt: null,
    timeSavedMinutes: null,
  };

  await callbacks.persistOutcome(outcome);

  // Alert must fire even during quiet hours — this is UNRESOLVED
  await callbacks.alertFacilityManager(state.incidentId, reason);
  callbacks.emitSSE(state.incidentId, reason);

  return {
    finalOutcome: outcome,
  };
}
