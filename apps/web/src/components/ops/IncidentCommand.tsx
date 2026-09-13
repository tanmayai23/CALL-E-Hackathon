"use client";

/**
 * Incident Command — the operational overview, and the demo's opening shot.
 *
 * Establishes in one screen what the floor is doing: the numbers across the
 * top, every incident and its outcome down the left, and where those assets
 * physically are on the right.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Inbox, RotateCw, ShieldOff } from "lucide-react";
import type { Incident } from "@/lib/contracts/domain";
import { useIncidentFeed } from "@/hooks/useIncidentFeed";
import { Panel, EmptyState, Skeleton } from "@/components/ui/Panel";
import { Button, buttonStyles } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { IncidentRow } from "./IncidentRow";
import { MetricsRail, summarise } from "./MetricsRail";

type Filter = "all" | "live" | "attention" | "closed";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "live", label: "Live" },
  { id: "attention", label: "Needs review" },
  { id: "closed", label: "Closed" },
];

function matches(incident: Incident, filter: Filter): boolean {
  switch (filter) {
    case "live":
      return incident.status === "OPEN" || incident.status === "CALLING";
    case "attention":
      return incident.status === "HUMAN_REVIEW" || incident.status === "UNRESOLVED";
    case "closed":
      return incident.status === "RESOLVED";
    default:
      return true;
  }
}

export function IncidentCommand() {
  const { incidents, error, refreshedAt, refresh } = useIncidentFeed();
  const [filter, setFilter] = useState<Filter>("all");

  const stats = useMemo(() => (incidents ? summarise(incidents) : null), [incidents]);
  const visible = useMemo(
    () => (incidents ?? []).filter((i) => matches(i, filter)),
    [incidents, filter],
  );

  return (
    <div className="flex flex-col gap-5 p-5 sm:p-6">
      <MetricsRail stats={stats} />

      <div>
        <Panel
          label="Coordination queue"
          bodyClassName="p-0"
          right={
            <div className="flex items-center gap-1">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  aria-pressed={filter === f.id}
                  className={cn(
                    "rounded-sm px-2 py-1 text-[11px] transition-colors",
                    filter === f.id
                      ? "bg-elevated text-ink"
                      : "text-ink-faint hover:text-ink-dim",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          }
        >
          {error && (
            <div className="flex items-center gap-2 border-b border-state-critical/35 bg-state-critical/8 px-4 py-2.5">
              <ShieldOff className="h-3.5 w-3.5 shrink-0 text-state-critical" aria-hidden />
              <p className="text-xs text-state-critical">{error}</p>
              <Button variant="ghost" size="sm" onClick={refresh} className="ml-auto">
                <RotateCw className="h-3 w-3" aria-hidden />
                Retry
              </Button>
            </div>
          )}

          {!incidents && !error && (
            <div className="space-y-px">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="ml-auto h-4 w-24" />
                </div>
              ))}
            </div>
          )}

          {incidents && visible.length === 0 && (
            <EmptyState
              icon={Inbox}
              title={filter === "all" ? "No incidents yet" : "Nothing matches this filter"}
              body={
                filter === "all"
                  ? "No order requests are waiting. Run a scenario to watch a wholesaler call become a structured commitment."
                  : "Every request is in a different state right now. Clear the filter to see them all."
              }
              action={
                filter === "all" ? (
                  <Link
                    href="/ops/simulator"
                    className={buttonStyles({ variant: "primary", size: "sm" })}
                  >
                    Trigger a scenario
                  </Link>
                ) : (
                  <Button variant="neutral" size="sm" onClick={() => setFilter("all")}>
                    Clear filter
                  </Button>
                )
              }
            />
          )}

          {incidents && visible.length > 0 && (
            <ul className="divide-y divide-line">
              {visible.map((incident, index) => (
                <IncidentRow key={incident.id} incident={incident} index={index} />
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between border-t border-line px-4 py-2">
            <span className="micro">
              {incidents ? `${visible.length} of ${incidents.length}` : "loading"}
            </span>
            <span className="micro" suppressHydrationWarning>
              {refreshedAt
                ? `refreshed ${refreshedAt.toLocaleTimeString("en-GB", { hour12: false })}`
                : "—"}
            </span>
          </div>
        </Panel>
      </div>
    </div>
  );
}
