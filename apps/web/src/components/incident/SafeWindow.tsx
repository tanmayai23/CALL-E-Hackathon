"use client";

/**
 * The safe-window countdown. This is the clock the whole system is racing, so
 * it gets monospace tabular digits and a bar that drains — the number must
 * never reflow while it ticks (§2.3).
 */

import { useNow } from "@/hooks/useClientValue";
import { cn } from "@/lib/utils";

export function SafeWindow({
  minutes,
  openedAt,
  frozen,
}: {
  minutes: number | null;
  openedAt: string;
  /** Once the incident closes the clock stops — a closed incident is not racing. */
  frozen: boolean;
}) {
  const now = useNow(1000, !frozen && minutes != null);
  const remaining =
    minutes == null || now == null ? null : minutes - (now - Date.parse(openedAt)) / 60_000;

  if (minutes == null || remaining == null) {
    return (
      <span className="flex items-baseline gap-2">
        <span className="micro">Safe window</span>
        <span className="data-value text-sm text-ink-faint">—</span>
      </span>
    );
  }

  const ratio = Math.max(0, Math.min(1, remaining / minutes));
  const tone =
    ratio > 0.5 ? "var(--state-success)" : ratio > 0.2 ? "var(--state-warning)" : "var(--state-critical)";
  const mins = Math.max(0, Math.floor(remaining));
  const secs = Math.max(0, Math.floor((remaining - mins) * 60));

  return (
    <span className="flex items-center gap-2.5">
      <span className="micro">Safe window</span>
      <span className="data-value text-sm leading-none" style={{ color: tone }}>
        {String(mins).padStart(2, "0")}m {String(secs).padStart(2, "0")}s
      </span>
      <span
        className="relative h-1 w-20 overflow-hidden rounded-full bg-elevated"
        role="img"
        aria-label={`${mins} minutes of safe window remaining out of ${minutes}`}
      >
        <span
          className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000")}
          style={{ width: `${ratio * 100}%`, background: tone }}
        />
      </span>
    </span>
  );
}
