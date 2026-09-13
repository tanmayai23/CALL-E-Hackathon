import { cn } from "@/lib/utils";

/**
 * The panel. A hairline box on the panel surface with a small uppercase label
 * and a rule running to its edge. Elevation comes from contrast and space, not
 * shadow — flat, the way the rest of the system is flat.
 */
export function Panel({
  label,
  right,
  bodyClassName,
  className,
  children,
}: {
  label?: string;
  right?: React.ReactNode;
  bodyClassName?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        // `min-w-0` matters: any `truncate` inside sets white-space:nowrap, whose
        // min-content width would otherwise force the panel wider than its
        // grid/flex track and push a horizontal scrollbar onto the page.
        "relative flex min-h-0 min-w-0 flex-col rounded-lg border border-line bg-panel",
        className,
      )}
    >
      {label && (
        // The label sizes from its text (`flex-auto`), so when the header is too
        // narrow for both, `right` wraps beneath it instead of running over it.
        <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-5 py-3">
          <h2 className="micro rule-label min-w-0 flex-auto">{label}</h2>
          {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
        </header>
      )}
      {/* `flex-1` fills the section by default; pass `flex-none` in bodyClassName
          alongside a height when the panel must stay a fixed size. */}
      <div className={cn("min-h-0 flex-1", bodyClassName ?? "p-5")}>{children}</div>
    </section>
  );
}

/** Skeletons match the shape of the real content — never a centred spinner (§8). */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-shimmer rounded-sm bg-stone/70", className)} aria-hidden />;
}

/** Empty states explain what will appear and how to make it happen (§8). */
export function EmptyState({
  title,
  body,
  action,
  icon: Icon,
  compact = false,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  /** Strip-shaped panels (the result bar) need a shorter resting height. */
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center gap-3 px-6 text-center",
        compact ? "py-6" : "py-10",
      )}
    >
      {Icon && (
        <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-stone/70">
          <Icon className="h-4 w-4 text-ink-dim" />
        </div>
      )}
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="max-w-[46ch] text-xs leading-relaxed text-ink-dim">{body}</p>
      {action}
    </div>
  );
}
