/**
 * packages/agent/nodes/resolve.ts
 * Node: resolve
 * Owner: Aryan
 *
 * Closes the incident successfully.
 * Computes time_saved_minutes vs manual baseline.
 * Exits to: END
 *
 * Note: actual DB write + manager notification is done by Sameer's
 * outcome engine via the persist callback.
 */

import type { EscalationState } from "../state";
import type { Outcome } from "../../types";
import { lastStructuredResult } from "../state";

// Baseline: average manual coordination time in minutes (from PRD §1.3)
const MANUAL_BASELINE_MINUTES = 12;

export type ResolveCallbacks = {
  persistOutcome: (outcome: Outcome) => Promise<void>;
  notifyManager: (incidentId: string, outcome: Outcome) => Promise<void>;
  emitSSE: (incidentId: string, timeSavedMinutes: number) => void;
};

export async function resolve(
  state: EscalationState,
  incidentOpenedAt: Date,
  callbacks: ResolveCallbacks
): Promise<Partial<EscalationState>> {
  const result = lastStructuredResult(state);
  const now = new Date();
  const elapsedMinutes = (now.getTime() - incidentOpenedAt.getTime()) / 60_000;
  const timeSavedMinutes = Math.max(
    0,
    Math.round(MANUAL_BASELINE_MINUTES - elapsedMinutes)
  );

  const outcome: Outcome = {
    incidentId: state.incidentId,
    responderId: state.currentResponder?.id ?? null,
    committed: true,
    etaMinutes: result?.eta_minutes ?? null,
    verifiedAt: null,
    verificationResult: null,
    notifiedAt: null,
    timeSavedMinutes,
  };

  await callbacks.persistOutcome(outcome);
  await callbacks.notifyManager(state.incidentId, outcome);
  callbacks.emitSSE(state.incidentId, timeSavedMinutes);

  return {
    finalOutcome: outcome,
  };
}
