/**
 * VENDORED — do not edit.
 *
 * Generated from packages/types/index.ts by scripts/vendor-skill.mjs.
 * Edit the source file and re-run the generator; edits here are overwritten.
 */

/**
 * packages/types/index.ts
 * Shared types for Sentinel Ops — used by both frontend and backend.
 * Owner: Sameer (contracts) — Aryan consumes these in the agent.
 * FROZEN: do not change without owner agreement (CLAUDE.md Rule 4)
 */

// ─── Severity ────────────────────────────────────────────────────────────────

export type Severity = "INFO" | "WARNING" | "CRITICAL";

// ─── Domain entities ─────────────────────────────────────────────────────────

export interface Facility {
  id: string;
  name: string;
  timezone: string;
}

export interface Asset {
  id: string;
  type: string;
  location: string;
}

export interface Reading {
  metric: string;
  value: number;
  unit: string;
  threshold: number;
}

export interface Responder {
  id: string;
  name: string;
  role: string;
  phoneE164: string;          // E.164 format e.g. +919876543210
  skills: string[];
  shiftStart: string;         // HH:mm UTC
  shiftEnd: string;           // HH:mm UTC
  zone: string;
  ladderPriority: number;     // 1 = primary
  preferredLanguage: string;  // e.g. "en-IN", "hi-IN"
  cooldownUntil: string | null; // ISO-8601 or null
}

// ─── EscalationContext — frozen contract (CLAUDE.md §8.1) ────────────────────
// This is what Sameer's backend sends to trigger the agent.

export interface EscalationContext {
  incidentId: string;
  traceId: string;
  severity: Severity;
  safeWindowMinutes: number;
  consequence: string;        // e.g. "inventory is at risk"
  escalationRung: number;     // 1-indexed
  facility: Facility;
  asset: Asset;
  reading: Reading;
  responder: Responder;
}

// ─── Call records ─────────────────────────────────────────────────────────────

export type CallStatus =
  | "queued"
  | "dialling"
  | "connected"
  | "in_conversation"
  | "extracting"
  | "completed"
  | "failed"
  | "no_answer";

export interface CallRecord {
  callId: string;
  incidentId: string;
  responderId: string;
  escalationRung: number;
  status: CallStatus;
  taskCompleted: boolean;
  confidenceScore: number;
  confidenceLabel: string;
  evidence: string[];
  structuredResult: EscalationStructuredResult | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  traceId: string;
}

// ─── CALL-E result schema types (frozen contract — CLAUDE.md §6.5) ───────────

export type ResponderAvailable = "yes" | "no" | "conditional" | "unknown";

export type DeclineReason =
  | "on_another_job"
  | "off_shift"
  | "out_of_zone"
  | "not_qualified"
  | "no_reason"
  | "none";

export type NextAction =
  | "CLOSE_RESOLVED"
  | "ESCALATE_NEXT_RUNG"
  | "SCHEDULE_VERIFICATION_CALL"
  | "SCHEDULE_CALLBACK"
  | "HUMAN_REVIEW";

export interface EscalationStructuredResult {
  responder_available: ResponderAvailable;
  eta_minutes?: number;
  acknowledged_severity: boolean;
  requires_backup?: boolean;
  requires_parts?: boolean;
  decline_reason?: DeclineReason;
  callback_requested_at?: string;
  verbatim_commitment?: string;
  next_action: NextAction;
}

// ─── Outcome ──────────────────────────────────────────────────────────────────

export type IncidentStatus =
  | "OPEN"
  | "CALLING"
  | "RESOLVED"
  | "UNRESOLVED"
  | "HUMAN_REVIEW";

export interface Outcome {
  incidentId: string;
  responderId: string | null;
  committed: boolean;
  etaMinutes: number | null;
  verifiedAt: string | null;
  verificationResult: string | null;
  notifiedAt: string | null;
  timeSavedMinutes: number | null;
}

// ─── SSE Event schema (frozen — CLAUDE.md §8.3) ───────────────────────────────

export type SentinelEvent =
  | { type: "signal.received";     incidentId: string; value: number; ts: string }
  | { type: "incident.opened";     incidentId: string; severity: Severity; safeWindowMinutes: number }
  | { type: "incident.suppressed"; assetId: string; reason: string }
  | { type: "responder.selected";  incidentId: string; responder: Responder; rung: number }
  | { type: "plan.composed";       incidentId: string; summary: string; mustAsk: string[] }
  | { type: "call.state";          incidentId: string; callId: string; state: CallStatus }
  | { type: "transcript.delta";    incidentId: string; speaker: "AGENT" | "HUMAN"; text: string; ts: string }
  | { type: "result.extracted";    incidentId: string; structured: EscalationStructuredResult;
                                    confidence: { score: number; label: string }; evidence: string[] }
  | { type: "incident.escalated";  incidentId: string; fromRung: number; toRung: number }
  | { type: "incident.resolved";   incidentId: string; outcome: string; timeSavedMinutes: number }
  | { type: "incident.unresolved"; incidentId: string; reason: string };
