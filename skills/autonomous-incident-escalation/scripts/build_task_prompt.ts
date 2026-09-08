/**
 * skills/autonomous-incident-escalation/scripts/build_task_prompt.ts
 *
 * Dynamic, rung-aware CALL-E task prompt composition.
 *
 * There is exactly ONE prompt builder in this project. This file re-exports it
 * rather than copying it: a forked prompt is how the self-identification rule,
 * the third-party protection rule, and the 90-second ceiling quietly get lost.
 *
 * ── Why the prompt is composed, not templated ────────────────────────────────
 *
 * A static string is a robocall. The same incident is framed differently at
 * rung 1 (first contact, factual), rung 2 (time already lost), and rung 3
 * (supervisor escalation, incident unassigned) — and the time-pressure language
 * scales with the remaining safe window.
 *
 * The prompt also encodes every conversational failure we have actually hit:
 *
 *   "I'm busy"          → do NOT accept as final; ask for the earliest ETA
 *   "call me later"     → ask for a specific time inside the window
 *   "soon" / "maybe"    → ask ONCE for a number, then mark for review
 *   wrong person        → withhold all details, end, escalate
 *   voicemail           → short message with asset ID, end
 *   hostile             → acknowledge, do not argue, mark declined
 *   IVR                 → never navigate menus; end and escalate
 *
 * Every one of those lines exists because a rehearsal failed without it.
 *
 * ── Before you edit ──────────────────────────────────────────────────────────
 *
 * Validate with scripts/plan_call.ts first. It is free, and it catches the two
 * mistakes that reach a real technician: an unrendered template hole, and a
 * missing "automated operations line" self-identification.
 */

export { buildTaskPrompt, buildVerificationPrompt } from "./lib/prompt";
export { ESCALATION_RESULT_SCHEMA } from "./lib/schema";
export type { EscalationContext } from "./lib/types";
