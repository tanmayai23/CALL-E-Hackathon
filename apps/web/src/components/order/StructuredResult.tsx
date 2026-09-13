"use client";

/**
 * The structured result panel — the moment the thesis lands: a phone
 * conversation became typed commercial data an order can be updated from.
 *
 * Layout is a strip, so the payoff never falls below the fold at 1440×900:
 * the quantity split on the left, the fields that decide the workflow on the
 * right, and everything else behind an expander.
 *
 * Provenance and the confidence contract live in `ResultField` and
 * `ConfidenceHeader`; this component owns state and layout.
 */

import { useState } from "react";
import { ChevronDown, FileSearch } from "lucide-react";
import type { ExtractedResult } from "@/hooks/useOrderStream";
import { EmptyState, Skeleton } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { HUMAN_REVIEW_THRESHOLD, PRIMARY_FIELDS, SECONDARY_FIELDS } from "@/lib/state-map";
import { apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ConfidenceHeader } from "./ConfidenceHeader";
import { QuantitySplit } from "./QuantitySplit";
import { ResultField, type FieldEntry } from "./ResultField";

/** Coerce an edited string back to the type the extracted field originally had. */
function coerce(raw: string, original: unknown): unknown {
  if (typeof original === "number") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : original;
  }
  if (typeof original === "boolean") return raw === "true" || raw === "yes";
  return raw;
}

export function StructuredResult({
  orderId,
  requested,
  unit,
  result,
  extracting,
}: {
  orderId: string;
  requested: number;
  unit: string;
  result: ExtractedResult | null;
  extracting: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  if (extracting && !result) {
    return (
      <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (!result) {
    return (
      <EmptyState
        compact
        icon={FileSearch}
        title="No result extracted yet"
        body="When the call ends, CALL-E returns a typed object — stock status, confirmed and remaining quantity, price, dispatch date and the next action. Nothing here is parsed from prose."
      />
    );
  }

  const { structured } = result;
  const values = structured as unknown as Record<string, unknown>;
  const toEntries = (keys: string[]): FieldEntry[] =>
    keys.filter((key) => key in values).map((key) => ({ key, value: values[key] }));

  const primary = toEntries(PRIMARY_FIELDS);
  const secondary = toEntries(SECONDARY_FIELDS);
  const entries = [...primary, ...secondary];
  const shown = expanded || editing ? entries : primary;
  const needsReview = result.confidence.score < HUMAN_REVIEW_THRESHOLD;
  const hasSplit = structured.confirmed_quantity != null;

  const startEditing = () => {
    setDraft(Object.fromEntries(entries.map((e) => [e.key, String(e.value ?? "")])));
    setEditing(true);
  };

  const save = () => {
    setSaving(true);
    setSaveError(null);
    const patch = Object.fromEntries(
      Object.entries(draft).map(([key, raw]) => [key, coerce(raw, values[key])]),
    );
    apiPost(`/api/v1/orders/${orderId}/override`, { structured: patch })
      .then(() => {
        setEditing(false);
        setDraft({});
      })
      .catch((err: unknown) => setSaveError(err instanceof Error ? err.message : "Could not save the correction"))
      .finally(() => setSaving(false));
  };

  return (
    <div className="flex flex-col">
      <ConfidenceHeader
        confidence={result.confidence}
        accepted={accepted}
        editing={editing}
        onAccept={() => setAccepted(true)}
        onToggleEdit={() => (editing ? setEditing(false) : startEditing())}
      />

      <div className={cn("grid gap-6 px-5 py-3", hasSplit && "lg:grid-cols-[220px_minmax(0,1fr)]")}>
        {hasSplit && (
          <QuantitySplit
            requested={requested}
            confirmed={structured.confirmed_quantity ?? 0}
            remaining={structured.remaining_quantity ?? 0}
            unit={unit}
            dispatch={structured.dispatch_date}
            remainingWhen={structured.delivery_eta}
            verified={!needsReview}
          />
        )}

        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 xl:grid-cols-5">
          {shown.map((entry, index) => (
            <ResultField
              key={entry.key}
              entry={entry}
              index={index}
              evidence={result.evidence}
              currency={structured.currency}
              needsReview={needsReview}
              editing={editing}
              draft={draft[entry.key] ?? ""}
              onDraftChange={(value) => setDraft((d) => ({ ...d, [entry.key]: value }))}
            />
          ))}
        </div>
      </div>

      {secondary.length > 0 && !editing && (
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex items-center gap-1.5 border-t border-line px-5 py-2 text-left text-xs text-ink-dim transition-colors hover:text-ink"
        >
          <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} aria-hidden />
          {expanded ? "Hide the remaining fields" : `Show all ${entries.length} extracted fields`}
        </button>
      )}

      {editing && (
        <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-3">
          <Button variant="primary" size="sm" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save correction"}
          </Button>
          <p className="text-xs text-ink-dim">
            Confidence and evidence are left untouched — an operator edit does not change what was said on
            the call.
          </p>
          {saveError && <p className="ml-auto text-xs text-state-critical">{saveError}</p>}
        </div>
      )}
    </div>
  );
}
