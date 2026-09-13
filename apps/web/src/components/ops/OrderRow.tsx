"use client";

/**
 * One order in the queue.
 *
 * Stacked block on a phone, single row on a desktop. `sm:contents` dissolves
 * the mobile grouping wrappers at sm and up, so both shapes come from one set
 * of markup rather than two that drift apart.
 */

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ChevronRight } from "lucide-react";
import type { Order } from "@/lib/contracts/domain";
import { StateChip } from "@/components/ui/StateChip";
import { FulfilmentBar } from "@/components/order/FulfilmentBar";
import { ORDER_STATUS } from "@/lib/state-map";
import { formatMinutes, relativeTime } from "@/lib/utils";
import { T } from "@/lib/motion";

export function OrderRow({ order, index }: { order: Order; index: number }) {
  const reduced = useReducedMotion() ?? false;
  const status = ORDER_STATUS[order.status];
  const { item } = order;
  const saved = order.operatorMinutesSaved;

  return (
    <motion.li
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...T.base, delay: reduced ? 0 : Math.min(index, 6) * 0.03 }}
    >
      <Link
        href={`/ops/orders/${order.id}`}
        className="group flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-stone/35 sm:flex-row sm:items-center sm:gap-4"
      >
        <span className="flex items-center gap-3 sm:contents">
          <span className="min-w-0 flex-1 sm:w-[112px] sm:flex-none">
            <span className="display block text-xl leading-tight text-ink">{order.reference}</span>
            <span className="micro block truncate">{relativeTime(order.createdAt)}</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint sm:hidden" aria-hidden />
        </span>

        <span className="min-w-0 sm:flex-1">
          <span className="flex items-center gap-1.5 truncate text-sm text-ink">
            {order.seller.name}
            <ArrowRight className="h-3 w-3 shrink-0 text-ink-faint" aria-hidden />
            <span className="truncate text-ink-dim">{item.requestedQuantity} {item.unit}</span>
          </span>
          <span className="mt-1 block truncate text-xs text-ink-faint">
            {order.outcome ?? order.trigger.summary}
          </span>
        </span>

        <span className="w-full sm:w-[144px] sm:shrink-0">
          <FulfilmentBar
            size="sm"
            requested={item.requestedQuantity}
            confirmed={item.confirmedQuantity}
            remaining={item.remainingQuantity}
            unit={item.unit}
          />
          <span className="data-value mt-1.5 block text-[11px] text-ink-faint">
            {item.confirmedQuantity ?? 0} / {item.requestedQuantity} confirmed
          </span>
        </span>

        <span className="flex shrink-0 items-center justify-between gap-3 sm:w-[168px] sm:flex-col sm:items-start sm:gap-1.5">
          <StateChip state={status.state} icon={status.icon} size="sm" pulse={status.pulse}>
            {status.label}
          </StateChip>
          {saved != null && saved > 0 && (
            <span className="data-value text-[11px] text-state-success">+{formatMinutes(saved)} saved</span>
          )}
        </span>

        <ChevronRight
          className="hidden h-4 w-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink-dim sm:block"
          aria-hidden
        />
      </Link>
    </motion.li>
  );
}
