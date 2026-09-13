"use client";

/**
 * The banner that says nobody's phone rang.
 *
 * Visible proof that the system chose *not* to call — here, because the request
 * was already covered. Restraint reads as judgement, but only if it is shown.
 */

import { motion, useReducedMotion } from "framer-motion";
import { BellOff } from "lucide-react";
import { StateChip } from "@/components/ui/StateChip";
import { T } from "@/lib/motion";

export function SuppressionBanner({ reason }: { reason: string }) {
  const reduced = useReducedMotion() ?? false;

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={T.base}
      className="flex shrink-0 items-start gap-3 border-b border-line-strong bg-stone/40 px-5 py-3"
    >
      <StateChip state="idle" icon={BellOff} size="sm">
        Suppressed
      </StateChip>
      <p className="text-xs leading-relaxed text-ink-dim">
        <span className="font-medium text-ink">No call was placed.</span> {reason}
      </p>
    </motion.div>
  );
}
