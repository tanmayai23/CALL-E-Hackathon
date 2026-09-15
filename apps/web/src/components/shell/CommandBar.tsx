"use client";

/**
 * The command bar — facility identity on the left, operator controls on the
 * right, and the kill switch always reachable.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Moon, Octagon, ShieldAlert, Sun, Volume2, VolumeX, LogOut, LogIn, User } from "lucide-react";
import { StateChip } from "@/components/ui/StateChip";
import { Button } from "@/components/ui/Button";
import { apiGet, apiPost, IS_MOCK } from "@/lib/api";
import { isSoundEnabled, setSoundEnabled } from "@/lib/sound";
import { useClientValue, useNow } from "@/hooks/useClientValue";
import { BUYER, WORKING_HOURS } from "@/lib/mock/directory";
import { formatters } from "@/lib/time";
import { BrandMark } from "@/components/ui/BrandMark";
import { RoleSelector } from "./role-selector";
import { useAuth } from "@/lib/auth/auth-context";

const THEME_STORAGE_KEY = "sentinel.theme";

function readTheme(): "dark" | "light" {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function FacilityClock() {
  const ms = useNow(1000);
  const now = ms == null ? null : formatters.clock.format(new Date(ms));

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

export function useKillSwitch(): KillSwitchState {
  const [engaged, setEngaged] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiGet<{ engaged: boolean }>("/api/v1/killswitch")
      .then((result) => {
        if (!cancelled) setEngaged(result.engaged);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback(() => {
    setBusy(true);
    apiPost<{ engaged: boolean }>("/api/v1/killswitch", { engaged: !engaged })
      .then((result) => setEngaged(result.engaged))
      .catch(() => {})
      .finally(() => setBusy(false));
  }, [engaged]);

  return { engaged, busy, toggle };
}

export function CommandBar({ killSwitch }: { killSwitch: KillSwitchState }) {
  const { user, profile, signOut, switchRole } = useAuth();
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
    } catch {}
    setChosenTheme(next);
  }, []);

  const toggleSound = useCallback(() => {
    const next = !sound;
    setSoundEnabled(next);
    setChosenSound(next);
  }, [sound]);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-4 border-b border-line bg-canvas/90 px-5 backdrop-blur-sm">
      <Link href="/" aria-label="Market Buddy home">
        <BrandMark />
      </Link>

      <span className="hidden h-4 w-px bg-line sm:block" aria-hidden />

      <div className="hidden min-w-0 flex-col lg:flex">
        <span className="truncate text-xs font-semibold leading-tight text-ink">
          {profile?.wholesalerName || profile?.fullName || user?.email?.split("@")[0] || "Operations Desk"}
        </span>
        <span className="micro leading-tight">
          {profile?.location ? `${profile.location} · Operations` : `Operations · working hours ${WORKING_HOURS.start}–${WORKING_HOURS.end} IST`}
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

        {process.env.NODE_ENV === "development" && (
          <RoleSelector currentRole={profile?.role} onRoleChange={(r) => switchRole(r)} />
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
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to light" : "Switch to dark"}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
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
        </Button>

        {user ? (
          <div className="flex items-center gap-2 pl-2 border-l border-line">
            <Link
              href="/ops/profile"
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              title="Edit Wholesaler Profile"
            >
              <div className="h-7 w-7 rounded-full bg-lilac/20 text-lilac font-bold text-xs flex items-center justify-center border border-lilac/40 shrink-0">
                {(profile?.fullName || user?.email || "U").charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-semibold text-ink leading-tight">
                  {profile?.fullName || user?.email?.split("@")[0]}
                </span>
                <span className="micro text-ink-dim leading-tight">
                  {profile?.wholesalerName || user?.email}
                </span>
              </div>
            </Link>
            <Button variant="ghost" size="sm" onClick={() => signOut()} title="Sign out">
              <LogOut className="h-4 w-4 text-red-600" />
            </Button>
          </div>
        ) : (
          <Link href="/login" className="pl-1">
            <Button variant="neutral" size="sm" className="gap-1">
              <LogIn className="h-3.5 w-3.5" />
              <span>Login</span>
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
}
