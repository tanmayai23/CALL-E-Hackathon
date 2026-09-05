"use client";

/**
 * One incident in the feed.
 *
 * Stacked block on a phone, single row on a desktop. `sm:contents` dissolves
 * the mobile grouping wrappers at sm and up, so both shapes come from one set
 * of markup rather than two that drift apart.
 */

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import type { Incident } from "@/lib/contracts/domain";
import { StateChip } from "@/components/ui/StateChip";
import { SEVERITY, STATUS } from "@/lib/state-map";
import { formatMinutes, relativeTime } from "@/lib/utils";
import { T } from "@/lib/motion";

export function IncidentRow({ incident, index }: { incident: Incident; index: number }) {
  const reduced = useReducedMotion() ?? false;
  const sev = SEVERITY[incident.severity];
  const status = STATUS[incident.status];
  const busy = incident.status === "CALLING" || incident.status === "OPEN";
  const saved = incident.timeSavedMinutes;

  return (
    <motion.li
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...T.base, delay: reduced ? 0 : Math.min(index, 6) * 0.03 }}
    >
      <Link
        href={`/ops/incident/${incident.id}`}
        className="group flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-elevated sm:flex-row sm:items-center sm:gap-4"
      >
        <span className="flex items-center gap-3 sm:contents">
          <span className="flex shrink-0 justify-start sm:w-[92px]">
            <StateChip
              state={sev.state}
              icon={sev.icon}
              size="sm"
              pulse={busy && incident.severity === "CRITICAL"}
            >
              {sev.label}
            </StateChip>
          </span>

          <span className="min-w-0 flex-1 sm:w-[76px] sm:flex-none">
            <span className="data-value block text-sm text-ink">{incident.asset.id}</span>
            <span className="micro block truncate" title={incident.asset.location}>
              {incident.asset.location.split(" · ")[0]}
            </span>
          </span>

          <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint sm:hidden" aria-hidden />
        </span>

        <span className="min-w-0 sm:flex-1">
          <span className="flex items-center gap-2">
            <StateChip
              state={status.state}
              icon={status.icon}
              size="sm"
              pulse={status.pulse}
            >
              {status.label}
            </StateChip>
            {incident.escalationRung > 1 && (
              <span className="micro">rung {incident.escalationRung}</span>
            )}
          </span>
          <span className="mt-1 block truncate text-[11px] text-ink-dim">
            {incident.finalOutcome ?? "Agent working — no outcome yet"}
          </span>
        </span>

        <span className="flex shrink-0 items-baseline justify-between gap-3 sm:contents">
          <span className="hidden text-right lg:block">
            <span className="data-value block text-[11px] text-ink-faint">
              {incident.traceId}
            </span>
            <span className="micro block">{relativeTime(incident.openedAt)}</span>
          </span>

          <span className="micro sm:hidden">{relativeTime(incident.openedAt)}</span>

          <span className="shrink-0 text-right">
            {saved != null && saved > 0 ? (
              <span className="data-value block text-xs text-state-success">
                +{formatMinutes(saved)}
              </span>
            ) : (
              <span className="micro block">—</span>
            )}
          </span>
        </span>

        <ChevronRight
          className="hidden h-4 w-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink-dim sm:block"
          aria-hidden
        />
      </Link>
    </motion.li>
  );
}
