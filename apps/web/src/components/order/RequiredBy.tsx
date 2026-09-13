"use client";

/**
 * Time left until the goods are needed — the clock the whole call is racing.
 * Monospace tabular digits so it never reflows while it ticks, and a bar that
 * drains from teal to amber to red as the deadline approaches.
 */

import { useNow } from "@/hooks/useClientValue";

const DAY_MS = 86_400_000;

function formatRemaining(ms: number): string {
  if (ms <= 0) return "overdue";
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 48) return `${Math.floor(hours / 24)}d ${String(hours % 24).padStart(2, "0")}h`;
  return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
}

export function RequiredBy({
  requiredBy,
  openedAt,
  frozen,
}: {
  requiredBy: string;
  openedAt: string;
  /** A settled order is not racing anything; the clock stops. */
  frozen: boolean;
}) {
  const now = useNow(1000, !frozen);

  const due = Date.parse(requiredBy);
  const window = Math.max(1, Math.min(DAY_MS * 3, due - Date.parse(openedAt)));
  const remaining = now == null ? null : due - now;
  const ratio = remaining == null ? 1 : Math.max(0, Math.min(1, remaining / window));
  const tone =
    ratio > 0.5 ? "var(--state-success)" : ratio > 0.2 ? "var(--state-warning)" : "var(--state-critical)";

  return (
    <span className="flex items-center gap-2.5">
      <span className="micro">Required in</span>
      <span className="data-value text-sm leading-none" style={{ color: tone }}>
        {remaining == null ? "—" : formatRemaining(remaining)}
      </span>
      <span
        className="relative h-1 w-20 overflow-hidden rounded-full bg-stone"
        role="img"
        aria-label={remaining == null ? "Time remaining unknown" : `${formatRemaining(remaining)} until required`}
      >
        <span
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000"
          style={{ width: `${ratio * 100}%`, background: tone }}
        />
      </span>
    </span>
  );
}
