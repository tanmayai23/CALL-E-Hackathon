"use client";

/**
 * The realtime layer for one order.
 *
 * Loads the order, subscribes to its SSE stream, and validates every frame with
 * Zod at the boundary before folding it into the view (`lib/order-view.ts`).
 * A malformed frame is dropped and counted; it degrades one panel and never
 * white-screens the dashboard.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { SentinelEventSchema } from "@/lib/contracts/events";
import type { Contact, Order } from "@/lib/contracts/domain";
import { EMPTY_VIEW, reduceOrderView } from "@/lib/order-view";
import { API_BASE, apiGet, apiUrl } from "@/lib/api";

export type { CallPlan, ExtractedResult, OrderUpdate, OrderView } from "@/lib/order-view";

export interface OrderDetail {
  order: Order;
  ladder: Contact[];
  finished: boolean;
}

export type LoadState = "loading" | "ready" | "error" | "not_found";

const LIVE_CALL_STATES = new Set(["queued", "dialling", "connected", "in_conversation", "extracting"]);

export function useOrderStream(orderId: string) {
  const [view, dispatch] = useReducer(reduceOrderView, EMPTY_VIEW);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [load, setLoad] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const openedOnce = useRef(false);
  const ladder = useRef<Contact[]>([]);

  /* Every setState here lands in a promise callback, never synchronously in the
     effect body — a mount must not cascade an extra render before paint. The
     retry path bumps `attempt`, which re-runs this effect. */
  useEffect(() => {
    const controller = new AbortController();

    apiGet<OrderDetail>(`/api/v1/orders/${orderId}`, controller.signal)
      .then((data) => {
        ladder.current = data.ladder;
        setDetail(data);
        dispatch({ kind: "ladder", contacts: data.ladder });
        setLoad("ready");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const status = (err as { status?: number }).status;
        setLoad(status === 404 ? "not_found" : "error");
        setError(err instanceof Error ? err.message : "Could not load this order");
      });

    return () => controller.abort();
  }, [orderId, attempt]);

  useEffect(() => {
    if (load !== "ready") return;

    const source = new EventSource(apiUrl(`/api/v1/orders/${orderId}/stream`), {
      withCredentials: API_BASE !== "",
    });

    source.onopen = () => {
      setConnected(true);
      // The server replays its whole buffer on every connect, so a reconnection
      // rebuilds from zero rather than double-applying events.
      if (openedOnce.current) {
        dispatch({ kind: "reset" });
        dispatch({ kind: "ladder", contacts: ladder.current });
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
      if (parsed.success) {
        dispatch({ kind: "event", event: parsed.data });
      } else {
        console.warn("Dropped malformed event", parsed.error.issues);
        dispatch({ kind: "dropped" });
      }
    };

    return () => {
      source.close();
      setConnected(false);
    };
  }, [orderId, load]);

  const retry = useCallback(() => {
    setLoad("loading");
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  /** A call is in progress right now — drives the waveform, timers and autoscroll. */
  const live = view.callState != null && LIVE_CALL_STATES.has(view.callState);

  return { view, detail, load, error, connected, live, retry };
}
