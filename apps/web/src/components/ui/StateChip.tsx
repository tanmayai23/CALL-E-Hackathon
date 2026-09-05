import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Info,
  OctagonAlert,
  Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The most reused component in the app — FRONTEND_DESIGN_PLUGINS.md §2.5.
 *
 * Accessibility rule, non-negotiable: every state is colour **+ icon + text**.
 * Never colour alone. There is no variant of this component that renders a bare
 * dot, because a bare dot fails both a screen reader and a judge watching a
 * compressed video.
 */

const chip = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 " +
    "text-xs font-medium leading-none transition-colors duration-200 whitespace-nowrap",
  {
    variants: {
      state: {
        idle: "border-state-idle/30 bg-state-idle/10 text-state-idle",
        info: "border-state-info/30 bg-state-info/10 text-state-info",
        active: "border-state-active/40 bg-state-active/15 text-state-active",
        warning: "border-state-warning/40 bg-state-warning/15 text-state-warning",
        critical: "border-state-critical/50 bg-state-critical/15 text-state-critical",
        success: "border-state-success/40 bg-state-success/15 text-state-success",
      },
      size: {
        sm: "px-2 py-0.5 text-[11px]",
        md: "px-2.5 py-1 text-xs",
      },
    },
    defaultVariants: { state: "idle", size: "md" },
  },
);

export type ChipState = NonNullable<VariantProps<typeof chip>["state"]>;

const DEFAULT_ICON: Record<ChipState, LucideIcon> = {
  idle: Circle,
  info: Info,
  active: Radio,
  warning: AlertTriangle,
  critical: OctagonAlert,
  success: CheckCircle2,
};

interface StateChipProps extends Omit<VariantProps<typeof chip>, "state"> {
  /** Narrowed from the cva variant type so it can index the icon map. */
  state?: ChipState;
  children: React.ReactNode;
  icon?: LucideIcon;
  /** Concentric ring behind the icon. Stops entirely under reduced motion. */
  pulse?: boolean;
  className?: string;
}

export function StateChip({
  state = "idle",
  size,
  icon,
  pulse = false,
  children,
  className,
}: StateChipProps) {
  const Icon = icon ?? DEFAULT_ICON[state];
  return (
    <span className={cn(chip({ state, size }), className)}>
      <span className="relative flex h-3 w-3 shrink-0 items-center justify-center">
        {pulse && (
          <span
            aria-hidden
            className="animate-pulse-ring absolute inset-0 rounded-full border border-current"
          />
        )}
        <Icon className="h-3 w-3" strokeWidth={2.25} aria-hidden />
      </span>
      {children}
    </span>
  );
}
