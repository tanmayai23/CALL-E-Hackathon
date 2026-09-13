"use client";

/**
 * How much of an order is spoken for.
 *
 * Three segments of one bar: confirmed (teal), promised later (amber), and not
 * yet confirmed (stone). It is the single picture of the product's promise —
 * the order went in as a number and came back as a commitment — so it appears
 * on the order screen, in the queue, and in the result panel, always the same.
 */

import { motion, useReducedMotion } from "framer-motion";
import { T } from "@/lib/motion";
import { cn } from "@/lib/utils";

export function FulfilmentBar({
  requested,
  confirmed,
  remaining,
  unit,
  size = "md",
  remainingLabel = "later",
  className,
}: {
  requested: number;
  confirmed: number | null;
  remaining: number | null;
  unit: string;
  size?: "sm" | "md";
  /** How the promised-later segment is described, e.g. "tomorrow". */
  remainingLabel?: string;
  className?: string;
}) {
  const reduced = useReducedMotion() ?? false;
  const safe = Math.max(requested, 1);
  const confirmedPct = ((confirmed ?? 0) / safe) * 100;
  const remainingPct = ((remaining ?? 0) / safe) * 100;
  const transition = reduced ? { duration: 0 } : T.slow;

  const label =
    confirmed == null
      ? `0 of ${requested} ${unit} confirmed`
      : `${confirmed} of ${requested} ${unit} confirmed${remaining ? `, ${remaining} ${remainingLabel}` : ""}`;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        className={cn(
          "relative flex w-full overflow-hidden rounded-full bg-stone",
          size === "sm" ? "h-1.5" : "h-2.5",
        )}
        role="img"
        aria-label={label}
      >
        <motion.span
          className="h-full bg-state-success"
          initial={false}
          animate={{ width: `${confirmedPct}%` }}
          transition={transition}
        />
        <motion.span
          className="h-full bg-state-warning/70"
          initial={false}
          animate={{ width: `${remainingPct}%` }}
          transition={{ ...transition, delay: reduced ? 0 : 0.12 }}
        />
      </div>

      {size === "md" && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-dim">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-state-success" aria-hidden />
            <span className="data-value text-ink">{confirmed ?? 0}</span> confirmed
          </span>
          {remaining ? (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-state-warning/70" aria-hidden />
              <span className="data-value text-ink">{remaining}</span> {remainingLabel}
            </span>
          ) : null}
          <span className="ml-auto data-value text-ink-faint">
            of {requested} {unit}
          </span>
        </div>
      )}
    </div>
  );
}
