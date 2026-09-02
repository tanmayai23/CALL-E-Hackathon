"use client";

/**
 * The command bar — facility identity on the left, operator controls on the
 * right, and the kill switch always reachable.
 *
 * The kill switch is a §12 safety control, not a preference: it is a global
 * halt on outbound calling, enforced server-side, and it is never hidden behind
 * a menu. Theme and sound are per-operator preferences and persist locally.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Moon, Octagon, ShieldAlert, Sun, Volume2, VolumeX } from "lucide-react";
import { StateChip } from "@/components/ui/StateChip";
import { Button } from "@/components/ui/Button";
import { apiGet, apiPost, IS_MOCK } from "@/lib/api";
import { isSoundEnabled, setSoundEnabled } from "@/lib/sound";
import { useClientValue, useNow } from "@/hooks/useClientValue";
import { FACILITY } from "@/lib/mock/facility";

const THEME_STORAGE_KEY = "sentinel.theme";

const CLOCK_FORMAT = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: FACILITY.timezone,
});

/** Module scope keeps the reader stable for useSyncExternalStore. */
function readTheme(): "dark" | "light" {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function FacilityClock() {
  const ms = useNow(1000);
  const now = ms == null ? null : CLOCK_FORMAT.format(new Date(ms));

  return (
    <span className="data-value text-xs text-ink-dim" suppressHydrationWarning>
      {now ?? "--:--:--"}
      <span className="micro ml-2">IST</span>
    </span>
  );
}

export interface KillSwitchState {
  engaged: boolean;
  busy: boolean;
  toggle: () => void;
}

/**
 * Kill-switch state lives here and is lifted to the shell, which needs it for
 * the persistent banner. Read once on mount, then owned by this control.
 */
export function useKillSwitch(): KillSwitchState {
  const [engaged, setEngaged] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiGet<{ engaged: boolean }>("/api/v1/killswitch")
      .then((result) => {
        if (!cancelled) setEngaged(result.engaged);
      })
      .catch(() => {
        /* The banner stays hidden and the button still works — the operator
           can engage it, which is the direction that matters for safety. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback(() => {
    setBusy(true);
    apiPost<{ engaged: boolean }>("/api/v1/killswitch", { engaged: !engaged })
      .then((result) => setEngaged(result.engaged))
      .catch(() => {
        /* Leave the state as-is; the button re-enables so it can be retried. */
      })
      .finally(() => setBusy(false));
  }, [engaged]);

  return { engaged, busy, toggle };
}

export function CommandBar({ killSwitch }: { killSwitch: KillSwitchState }) {
  /* Theme and sound live in the browser, so they are read as client snapshots
     and only shadowed once the operator changes them here. */
  const storedTheme = useClientValue(readTheme, "dark");
  const storedSound = useClientValue(isSoundEnabled, false);
  const [chosenTheme, setChosenTheme] = useState<"dark" | "light" | null>(null);
  const [chosenSound, setChosenSound] = useState<boolean | null>(null);
  const theme = chosenTheme ?? storedTheme;
  const sound = chosenSound ?? storedSound;

  const toggleTheme = useCallback(() => {
    const next = readTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* Private mode — the choice still holds for this session. */
    }
    setChosenTheme(next);
  }, []);

  const toggleSound = useCallback(() => {
    const next = !sound;
    setSoundEnabled(next);
    setChosenSound(next);
  }, [sound]);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-4 border-b border-line bg-base/95 px-4 backdrop-blur-sm">
      <Link href="/" className="flex items-baseline gap-2.5">
        <span className="data-value whitespace-nowrap text-sm font-semibold tracking-tight text-ink">
          SENTINEL OPS
        </span>
      </Link>

      <span className="hidden h-4 w-px bg-line sm:block" aria-hidden />

      <div className="hidden min-w-0 flex-col lg:flex">
        <span className="truncate text-xs font-medium leading-tight text-ink">
          {FACILITY.name}
        </span>
        <span className="micro leading-tight">
          {FACILITY.timezone} · quiet hours {FACILITY.quietHoursStart}–{FACILITY.quietHoursEnd}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span className="hidden md:block">
          <FacilityClock />
        </span>

        {IS_MOCK && (
          <StateChip state="info" icon={ShieldAlert} size="sm">
            <span className="hidden md:inline">Mock driver</span>
            <span className="md:hidden">Mock</span>
          </StateChip>
        )}

        <span className="hidden h-4 w-px bg-line sm:block" aria-hidden />

        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSound}
          aria-pressed={sound}
          title={sound ? "Mute call cues" : "Enable call cues"}
        >
          {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          <span className="sr-only">{sound ? "Mute call cues" : "Enable call cues"}</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to light" : "Switch to dark"}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span className="sr-only">Toggle colour theme</span>
        </Button>

        <Button
          variant={killSwitch.engaged ? "danger" : "neutral"}
          size="sm"
          onClick={killSwitch.toggle}
          disabled={killSwitch.busy}
          aria-pressed={killSwitch.engaged}
          title="Global halt on outbound calling"
        >
          <Octagon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="hidden whitespace-nowrap md:inline">
            {killSwitch.engaged ? "Calling halted" : "Kill switch"}
          </span>
          <span className="sr-only md:hidden">
            {killSwitch.engaged ? "Release the kill switch" : "Engage the kill switch"}
          </span>
        </Button>
      </div>
    </header>
  );
}
