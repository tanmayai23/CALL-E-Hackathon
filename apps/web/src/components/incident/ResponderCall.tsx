"use client";

/**
 * Responder + live call state — §4.2 and signature animation §6.3 #1.
 * Concentric rings expanding from the responder's initials read as "ringing"
 * instantly, without a word of narration.
 */

import { motion, useReducedMotion } from "framer-motion";
import { PhoneOutgoing } from "lucide-react";
import type { CallState, Responder } from "@/lib/contracts/domain";
import { StateChip } from "@/components/ui/StateChip";
import { EmptyState } from "@/components/ui/Panel";
import { useNow } from "@/hooks/useClientValue";
import { CALL } from "@/lib/state-map";
import { maskPhone } from "@/lib/mock/facility";
import { formatClock } from "@/lib/utils";
import { T } from "@/lib/motion";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}

function CallTimer({ connectedAt, running }: { connectedAt: number | null; running: boolean }) {
  const now = useNow(250, running && connectedAt != null);

  if (connectedAt == null) return null;
  const elapsed = Math.max(0, (now ?? connectedAt) - connectedAt);

  return (
    <span className="data-value flex items-center gap-1.5 text-sm text-ink">
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          running ? "animate-beacon bg-state-active" : "bg-state-idle",
        )}
        aria-hidden
      />
      {formatClock(elapsed)}
    </span>
  );
}

export function ResponderCall({
  responder,
  rung,
  callState,
  connectedAt,
}: {
  responder: Responder | null;
  rung: number;
  callState: CallState | null;
  connectedAt: number | null;
}) {
  const reduced = useReducedMotion() ?? false;

  if (!responder) {
    return (
      <EmptyState
        icon={PhoneOutgoing}
        title="No responder selected"
        body="The agent filters the consented roster by required skill, on-shift window and service zone, then picks the highest-priority match for the current escalation rung."
      />
    );
  }

  const spec = callState ? CALL[callState] : null;
  const ringing = callState === "dialling";
  const conversing = callState === "in_conversation" || callState === "connected";

  return (
    <div className="flex items-center gap-4 px-4 py-4">
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
        {ringing && !reduced && (
          <>
            <span
              aria-hidden
              className="animate-pulse-ring absolute inset-0 rounded-full border border-state-active"
            />
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
            "data-value flex h-12 w-12 items-center justify-center rounded-full border text-sm font-medium",
            conversing || ringing
              ? "border-state-active bg-state-active/12 text-state-active"
              : "border-line-strong bg-elevated text-ink-dim",
          )}
        >
          {initials(responder.name)}
        </motion.span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="truncate text-sm font-medium text-ink">{responder.name}</p>
          <span className="micro shrink-0">rung {rung}</span>
        </div>
        <p className="truncate text-xs text-ink-dim">{responder.role}</p>
        <p className="data-value mt-0.5 truncate text-[11px] text-ink-faint">
          {maskPhone(responder.phoneE164)} · zone {responder.zone} · {responder.preferredLanguage}
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
        <CallTimer connectedAt={connectedAt} running={conversing} />
      </div>
    </div>
  );
}
