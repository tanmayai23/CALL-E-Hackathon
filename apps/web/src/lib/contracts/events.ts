/**
 * SSE event contract — wholesale coordination.
 *
 * STATUS: PROPOSED (see `docs/FRONTEND_BACKEND_CONTRACT.md`). The call-level
 * events — `plan.composed`, `call.state`, `transcript.delta`,
 * `result.extracted` — keep the v1 names, because they are domain-neutral and
 * are what `packages/calle/progress.ts` already emits; only the id field moves
 * from `incidentId` to `orderId`. The order-level events are new names.
 *
 * Every member is a LOOSE object: unknown keys pass through rather than being
 * stripped, so a backend carrying `traceId` on the wire (Rule 7) keeps it, and
 * an added field never breaks the dashboard mid-demo.
 *
 * Validate every frame at the boundary. A malformed event degrades one panel —
 * it must never white-screen the dashboard.
 */

import { z } from "zod";

const UrgencySchema = z.enum(["ROUTINE", "PRIORITY", "URGENT"]);

const OrderStatusSchema = z.enum([
  "AWAITING_CONFIRMATION",
  "CALLING",
  "CONFIRMED",
  "PARTIALLY_CONFIRMED",
  "APPROVAL_REQUIRED",
  "CALLBACK_SCHEDULED",
  "HUMAN_REVIEW",
  "UNRESOLVED",
  "SUPPRESSED",
]);

const CallStateSchema = z.enum([
  "queued",
  "dialling",
  "connected",
  "in_conversation",
  "extracting",
  "completed",
  "failed",
  "no_answer",
]);

const TriggerTypeSchema = z.enum(["ORDER", "INVENTORY", "DELIVERY", "EXCEPTION", "IOT"]);

const ContactSchema = z.looseObject({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  role: z.string(),
  phoneE164: z.string(),
  productCategories: z.array(z.string()),
  region: z.string(),
  workingHours: z.looseObject({ start: z.string(), end: z.string(), timezone: z.string() }),
  escalationPriority: z.number(),
  preferredLanguage: z.string(),
  consentAt: z.string(),
  cooldownUntil: z.string().nullable(),
});

/** PRD §7.2, as a validator. `next_action` and the two required enums are strict. */
const WholesaleResultSchema = z.looseObject({
  contact_reached: z.enum(["yes", "no", "wrong_person", "voicemail", "unknown"]),
  stock_status: z.enum(["confirmed", "partial", "unavailable", "unknown"]),
  confirmed_quantity: z.number().optional(),
  remaining_quantity: z.number().optional(),
  unit_price: z.number().optional(),
  currency: z.string().optional(),
  dispatch_date: z.string().optional(),
  delivery_eta: z.string().optional(),
  delay_reason: z.string().optional(),
  callback_requested_at: z.string().optional(),
  requires_approval: z.boolean().optional(),
  verbatim_commitment: z.string().optional(),
  next_action: z.enum([
    "CONFIRM_ORDER",
    "PARTIAL_CONFIRMATION",
    "REQUEST_APPROVAL",
    "SCHEDULE_CALLBACK",
    "ESCALATE_NEXT_CONTACT",
    "HUMAN_REVIEW",
  ]),
});

const FollowUpSchema = z.looseObject({
  id: z.string(),
  orderId: z.string(),
  kind: z.enum(["VERIFICATION", "CALLBACK", "REMAINING_QUANTITY"]),
  dueAt: z.string(),
  contactId: z.string(),
  note: z.string(),
  status: z.enum(["SCHEDULED", "DONE", "CANCELLED"]),
});

export const SentinelEventSchema = z.discriminatedUnion("type", [
  /* ── Assessment ─────────────────────────────────────────────── */
  z.looseObject({
    type: z.literal("event.received"),
    orderId: z.string(),
    triggerType: TriggerTypeSchema,
    summary: z.string(),
    ts: z.string(),
  }),
  z.looseObject({
    type: z.literal("order.opened"),
    orderId: z.string(),
    urgency: UrgencySchema,
    requiredBy: z.string(),
  }),
  z.looseObject({
    type: z.literal("order.suppressed"),
    orderId: z.string(),
    reason: z.string(),
    duplicateOf: z.string().optional(),
  }),

  /* ── Contact selection and the call ─────────────────────────── */
  z.looseObject({
    type: z.literal("contact.selected"),
    orderId: z.string(),
    contact: ContactSchema,
    rung: z.number(),
  }),
  z.looseObject({
    type: z.literal("plan.composed"),
    orderId: z.string(),
    summary: z.string(),
    mustAsk: z.array(z.string()),
  }),
  z.looseObject({
    type: z.literal("call.state"),
    orderId: z.string(),
    callId: z.string(),
    state: CallStateSchema,
    /** When the call entered this state. Lets a replayed call show its real duration. */
    ts: z.iso.datetime().optional(),
  }),
  z.looseObject({
    type: z.literal("transcript.delta"),
    orderId: z.string(),
    speaker: z.enum(["AGENT", "HUMAN"]),
    text: z.string(),
    ts: z.string(),
  }),
  z.looseObject({
    type: z.literal("result.extracted"),
    orderId: z.string(),
    structured: WholesaleResultSchema,
    confidence: z.looseObject({ score: z.number(), label: z.string() }),
    evidence: z.array(z.string()),
  }),

  /* ── Decisions and outcomes ─────────────────────────────────── */
  z.looseObject({
    type: z.literal("order.escalated"),
    orderId: z.string(),
    fromRung: z.number(),
    toRung: z.number(),
    reason: z.string(),
  }),
  z.looseObject({
    type: z.literal("approval.required"),
    orderId: z.string(),
    reason: z.string(),
    previousUnitPrice: z.number(),
    proposedUnitPrice: z.number(),
    currency: z.string(),
  }),
  z.looseObject({
    type: z.literal("followup.scheduled"),
    orderId: z.string(),
    followUp: FollowUpSchema,
  }),
  z.looseObject({
    type: z.literal("order.updated"),
    orderId: z.string(),
    status: OrderStatusSchema,
    confirmedQuantity: z.number().nullable(),
    remainingQuantity: z.number().nullable(),
    /** Present only when the agreed unit price changed — an approved price change. */
    unitPrice: z.number().optional(),
    summary: z.string(),
    operatorMinutesSaved: z.number().nullable(),
  }),
  z.looseObject({
    type: z.literal("order.unresolved"),
    orderId: z.string(),
    reason: z.string(),
  }),
]);

export type SentinelEvent = z.infer<typeof SentinelEventSchema>;
export type SentinelEventType = SentinelEvent["type"];

/** Narrow a validated event to one member of the union. */
export function isEvent<T extends SentinelEventType>(
  event: SentinelEvent,
  type: T,
): event is Extract<SentinelEvent, { type: T }> {
  return event.type === type;
}
