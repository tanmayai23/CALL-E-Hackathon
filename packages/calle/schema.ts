/**
 * packages/calle/schema.ts
 * CALL-E result schema — frozen contract (CLAUDE.md §6.5)
 * Owner: Aryan + Tanmay
 *
 * This is the single source of truth for what we extract from every call.
 * Do NOT inline a different schema anywhere else.
 */

export const ESCALATION_RESULT_SCHEMA = {
  type: "object",
  required: ["responder_available", "acknowledged_severity", "next_action"],
  properties: {
    responder_available: {
      type: "string",
      enum: ["yes", "no", "conditional", "unknown"],
      description: "Whether the responder committed to attending the incident.",
    },
    eta_minutes: {
      type: "number",
      description:
        "Minutes until the responder can arrive on site. Omit if not committed.",
    },
    acknowledged_severity: {
      type: "boolean",
      description:
        "Did the responder verbally acknowledge the severity level stated?",
    },
    requires_backup: {
      type: "boolean",
      description:
        "Did the responder request that a backup technician be arranged?",
    },
    requires_parts: {
      type: "boolean",
      description: "Did the responder indicate replacement parts are needed?",
    },
    decline_reason: {
      type: "string",
      enum: [
        "on_another_job",
        "off_shift",
        "out_of_zone",
        "not_qualified",
        "no_reason",
        "none",
      ],
      description: "Reason for declining. Use 'none' if they accepted.",
    },
    callback_requested_at: {
      type: "string",
      description:
        "ISO-8601 time if the responder asked to be called back later.",
    },
    verbatim_commitment: {
      type: "string",
      description:
        "The responder's exact words committing to or declining the task.",
    },
    next_action: {
      type: "string",
      enum: [
        "CLOSE_RESOLVED",
        "ESCALATE_NEXT_RUNG",
        "SCHEDULE_VERIFICATION_CALL",
        "SCHEDULE_CALLBACK",
        "HUMAN_REVIEW",
      ],
      description: "What the agent should do next based on this call outcome.",
    },
  },
} as const;
