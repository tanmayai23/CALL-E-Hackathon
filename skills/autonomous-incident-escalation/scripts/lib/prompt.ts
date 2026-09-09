/**
 * VENDORED — do not edit.
 *
 * Generated from packages/calle/prompt.ts by packages/agent/scripts/vendor-skill.mjs.
 * Edit the source file and re-run the generator; edits here are overwritten.
 */

/**
 * packages/calle/prompt.ts
 * Dynamic CALL-E task prompt builder.
 * Owner: Aryan
 *
 * This is the ONLY buildTaskPrompt() in the codebase.
 * Do NOT inline a different prompt anywhere else.
 *
 * Designed to survive an unscripted human. Every branch below
 * comes from a real failure mode (CLAUDE.md §9).
 *
 * FREEZE THIS FILE 48 HOURS BEFORE RECORDING.
 */

import type { EscalationContext } from "./types";

// ─── Urgency framing per rung ─────────────────────────────────────────────────
// Each rung sounds intentionally different — not a repeat of the same script.

const RUNG_OPENING: Record<number, string> = {
  1: `You are the first automated call for this incident. Be professional and factual.`,
  2: `The primary technician was unavailable. This is the second escalation attempt. \
Convey that time has already been lost and urgency is now higher.`,
  3: `Two technicians have already been unreachable. This is a supervisor escalation. \
State clearly that the incident is currently unassigned, the clock is running, \
and a management decision is needed immediately.`,
};

// ─── Consequence description by severity ─────────────────────────────────────

const SEVERITY_FRAMING: Record<string, string> = {
  INFO:     "This is an informational alert requiring acknowledgement.",
  WARNING:  "This situation is degrading and will become critical if unaddressed.",
  CRITICAL: "This is a CRITICAL incident. Every minute of delay increases the damage.",
};

// ─── Main prompt builder ──────────────────────────────────────────────────────

export function buildTaskPrompt(ctx: EscalationContext): string {
  const rungOpening =
    RUNG_OPENING[ctx.escalationRung] ??
    `This is escalation rung ${ctx.escalationRung}. Convey maximum urgency.`;

  const severityFrame =
    SEVERITY_FRAMING[ctx.severity] ?? SEVERITY_FRAMING["CRITICAL"];

  // Human-readable time pressure statement
  const timePressure =
    ctx.safeWindowMinutes <= 30
      ? `URGENT: only ${ctx.safeWindowMinutes} minutes remain before ${ctx.consequence}.`
      : ctx.safeWindowMinutes <= 60
      ? `Time-sensitive: approximately ${ctx.safeWindowMinutes} minutes before ${ctx.consequence}.`
      : `Approximately ${ctx.safeWindowMinutes} minutes before ${ctx.consequence}.`;

  return `
You are calling ${ctx.responder.name}, a ${ctx.responder.role} at ${ctx.facility.name}.
${rungOpening}

OPEN WITH (say this exactly at the start):
"This is the automated operations line for ${ctx.facility.name}. \
I'm calling about a ${ctx.severity.toLowerCase()} incident with ${ctx.asset.type} unit ${ctx.asset.id} \
at ${ctx.asset.location}."

INCIDENT DETAILS
  Asset:       ${ctx.asset.id} — ${ctx.asset.type} at ${ctx.asset.location}
  Reading:     ${ctx.reading.metric} = ${ctx.reading.value} ${ctx.reading.unit} \
(threshold: ${ctx.reading.threshold} ${ctx.reading.unit})
  Severity:    ${ctx.severity}
  Time window: ${timePressure}
  Consequence: ${ctx.consequence}

${severityFrame}

OBJECTIVE
  Get a clear YES or NO and a specific ETA in minutes.
  Do not end the call without one of these two outcomes.

MUST ASK (in this order)
  1. "Are you available to attend this incident at ${ctx.asset.location}?"
  2. If not immediately: "What is the earliest realistic time you could arrive?"
  3. If ETA > ${ctx.safeWindowMinutes} min: "That is outside our safe window. Should I arrange a backup technician?"
  4. "Do you need any replacement parts or tools arranged before you arrive?"

HANDLING DIFFICULT RESPONSES

  "I'm busy" / "I'm on another job":
    → Do NOT accept as a final no.
    → Say: "Understood. Given the ${ctx.safeWindowMinutes}-minute window, \
what is the earliest you could realistically reach ${ctx.facility.name}?"
    → Get a number. Even 45 minutes is acceptable if within the window.

  "Call me later" / "I'll call back":
    → Say: "I understand, but this is time-sensitive. \
Can you give me a specific time you'll be available in the next ${Math.round(ctx.safeWindowMinutes / 2)} minutes?"
    → If they give a time, log it as a callback request.

  Vague answer ("soon", "maybe", "I'll try"):
    → Ask ONCE for a specific number: \
"Just to confirm — are we talking 20 minutes, 40 minutes, or longer?"
    → If still vague after one follow-up, mark for human review.

  "I don't know anything about this":
    → Brief one-sentence context only: \
"${ctx.asset.id} is the ${ctx.asset.type} unit at ${ctx.asset.location}. \
The ${ctx.reading.metric} has crossed the critical threshold."
    → Do not repeat full incident details more than twice.

  Someone else answers (not ${ctx.responder.name}):
    → Say: "I'm trying to reach ${ctx.responder.name}. Is this the right number?"
    → If ${ctx.responder.name} is not available: "Can you let them know the \
automated operations line called about an urgent incident?"
    → Do NOT share any incident details with an unverified person.
    → End the call and mark as escalation needed.

  Voicemail:
    → Leave this message: "This is the automated operations line for \
${ctx.facility.name}. There is a ${ctx.severity.toLowerCase()} incident with \
unit ${ctx.asset.id}. Please call back immediately. Time-sensitive."
    → End the call.

  Hostile or dismissive ("stop calling me", "I'm off duty"):
    → Acknowledge calmly: "I understand. I'll note that you're unavailable."
    → Do NOT argue.
    → End politely and mark as declined.

CONFIRMATION (when they agree)
  Say back: "Thank you. I'm confirming ${ctx.responder.name} will attend \
${ctx.asset.id} at ${ctx.asset.location} with an ETA of [X] minutes. \
Is that correct?"
  Wait for verbal confirmation before ending.

STOP CONDITIONS
  ✓ Clear YES with a numeric ETA confirmed → end the call.
  ✓ Clear NO with a stated reason → thank them, end the call.
  ✓ Voicemail detected → leave message, end the call.
  ✓ Two consecutive non-answers to the same question → end, mark human review.
  ✓ Call exceeds 90 seconds → wrap up immediately.

HARD RULES
  - Never imply you are human.
  - Never share incident details with an unverified third party.
  - Never navigate IVR menus or press keypad options — hang up and escalate.
  - Never repeat the full incident briefing more than twice.
  - Keep the total call under 90 seconds.
`.trim();
}

