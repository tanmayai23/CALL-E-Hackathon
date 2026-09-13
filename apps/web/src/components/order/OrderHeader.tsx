"use client";

/**
 * The identity strip of the order screen: which order, between whom, where it
 * stands, how long until it is needed, and whether the stream feeding this
 * screen is alive.
 */

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Order, OrderStatus, Urgency } from "@/lib/contracts/domain";
import { StateChip } from "@/components/ui/StateChip";
import { ConnectionStatus } from "@/components/ui/ConnectionStatus";
import { ORDER_STATUS, URGENCY } from "@/lib/state-map";
import { RequiredBy } from "./RequiredBy";

export function OrderHeader({
  order,
  status,
  urgency,
  settled,
  connected,
  dropped,
}: {
  order: Order;
  status: OrderStatus;
  urgency: Urgency;
  settled: boolean;
  connected: boolean;
  dropped: number;
}) {
  const st = ORDER_STATUS[status];
  const urg = URGENCY[urgency];

  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-b border-line px-5 py-3">
      <Link href="/ops" className="flex items-center gap-1.5 text-xs text-ink-dim transition-colors hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline">Orders</span>
      </Link>

      <span className="h-4 w-px bg-line" aria-hidden />

      <div className="flex min-w-0 items-baseline gap-3">
        <h1 className="display shrink-0 whitespace-nowrap text-2xl text-ink">{order.reference}</h1>
        <span className="flex min-w-0 items-center gap-1.5 truncate text-xs text-ink-dim">
          {order.buyer.name}
          <ArrowRight className="h-3 w-3 shrink-0 text-ink-faint" aria-hidden />
          {order.seller.name}
        </span>
      </div>

      <StateChip state={st.state} icon={st.icon} pulse={st.pulse}>
        {st.label}
      </StateChip>
      <StateChip state={urg.state} icon={urg.icon} size="sm">
        {urg.label}
      </StateChip>

      <RequiredBy requiredBy={order.requiredBy} openedAt={order.createdAt} frozen={settled} />

      <div className="ml-auto flex items-center gap-3">
        <span
          className="data-value text-[10px] text-ink-faint"
          title="One trace ID follows this order through the event, the call, the result and the update"
        >
          {order.traceId}
        </span>
        <ConnectionStatus connected={connected} dropped={dropped} />
      </div>
    </header>
  );
}
