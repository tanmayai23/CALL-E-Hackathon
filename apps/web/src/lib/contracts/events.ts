/**
 * SSE event contract — CLAUDE.md §8.3. FROZEN (owner: Sameer).
 *
 * The shapes below are transcribed verbatim from the contract. Every member is
 * a LOOSE object: unknown keys pass through rather than being stripped, so a
 * backend that carries `traceId` on the wire (Rule 7) does not get it silently
 * deleted here, and an added field never breaks the dashboard mid-demo.
 *
 * §7.2: validate every event at the boundary. A malformed event degrades one
 * panel — it must never white-screen the dashboard.
 */

import { z } from "zod";

const SeveritySchema = z.enum(["INFO", "WARNING", "CRITICAL"]);

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

const ResponderSchema = z.looseObject({
  id: z.string(),
  facilityId: z.string(),
  name: z.string(),
  role: z.string(),
  skills: z.array(z.string()),
  phoneE164: z.string(),
  shiftStart: z.string(),
  shiftEnd: z.string(),
  zone: z.string(),
  ladderPriority: z.number(),
  preferredLanguage: z.string(),
  consentAt: z.string(),
  cooldownUntil: z.string().nullable(),
});

export const SentinelEventSchema = z.discriminatedUnion("type", [
  z.looseObject({
    type: z.literal("signal.received"),
    incidentId: z.string(),
    value: z.number(),
    ts: z.string(),
  }),
  z.looseObject({
    type: z.literal("incident.opened"),
    incidentId: z.string(),
    severity: SeveritySchema,
    safeWindowMinutes: z.number(),
  }),
  z.looseObject({
    type: z.literal("incident.suppressed"),
    assetId: z.string(),
    reason: z.string(),
  }),
  z.looseObject({
    type: z.literal("responder.selected"),
    incidentId: z.string(),
    responder: ResponderSchema,
    rung: z.number(),
  }),
  z.looseObject({
    type: z.literal("plan.composed"),
    incidentId: z.string(),
    summary: z.string(),
    mustAsk: z.array(z.string()),
  }),
  z.looseObject({
    type: z.literal("call.state"),
    incidentId: z.string(),
    callId: z.string(),
    state: CallStateSchema,
  }),
  z.looseObject({
    type: z.literal("transcript.delta"),
    incidentId: z.string(),
    speaker: z.enum(["AGENT", "HUMAN"]),
    text: z.string(),
    ts: z.string(),
  }),
  z.looseObject({
    type: z.literal("result.extracted"),
    incidentId: z.string(),
    structured: z.record(z.string(), z.unknown()),
    confidence: z.looseObject({ score: z.number(), label: z.string() }),
    evidence: z.array(z.string()),
  }),
  z.looseObject({
    type: z.literal("incident.escalated"),
    incidentId: z.string(),
    fromRung: z.number(),
    toRung: z.number(),
  }),
  z.looseObject({
    type: z.literal("incident.resolved"),
    incidentId: z.string(),
    outcome: z.string(),
    timeSavedMinutes: z.number(),
  }),
  z.looseObject({
    type: z.literal("incident.unresolved"),
    incidentId: z.string(),
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
