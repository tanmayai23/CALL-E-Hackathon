/**
 * packages/calle/prompt.ts
 * Dynamic CALL-E task prompt builder — wholesale coordination.
 * Owner: Aryan (composition) + Tanmay (conversation quality)
 *
 * This is the ONLY buildWholesaleCoordinationPrompt() in the codebase.
 * Do NOT inline a different prompt anywhere else (PRD §7.3).
 *
 * A static prompt is a robocall. Every call is composed from the order, the
 * product, the quantity, the contact, the urgency and the escalation rung, so
 * the backup contact does not hear the same script the primary did.
 *
 * Designed to survive an unscripted human. Every branch below comes from a real
 * failure mode (PRD §9). Verified against a live call on 2026-09-08 (testing
 * log P-002): the responder mumbled, gave a half-name, and said "available but
 * currently busy" — the agent still pressed for and got a concrete number.
 *
 * FREEZE THIS FILE 48 HOURS BEFORE RECORDING.
 */

import type { WholesaleCoordinationContext, Contact } from "../types";

// ─── Framing per escalation rung ─────────────────────────────────────────────
// Each rung sounds intentionally different. A backup contact who hears the
// primary's script learns nothing about why they are being called instead.

const RUNG_FRAMING: Record<number, string> = {
  1: `This is the first call about this order. Be professional, brief and factual.`,

  2: `The primary contact at this supplier could not be reached or could not \
commit. You are now calling the backup contact. Make clear that time has \
already been spent and the buyer still has no confirmation.`,

  3: `Two contacts at this supplier have already failed to produce a commitment. \
This is a supervisor-level call. State plainly that the order is still \
unconfirmed, that the buyer's deadline is approaching, and that you need a \
decision from someone who can make one.`,
};

// ─── Framing per urgency (FR-2.2) ────────────────────────────────────────────

