"use client";

/**
 * The Live Call Theatre header — the identity strip of §4.1.
 *
 * Everything a viewer needs to place the incident in a single glance: which
 * asset, how bad, how long until it matters, and whether the stream feeding
 * this screen is actually alive.
 */

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Incident, Severity } from "@/lib/contracts/domain";
import { StateChip } from "@/components/ui/StateChip";
import { ConnectionStatus } from "@/components/ui/ConnectionStatus";
import { SafeWindow } from "./SafeWindow";
import { SEVERITY } from "@/lib/state-map";

export function IncidentHeader({
  incident,
  severity,
  safeWindowMinutes,
  closed,
  connected,
  dropped,
}: {
  incident: Incident;
  severity: Severity;
  safeWindowMinutes: number | null;
  closed: boolean;
  connected: boolean;
  dropped: number;
}) {
  const sev = SEVERITY[severity];

  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-b border-line px-4 py-3">
      <Link
        href="/ops"
        className="flex items-center gap-1.5 text-xs text-ink-dim transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline">Incidents</span>
      </Link>

      <span className="h-4 w-px bg-line" aria-hidden />

      <div className="flex min-w-0 items-baseline gap-2.5">
        <h1 className="data-value text-base font-semibold text-ink">{incident.asset.id}</h1>
        <span className="truncate text-xs text-ink-dim">
          {incident.asset.type} · {incident.asset.location}
        </span>
      </div>

      <StateChip state={sev.state} icon={sev.icon} pulse={!closed && severity === "CRITICAL"}>
        {sev.label}
      </StateChip>

      <SafeWindow
        minutes={safeWindowMinutes ?? incident.safeWindowMinutes}
        openedAt={incident.openedAt}
        frozen={closed}
      />

      <div className="ml-auto flex items-center gap-3">
        <span
          className="data-value text-[10px] text-ink-faint"
          title="One trace ID reconstructs the whole incident across every table, log line and call"
        >
          {incident.traceId}
        </span>
        <ConnectionStatus connected={connected} dropped={dropped} />
      </div>
    </header>
  );
}
