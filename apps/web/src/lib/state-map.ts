/**
 * Every state in the product, mapped once to colour + icon + text.
 *
 * Components never pick a state colour themselves; they look it up here. That
 * is what keeps the rule "colour is semantic, and never appears alone" true
 * across every screen.
 */

import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BellOff,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  CircleSlash,
  Ear,
  Gauge,
  Hourglass,
  OctagonAlert,
  PackageCheck,
  PackageOpen,
  PackageX,
  PhoneCall,
  PhoneMissed,
  PhoneOff,
  ScanLine,
  ShieldQuestion,
  Timer,
  UserSearch,
  Voicemail,
} from "lucide-react";
import type {
  CallState,
  ContactReached,
  FollowUpKind,
  NextAction,
  OrderStatus,
  StockStatus,
  TriggerType,
  Urgency,
} from "@/lib/contracts/domain";
import { HUMAN_REVIEW_THRESHOLD } from "@/lib/contracts/domain";
import type { ChipState } from "@/components/ui/StateChip";

export interface ChipSpec {
  state: ChipState;
  label: string;
  icon: LucideIcon;
  pulse?: boolean;
}

export const ORDER_STATUS: Record<OrderStatus, ChipSpec> = {
  AWAITING_CONFIRMATION: { state: "warning", label: "Awaiting confirmation", icon: Hourglass },
  CALLING: { state: "active", label: "Calling", icon: PhoneCall, pulse: true },
  CONFIRMED: { state: "success", label: "Confirmed", icon: CheckCircle2 },
  PARTIALLY_CONFIRMED: { state: "success", label: "Partially confirmed", icon: PackageCheck },
  APPROVAL_REQUIRED: { state: "info", label: "Approval required", icon: ShieldQuestion },
  CALLBACK_SCHEDULED: { state: "idle", label: "Callback scheduled", icon: CalendarClock },
  HUMAN_REVIEW: { state: "info", label: "Human review", icon: UserSearch },
  UNRESOLVED: { state: "critical", label: "Unresolved", icon: OctagonAlert },
  SUPPRESSED: { state: "idle", label: "Suppressed", icon: BellOff },
};

export const URGENCY: Record<Urgency, ChipSpec> = {
  ROUTINE: { state: "idle", label: "Routine", icon: Gauge },
  PRIORITY: { state: "warning", label: "Priority", icon: AlertTriangle },
  URGENT: { state: "critical", label: "Urgent", icon: OctagonAlert },
};

/** §4.2 of the design guide — every call state is readable from a still frame. */
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

export const STOCK_STATUS: Record<StockStatus, ChipSpec> = {
  confirmed: { state: "success", label: "In stock", icon: PackageCheck },
  partial: { state: "warning", label: "Partial stock", icon: PackageOpen },
  unavailable: { state: "critical", label: "Unavailable", icon: PackageX },
  unknown: { state: "idle", label: "Unknown", icon: CircleDashed },
};

export const CONTACT_REACHED: Record<ContactReached, ChipSpec> = {
  yes: { state: "success", label: "Reached", icon: CheckCircle2 },
  no: { state: "critical", label: "Not reached", icon: PhoneMissed },
  wrong_person: { state: "warning", label: "Wrong person", icon: UserSearch },
  voicemail: { state: "warning", label: "Voicemail", icon: Voicemail },
  unknown: { state: "idle", label: "Unknown", icon: CircleDashed },
};

export const NEXT_ACTION_LABEL: Record<NextAction, string> = {
  CONFIRM_ORDER: "Confirm order",
  PARTIAL_CONFIRMATION: "Partial confirmation",
  REQUEST_APPROVAL: "Request approval",
  SCHEDULE_CALLBACK: "Schedule callback",
  ESCALATE_NEXT_CONTACT: "Escalate to next contact",
  HUMAN_REVIEW: "Human review",
};

export const TRIGGER_LABEL: Record<TriggerType, string> = {
  ORDER: "Order event",
  INVENTORY: "Inventory event",
  DELIVERY: "Delivery event",
  EXCEPTION: "Exception",
  IOT: "Sensor event",
};

export const FOLLOW_UP_LABEL: Record<FollowUpKind, string> = {
  VERIFICATION: "Verification call",
  CALLBACK: "Callback",
  REMAINING_QUANTITY: "Remaining quantity",
};

/** Re-exported beside the confidence scale it anchors; defined with the domain. */
export { HUMAN_REVIEW_THRESHOLD };

/** Confidence scale. */
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

/** Plain-language labels for the §7.2 result fields. */
export const FIELD_LABELS: Record<string, string> = {
  contact_reached: "contact reached",
  stock_status: "stock status",
  confirmed_quantity: "confirmed quantity",
  remaining_quantity: "remaining quantity",
  unit_price: "unit price",
  currency: "currency",
  dispatch_date: "dispatch date",
  delivery_eta: "delivery eta",
  delay_reason: "delay reason",
  callback_requested_at: "callback requested",
  requires_approval: "requires approval",
  verbatim_commitment: "verbatim commitment",
  next_action: "next action",
};

/**
 * The fields that decide the workflow lead; the rest sit behind an expander so
 * the payoff strip never falls below the fold at 1440×900.
 */
export const PRIMARY_FIELDS = [
  "stock_status",
  "confirmed_quantity",
  "remaining_quantity",
  "dispatch_date",
  "next_action",
];

export const SECONDARY_FIELDS = [
  "contact_reached",
  "delivery_eta",
  "unit_price",
  "currency",
  "requires_approval",
  "callback_requested_at",
  "delay_reason",
  "verbatim_commitment",
];
