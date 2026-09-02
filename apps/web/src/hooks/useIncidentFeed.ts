"use client";

/**
 * The incident list, polled.
 *
 * Polling is deliberate: the frozen contract streams per incident (§8.2), not
 * per facility, so a facility-wide SSE would be a contract change and Rule 4
 * says contracts change on both sides with the owner's agreement, never
 * unilaterally.
 *
 * Cadence follows activity — fast while something is live, slow when the floor
 * is quiet — and the last refresh time is surfaced so a stalled feed is
 * visible rather than silently stale (§7.4).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Incident } from "@/lib/contracts/domain";
import { apiGet } from "@/lib/api";

const BUSY_INTERVAL_MS = 2_000;
const IDLE_INTERVAL_MS = 8_000;

export interface IncidentFeed {
  incidents: Incident[] | null;
  error: string | null;
  refreshedAt: Date | null;
  refresh: () => void;
}

export function useIncidentFeed(): IncidentFeed {
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [attempt, setAttempt] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const cycle = () => {
      apiGet<{ incidents: Incident[] }>("/api/v1/incidents")
        .then((data) => {
          if (cancelled) return;
          setIncidents(data.incidents);
          setRefreshedAt(new Date());
          setError(null);
          const busy = data.incidents.some(
            (i) => i.status === "OPEN" || i.status === "CALLING",
          );
          timer.current = setTimeout(cycle, busy ? BUSY_INTERVAL_MS : IDLE_INTERVAL_MS);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : "Could not reach the incident API");
          timer.current = setTimeout(cycle, IDLE_INTERVAL_MS);
        });
    };

    cycle();

    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [attempt]);

  const refresh = useCallback(() => setAttempt((n) => n + 1), []);

  return { incidents, error, refreshedAt, refresh };
}
