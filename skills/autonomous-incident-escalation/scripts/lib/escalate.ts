/**
 * VENDORED — do not edit.
 *
 * Generated from packages/agent/nodes/escalate.ts by packages/agent/scripts/vendor-skill.mjs.
 * Edit the source file and re-run the generator; edits here are overwritten.
 */

/**
 * packages/agent/nodes/escalate.ts
 * Node: escalate
 * Owner: Aryan
 *
 * Advances the escalation rung and raises urgency framing.
 * Exits to: "select_responder" | "unresolved" (when ladder exhausted)
 */

import type { EscalationState } from "./state";

export type EscalateResult = "select_responder" | "unresolved";

export function escalate(state: EscalationState): {
  nextNode: EscalateResult;
  updatedState: Partial<EscalationState>;
} {
  const nextRung = state.escalationRung + 1;

  // ── Record the attempt first ──────────────────────────────────────────────
  // This happens even when the ladder is exhausted: the responder on the final
  // rung was still called, and the UNRESOLVED alert names everyone tried.
  const attemptedResponders = state.currentResponder
    ? [...state.attemptedResponders, state.currentResponder.id]
    : state.attemptedResponders;

  // ── Rung cap check ────────────────────────────────────────────────────────
  if (nextRung > state.maxRungs) {
    return {
      nextNode: "unresolved",
      updatedState: { attemptedResponders },
    };
  }

  return {
    nextNode: "select_responder",
    updatedState: {
      escalationRung: nextRung,
      attemptedResponders,
      currentResponder: null,  // cleared — select_responder will fill it
    },
  };
}
