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
import { History, LayoutList, PhoneOutgoing, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavRoute {
  href: string;
  label: string;
  icon: LucideIcon;
  built: boolean;
}

export const NAV_ROUTES: NavRoute[] = [
  { href: "/ops", label: "Orders", icon: LayoutList, built: true },
  { href: "/ops/simulator", label: "New order", icon: PhoneOutgoing, built: true },
  { href: "/ops/history", label: "History", icon: History, built: false },
  { href: "/ops/contacts", label: "Contacts", icon: Users, built: false },
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
      ? "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm"
      : "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs";
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
          <span className="micro ml-auto shrink-0">soon</span>
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
        active
          ? "bg-lilac font-semibold text-on-lilac"
          : "text-ink-dim hover:bg-stone/60 hover:text-ink",
      )}
    >
      <Icon className={cn(iconSize, "shrink-0")} aria-hidden />
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
      className="hidden w-[208px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-line px-3 py-4 lg:flex"
    >
      {NAV_ROUTES.map((route) => (
        <NavItem
          key={route.href}
          route={route}
          active={isActive(pathname, route.href)}
          orientation="rail"
        />
      ))}

      <div className="mt-auto space-y-2 rounded-lg bg-stone/50 p-3">
        <p className="micro">Safety</p>
        <p className="text-xs leading-relaxed text-ink-dim">
          Consented business contacts only, within working hours. Prices, credit and terms are never
          accepted by the agent.
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
