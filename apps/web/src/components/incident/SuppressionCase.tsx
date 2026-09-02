"use client";

/**
 * The restraint case — §12 #6: "visible proof that the agent chose *not* to
 * call on a transient spike. Restraint reads as intelligence."
 *
 * A suppressed incident gets its own panels rather than the call panels showing
 * "no conversation *yet*" — nothing is coming, and empty states that imply
 * otherwise are a small lie the UI does not need to tell.
 */

import { motion, useReducedMotion } from "framer-motion";
import { BellOff, Check } from "lucide-react";
import type { TelemetryPoint } from "@/hooks/useIncidentStream";
import { StateChip } from "@/components/ui/StateChip";
import { T, landIn } from "@/lib/motion";

export function SuppressionCase({
  reason,
  readings,
  threshold,
  unit,
}: {
  reason: string;
  readings: TelemetryPoint[];
  threshold: number;
  unit: string;
}) {
  const reduced = useReducedMotion() ?? false;
  const crossings = readings.filter((r) => r.value > threshold);
  const peak = readings.reduce((max, r) => Math.max(max, r.value), -Infinity);

  const facts = [
    { label: "readings in window", value: String(readings.length) },
    { label: "crossed ceiling", value: String(crossings.length) },
    {
      label: "peak",
      value: Number.isFinite(peak) ? `${peak.toFixed(1)}${unit}` : "—",
    },
    { label: "calls placed", value: "0" },
  ];

  return (
    <div className="flex h-full flex-col gap-4 px-4 py-4">
      <div className="flex items-start gap-3">
        <StateChip state="info" icon={BellOff} size="sm">
          No call placed
        </StateChip>
      </div>

      <p className="text-xs leading-relaxed text-ink-dim">{reason}</p>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-line bg-line">
        {facts.map((fact, i) => (
          <motion.div
            key={fact.label}
            initial={reduced ? false : landIn.initial}
            animate={landIn.animate}
            transition={{ delay: reduced ? 0 : i * T.stagger, duration: 0.25 }}
            className="bg-panel px-3 py-2.5"
          >
            <dt className="micro">{fact.label}</dt>
            <dd className="data-value mt-1 text-base text-ink">{fact.value}</dd>
          </motion.div>
        ))}
      </dl>

      <div className="mt-auto flex items-start gap-2 border-t border-line pt-3">
        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-state-success" aria-hidden />
        <p className="text-[11px] leading-relaxed text-ink-faint">
          Suppression is deterministic and runs before the agent — the LLM never sees this
          signal, so noise cannot cost a call. The decision is logged against the incident&rsquo;s
          trace ID and is replayable from the audit trail.
        </p>
      </div>
    </div>
  );
}
