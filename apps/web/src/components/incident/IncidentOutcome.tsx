"use client";

/**
 * The closing beat of an incident.
 *
 * A resolution is not a toast (§13 lists that as an anti-pattern) — it is a
 * persistent strip carrying the negotiated outcome and the business number
 * that outcome is worth, which is §12 #4.
 */

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, OctagonAlert, Timer } from "lucide-react";
import { StateChip } from "@/components/ui/StateChip";
import { formatMinutes } from "@/lib/utils";
import { T } from "@/lib/motion";

export function IncidentOutcome({
  resolved,
  unresolved,
}: {
  resolved: { outcome: string; timeSavedMinutes: number } | null;
  unresolved: { reason: string } | null;
}) {
  const reduced = useReducedMotion() ?? false;
  const enter = reduced ? false : { opacity: 0, y: 10 };

  return (
    <AnimatePresence>
      {resolved && (
        <motion.div
          key="resolved"
          initial={enter}
          animate={{ opacity: 1, y: 0 }}
          transition={T.slow}
          className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-t border-state-success/35 bg-state-success/8 px-4 py-3"
        >
          <StateChip state="success" icon={CheckCircle2}>
            Incident closed
          </StateChip>
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-ink">{resolved.outcome}</p>
          <div className="flex items-center gap-2">
            <Timer className="h-3.5 w-3.5 text-state-success" aria-hidden />
            <span className="micro">Human time saved</span>
            <span className="data-value text-lg leading-none text-state-success">
              {formatMinutes(resolved.timeSavedMinutes)}
            </span>
          </div>
        </motion.div>
      )}

      {unresolved && (
        <motion.div
          key="unresolved"
          initial={enter}
          animate={{ opacity: 1, y: 0 }}
          transition={T.slow}
          className="animate-shake flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-t border-state-critical/45 bg-state-critical/10 px-4 py-3"
        >
          <StateChip state="critical" icon={OctagonAlert}>
            Unresolved
          </StateChip>
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-ink">
            {unresolved.reason} — this incident requires human intervention now.
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
