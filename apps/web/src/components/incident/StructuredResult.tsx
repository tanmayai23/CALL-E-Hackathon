"use client";

/**
 * The structured result panel — §4.5, and the moment the whole thesis lands:
 * a phone conversation became typed data a workflow can branch on.
 *
 * §4.1 draws this as a strip, so the five fields that actually decide the
 * workflow lead and the rest sit behind an expander. Pushing the payoff below
 * the fold to fit ten fields would cost more than it shows.
 *
 * Provenance and the confidence contract are handled by `ResultField` and
 * `ConfidenceHeader` respectively; this component owns state and layout.
 */

import { useState } from "react";
import { ChevronDown, FileSearch } from "lucide-react";
import type { ExtractedResult } from "@/hooks/useIncidentStream";
import { EmptyState, Skeleton } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { HUMAN_REVIEW_THRESHOLD, PRIMARY_FIELDS, SECONDARY_FIELDS } from "@/lib/state-map";
import { apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ConfidenceHeader } from "./ConfidenceHeader";
import { ResultField, type FieldEntry } from "./ResultField";

/** Coerce an edited string back to the type the extracted field originally had. */
function coerce(raw: string, original: unknown): unknown {
  if (typeof original === "number") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : original;
  }
  if (typeof original === "boolean") return raw === "true";
  return raw;
}

export function StructuredResult({
  incidentId,
  result,
  extracting,
}: {
  incidentId: string;
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
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
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
        body="When the call ends, CALL-E returns a typed object against the frozen resultSchema — availability, ETA, decline reason, and the next action the workflow should take. Nothing here is parsed from prose."
      />
    );
  }

  const toEntries = (keys: string[]): FieldEntry[] =>
    keys
      .filter((key) => key in result.structured)
      .map((key) => ({ key, value: result.structured[key] }));

  const primary = toEntries(PRIMARY_FIELDS);
  const secondary = toEntries(SECONDARY_FIELDS);
  const entries = [...primary, ...secondary];
  const shown = expanded || editing ? entries : primary;
  const needsReview = result.confidence.score < HUMAN_REVIEW_THRESHOLD;

  const startEditing = () => {
    setDraft(Object.fromEntries(entries.map((e) => [e.key, String(e.value ?? "")])));
    setEditing(true);
  };

  const save = () => {
    setSaving(true);
    setSaveError(null);

    const patch = Object.fromEntries(
      Object.entries(draft).map(([key, raw]) => [key, coerce(raw, result.structured[key])]),
    );

    apiPost(`/api/v1/incidents/${incidentId}/override`, { structured: patch })
      .then(() => {
        setEditing(false);
        setDraft({});
      })
      .catch((err: unknown) => {
        setSaveError(err instanceof Error ? err.message : "Could not save the override");
      })
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

      <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-4 py-4 sm:grid-cols-3 lg:grid-cols-5">
        {shown.map((entry, index) => (
          <ResultField
            key={entry.key}
            entry={entry}
            index={index}
            evidence={result.evidence}
            needsReview={needsReview}
            editing={editing}
            draft={draft[entry.key] ?? ""}
            onDraftChange={(value) => setDraft((d) => ({ ...d, [entry.key]: value }))}
          />
        ))}
      </div>

      {secondary.length > 0 && !editing && (
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex items-center gap-1.5 border-t border-line px-4 py-2 text-left text-[11px] text-ink-dim transition-colors hover:text-ink"
        >
          <ChevronDown
            className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")}
            aria-hidden
          />
          {expanded ? "Hide the remaining fields" : `Show all ${entries.length} extracted fields`}
        </button>
      )}

      {editing && (
        <div className="flex items-center gap-3 border-t border-line px-4 py-3">
          <Button variant="primary" size="sm" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save override"}
          </Button>
          <p className="text-[11px] text-ink-dim">
            Confidence and evidence are left untouched — an operator edit does not change what
            was said on the call.
          </p>
          {saveError && <p className="ml-auto text-[11px] text-state-critical">{saveError}</p>}
        </div>
      )}
    </div>
  );
}
