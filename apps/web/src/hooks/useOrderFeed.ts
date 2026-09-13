"use client";

/**
 * The order queue and its follow-ups, polled together.
 *
 * Polling is deliberate: the contract streams per order, not per facility, and
 * a facility-wide stream would be a contract change the backend owner has to
 * agree to first (Rule 4). Cadence follows activity — fast while something is
 * live, slow when the queue is quiet — and the last refresh is shown, so a
 * stalled feed is visible rather than silently stale.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { FollowUp, Order } from "@/lib/contracts/domain";
import { apiGet } from "@/lib/api";

const BUSY_INTERVAL_MS = 2_000;
const IDLE_INTERVAL_MS = 8_000;

export interface FollowUpRow extends FollowUp {
  orderReference: string;
  contactName: string;
}

export interface OrderFeed {
  orders: Order[] | null;
  followUps: FollowUpRow[] | null;
  error: string | null;
  refreshedAt: Date | null;
  refresh: () => void;
}

export function useOrderFeed(): OrderFeed {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [followUps, setFollowUps] = useState<FollowUpRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [attempt, setAttempt] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const cycle = () => {
      Promise.all([
        apiGet<{ orders: Order[] }>("/api/v1/orders"),
        apiGet<{ followUps: FollowUpRow[] }>("/api/v1/followups"),
      ])
        .then(([orderData, followUpData]) => {
          if (cancelled) return;
          setOrders(orderData.orders);
          setFollowUps(followUpData.followUps);
          setRefreshedAt(new Date());
          setError(null);
          const busy = orderData.orders.some((o) => o.status === "CALLING");
          timer.current = setTimeout(cycle, busy ? BUSY_INTERVAL_MS : IDLE_INTERVAL_MS);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : "Could not reach the order API");
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

  return { orders, followUps, error, refreshedAt, refresh };
}
