"use client";

/**
 * Section navigation, in the two shapes the shell needs.
 *
 * One source of truth for the route list and one for how an item renders. The
 * rail (lg and up) and the horizontal strip (below lg) differ only in
 * orientation — duplicating the item markup between them is how a nav ends up
 * with a route that exists in one and not the other.
 *
 * Routes that are not built render as visibly disabled with a stated reason,
 * because §8.1 forbids dead controls: every control does something, or is
 * visibly disabled and says why.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Boxes,
  History,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavRoute {
  href: string;
  label: string;
  icon: LucideIcon;
  built: boolean;
}

export const NAV_ROUTES: NavRoute[] = [
  { href: "/ops", label: "Operations", icon: Activity, built: true },
  { href: "/ops/simulator", label: "Simulator", icon: SlidersHorizontal, built: true },
  { href: "/ops/history", label: "History", icon: History, built: false },
  { href: "/ops/roster", label: "Roster", icon: Users, built: false },
  { href: "/ops/assets", label: "Assets", icon: Boxes, built: false },
];

const NOT_BUILT = "Not in this build — scoped out of the P0 pass";

function isActive(pathname: string, href: string): boolean {
  return href === "/ops" ? pathname === "/ops" : pathname.startsWith(href);
}

function NavItem({
  route,
  active,
  orientation,
}: {
  route: NavRoute;
  active: boolean;
  orientation: "rail" | "strip";
}) {
  const Icon = route.icon;
  const shared =
    orientation === "rail"
      ? "flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-xs"
      : "flex shrink-0 items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs";
  const iconSize = orientation === "rail" ? "h-4 w-4" : "h-3.5 w-3.5";

  if (!route.built) {
    return (
      <span
        aria-disabled
        title={NOT_BUILT}
        className={cn(shared, "cursor-not-allowed text-ink-faint/60")}
      >
        <Icon className={cn(iconSize, "shrink-0")} aria-hidden />
        <span className="truncate">{route.label}</span>
        {orientation === "rail" && (
          <span className="micro ml-auto shrink-0 text-[9px]">soon</span>
        )}
      </span>
    );
  }

  return (
    <Link
      href={route.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        shared,
        "transition-colors",
        active ? "bg-elevated text-ink" : "text-ink-dim hover:bg-elevated hover:text-ink",
      )}
    >
      <Icon className={cn(iconSize, "shrink-0", active && "text-state-active")} aria-hidden />
      <span className="truncate">{route.label}</span>
    </Link>
  );
}

/** The vertical rail, shown from lg up. */
export function NavRail() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Sections"
      className="hidden w-[188px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-line px-2 py-3 lg:flex"
    >
      {NAV_ROUTES.map((route) => (
        <NavItem
          key={route.href}
          route={route}
          active={isActive(pathname, route.href)}
          orientation="rail"
        />
      ))}

      <div className="mt-auto space-y-2 px-2.5 pt-4">
        <p className="micro">Safety</p>
        <p className="text-[11px] leading-relaxed text-ink-faint">
          Consented roster only. Quiet hours enforced per facility; only CRITICAL overrides.
        </p>
      </div>
    </nav>
  );
}

/** The horizontal strip, shown below lg where the rail is hidden. */
export function NavStrip() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Sections"
      className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-line px-3 py-2 lg:hidden"
    >
      {NAV_ROUTES.map((route) => (
        <NavItem
          key={route.href}
          route={route}
          active={isActive(pathname, route.href)}
          orientation="strip"
        />
      ))}
    </nav>
  );
}
