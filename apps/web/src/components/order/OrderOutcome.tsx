"use client";

/**
 * The closing beat of an order.
 *
 * Not a toast (§13 of the design guide lists that as an anti-pattern) — a
 * persistent strip carrying the outcome, the follow-up the system committed to,
 * and the operator time the call replaced.
 */

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CalendarClock, OctagonAlert, Timer } from "lucide-react";
import type { FollowUp } from "@/lib/contracts/domain";
import type { OrderUpdate } from "@/hooks/useOrderStream";
import { StateChip } from "@/components/ui/StateChip";
import { FOLLOW_UP_LABEL, ORDER_STATUS } from "@/lib/state-map";
import { formatMinutes } from "@/lib/utils";
import { formatters } from "@/lib/time";
import { T } from "@/lib/motion";

/** The strip only speaks for outcomes; an approval has its own banner. */
const SHOWN = new Set(["CONFIRMED", "PARTIALLY_CONFIRMED", "CALLBACK_SCHEDULED", "HUMAN_REVIEW"]);

const TONE: Record<string, string> = {
  CONFIRMED: "border-state-success/30 bg-state-success/8",
  PARTIALLY_CONFIRMED: "border-state-success/30 bg-state-success/8",
  CALLBACK_SCHEDULED: "border-line-strong bg-stone/40",
  HUMAN_REVIEW: "border-state-info/30 bg-state-info/8",
};

export function OrderOutcome({
  update,
  unresolved,
  followUps,
}: {
  update: OrderUpdate | null;
  unresolved: { reason: string } | null;
  followUps: FollowUp[];
}) {
  const reduced = useReducedMotion() ?? false;
  const enter = reduced ? false : { opacity: 0, y: 10 };
  const next = followUps
    .filter((f) => f.status === "SCHEDULED")
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];

  return (
    <AnimatePresence>
      {update && SHOWN.has(update.status) && !unresolved && (
        <motion.div
          key="update"
          initial={enter}
          animate={{ opacity: 1, y: 0 }}
          transition={T.slow}
          className={`flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-t px-5 py-3 ${TONE[update.status]}`}
        >
          <StateChip state={ORDER_STATUS[update.status].state} icon={ORDER_STATUS[update.status].icon}>
            {ORDER_STATUS[update.status].label}
          </StateChip>
          <p className="min-w-0 flex-1 text-sm leading-relaxed text-ink">{update.summary}</p>

          {next && (
            <span className="flex items-center gap-2 text-xs text-ink-dim" suppressHydrationWarning>
              <CalendarClock className="h-3.5 w-3.5 text-ink-faint" aria-hidden />
              {FOLLOW_UP_LABEL[next.kind]} · <span className="data-value text-ink">{formatters.dayTime.format(new Date(next.dueAt))}</span>
            </span>
          )}

          {update.operatorMinutesSaved != null && (
            <span className="flex items-center gap-2">
              <Timer className="h-3.5 w-3.5 text-state-success" aria-hidden />
              <span className="micro">Operator time saved</span>
              <span className="data-value text-base leading-none text-state-success">
                {formatMinutes(update.operatorMinutesSaved)}
              </span>
            </span>
          )}
        </motion.div>
      )}

      {unresolved && (
        <motion.div
          key="unresolved"
          initial={enter}
          animate={{ opacity: 1, y: 0 }}
          transition={T.slow}
          className="animate-shake flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-t border-state-critical/40 bg-state-critical/8 px-5 py-3"
        >
          <StateChip state="critical" icon={OctagonAlert}>
            Unresolved
          </StateChip>
          <p className="min-w-0 flex-1 text-sm leading-relaxed text-ink">
            {unresolved.reason} — a person needs to take this order now.
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
