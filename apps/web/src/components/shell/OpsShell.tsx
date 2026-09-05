"use client";

/**
 * The operations shell — the frame every /ops screen renders inside.
 *
 * Fixed to the viewport (`h-dvh` + `overflow-hidden`) so that screens which
 * must not scroll can claim a definite height and scroll their own regions
 * instead. The Live Call Theatre depends on this: its payoff strip has to stay
 * on screen at 1440×900, which is the recording resolution.
 */

import { Octagon } from "lucide-react";
import { CommandBar, useKillSwitch } from "./CommandBar";
import { NavRail, NavStrip } from "./Navigation";

export function OpsShell({ children }: { children: React.ReactNode }) {
  const killSwitch = useKillSwitch();

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-base">
      <CommandBar killSwitch={killSwitch} />

      {/* A halted system says so in persistent UI. §13 lists a toast for
          critical state as an anti-pattern — it disappears, and this must not. */}
      {killSwitch.engaged && (
        <div
          role="status"
          className="flex shrink-0 items-center gap-2 border-b border-state-critical/40 bg-state-critical/10 px-4 py-2"
        >
          <Octagon className="h-3.5 w-3.5 shrink-0 text-state-critical" aria-hidden />
          <p className="text-xs text-state-critical">
            <span className="font-medium">Outbound calling is halted.</span> In-flight calls were
            stopped and no scenario can be triggered until the kill switch is released.
          </p>
        </div>
      )}

      <NavStrip />

      <div className="flex min-h-0 flex-1">
        <NavRail />
        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
