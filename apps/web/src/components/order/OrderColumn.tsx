"use client";

/**
 * Column A of the order screen — the facts of the order.
 *
 * What was asked for, by when, at what price, what caused the request, and how
 * much of it is now spoken for. Everything here is either entered data or a
 * confirmed commitment; nothing is inferred.
 */

import { Zap } from "lucide-react";
import type { CallState, Order, Speaker } from "@/lib/contracts/domain";
import { Panel } from "@/components/ui/Panel";
import { TRIGGER_LABEL } from "@/lib/state-map";
import { formatters } from "@/lib/time";
import { FulfilmentBar } from "./FulfilmentBar";
import { Waveform } from "./Waveform";

export function OrderColumn({
  order,
  unitPrice,
  confirmed,
  remaining,
  remainingLabel,
  triggerSummary,
  callState,
  speaker,
  showCallActivity,
}: {
  order: Order;
  /** The agreed price — the order's own until an approved change replaces it. */
  unitPrice: number;
  confirmed: number | null;
  remaining: number | null;
  remainingLabel: string;
  triggerSummary: string | null;
  callState: CallState | null;
  speaker: Speaker | null;
  /** A suppressed request never places a call, so it has no activity to show. */
  showCallActivity: boolean;
}) {
  const { item } = order;
  const money = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: item.currency,
    maximumFractionDigits: 0,
  });

  return (
    <div className="flex flex-col gap-3 xl:min-h-0 xl:overflow-y-auto">
      <Panel label="Order" className="shrink-0" bodyClassName="flex flex-col gap-5 p-5">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-baseline gap-2">
              <span className="display-num text-display-s text-ink">{item.requestedQuantity}</span>
              <span className="text-sm text-ink-dim">{item.unit}</span>
            </p>
            <p className="mt-2 truncate text-sm text-ink" title={item.description}>
              {item.description}
            </p>
            <p className="data-value mt-0.5 text-[11px] text-ink-faint">{item.sku}</p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4">
          <div>
            <dt className="micro">Unit price</dt>
            <dd className="data-value mt-1 text-sm text-ink">
              {money.format(unitPrice)}
              <span className="text-ink-faint"> / {item.unit.replace(/s$/, "")}</span>
            </dd>
          </div>
          <div>
            <dt className="micro">Required by</dt>
            <dd className="data-value mt-1 text-sm text-ink" suppressHydrationWarning>
              {formatters.dateTime.format(new Date(order.requiredBy))}
            </dd>
          </div>
        </dl>

        <FulfilmentBar
          requested={item.requestedQuantity}
          confirmed={confirmed}
          remaining={remaining}
          unit={item.unit}
          remainingLabel={remainingLabel}
        />
      </Panel>

      <Panel label="Why this call" className="shrink-0" bodyClassName="flex gap-3 p-5">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone/70">
          <Zap className="h-3.5 w-3.5 text-ink-dim" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="micro">{TRIGGER_LABEL[order.trigger.type]}</p>
          <p className="mt-1 text-xs leading-relaxed text-ink">
            {triggerSummary ?? order.trigger.summary}
          </p>
        </div>
      </Panel>

      {showCallActivity && (
        <Panel label="Call" className="shrink-0" bodyClassName="h-[104px] flex-none px-5 py-3">
          <Waveform callState={callState} speaker={speaker} />
        </Panel>
      )}
    </div>
  );
}
