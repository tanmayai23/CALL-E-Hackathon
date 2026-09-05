/**
 * Domain types — mirrors the data model in CLAUDE.md §7 and the
 * EscalationContext in §8.1 (owner: Sameer).
 *
 * NOTE: CLAUDE.md §13 places the canonical definitions in `packages/types`,
 * imported by both frontend and backend. That package does not exist in this
 * repository yet. These are a faithful mirror of the frozen contract, kept in
 * one file so the swap is a single import change:
 *
 *     import { ... } from "@sentinel/types";
 *
 * Do not diverge from the contract here. If a field needs to change, it changes
 * in both places at once, with the owner's agreement (Rule 4).
 */

export type Severity = "INFO" | "WARNING" | "CRITICAL";

export type IncidentStatus =
  | "OPEN"
  | "CALLING"
  | "RESOLVED"
  | "UNRESOLVED"
  | "HUMAN_REVIEW";

export type CallState =
  | "queued"
  | "dialling"
  | "connected"
  | "in_conversation"
  | "extracting"
  | "completed"
  | "failed"
  | "no_answer";

export type Speaker = "AGENT" | "HUMAN";

export type NextAction =
  | "CLOSE_RESOLVED"
  | "ESCALATE_NEXT_RUNG"
  | "SCHEDULE_VERIFICATION_CALL"
  | "SCHEDULE_CALLBACK"
  | "HUMAN_REVIEW";

export interface Facility {
  id: string;
  name: string;
  timezone: string;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

export interface Asset {
  id: string;
  facilityId: string;
  type: string;
  label: string;
  location: string;
  metric: string;
  safeMin: number;
  safeMax: number;
  unit: string;
  consequenceDesc: string;
  safeWindowMinutes: number;
  /** Floor-plan position in metres, [x, y, z] — drives the 3D facility view. */
  position: [number, number, number];
  lastHeartbeatAt: string;
}

export type Responder = {
  id: string;
  facilityId: string;
  name: string;
  role: string;
  skills: string[];
  phoneE164: string;
  shiftStart: string;
  shiftEnd: string;
  zone: string;
  ladderPriority: number;
  preferredLanguage: string;
  consentAt: string;
  cooldownUntil: string | null;
}

export interface Reading {
  metric: string;
  value: number;
  unit: string;
  threshold: number;
}

/** CLAUDE.md §8.1 — the payload the backend hands to the LangGraph agent. */
export interface EscalationContext {
  incidentId: string;
  traceId: string;
  severity: Severity;
  safeWindowMinutes: number;
  consequence: string;
  escalationRung: number;
  facility: Pick<Facility, "id" | "name" | "timezone">;
  asset: Pick<Asset, "id" | "type" | "location">;
  reading: Reading;
  responder: Responder;
}

/** CLAUDE.md §6.5 — the frozen CALL-E resultSchema, as it comes back. */
export interface EscalationResult {
  responder_available: "yes" | "no" | "conditional" | "unknown";
  eta_minutes?: number;
  eta_within_safe_window?: boolean;
  acknowledged_severity: boolean;
  requires_backup?: boolean;
  requires_parts?: boolean;
  decline_reason?:
    | "on_another_job"
    | "off_shift"
    | "out_of_zone"
    | "not_qualified"
    | "no_reason"
    | "none";
  callback_requested_at?: string;
  verbatim_commitment?: string;
  next_action: NextAction;
}

export interface Confidence {
  score: number;
  label: string;
}

export interface TranscriptTurn {
  id: string;
  speaker: Speaker;
  text: string;
  ts: string;
  /** Set once extraction lands — spans of `text` that CALL-E cited as evidence. */
  evidence?: boolean;
}

export interface AgentEvent {
  id: string;
  node: string;
  label: string;
  detail?: string;
  ts: string;
  state: "done" | "live" | "pending" | "failed";
}

export interface Incident {
  id: string;
  traceId: string;
  facility: Facility;
  asset: Asset;
  severity: Severity;
  status: IncidentStatus;
  openedAt: string;
  closedAt: string | null;
  safeWindowMinutes: number;
  escalationRung: number;
  maxRungs: number;
  reading: Reading;
  scenarioId: string;
  finalOutcome: string | null;
  timeSavedMinutes: number | null;
}

/** One rung of the escalation ladder, as rendered in the Live Call Theatre. */
export interface LadderRung {
  rung: number;
  responder: Responder;
  state: "pending" | "active" | "declined" | "no_answer" | "committed";
  detail?: string;
}
