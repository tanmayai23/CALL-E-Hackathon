"use client";

/**
 * The confidence readout, with the human-review threshold drawn where you can
 * see it — §12 #3.
 *
 * FR-6.3 routes anything below 0.70 to human review, and that rule lives in
 * code, not in the prompt (CLAUDE.md §5.3: "confidence below threshold always
 * wins over next_action"). Marking the threshold on the bar makes an invisible
 * invariant legible in a still frame.
 */

import { motion, useReducedMotion } from "framer-motion";
import { Check, Pencil } from "lucide-react";
import type { Confidence } from "@/lib/contracts/domain";
import { StateChip } from "@/components/ui/StateChip";
import { Button } from "@/components/ui/Button";
import { confidenceBand, HUMAN_REVIEW_THRESHOLD } from "@/lib/state-map";
import { T } from "@/lib/motion";

export function ConfidenceHeader({
  confidence,
  accepted,
  editing,
  onAccept,
  onToggleEdit,
}: {
  confidence: Confidence;
  accepted: boolean;
  editing: boolean;
  onAccept: () => void;
  onToggleEdit: () => void;
}) {
  const reduced = useReducedMotion() ?? false;
  const band = confidenceBand(confidence.score);
  const needsReview = confidence.score < HUMAN_REVIEW_THRESHOLD;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line px-4 py-3">
      <div className="flex items-baseline gap-2.5">
        <span className="micro">Completion confidence</span>
        <span className="data-value text-xl leading-none" style={{ color: band.token }}>
          {confidence.score.toFixed(2)}
        </span>
        <StateChip state={band.chip} icon={band.icon} size="sm">
          {confidence.label || band.label}
        </StateChip>
      </div>

      <div className="min-w-[160px] flex-1">
        <div className="relative h-1.5 overflow-hidden rounded-full bg-elevated">
          <motion.div
            className="h-full rounded-full"
            style={{ background: band.token }}
            initial={reduced ? false : { width: 0 }}
            animate={{ width: `${confidence.score * 100}%` }}
            transition={T.slow}
          />
          <span
            aria-hidden
            className="absolute inset-y-0 w-px bg-ink-faint"
            style={{ left: `${HUMAN_REVIEW_THRESHOLD * 100}%` }}
          />
        </div>
        <p className="micro mt-1.5">
          below {HUMAN_REVIEW_THRESHOLD.toFixed(2)} → human review · threshold enforced in code,
          not in the prompt
        </p>
      </div>

      <div className="flex items-center gap-2">
        {needsReview && (
          <StateChip state="critical" size="sm">
            Needs review
          </StateChip>
        )}

        {accepted ? (
          <StateChip state="success" size="sm">
            Extraction accepted
          </StateChip>
        ) : (
          <>
            <Button variant="primary" size="sm" onClick={onAccept} disabled={editing}>
              <Check className="h-3.5 w-3.5" aria-hidden />
              Accept
            </Button>
            <Button variant="neutral" size="sm" onClick={onToggleEdit}>
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              {editing ? "Cancel" : "Override"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
