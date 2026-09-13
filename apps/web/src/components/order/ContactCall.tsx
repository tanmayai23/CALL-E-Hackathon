"use client";

/**
 * The contact being called, and the live state of that call.
 * Concentric rings from the contact's initials read as "ringing" in a still
 * frame, without a word of narration.
 */

import { motion, useReducedMotion } from "framer-motion";
import { PhoneOutgoing } from "lucide-react";
import type { CallState, Contact } from "@/lib/contracts/domain";
import { StateChip } from "@/components/ui/StateChip";
import { EmptyState } from "@/components/ui/Panel";
import { useNow } from "@/hooks/useClientValue";
import { CALL } from "@/lib/state-map";
import { maskPhone } from "@/lib/mock/directory";
import { cn, formatClock } from "@/lib/utils";
import { T } from "@/lib/motion";

export const RUNG_NAME: Record<number, string> = { 1: "primary", 2: "backup", 3: "supervisor" };

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}

function CallTimer({
  connectedAt,
  endedAt,
  running,
}: {
  connectedAt: number | null;
  endedAt: number | null;
  running: boolean;
}) {
  const now = useNow(250, running && connectedAt != null);
  if (connectedAt == null) return null;
  const until = running ? now : (endedAt ?? now);
  const elapsed = Math.max(0, (until ?? connectedAt) - connectedAt);

  return (
    <span className="data-value flex items-center gap-1.5 text-sm text-ink">
      <span
        className={cn("h-1.5 w-1.5 rounded-full", running ? "animate-beacon bg-state-active" : "bg-state-idle")}
        aria-hidden
      />
      {formatClock(elapsed)}
    </span>
  );
}

export function ContactCall({
  contact,
  company,
  rung,
  callState,
  connectedAt,
  endedAt,
}: {
  contact: Contact | null;
  company: string;
  rung: number;
  callState: CallState | null;
  connectedAt: number | null;
  endedAt: number | null;
}) {
  const reduced = useReducedMotion() ?? false;

  if (!contact) {
    return (
      <EmptyState
        icon={PhoneOutgoing}
        title="No contact selected yet"
        body="The agent picks a consented contact at the supplier by product, region, working hours and escalation priority, starting with the primary."
      />
    );
  }

  const spec = callState ? CALL[callState] : null;
  const ringing = callState === "dialling";
  const conversing = callState === "in_conversation" || callState === "connected";

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
        {ringing && !reduced && (
          <>
            <span aria-hidden className="animate-pulse-ring absolute inset-0 rounded-full border border-state-active" />
            <span
              aria-hidden
              className="animate-pulse-ring absolute inset-0 rounded-full border border-state-active"
              style={{ animationDelay: "0.4s" }}
            />
          </>
        )}
        <motion.span
          initial={false}
          animate={{ scale: conversing ? 1 : 0.96 }}
          transition={T.spring}
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full border text-sm font-semibold",
            conversing || ringing
              ? "border-state-active/50 bg-state-active/10 text-state-active"
              : "border-line-strong bg-stone/60 text-ink-dim",
          )}
        >
          {initials(contact.name)}
        </motion.span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="truncate text-sm font-semibold text-ink">{contact.name}</p>
          <span className="micro shrink-0">{RUNG_NAME[rung] ?? `rung ${rung}`}</span>
        </div>
        <p className="truncate text-xs text-ink-dim">
          {contact.role} · {company}
        </p>
        <p className="data-value mt-0.5 truncate text-[11px] text-ink-faint">
          {maskPhone(contact.phoneE164)} · {contact.region} · {contact.workingHours.start}–
          {contact.workingHours.end}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        {spec ? (
          <StateChip state={spec.state} icon={spec.icon} pulse={spec.pulse} size="sm">
            {spec.label}
          </StateChip>
        ) : (
          <StateChip state="idle" size="sm">
            Not dialled
          </StateChip>
        )}
        <CallTimer connectedAt={connectedAt} endedAt={endedAt} running={conversing} />
      </div>
    </div>
  );
}
