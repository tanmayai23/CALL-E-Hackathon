"use client";

/**
 * What the supplier will do on the call — the mock driver's scenarios, offered
 * as a choice.
 *
 * Only shown while the mock driver is the source. With a real backend the
 * supplier's answer is whatever the real person says, so there is nothing to
 * choose and the panel says so instead.
 */

import { CircleDot, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/Panel";
import { cn } from "@/lib/utils";

export interface ScenarioOption {
  id: string;
  name: string;
  tagline: string;
  description: string;
  expectedOutcome: string;
}

export function SupplierBehaviour({
  scenarios,
  value,
  onChange,
  mock,
}: {
  scenarios: ScenarioOption[] | null;
  value: string;
  onChange: (id: string) => void;
  mock: boolean;
}) {
  if (!mock) {
    return (
      <div className="flex gap-3 p-5">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-state-info" aria-hidden />
        <p className="text-sm leading-relaxed text-ink-dim">
          <span className="font-medium text-ink">Live mode.</span> The supplier&rsquo;s answer is whatever
          the real person says. Calls go only to consented contacts, within working hours.
        </p>
      </div>
    );
  }

  if (!scenarios) {
    return (
      <div className="space-y-2 p-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <fieldset className="flex flex-col gap-2 p-4">
      <legend className="sr-only">What the supplier does on the call</legend>
      {scenarios.map((s, i) => {
        const checked = s.id === value;
        return (
          <label key={s.id} className="cursor-pointer">
            <input
              type="radio"
              name="supplier-behaviour"
              value={s.id}
              checked={checked}
              onChange={() => onChange(s.id)}
              className="peer sr-only"
            />
            <span
              className={cn(
                "flex gap-3 rounded-lg border p-3.5 transition-colors",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-state-active",
                checked
                  ? "border-on-lilac bg-lilac/60"
                  : "border-line bg-panel hover:border-line-strong hover:bg-elevated",
              )}
            >
              <CircleDot
                className={cn("mt-0.5 h-4 w-4 shrink-0", checked ? "text-on-lilac" : "text-ink-faint")}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-ink">
                    {s.name}
                    {i === 0 && <span className="ml-2 text-[11px] font-medium text-ink-faint">hero</span>}
                  </span>
                  <span className="shrink-0 text-[11px] text-ink-faint">{s.expectedOutcome}</span>
                </span>
                <span className="mt-0.5 block text-xs text-ink-dim">{s.tagline}</span>
                {checked && <span className="mt-2 block text-xs leading-relaxed text-ink">{s.description}</span>}
              </span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
