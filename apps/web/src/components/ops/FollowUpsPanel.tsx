"use client";

/**
 * The calls the system has promised to make later (FR-5.4).
 *
 * A partial confirmation is only closed when the remainder arrives, and a
 * callback is only kept if someone places it. This list is where those promises
 * live, soonest first — the loop the product claims to close, made visible.
 */

import Link from "next/link";
import { CalendarClock, PackageOpen, PhoneCall, ShieldCheck } from "lucide-react";
import type { FollowUpKind } from "@/lib/contracts/domain";
import type { FollowUpRow } from "@/hooks/useOrderFeed";
import { EmptyState, Panel, Skeleton } from "@/components/ui/Panel";
import { useNow } from "@/hooks/useClientValue";
import { FOLLOW_UP_LABEL } from "@/lib/state-map";
import { cn } from "@/lib/utils";
import { formatters } from "@/lib/time";

const ICON: Record<FollowUpKind, React.ComponentType<{ className?: string }>> = {
  CALLBACK: PhoneCall,
  REMAINING_QUANTITY: PackageOpen,
  VERIFICATION: ShieldCheck,
};

function inWords(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes <= 0) return "due now";
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `in ${hours} h` : `in ${Math.round(hours / 24)} d`;
}

export function FollowUpsPanel({ followUps }: { followUps: FollowUpRow[] | null }) {
  const now = useNow(30_000);

  return (
    <Panel
      label="Follow-ups"
      className="lg:sticky lg:top-0 lg:self-start"
      bodyClassName="p-0"
      right={followUps ? <span className="micro">{followUps.length} scheduled</span> : null}
    >
      {!followUps && (
        <div className="space-y-3 p-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {followUps && followUps.length === 0 && (
        <EmptyState
          compact
          icon={CalendarClock}
          title="Nothing scheduled"
          body="Callbacks, checks on the remaining quantity of a partial order, and verification calls appear here as soon as a call schedules them."
        />
      )}

      {followUps && followUps.length > 0 && (
        <ol className="divide-y divide-line">
          {followUps.map((f) => {
            const Icon = ICON[f.kind];
            const due = Date.parse(f.dueAt);
            const soon = now != null && due - now < 3_600_000;
            return (
              <li key={f.id}>
                <Link
                  href={`/ops/orders/${f.orderId}`}
                  className="flex gap-3 px-5 py-3.5 transition-colors hover:bg-stone/35"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone/70">
                    <Icon className="h-3.5 w-3.5 text-ink-dim" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium text-ink">{FOLLOW_UP_LABEL[f.kind]}</span>
                      <span
                        className={cn("data-value shrink-0 text-[11px]", soon ? "text-state-warning" : "text-ink-faint")}
                        suppressHydrationWarning
                      >
                        {now == null ? formatters.dayTime.format(new Date(due)) : inWords(due - now)}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-ink-dim">{f.note}</span>
                    <span className="mt-1 block text-[11px] text-ink-faint">
                      {f.orderReference} · {f.contactName} ·{" "}
                      <span suppressHydrationWarning>{formatters.dayTime.format(new Date(due))}</span>
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
