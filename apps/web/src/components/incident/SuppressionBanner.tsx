"use client";

/**
 * The banner that says nobody's phone rang.
 *
 * §12 #6 ranks the suppression log among the details that make a judge read
 * this as a real product: visible proof that the agent chose *not* to call on a
 * transient spike. Restraint reads as intelligence, but only if it is shown.
 */

import { motion, useReducedMotion } from "framer-motion";
import { StateChip } from "@/components/ui/StateChip";
import { T } from "@/lib/motion";

export function SuppressionBanner({ reason }: { reason: string }) {
  const reduced = useReducedMotion() ?? false;

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={T.base}
      className="flex shrink-0 items-start gap-3 border-b border-state-info/30 bg-state-info/8 px-4 py-3"
    >
      <StateChip state="info" size="sm">
        Suppressed
      </StateChip>
      <p className="text-xs leading-relaxed text-ink-dim">
        <span className="text-ink">No call was placed.</span> {reason}
      </p>
    </motion.div>
  );
}
