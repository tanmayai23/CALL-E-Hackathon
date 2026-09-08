/**
 * VENDORED — do not edit.
 *
 * Generated from packages/agent/nodes/decide.ts by scripts/vendor-skill.mjs.
 * Edit the source file and re-run the generator; edits here are overwritten.
 */

/**
 * packages/agent/nodes/decide.ts
 * Node: decide
 * Owner: Aryan
 *
 * THE most important node. Routes the graph based on CALL-E's output.
 * This is 100% deterministic code — NOT an LLM call (CLAUDE.md §5.3).
 *
 * Invariants:
 *   1. Confidence < 0.7 never lets the agent CLOSE an incident — it overrides
 *      every next_action except ESCALATE_NEXT_RUNG. See CLOSING_ACTIONS below.
 *   2. Rung cap is enforced here, not in the prompt.
 *   3. Every branch is reachable and must have a test.
 *
 * Exits to:
 *   "resolve" | "escalate" | "human_review" | "schedule_callback" | "verify"
 */

import type { EscalationState } from "./state";
import { lastStructuredResult, lastConfidence } from "./state";

export type DecideResult =
  | "resolve"
  | "escalate"
  | "human_review"
  | "schedule_callback"
  | "verify";

// Confidence threshold below which we never auto-close (FR-6.3)
const CONFIDENCE_THRESHOLD = 0.7;

/**
 * Actions that END the agent's pursuit of a human commitment. A shaky
 * extraction must never trigger one of these — that is what FR-6.3 protects.
 *
 * ESCALATE_NEXT_RUNG is deliberately absent. Escalating on a low-confidence
 * result is fail-safe (we simply try the next human), whereas parking it for
 * an operator is fail-dangerous: a no-answer at 02:00 has confidence 0.0 by
 * construction, and §9 F1/F2/F9 require those to advance the rung immediately,
 * not to wait for a human who is not on shift.
 */
const CLOSING_ACTIONS = new Set([
  "CLOSE_RESOLVED",
  "SCHEDULE_VERIFICATION_CALL",
  "SCHEDULE_CALLBACK",
]);

export function decide(state: EscalationState): DecideResult {
  const result = lastStructuredResult(state);
  const confidence = lastConfidence(state);

  // ── Guard: should never happen if execute_call ran correctly ─────────────
  if (!result || !confidence) {
    console.error(
      `decide: missing structuredResult or confidence for incident ${state.incidentId}. ` +
      "Routing to human_review."
    );
    return "human_review";
  }

  // ── Invariant 1: Low confidence blocks closing the incident (FR-6.3) ─────
  if (
    confidence.score < CONFIDENCE_THRESHOLD &&
    CLOSING_ACTIONS.has(result.next_action)
  ) {
    return "human_review";
  }

  // ── Route on next_action ──────────────────────────────────────────────────
  switch (result.next_action) {
    case "CLOSE_RESOLVED":
      return "resolve";

    case "SCHEDULE_VERIFICATION_CALL":
      // FR-6.4 — a commitment that lands outside the safe window is accepted
      // but is NOT sufficient on its own. The verify node arranges a backup
      // (see etaOutsideSafeWindow / needsBackup below).
      return "verify";

    case "SCHEDULE_CALLBACK":
      return "schedule_callback";

    case "HUMAN_REVIEW":
      return "human_review";

    case "ESCALATE_NEXT_RUNG":
      // ── Invariant 2: Rung cap enforced here ────────────────────────────
      if (state.escalationRung >= state.maxRungs) {
        // Ladder exhausted — will route to unresolved inside escalate node
        return "escalate";
      }
      return "escalate";

    default:
      // Unknown next_action — safe fallback
      console.error(
        `decide: unknown next_action "${(result as { next_action: string }).next_action}" ` +
        `for incident ${state.incidentId}. Routing to human_review.`
      );
      return "human_review";
  }
}

// ─── FR-6.4 — ETA validation against the safe window ─────────────────────────

/**
 * True when the responder's committed ETA lands after the point at which the
 * real-world consequence occurs. An unknown ETA counts as outside the window:
 * we cannot prove a commitment is safe, so we behave as though it isn't.
 */
export function etaOutsideSafeWindow(state: EscalationState): boolean {
  const eta = lastStructuredResult(state)?.eta_minutes;
  if (typeof eta !== "number" || Number.isNaN(eta)) return true;
  return eta > state.safeWindowMinutes;
}

/**
 * FR-6.4 — whether a backup responder must be arranged alongside the accepted
 * commitment. Either the responder asked for one, or their ETA does not beat
 * the safe window.
 *
 * Note this is computed in code rather than trusted from `requires_backup`
 * alone: a technician who says "no, I'll make it" while quoting an ETA past
 * the window is exactly the case a dispatcher must not take at face value.
 */
export function needsBackup(state: EscalationState): boolean {
  const result = lastStructuredResult(state);
  if (!result) return true;
  return result.requires_backup === true || etaOutsideSafeWindow(state);
}

/**
 * Returns a human-readable explanation of the routing decision.
 * Used in agent_events audit log.
 */
export function explainDecision(
  state: EscalationState,
  decision: DecideResult
): string {
  const result = lastStructuredResult(state);
  const confidence = lastConfidence(state);

  if (!result || !confidence) {
    return "Missing result or confidence — routed to human_review as fallback.";
  }

  const base = `next_action="${result.next_action}", confidence=${confidence.score} (${confidence.label})`;

  if (
    confidence.score < CONFIDENCE_THRESHOLD &&
    CLOSING_ACTIONS.has(result.next_action)
  ) {
    return (
      `Confidence score ${confidence.score} is below threshold ${CONFIDENCE_THRESHOLD} ` +
      `and "${result.next_action}" would close the incident. → human_review.`
    );
  }

  if (confidence.score < CONFIDENCE_THRESHOLD) {
    return (
      `${base} → confidence is below ${CONFIDENCE_THRESHOLD}, but escalating is ` +
      `fail-safe so the ladder advances rather than parking for an operator.`
    );
  }

  switch (decision) {
    case "resolve":
      return `${base} → closing incident as resolved.`;
    case "verify":
      return `${base} → scheduling verification call at T+${result.eta_minutes ?? "?"}min.`;
    case "schedule_callback":
      return `${base} → scheduling callback at ${result.callback_requested_at ?? "requested time"}.`;
    case "human_review":
      return `${base} → parking for operator review.`;
    case "escalate":
      return state.escalationRung >= state.maxRungs
        ? `${base} → ladder exhausted (rung ${state.escalationRung}/${state.maxRungs}) → marking UNRESOLVED.`
        : `${base} → advancing to rung ${state.escalationRung + 1}.`;
  }
}
