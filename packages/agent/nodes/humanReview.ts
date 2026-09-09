/**
 * packages/agent/nodes/humanReview.ts
 * Node: human_review
 * Owner: Aryan
 *
 * Parks the incident for operator decision.
 * The operator can then:
 *   - Override extracted fields and resume → "resolve"
 *   - Manually escalate → "escalate"
 *
 * This node just parks the incident and alerts. The operator
 * resumes via POST /api/v1/incidents/:id/override (Sameer's endpoint).
 */

import type { EscalationState } from "../state";
import { lastStructuredResult, lastConfidence } from "../state";

export interface HumanReviewCallbacks {
  parkIncident: (params: {
    incidentId: string;
    traceId: string;
    reason: string;
    confidenceScore: number;
    structuredResult: Record<string, unknown>;
  }) => Promise<void>;
  alertOperator: (params: {
    incidentId: string;
    reason: string;
    assetId: string;
    severity: string;
  }) => Promise<void>;
  emitSSE: (incidentId: string, reason: string) => void;
}

export async function humanReview(
  state: EscalationState,
  callbacks: HumanReviewCallbacks
): Promise<Partial<EscalationState>> {
  const result = lastStructuredResult(state);
  const confidence = lastConfidence(state);

  const reason = buildReviewReason(state);

  await callbacks.parkIncident({
    incidentId: state.incidentId,
    traceId: state.traceId,
    reason,
    confidenceScore: confidence?.score ?? 0,
    structuredResult: (result ?? {}) as Record<string, unknown>,
  });

  await callbacks.alertOperator({
    incidentId: state.incidentId,
    reason,
    assetId: state.asset.id,
    severity: state.severity,
  });

  callbacks.emitSSE(state.incidentId, reason);

  return { requiresHumanReview: true };
}

function buildReviewReason(state: EscalationState): string {
  const confidence = lastConfidence(state);
  const result = lastStructuredResult(state);

  if (state.callError) {
    return `Call failed: ${state.callError}`;
  }

  if (!confidence || !result) {
    return "No call result available — manual review required.";
  }

  if (confidence.score < 0.7) {
    return (
      `Low confidence (${confidence.score}) — extraction was ambiguous. ` +
      `next_action was "${result.next_action}". Operator must verify.`
    );
  }

  if (result.next_action === "HUMAN_REVIEW") {
    return `Agent requested human review. Verbatim: "${result.verbatim_commitment ?? "none recorded"}".`;
  }

  return "Routed to human review.";
}
