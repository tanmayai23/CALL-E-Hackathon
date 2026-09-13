"use client";

/**
 * The payoff, in one figure: how much of the order the call secured.
 *
 * A serif "120 / 200" over a thin fulfilment bar, then when each part moves.
 * Kept compact on purpose: the result strip must leave the conversation above
 * it room to be read at 1440×900. The order column carries the full legend.
 *
 * An unverified result — below the review floor — is shown as what was
 * claimed, in neutral ink and without a bar: nothing is secured until a person
 * has checked it.
 */

import { motion, useReducedMotion } from "framer-motion";
import { FulfilmentBar } from "./FulfilmentBar";
import { T } from "@/lib/motion";
import { cn } from "@/lib/utils";

export function QuantitySplit({
  requested,
  confirmed,
  remaining,
  unit,
  dispatch,
  remainingWhen,
  verified,
}: {
  requested: number;
  confirmed: number;
  remaining: number;
  unit: string;
  dispatch?: string;
  remainingWhen?: string;
  verified: boolean;
}) {
  const reduced = useReducedMotion() ?? false;

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={T.slow}
      className="flex flex-col gap-2"
    >
      <p className="flex items-baseline gap-1.5">
        <span className={cn("display-num text-3xl", verified ? "text-state-success" : "text-ink-dim")}>
          {confirmed}
        </span>
        <span className="display-num text-xl text-ink-faint">/ {requested}</span>
        <span className="text-xs text-ink-dim">{verified ? `${unit} secured` : `${unit} claimed`}</span>
      </p>
      {verified ? (
        <FulfilmentBar
          size="sm"
          requested={requested}
          confirmed={confirmed}
          remaining={remaining}
          unit={unit}
          remainingLabel={remainingWhen ?? "later"}
        />
      ) : (
        <p className="text-xs text-state-warning">Unverified — a person confirms it before the order changes.</p>
      )}
      {verified && dispatch && (
        <p className="truncate text-xs text-ink-dim">
          Dispatch <span className="font-medium text-ink">{dispatch}</span>
          {remaining > 0 && remainingWhen ? (
            <>
              {" "}· {remaining} <span className="font-medium text-ink">{remainingWhen}</span>
            </>
          ) : null}
        </p>
      )}
    </motion.div>
  );
}
