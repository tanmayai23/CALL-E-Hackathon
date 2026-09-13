"use client";

/**
 * A single-choice group rendered as pills.
 *
 * Built on native radio inputs — visually hidden, not removed — so arrow keys,
 * focus and screen-reader semantics come from the platform instead of being
 * re-implemented.
 */

import { cn } from "@/lib/utils";

export interface Choice<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

export function ChoicePills<T extends string>({
  name,
  legend,
  choices,
  value,
  onChange,
}: {
  name: string;
  legend: string;
  choices: Choice<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="micro mb-2">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {choices.map((choice) => (
          <label key={choice.value} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={choice.value}
              checked={value === choice.value}
              onChange={() => onChange(choice.value)}
              className="peer sr-only"
            />
            <span
              className={cn(
                "flex items-baseline gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-state-active",
                value === choice.value
                  ? "border-on-lilac bg-lilac font-medium text-on-lilac"
                  : "border-line-strong bg-panel text-ink-dim hover:border-ink-faint hover:text-ink",
              )}
            >
              {choice.label}
              {choice.hint && (
                <span className="data-value text-[11px] opacity-70" suppressHydrationWarning>
                  {choice.hint}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
