"use client";

/**
 * The realtime layer — FRONTEND_DESIGN_PLUGINS.md §7.3.
 *
 * Loads the incident, subscribes to its SSE stream, and validates every frame
 * with Zod at the boundary before folding it into the view (see
 * `lib/incident-view.ts`). A malformed frame is dropped and counted; it
 * degrades one panel and never white-screens the dashboard.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { SentinelEventSchema } from "@/lib/contracts/events";
import type { Incident, Responder } from "@/lib/contracts/domain";
import { EMPTY_VIEW, reduceIncidentView } from "@/lib/incident-view";
import { API_BASE, apiGet, apiUrl } from "@/lib/api";

export type {
  CallPlan,
  ExtractedResult,
  IncidentView,
  TelemetryPoint,
} from "@/lib/incident-view";

export interface IncidentDetail {
  incident: Incident;
  finished: boolean;
  telemetry: { baseline: number[]; threshold: number; unit: string; metricLabel: string };
  ladder: Responder[];
  scenario: { id: string; name: string; expectedOutcome: string } | null;
}

export type LoadState = "loading" | "ready" | "error" | "not_found";

export function useIncidentStream(incidentId: string) {
  const [view, dispatch] = useReducer(reduceIncidentView, EMPTY_VIEW);
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const [load, setLoad] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const openedOnce = useRef(false);

  /* Every setState here lands in a promise callback, never synchronously in the
     effect body — a mount must not cascade an extra render before paint. The
     retry path bumps `attempt`, which re-runs this effect. */
  useEffect(() => {
    const controller = new AbortController();

    apiGet<IncidentDetail>(`/api/v1/incidents/${incidentId}`, controller.signal)
      .then((data) => {
        setDetail(data);
        dispatch({ kind: "ladder", responders: data.ladder });
        setLoad("ready");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const status = (err as { status?: number }).status;
        setLoad(status === 404 ? "not_found" : "error");
        setError(err instanceof Error ? err.message : "Could not load this incident");
      });

    return () => controller.abort();
  }, [incidentId, attempt]);

  useEffect(() => {
    if (load !== "ready") return;

    const source = new EventSource(apiUrl(`/api/v1/incidents/${incidentId}/stream`), {
      withCredentials: API_BASE !== "",
    });

    source.onopen = () => {
      setConnected(true);
      // The server replays its whole emitted buffer on every connect, so a
      // reconnection rebuilds from zero rather than double-applying events.
      if (openedOnce.current) {
        dispatch({ kind: "reset" });
        setDetail((d) => {
          if (d) dispatch({ kind: "ladder", responders: d.ladder });
          return d;
        });
      }
      openedOnce.current = true;
    };

    source.onerror = () => setConnected(false);

    source.onmessage = (message) => {
      let raw: unknown;
      try {
        raw = JSON.parse(message.data);
      } catch {
        dispatch({ kind: "dropped" });
        return;
      }
      const parsed = SentinelEventSchema.safeParse(raw);
      if (parsed.success) dispatch({ kind: "event", event: parsed.data });
      else {
        console.warn("Dropped malformed event", parsed.error.issues);
        dispatch({ kind: "dropped" });
      }
    };

    return () => {
      source.close();
      setConnected(false);
    };
  }, [incidentId, load]);

  const retry = useCallback(() => {
    setLoad("loading");
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  const live = useMemo(
    () => view.callState != null && !view.resolved && !view.unresolved,
    [view.callState, view.resolved, view.unresolved],
  );

  return { view, detail, load, error, connected, live, retry };
}