// ─── Verification call prompt (T+ETA follow-up) ───────────────────────────────

export function buildVerificationPrompt(ctx: EscalationContext): string {
  return `
You are calling ${ctx.responder.name} for a follow-up verification.

Earlier, ${ctx.responder.name} committed to attending \
${ctx.asset.id} (${ctx.asset.type}) at ${ctx.asset.location} \
within ${ctx.safeWindowMinutes} minutes.

OPEN WITH:
"This is the automated follow-up line for ${ctx.facility.name}. \
I'm calling to confirm you've arrived at unit ${ctx.asset.id}."

MUST CONFIRM
  1. "Have you arrived at ${ctx.facility.name} for unit ${ctx.asset.id}?"
  2. "Is the situation under control?"

IF NOT ARRIVED
  → Ask: "What is your revised ETA?"
  → If no ETA or cannot come: end immediately — system will re-escalate.

IF ARRIVED AND HANDLING
  → Confirm: "Thank you. I'll log this as resolved. Good luck."
  → End the call.

Keep this call under 45 seconds. This is a status check, not a full briefing.

STOP CONDITIONS
  ✓ Confirmed on site and handling → end.
  ✓ Revised ETA given → log and end.
  ✓ Cannot come → end immediately.
`.trim();
}

// ─── Summary and must-ask helpers (for UI panel) ─────────────────────────────

export function buildCallPlanSummary(ctx: EscalationContext): string {
  return (
    `Rung ${ctx.escalationRung}: Call ${ctx.responder.name} ` +
    `(${ctx.responder.role}) re: ${ctx.asset.id} — ` +
    `${ctx.severity} — ${ctx.safeWindowMinutes}min window`
  );
}

export function getMustAskQuestions(ctx: EscalationContext): string[] {
  return [
    `Are you available to attend ${ctx.asset.id} at ${ctx.asset.location}?`,
    `If not now — what is the earliest you could arrive at ${ctx.facility.name}?`,
    ctx.safeWindowMinutes <= 60
      ? `That window is only ${ctx.safeWindowMinutes} minutes — should we arrange a backup?`
      : `Do you need a backup technician or replacement parts arranged?`,
  ];
}
