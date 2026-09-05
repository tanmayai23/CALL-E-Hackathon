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
 * That is a real, checkable property, and it is what §12 ranks first among the
 * details that prove the extraction came from the conversation.
 */

import { motion, useReducedMotion } from "framer-motion";
import { Check, Quote, X } from "lucide-react";
import { FIELD_LABELS } from "@/lib/state-map";
import { T, landIn } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Spoken numbers arrive as words, so a numeric field only matches its quote if
 * we know the word for it. Covers the ETA values a responder actually says.
 */
const NUMBER_WORDS: Record<number, string> = {
  5: "five",
  10: "ten",
  15: "fifteen",
  20: "twenty",
  25: "twenty five",
  30: "thirty",
  35: "thirty five",
  40: "forty",
  45: "forty five",
  50: "fifty",
  60: "sixty",
  90: "ninety",
};

/** The verbatim quote this value traces back to, or null if it was inferred. */
export function evidenceFor(value: unknown, evidence: string[]): string | null {
  if (value == null || typeof value === "boolean") return null;

  const needles = [String(value).toLowerCase()];
  if (typeof value === "number" && NUMBER_WORDS[value]) needles.push(NUMBER_WORDS[value]);
  if (typeof value === "string" && value.length > 8) needles.push(value.toLowerCase());

  for (const quote of evidence) {
    const haystack = quote.toLowerCase();
    if (needles.some((n) => n.length > 2 && haystack.includes(n))) return quote;
  }
  return null;
}

function FieldValue({ value }: { value: unknown }) {
  if (typeof value === "boolean") {
    return (
      <span
        className={cn("inline-flex items-center gap-1", value ? "text-state-success" : "text-ink-dim")}
      >
        {value ? <Check className="h-3.5 w-3.5" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
        {String(value)}
      </span>
    );
  }
  if (value == null || value === "") return <span className="text-ink-faint">—</span>;
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
  needsReview,
  editing,
  draft,
  onDraftChange,
}: {
  entry: FieldEntry;
  /** Position in the stagger — §6.3 #3, fields land 60ms apart. */
  index: number;
  evidence: string[];
  needsReview: boolean;
  editing: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
}) {
  const reduced = useReducedMotion() ?? false;
  const quote = evidenceFor(entry.value, evidence);
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
          className={cn(
            "data-value mt-1.5 block truncate text-base",
            needsReview ? "text-conf-low" : "text-ink",
          )}
          title={typeof entry.value === "string" ? entry.value : undefined}
        >
          <FieldValue value={entry.value} />
        </span>
      )}

      {quote ? (
        <span
          title={`Evidence: “${quote}”`}
          className="mt-1.5 flex items-start gap-1 text-[10px] leading-tight text-state-success"
        >
          <Quote className="mt-px h-2.5 w-2.5 shrink-0" aria-hidden />
          <span className="line-clamp-2">{quote}</span>
        </span>
      ) : (
        <span className="micro mt-1.5 block text-[9px]">inferred</span>
      )}
    </motion.div>
  );
}
