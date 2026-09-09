/**
 * packages/agent/nodes/assessIncident.ts
 * Node: assess_incident
 * Owner: Aryan
 *
 * Decides whether the incident warrants a phone call.
 * Exits to: "select_responder" | "suppress"
 *
 * This is deterministic rule-based logic. The correlation engine
 * (Sameer) already filtered noise — this is the agent's final gate.
 */

import type { EscalationState } from "../state";

export type AssessResult = "select_responder" | "suppress";

export function assessIncident(state: EscalationState): AssessResult {
  const { severity, safeWindowMinutes, reading } = state;

  // INFO severity never warrants a call — log and suppress.
  if (severity === "INFO") {
    return "suppress";
  }

  // If safe window is extremely large (> 8 hours), treat as low-priority.
  // This prevents unnecessary calls for distant slow-moving trends.
  if (severity === "WARNING" && safeWindowMinutes > 480) {
    return "suppress";
  }

  // Sanity check — if the reading is not actually beyond threshold, suppress.
  // (Guards against stale incidents re-entering the graph.)
  if (reading.value <= reading.threshold && severity !== "CRITICAL") {
    return "suppress";
  }

  // All other WARNING and all CRITICAL incidents proceed to a call.
  return "select_responder";
}

/**
 * Returns a human-readable reason for suppression.
 * Used to populate state.suppressReason for the audit log.
 */
export function getSuppressReason(state: EscalationState): string {
  const { severity, safeWindowMinutes, reading } = state;

  if (severity === "INFO") {
    return `Severity is INFO — no call warranted.`;
  }
  if (severity === "WARNING" && safeWindowMinutes > 480) {
    return `WARNING with safe window > 8 hours (${safeWindowMinutes}min) — deferred.`;
  }
  if (reading.value <= reading.threshold) {
    return `Reading (${reading.value}${reading.unit}) is within threshold (${reading.threshold}${reading.unit}) — stale incident.`;
  }
  return "Suppressed by assess_incident.";
}
