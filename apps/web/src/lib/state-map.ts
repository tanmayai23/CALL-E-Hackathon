import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
  Ear,
  Info,
  OctagonAlert,
  PhoneCall,
  PhoneMissed,
  PhoneOff,
  ScanLine,
  Timer,
  UserSearch,
} from "lucide-react";
import type { CallState, IncidentStatus, Severity } from "@/lib/contracts/domain";
import type { ChipState } from "@/components/ui/StateChip";

export interface ChipSpec {
  state: ChipState;
  label: string;
  icon: LucideIcon;
  pulse?: boolean;
}

export const SEVERITY: Record<Severity, ChipSpec> = {
  INFO: { state: "info", label: "INFO", icon: Info },
  WARNING: { state: "warning", label: "WARNING", icon: AlertTriangle },
  CRITICAL: { state: "critical", label: "CRITICAL", icon: OctagonAlert },
};

export const STATUS: Record<IncidentStatus, ChipSpec> = {
  OPEN: { state: "warning", label: "Open", icon: AlertTriangle },
  CALLING: { state: "active", label: "Calling", icon: PhoneCall, pulse: true },
  RESOLVED: { state: "success", label: "Resolved", icon: CheckCircle2 },
  UNRESOLVED: { state: "critical", label: "Unresolved", icon: OctagonAlert },
  HUMAN_REVIEW: { state: "info", label: "Human review", icon: UserSearch },
};

/** §4.2 — every call state has an unmistakable signature in a still frame. */
export const CALL: Record<CallState, ChipSpec> = {
  queued: { state: "idle", label: "Queued", icon: Timer },
  dialling: { state: "active", label: "Dialling…", icon: PhoneCall, pulse: true },
  connected: { state: "active", label: "Connected", icon: PhoneCall },
  in_conversation: { state: "active", label: "In conversation", icon: Ear, pulse: true },
  extracting: { state: "info", label: "Extracting result", icon: ScanLine },
  completed: { state: "success", label: "Completed", icon: CheckCircle2 },
  failed: { state: "critical", label: "Call failed", icon: PhoneOff },
  no_answer: { state: "critical", label: "No answer", icon: PhoneMissed },
};

export const SEVERITY_HEX: Record<Severity, string> = {
  INFO: "var(--state-info)",
  WARNING: "var(--state-warning)",
  CRITICAL: "var(--state-critical)",
};

/**
 * FR-6.3 — extraction below this confidence never auto-closes an incident; it
 * is routed to a human. Enforced in code, never in the prompt (CLAUDE.md §12:
 * "an LLM instruction is not a safety control").
 */
export const HUMAN_REVIEW_THRESHOLD = 0.7;

/** Confidence scale — §2.2. */
export function confidenceBand(score: number): {
  token: string;
  label: string;
  chip: ChipState;
  icon: LucideIcon;
} {
  if (score >= 0.85)
    return { token: "var(--conf-high)", label: "HIGH", chip: "success", icon: CheckCircle2 };
  if (score >= HUMAN_REVIEW_THRESHOLD)
    return { token: "var(--conf-medium)", label: "MEDIUM", chip: "warning", icon: AlertTriangle };
  return { token: "var(--conf-low)", label: "NEEDS REVIEW", chip: "critical", icon: CircleSlash };
}

export const FIELD_LABELS: Record<string, string> = {
  responder_available: "responder available",
  eta_minutes: "eta minutes",
  eta_within_safe_window: "eta within safe window",
  acknowledged_severity: "acknowledged severity",
  requires_backup: "requires backup",
  requires_parts: "requires parts",
  decline_reason: "decline reason",
  callback_requested_at: "callback requested at",
  verbatim_commitment: "verbatim commitment",
  next_action: "next action",
};

/**
 * Field order matters on camera. §4.1 draws the result as a single strip, so
 * the five fields that actually decide the workflow lead, and the rest sit
 * behind an expander rather than pushing the payoff below the fold.
 */
export const PRIMARY_FIELDS = [
  "responder_available",
  "eta_minutes",
  "eta_within_safe_window",
  "verbatim_commitment",
  "next_action",
];

export const SECONDARY_FIELDS = [
  "acknowledged_severity",
  "requires_backup",
  "requires_parts",
  "decline_reason",
  "callback_requested_at",
];

export const FIELD_ORDER = [...PRIMARY_FIELDS, ...SECONDARY_FIELDS];
