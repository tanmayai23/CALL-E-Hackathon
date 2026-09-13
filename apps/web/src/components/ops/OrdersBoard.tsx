"use client";

/**
 * Orders — the operations overview, and the demo's opening shot.
 *
 * Every order waiting on a supplier's answer: the numbers across the top, the
 * queue on the left with how much of each order is spoken for, and on the right
 * the follow-up calls the system has committed to make.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Inbox, Plus, RotateCw, ShieldOff } from "lucide-react";
import type { Order } from "@/lib/contracts/domain";
import { useOrderFeed } from "@/hooks/useOrderFeed";
import { Panel, EmptyState, Skeleton } from "@/components/ui/Panel";
import { Button, buttonStyles } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { FollowUpsPanel } from "./FollowUpsPanel";
import { MetricsRail, summarise } from "./MetricsRail";
import { OrderRow } from "./OrderRow";

type Filter = "all" | "open" | "person" | "settled";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "person", label: "Needs a person" },
  { id: "settled", label: "Settled" },
];

function matches(order: Order, filter: Filter): boolean {
  switch (filter) {
    case "open":
      return ["AWAITING_CONFIRMATION", "CALLING", "CALLBACK_SCHEDULED"].includes(order.status);
    case "person":
      return ["APPROVAL_REQUIRED", "HUMAN_REVIEW", "UNRESOLVED"].includes(order.status);
    case "settled":
      return ["CONFIRMED", "PARTIALLY_CONFIRMED", "SUPPRESSED"].includes(order.status);
    default:
      return true;
  }
}

export function OrdersBoard() {
  const { orders, followUps, error, refreshedAt, refresh } = useOrderFeed();
  const [filter, setFilter] = useState<Filter>("all");

  const stats = useMemo(() => (orders ? summarise(orders) : null), [orders]);
  const visible = useMemo(() => (orders ?? []).filter((o) => matches(o, filter)), [orders, filter]);

  return (
    <div className="flex flex-col gap-6 p-5 sm:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Northgate Distributors</p>
          <h1 className="display mt-2 text-display-s text-ink">
            Orders <em>in motion</em>
          </h1>
          <p className="mt-2 max-w-[56ch] text-sm text-ink-dim">
            Every order waiting on a supplier&rsquo;s answer — and what each call turned into.
          </p>
        </div>
        <Link href="/ops/simulator" className={buttonStyles({ variant: "primary", size: "md" })}>
          <Plus className="h-4 w-4" aria-hidden />
          New order
        </Link>
      </header>

      <MetricsRail stats={stats} />

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-8">
          <Panel
            label="Coordination queue"
            bodyClassName="p-0"
            right={
              <div className="flex items-center gap-1" role="group" aria-label="Filter orders">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    aria-pressed={filter === f.id}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs transition-colors",
                      filter === f.id ? "bg-ink text-canvas" : "text-ink-dim hover:bg-stone/60 hover:text-ink",
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            }
          >
            {error && (
              <div className="flex items-center gap-2 border-b border-state-critical/30 bg-state-critical/8 px-5 py-2.5">
                <ShieldOff className="h-3.5 w-3.5 shrink-0 text-state-critical" aria-hidden />
                <p className="text-xs text-state-critical">{error}</p>
                <Button variant="ghost" size="sm" onClick={refresh} className="ml-auto">
                  <RotateCw className="h-3 w-3" aria-hidden />
                  Retry
                </Button>
              </div>
            )}

            {!orders && !error && (
              <div className="divide-y divide-line">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-5 px-5 py-4">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-2 w-36" />
                    <Skeleton className="h-6 w-28 rounded-full" />
                  </div>
                ))}
              </div>
            )}

            {orders && visible.length === 0 && (
              <EmptyState
                icon={Inbox}
                title={filter === "all" ? "No orders yet" : "Nothing here right now"}
                body={
                  filter === "all"
                    ? "Place an order to watch a supplier call become a confirmed commitment."
                    : "No order is in this state at the moment. Clear the filter to see them all."
                }
                action={
                  filter === "all" ? (
                    <Link href="/ops/simulator" className={buttonStyles({ variant: "primary", size: "sm" })}>
                      Place an order
                    </Link>
                  ) : (
                    <Button variant="neutral" size="sm" onClick={() => setFilter("all")}>
                      Clear filter
                    </Button>
                  )
                }
              />
            )}

            {orders && visible.length > 0 && (
              <ul className="divide-y divide-line">
                {visible.map((order, index) => (
                  <OrderRow key={order.id} order={order} index={index} />
                ))}
              </ul>
            )}

            <div className="flex items-center justify-between border-t border-line px-5 py-2.5">
              <span className="micro">{orders ? `${visible.length} of ${orders.length}` : "loading"}</span>
              <span className="micro" suppressHydrationWarning>
                {refreshedAt ? `refreshed ${refreshedAt.toLocaleTimeString("en-GB", { hour12: false })}` : "—"}
              </span>
            </div>
          </Panel>
        </div>

        <div className="min-w-0 xl:col-span-4">
          <FollowUpsPanel followUps={followUps} />
        </div>
      </div>
    </div>
  );
}
