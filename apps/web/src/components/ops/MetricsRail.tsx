"use client";

/**
 * Facility-level metrics — the opening shot's context strip.
 *
 * Five numbers that say what the floor is doing right now, ending with the one
 * that connects the technical demo to a business case: human time saved
 * (§12 #4). Every value is `tabular-nums` so a count ticking over does not
 * shift the layout beside it.
 */

import { Activity, PhoneCall, ShieldOff, Timer, TrendingDown } from "lucide-react";
import type { Incident } from "@/lib/contracts/domain";
import { formatMinutes } from "@/lib/utils";

export interface FacilityStats {
  active: number;
  calling: number;
  attention: number;
  suppressed: number;
  savedMinutes: number;
}

export function summarise(incidents: Incident[]): FacilityStats {
  return {
    active: incidents.filter((i) => i.status === "OPEN" || i.status === "CALLING").length,
    calling: incidents.filter((i) => i.status === "CALLING").length,
    attention: incidents.filter(
      (i) => i.status === "HUMAN_REVIEW" || i.status === "UNRESOLVED",
    ).length,
    suppressed: incidents.filter((i) => i.finalOutcome?.startsWith("Suppressed")).length,
    savedMinutes: incidents.reduce((sum, i) => sum + (i.timeSavedMinutes ?? 0), 0),
  };
}

function Metric({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 bg-panel px-4 py-3.5">
      <span className="micro flex items-center gap-1.5">
        <Icon className="h-3 w-3" />
        {label}
      </span>
      <span className="data-value text-2xl leading-none" style={tone ? { color: tone } : undefined}>
        {value}
      </span>
      <span className="text-[11px] leading-tight text-ink-faint">{hint}</span>
    </div>
  );
}

export function MetricsRail({ stats }: { stats: FacilityStats | null }) {
  const show = (n: number) => (stats ? String(n) : "—");
  const tone = (condition: boolean, token: string) => (condition ? token : undefined);

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-3 lg:grid-cols-5">
      <Metric
        label="Active requests"
        value={show(stats?.active ?? 0)}
        hint="open or calling"
        icon={Activity}
        tone={tone(Boolean(stats?.active), "var(--state-warning)")}
      />
      <Metric
        label="Calls in flight"
        value={show(stats?.calling ?? 0)}
        hint="agent on the phone"
        icon={PhoneCall}
        tone={tone(Boolean(stats?.calling), "var(--state-active)")}
      />
      <Metric
        label="Needs review"
        value={show(stats?.attention ?? 0)}
        hint="low confidence or unresolved"
        icon={ShieldOff}
        tone={tone(Boolean(stats?.attention), "var(--state-critical)")}
      />
      <Metric
        label="Suppressed requests"
        value={show(stats?.suppressed ?? 0)}
        hint="noise the agent did not call about"
        icon={TrendingDown}
      />
      <Metric
        label="Operator time saved"
        value={stats ? formatMinutes(stats.savedMinutes) : "—"}
        hint="vs. manual coordination"
        icon={Timer}
        tone={tone(Boolean(stats?.savedMinutes), "var(--state-success)")}
      />

      {/* Five metrics in a two- or three-up grid leave a hole. Blank it on
          purpose so it reads as instrument panelling rather than a panel that
          failed to load. */}
      <div className="hatch bg-panel lg:hidden" aria-hidden />
    </div>
  );
}
