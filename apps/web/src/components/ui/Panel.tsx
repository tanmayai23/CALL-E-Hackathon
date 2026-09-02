import { cn } from "@/lib/utils";

/**
 * The instrument panel. Elevation on dark UI comes from border contrast, not
 * shadow (§2.4) — so a panel is a hairline box with a tracked-out label and a
 * rule running to its edge, the way a plotted instrument is captioned.
 */
export function Panel({
  label,
  right,
  brackets = false,
  bodyClassName,
  className,
  children,
}: {
  label?: string;
  right?: React.ReactNode;
  /** Viewfinder corner ticks — reserved for the panels that carry the demo. */
  brackets?: boolean;
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
        "relative flex min-h-0 min-w-0 flex-col rounded-md border border-line bg-panel",
        brackets && "brackets",
        className,
      )}
    >
      {label && (
        <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-2.5">
          <h2 className="micro rule-label min-w-0 flex-1">{label}</h2>
          {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
        </header>
      )}
      {/* `flex-1` fills the section by default; pass `flex-none` in bodyClassName
          alongside a height when the panel must stay a fixed size. */}
      <div className={cn("min-h-0 flex-1", bodyClassName ?? "p-4")}>{children}</div>
    </section>
  );
}

/** Skeletons match the shape of the real content — never a centred spinner (§8). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-shimmer rounded-sm bg-elevated", className)}
      aria-hidden
    />
  );
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
      <div className="hatch mb-1 flex h-10 w-10 items-center justify-center rounded-sm border border-line">
        {Icon && <Icon className="h-4 w-4 text-ink-faint" />}
      </div>
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="max-w-[46ch] text-xs leading-relaxed text-ink-dim">{body}</p>
      {action}
    </div>
  );
}