const URGENCY_FRAMING: Record<string, string> = {
  ROUTINE: `This is routine forward planning. Do not manufacture urgency.`,

  PRIORITY: `This order is time-sensitive. Say so once, plainly, without pressure tactics.`,

  URGENT: `This order is URGENT — the buyer has a committed delivery depending on it. \
Convey that clearly and early, but stay calm. Pressure makes suppliers vague, \
and a vague answer is worth nothing to us.`,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Renders a date for a human to hear. The supplier is on the phone, not reading
 * a timestamp, so "Friday 13 September, 6:00 pm" beats an ISO string.
 *
 * Falls back to the raw value rather than throwing: a malformed date must
 * degrade the prompt's wording, never block the call. `lintTaskPrompt` catches
 * the "Invalid Date" literal before it can reach a supplier.
 */
export function formatForSpeech(iso: string, timezone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  try {
    return new Intl.DateTimeFormat("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: timezone,
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

/**
 * Today's date where the CONTACT is, as YYYY-MM-DD.
 *
 * OBSERVED (live call 2026-09-14): the supplier said the goods would dispatch
 * "today" at 00:42 in their own timezone, and the extraction returned
 * `2026-09-13` — the UTC date, which was yesterday for them. A dispatch date a
 * day early is not a rounding error: `dispatchMissesDeadline()` compares it
 * against the buyer's required date, so it can mark a late order on time or an
 * on-time order late.
 *
 * The model cannot resolve "today" without being told when and where it is.
 */
function localDate(now: Date, timezone: string): string {
  try {
    // en-CA formats as YYYY-MM-DD, which is what the schema asks for.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/**
 * An order reference a text-to-speech voice can say out loud.
 *
 * OBSERVED (live call 2026-09-14): handed the raw string `ORD-482`, the agent
 * said — out loud, to a supplier — *"order capitalized O, capitalized R,
 * capitalized D, dash, four, eight, two"*. It described the typography of the
 * reference instead of reading it.
 *
 * Splitting it into spaced letters and digits gives the voice the grouping it
 * needs ("O R D, four eight two") without any punctuation or case for it to
 * narrate. The prompt also forbids the failure mode explicitly, because the
 * formatting alone did not prevent it.
 */
export function formatReferenceForSpeech(reference: string): string {
  return reference
    .split(/[^A-Za-z0-9]+/)          // drop dashes, slashes, spaces
    .filter(Boolean)
    .map((part) => part.split("").join(" "))
    .join(", ");
}

/** Hours until the order is needed. Negative when the deadline has passed. */
export function hoursUntil(requiredBy: string, now: Date = new Date()): number {
  const due = new Date(requiredBy).getTime();
  if (Number.isNaN(due)) return Number.POSITIVE_INFINITY;
  return (due - now.getTime()) / 3_600_000;
}

// ─── Main prompt builder ─────────────────────────────────────────────────────

export function buildWholesaleCoordinationPrompt(
  ctx: WholesaleCoordinationContext,
  contact: Contact,
  now: Date = new Date()
): string {
  const rungFraming =
    RUNG_FRAMING[ctx.rung] ??
    `This is contact attempt ${ctx.rung} for this order. The order is still unconfirmed.`;

  const urgencyFraming = URGENCY_FRAMING[ctx.urgency] ?? URGENCY_FRAMING["PRIORITY"];

  const { item } = ctx;
  const requiredBySpoken = formatForSpeech(ctx.requiredBy, contact.workingHours.timezone);
  const hours = hoursUntil(ctx.requiredBy, now);
  const referenceSpoken = formatReferenceForSpeech(ctx.reference);
  const todayForContact = localDate(now, contact.workingHours.timezone);

  const deadlineFraming =
    hours < 0
      ? `The buyer's required date has ALREADY PASSED. Establish what is still possible.`
      : hours <= 24
      ? `The buyer needs this within ${Math.max(1, Math.round(hours))} hours.`
      : `The buyer needs this by ${requiredBySpoken}.`;

  return `
You are placing a business-to-business inventory coordination call on behalf of \
${ctx.seller.name} (Wholesale Distributors) to ${contact.name}, ${contact.role} at ${contact.shopName || contact.workplaceLocation || ctx.buyer.name}.

${rungFraming}
${urgencyFraming}

OPEN WITH (say EXACTLY this, and nothing more, before anything else):
"This is the automated operations line for ${ctx.seller.name}. \
Am I speaking with ${contact.name}?"

  → WAIT for their answer. Do not continue until they have answered.
  → Only if they confirm they are ${contact.name}, say:
    "Thank you. I'm calling about order ${referenceSpoken} from ${ctx.seller.name} to check on your current stock status \
and see what inventory or items you are running low on and need supplied to you."
  → If they say no, say they are someone else, hand you to another person, or
    give any answer you cannot read as "yes, this is ${contact.name}", go to
    SOMEONE ELSE ANSWERS below. Do not state the order reference, the product,
    the quantity or the price.

SAYING THE ORDER REFERENCE
  Say it as: "${referenceSpoken}" — letter by letter, then digit by digit.
  Never say "capitalized", "uppercase", "lowercase", "dash" or "hyphen".

TODAY'S DATE, WHERE ${contact.name.toUpperCase()} IS: ${todayForContact}
  ${contact.workingHours.timezone}. Resolve "today", "tomorrow" and the like
  against THIS date, not any other clock. "Today" means ${todayForContact}.

ORDER DETAILS
  Order reference:    ${ctx.reference}
  Product:            ${item.description} (${item.sku})
  Quantity requested: ${item.requestedQuantity} ${item.unit}
  Price on the order: ${item.unitPrice} ${item.currency} per ${singular(item.unit)}
  Required by:        ${requiredBySpoken}

${deadlineFraming}

OBJECTIVE
  Leave this call with a number and a date: how many ${item.unit} they can
  supply, and when they dispatch. "We'll sort it out" is not an outcome.

MUST ASK (in this order)
  1. "Am I speaking with ${contact.name}?" — ALWAYS first. Nothing below may be
     asked until this is answered yes.
  2. "Can you confirm you have ${item.requestedQuantity} ${item.unit} of \
${item.description} available?"
  3. If not the full quantity: "How many ${item.unit} can you confirm today?"
  4. "When will those dispatch?"
  5. If any quantity remains outstanding: "And when will the remaining \
${item.unit} be available?"
  6. "Is the price still ${item.unitPrice} ${item.currency} per \
${singular(item.unit)}?"

HANDLING DIFFICULT RESPONSES

  PARTIAL STOCK — "we only have [N]":
    → A good outcome, not a failure. Take it.
    → "Understood, ${"{N}"} ${item.unit} today. When can you have the
      remaining ${"{requested - N}"} ready?"
    → ALWAYS ask when the remainder follows. The buyer needs both halves, and
      the follow-up call is scheduled from it.

  PRICE HAS CHANGED — "it's [new price] now":
    → Record the new price exactly. Do NOT agree to it, argue about it, or
      suggest what the buyer might accept.
    → Say: "Thank you, I've noted ${"{new price}"} per ${singular(item.unit)}. \
That is a change from our order, so it needs approval on our side before I can \
confirm. Can you still reserve the stock while that is checked?"
    → A person at ${ctx.buyer.name} decides this. You do not.

  HEDGED QUANTITY — "about 200", "approx 200", "around 200", "roughly":
    → Not a commitment. Do not echo their hedge — "about 200 confirmed" turns
      their approximation into your confirmation.
    → Ask ONCE: "Can you give me the exact number you can confirm today?"
    → Still hedged? Record their words in verbatim_commitment, leave
      confirmed_quantity empty, let it go to review.

  VAGUE ANSWER — "soon", "should be fine", "we'll see", "probably":
    → Ask ONCE for something concrete:
      "Just so I record it correctly — is that today, tomorrow, or later this week?"
    → If the second answer is still vague, stop pressing. Thank them, end the
      call, and let it go to review. Do not guess a date on their behalf.

  REFUSAL / CANNOT SUPPLY:
    → Ask for the reason, then for the alternative:
      "Understood. What is the earliest you could supply any part of this order?"
    → If there is genuinely nothing, ask: "Is there someone else at \
${ctx.seller.name} I should speak to about this?"
    → Thank them and end. Do not argue.

  "CALL ME BACK" / "I'm in the middle of something":
    → Get a time, not a vague promise:
      "Of course. What time today should I call back?"
    → Repeat the time back so it is captured: "I'll call back at ${"{time}"}."

  SOMEONE ELSE ANSWERS, or you cannot confirm it is ${contact.name}:
    → Say only: "I'm trying to reach ${contact.name} at ${ctx.seller.name}. \
Is this the right number?"
    → Do NOT state the order reference, the quantity, the product, or the price
      to anyone who is not the named contact. This is a firm rule.
    → Ask when ${contact.name} is available, thank them, end the call.
    → This also covers the answers that are neither yes nor no — "who's this?",
      "what's it regarding?", someone answering on ${contact.name}'s behalf, or
      silence. An unclear answer is NOT a yes. Treat it as someone else.
    → Do not ask a third time. One repeat of the question, then end the call.

  VOICEMAIL:
    → Leave exactly this, and nothing more: "This is the automated operations \
line for ${ctx.buyer.name} calling for ${contact.name} about a purchase order. \
Please call us back."
    → Do NOT leave the order reference, quantity, product or price on a
      voicemail — you cannot verify who will hear it.
    → End the call.

  AUTOMATED MENU / SWITCHBOARD:
    → Do not press options or navigate the menu. End the call.

CONFIRMATION (before you end any call where something was agreed)
  Read it back ONCE, at the very end, and get a yes:
  "So that I record this correctly: ${"{confirmed}"} ${item.unit} of \
${item.description} dispatching ${"{date}"}, against order ${referenceSpoken}. \
Is that right?"
  Wait for them to confirm before ending.

  ONCE means once. Do NOT re-read the summary each time a detail arrives.
  If a detail changes after the read-back, confirm only THAT detail:
  "Understood — ${"{new detail}"}. Everything else as agreed?"

  Let them finish. If you and they speak at once, stop and let them talk, and
  never say goodbye while they are mid-sentence.

STOP CONDITIONS — end the call when any of these is true
  ✓ You could not confirm you are speaking to ${contact.name} (disclose nothing).
  ✓ Quantity and dispatch date confirmed and read back.
  ✓ Partial quantity plus a date for the remainder.
  ✓ A callback time agreed, or a clear refusal with a reason.
  ✓ Voicemail or a switchboard — minimal message if appropriate.
  ✓ Two consecutive vague answers to the same question — mark for review.
  ✓ The call reaches 90 seconds — wrap up with whatever is agreed.

HARD RULES
  - Never imply you are a human. You are an automated line and you said so.
  - Never disclose order details to anyone who is not ${contact.name} — and you
    do not know who you are speaking to until you have asked and they have said
    so. Silence on this is not consent to hear it.
  - Never agree to a price, a discount, credit terms, payment terms, or any
    contractual condition. Record what was proposed; a person decides.
  - Never invent, estimate, or round a quantity, price or date. If they did not
    say it, it does not go in the result. If they hedged it — "about", "approx",
    "around" — they did not say it.
  - Never commit ${ctx.buyer.name} to anything beyond this order's quantity.
  - Keep the total call under 90 seconds.
`.trim();
}

// ─── Follow-up call prompts ──────────────────────────────────────────────────

/**
 * FR-5.4 — the verification call at dispatch time, and the chase for a
 * partially-confirmed remainder. Both are short status checks, not briefings:
 * the supplier already had the full conversation.
 */
export function buildFollowUpPrompt(
  ctx: WholesaleCoordinationContext,
  contact: Contact,
  kind: "VERIFICATION" | "REMAINING_QUANTITY",
  committed: { confirmedQuantity?: number; remainingQuantity?: number; dispatchDate?: string }
): string {
  const { item } = ctx;

  // Identity first on follow-ups too. These are shorter calls and the
  // temptation is to skip it, but a follow-up discloses MORE than a first call
  // — it repeats back a quantity and a date the supplier already committed to.
  const identityCheck = `
OPEN WITH (exactly this, and nothing more):
"This is the automated operations line for ${ctx.buyer.name}. \
Am I speaking with ${contact.name}?"

  → WAIT for the answer. If it is anything other than a clear yes, say
    "I'll try again later, thank you", and END THE CALL. Do not mention the
    order, the quantity, the date or the price. Do not leave a message.
  → Only once they confirm, continue with:`.trim();

  const opening = `Thank you. I'm following up on order ${ctx.reference}.`;

  if (kind === "REMAINING_QUANTITY") {
    const remaining = committed.remainingQuantity ?? item.remainingQuantity ?? 0;

    return `
You are calling ${contact.name} at ${ctx.seller.name} to chase the outstanding
part of an order they have already partially confirmed.

${identityCheck}
"${opening} You confirmed ${committed.confirmedQuantity ?? "part"} \
${item.unit} previously, with ${remaining} ${item.unit} still to come. \
Can you confirm those are ready?"

MUST CONFIRM
  1. "Am I speaking with ${contact.name}?" — first, before anything else.
  2. "Are the remaining ${remaining} ${item.unit} available now?"
  3. "When will they dispatch?"

IF STILL NOT AVAILABLE
  → Ask once for a concrete date. If they cannot give one, thank them and end;
    the order will go back for review.

Keep this call under 45 seconds. Do not re-brief the whole order.

HARD RULES
  - Never disclose order details to anyone who is not ${contact.name}.
  - Never agree to a price or terms change. Record it; a person decides.
`.trim();
  }

  const dispatchSpoken = committed.dispatchDate
    ? formatForSpeech(committed.dispatchDate, contact.workingHours.timezone)
    : "the agreed date";

  return `
You are calling ${contact.name} at ${ctx.seller.name} to verify that a
commitment they already made has actually been met.

${identityCheck}
"${opening} You confirmed ${committed.confirmedQuantity ?? item.requestedQuantity} \
${item.unit} dispatching ${dispatchSpoken}. I'm calling to confirm that has gone out."

MUST CONFIRM
  1. "Am I speaking with ${contact.name}?" — first, before anything else.
  2. "Has the order dispatched?"
  3. If yes: "Can you confirm the quantity that went out?"
  4. If no: "When will it dispatch?"

IF IT HAS NOT DISPATCHED
  → Get a revised date. If they cannot give one, thank them and end; the order
    will be escalated.

Keep this call under 45 seconds. This is a status check, not a briefing.

HARD RULES
  - Never disclose order details to anyone who is not ${contact.name}.
  - Never agree to a price or terms change. Record it; a person decides.
`.trim();
}

// ─── Summary and must-ask helpers (FR-4.1 — the plan panel) ─────────────────

/**
 * The one-line plan the operator sees BEFORE the phone rings. FR-4.1 exists so
 * a human can see what the agent is about to do while it is still preventable.
 */
export function buildCallPlanSummary(
  ctx: WholesaleCoordinationContext,
  contact: Contact
): string {
  const rungLabel = RUNG_LABELS[ctx.rung] ?? `contact ${ctx.rung}`;

  return (
    `Rung ${ctx.rung} (${rungLabel}): call ${contact.name} at ${ctx.seller.name} ` +
    `re: ${ctx.reference} — ${ctx.item.requestedQuantity} ${ctx.item.unit} of ` +
    `${ctx.item.description} — ${ctx.urgency}`
  );
}

const RUNG_LABELS: Record<number, string> = {
  1: "primary",
  2: "backup",
  3: "supervisor",
};

export function getMustAskQuestions(ctx: WholesaleCoordinationContext): string[] {
  const { item } = ctx;

  return [
    // Listed first because the operator's plan panel (FR-4.1) is where a human
    // sees what the agent will say BEFORE the phone rings. If identity
    // verification is not visible there, nobody reviewing the plan can tell
    // whether it happens.
    `Am I speaking with the named contact?`,
    `Can you confirm ${item.requestedQuantity} ${item.unit} of ${item.description} are available?`,
    `If not the full quantity — how many can you confirm, and when do the rest follow?`,
    `When will the confirmed quantity dispatch?`,
    `Is the price still ${item.unitPrice} ${item.currency} per ${singular(item.unit)}?`,
  ];
}

/**
 * "cases" → "case". Only used inside spoken sentences, where "2050 rupees per
 * cases" is the kind of detail that makes a demo call sound synthetic.
 *
 * The `-es` rule only applies after a sibilant stem ("boxes" → "box",
 * "batches" → "batch"). A naive `-es` strip turns "cases" into "cas", which is
 * exactly the unit this project uses most.
 */
function singular(unit: string): string {
  if (/(?:x|ch|sh|ss|z)es$/.test(unit)) return unit.slice(0, -2);
  if (unit.endsWith("s") && !unit.endsWith("ss")) return unit.slice(0, -1);
  return unit;
}
