"use client";

/**
 * The queue in five numbers — the opening shot's context strip.
 *
 * What is waiting, what is on the phone, what needs a person, how much stock
 * the calls have secured, and the operator time they replaced. Figures are set
 * in the display face with lining, tabular digits so a count ticking over does
 * not shift anything beside it.
 */

import { Hourglass, PackageCheck, PhoneCall, Timer, UserSearch } from "lucide-react";
import type { Order } from "@/lib/contracts/domain";
import { formatMinutes } from "@/lib/utils";

export interface QueueStats {
  awaiting: number;
  calling: number;
  needsPerson: number;
  unitsConfirmed: number;
  minutesSaved: number;
}

export function summarise(orders: Order[]): QueueStats {
  return {
    awaiting: orders.filter((o) => o.status === "AWAITING_CONFIRMATION" || o.status === "CALLBACK_SCHEDULED").length,
    calling: orders.filter((o) => o.status === "CALLING").length,
    needsPerson: orders.filter(
      (o) => o.status === "APPROVAL_REQUIRED" || o.status === "HUMAN_REVIEW" || o.status === "UNRESOLVED",
    ).length,
    unitsConfirmed: orders.reduce((sum, o) => sum + (o.item.confirmedQuantity ?? 0), 0),
    minutesSaved: orders.reduce((sum, o) => sum + (o.operatorMinutesSaved ?? 0), 0),
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
    <div className="flex min-w-0 flex-col gap-2 bg-panel px-5 py-4">
      <span className="micro flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className="display-num whitespace-nowrap text-3xl" style={{ color: tone ?? "var(--text-primary)" }}>
        {value}
      </span>
      <span className="text-xs leading-tight text-ink-faint">{hint}</span>
    </div>
  );
}

export function MetricsRail({ stats }: { stats: QueueStats | null }) {
  const show = (n: number | undefined) => (stats ? String(n ?? 0) : "—");
  const tone = (condition: boolean, token: string) => (condition ? token : undefined);

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 xl:grid-cols-5">
      <Metric
        label="Awaiting"
        value={show(stats?.awaiting)}
        hint="waiting on a supplier answer"
        icon={Hourglass}
        tone={tone(Boolean(stats?.awaiting), "var(--state-warning)")}
      />
      <Metric
        label="On the phone"
        value={show(stats?.calling)}
        hint="calls in progress"
        icon={PhoneCall}
        tone={tone(Boolean(stats?.calling), "var(--state-active)")}
      />
      <Metric
        label="Needs a person"
        value={show(stats?.needsPerson)}
        hint="approval, review or unresolved"
        icon={UserSearch}
        tone={tone(Boolean(stats?.needsPerson), "var(--state-info)")}
      />
      <Metric
        label="Units confirmed"
        value={show(stats?.unitsConfirmed)}
        hint="secured on calls today"
        icon={PackageCheck}
        tone={tone(Boolean(stats?.unitsConfirmed), "var(--state-success)")}
      />
      <Metric
        label="Operator time saved"
        value={stats ? formatMinutes(stats.minutesSaved) : "—"}
        hint="vs. calling by hand"
        icon={Timer}
      />

      {/* Five metrics in a two- or three-up grid leave a hole. Blank it on
          purpose so it reads as a composed grid, not a panel that failed. */}
      <div className="hatch bg-panel xl:hidden" aria-hidden />
    </div>
  );
}
