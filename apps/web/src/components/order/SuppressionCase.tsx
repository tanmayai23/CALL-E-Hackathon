"use client";

/**
 * Why no call was placed (FR-2.3).
 *
 * A suppressed request gets its own panel rather than call panels reading "no
 * conversation *yet*" — nothing is coming, and an empty state that implies
 * otherwise is a small lie the UI does not need to tell.
 */

import { motion, useReducedMotion } from "framer-motion";
import { BellOff, Check } from "lucide-react";
import { StateChip } from "@/components/ui/StateChip";
import { T, landIn } from "@/lib/motion";

export function SuppressionCase({
  reason,
  duplicateOf,
  seller,
}: {
  reason: string;
  duplicateOf?: string;
  seller: string;
}) {
  const reduced = useReducedMotion() ?? false;

  const facts = [
    { label: "matched request", value: duplicateOf ?? "open request" },
    { label: "supplier", value: seller },
    { label: "calls placed", value: "0" },
    { label: "contacts disturbed", value: "0" },
  ];

  return (
    <div className="flex h-full flex-col gap-4 px-5 py-5">
      <div>
        <StateChip state="idle" icon={BellOff} size="sm">
          No call placed
        </StateChip>
      </div>

      <p className="text-sm leading-relaxed text-ink">{reason}</p>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line">
        {facts.map((fact, i) => (
          <motion.div
            key={fact.label}
            initial={reduced ? false : landIn.initial}
            animate={landIn.animate}
            transition={{ delay: reduced ? 0 : i * T.stagger, duration: 0.25 }}
            className="bg-panel px-4 py-3"
          >
            <dt className="micro">{fact.label}</dt>
            <dd className="mt-1 truncate text-base text-ink">{fact.value}</dd>
          </motion.div>
        ))}
      </dl>

      <div className="mt-auto flex items-start gap-2 border-t border-line pt-3">
        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-state-success" aria-hidden />
        <p className="text-[11px] leading-relaxed text-ink-faint">
          Duplicate checks run before a call is planned, so a repeated request can never cost a call
          or interrupt a supplier twice. The decision is logged against this request&rsquo;s trace ID.
        </p>
      </div>
    </div>
  );
}
