/**
 * VENDORED — do not edit.
 *
 * Generated from packages/agent/nodes/selectResponder.ts by scripts/vendor-skill.mjs.
 * Edit the source file and re-run the generator; edits here are overwritten.
 */

/**
 * packages/agent/nodes/selectResponder.ts
 * Node: select_responder
 * Owner: Aryan
 *
 * Picks the right responder for the current escalation rung.
 * Exits to: "plan_call" | "escalate" (if no eligible responder found)
 *
 * Selection criteria (all must pass):
 *   1. Not already attempted this incident
 *   2. On shift right now
 *   3. Covers the required skill for this asset type
 *   4. In the correct service zone
 *   5. Not in cooldown
 *   6. Ordered by ladder_priority ascending (1 = primary)
 *
 * NOTE: The full responder roster comes from the backend (Sameer).
 * This node receives the roster via the context injected at graph invocation.
 */

import type { Responder } from "./types";
import type { EscalationState } from "./state";

export type SelectResponderResult = "plan_call" | "unresolved";

/**
 * Checks if a responder is currently on shift.
 * shift_start and shift_end are "HH:mm" in UTC.
 */
function isOnShift(responder: Responder): boolean {
  const now = new Date();
  const [startH, startM] = responder.shiftStart.split(":").map(Number);
  const [endH, endM] = responder.shiftEnd.split(":").map(Number);

  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  // Handle shifts that cross midnight (e.g. 22:00 → 06:00)
  if (startMinutes <= endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  } else {
    return nowMinutes >= startMinutes || nowMinutes < endMinutes;
  }
}

/**
 * Checks if a responder is past their cooldown window.
 */
function isNotInCooldown(responder: Responder): boolean {
  if (!responder.cooldownUntil) return true;
  return new Date() > new Date(responder.cooldownUntil);
}

/**
 * Selects the best available responder from the roster.
 * Returns null if no eligible responder is found (triggers escalate/unresolved).
 */
export function selectBestResponder(
  state: EscalationState,
  roster: Responder[],
  requiredSkill: string,
  requiredZone: string
): Responder | null {
  const eligible = roster
    .filter((r) => !state.attemptedResponders.includes(r.id))
    .filter((r) => r.skills.includes(requiredSkill))
    .filter((r) => r.zone === requiredZone)
    .filter((r) => isOnShift(r))
    .filter((r) => isNotInCooldown(r))
    .sort((a, b) => a.ladderPriority - b.ladderPriority);  // lowest = highest priority

  return eligible[0] ?? null;
}
