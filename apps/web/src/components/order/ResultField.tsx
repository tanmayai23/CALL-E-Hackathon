"use client";

/**
 * One extracted field, and its provenance.
 *
 * There is no per-field confidence here, and that is deliberate. CALL-E returns
 * one call-level `completionConfidence`; inventing a score per field to fill
 * out the layout would be fabricating a confidence value, which Rule 8 forbids.
 *
 * What each field carries instead is whether it is **evidence-backed** — its
 * value traceable to one of the verbatim `evidence[]` quotes — or inferred.
 * That is a real, checkable property, and it is the cheapest proof there is
 * that the extraction came from the conversation and not from the model.
 */

import { motion, useReducedMotion } from "framer-motion";
import { Check, Quote, X } from "lucide-react";
import { FIELD_LABELS, NEXT_ACTION_LABEL, STOCK_STATUS } from "@/lib/state-map";
import type { NextAction, StockStatus } from "@/lib/contracts/domain";
import { T, landIn } from "@/lib/motion";
import { formatters } from "@/lib/time";
import { cn } from "@/lib/utils";

/* ─── Provenance ─────────────────────────────────────────────────────────── */

const ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/** 120 → "one hundred twenty". Spoken quantities arrive as words as often as digits. */
function numberWords(n: number): string | null {
  if (!Number.isInteger(n) || n < 0 || n > 9999) return null;
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : "");
  if (n < 1000) {
    const rest = n % 100;
    return `${ONES[Math.floor(n / 100)]} hundred${rest ? ` ${numberWords(rest)}` : ""}`;
  }
  const rest = n % 1000;
  return `${numberWords(Math.floor(n / 1000))} thousand${rest ? ` ${numberWords(rest)}` : ""}`;
}

/** Words that, in a quote, support a stock status. Deliberately conservative. */
const STOCK_CUES: Record<StockStatus, string[]> = {
  confirmed: ["have all", "all of it", "in stock"],
  partial: ["only have", "only"],
  unavailable: ["out of stock", "don't have", "do not have", "none"],
  unknown: [],
};

/** "2026-09-13T10:30:00Z" → the ways a person would say that time on a call. */
function timeCues(iso: string): string[] {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return [];
  const hour24 = Number(formatters.hour24.format(at));
  const hour12 = hour24 % 12 || 12;
  const words = numberWords(hour12);
  return [`${hour12} pm`, `at ${hour12}`, ...(words ? [`at ${words}`] : [])];
}

/** The verbatim quote a value traces back to, or null if it was inferred. */
export function evidenceFor(key: string, value: unknown, evidence: string[]): string | null {
  if (value == null || typeof value === "boolean") return null;
  // A next action is the call's decision, not something anyone said.
  if (key === "next_action") return null;

  const needles: string[] = [];
  if (typeof value === "number") {
    needles.push(String(value));
    const words = numberWords(value);
    if (words) needles.push(words);
  } else if (typeof value === "string") {
    if (key === "stock_status") needles.push(...(STOCK_CUES[value as StockStatus] ?? []));
    else if (/^\d{4}-\d{2}-\d{2}T/.test(value)) needles.push(...timeCues(value));
    else if (value.length > 3) needles.push(value);
  }

  const phrases = needles.map((n) => n.toLowerCase()).filter((n) => n.length > 1);
  return evidence.find((quote) => phrases.some((p) => containsPhrase(quote, p))) ?? null;
}

/**
 * Whole-word containment, so "80" does not match inside "180" and "only" does
 * not match inside "commonly".
 */
function containsPhrase(text: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(text.toLowerCase());
}

/* ─── Rendering ──────────────────────────────────────────────────────────── */

function FieldValue({ field, value, currency }: { field: string; value: unknown; currency?: string }) {
  if (typeof value === "boolean") {
    return (
      <span className={cn("inline-flex items-center gap-1", value ? "text-state-warning" : "text-ink-dim")}>
        {value ? <Check className="h-3.5 w-3.5" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
        {value ? "yes" : "no"}
      </span>
    );
  }
  if (value == null || value === "") return <span className="text-ink-faint">—</span>;

  if (field === "stock_status") {
    const spec = STOCK_STATUS[value as StockStatus];
    return <span>{spec?.label ?? String(value)}</span>;
  }
  if (field === "next_action") return <span>{NEXT_ACTION_LABEL[value as NextAction] ?? String(value)}</span>;
  if (field === "unit_price" && typeof value === "number" && currency) {
    return (
      <span>
        {new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value)}
      </span>
    );
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return <span suppressHydrationWarning>{formatters.dayTime.format(new Date(value))}</span>;
  }
  return <span>{String(value)}</span>;
}

export interface FieldEntry {
  key: string;
  value: unknown;
}

export function ResultField({
  entry,
  index,
  evidence,
  currency,
  needsReview,
  editing,
  draft,
  onDraftChange,
}: {
  entry: FieldEntry;
  /** Position in the stagger — fields land 60ms apart. */
  index: number;
  evidence: string[];
  currency?: string;
  needsReview: boolean;
  editing: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
}) {
  const reduced = useReducedMotion() ?? false;
  const quote = evidenceFor(entry.key, entry.value, evidence);
  const label = FIELD_LABELS[entry.key] ?? entry.key;

  return (
    <motion.div
      initial={reduced ? false : landIn.initial}
      animate={landIn.animate}
      transition={{ delay: reduced ? 0 : index * T.stagger, duration: 0.25 }}
      className="min-w-0"
    >
      <span className="micro block truncate">{label}</span>

      {editing ? (
        <input
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          aria-label={label}
          className="data-value mt-1.5 w-full rounded-sm border border-line-strong bg-elevated px-2 py-1 text-sm text-ink"
        />
      ) : (
        <span
          className={cn("mt-1.5 block truncate text-base font-medium", needsReview ? "text-conf-low" : "text-ink")}
          title={typeof entry.value === "string" ? entry.value : undefined}
        >
          <FieldValue field={entry.key} value={entry.value} currency={currency} />
        </span>
      )}

      {quote ? (
        <span
          title={`Evidence: “${quote}”`}
          className="mt-1.5 flex items-start gap-1 text-[11px] leading-tight text-state-success"
        >
          <Quote className="mt-px h-2.5 w-2.5 shrink-0" aria-hidden />
          <span className="line-clamp-2">{quote}</span>
        </span>
      ) : (
        <span className="micro mt-1.5 block text-[10px]">{entry.key === "next_action" ? "decision" : "inferred"}</span>
      )}
    </motion.div>
  );
}
