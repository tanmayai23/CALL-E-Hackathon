"use client";

/**
 * Live transcript — §4.3.
 *
 * The evidence highlighting here is, per §12, the single highest-value detail
 * in the UI: it shows the extracted values tracing back to the exact spoken
 * words, which is the cheapest possible proof that the extraction is real and
 * not a hallucination.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowDown, Quote } from "lucide-react";
import type { TranscriptTurn } from "@/lib/contracts/domain";
import { EmptyState } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { T, riseIn } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** Wrap each evidence phrase found in `text`, longest first so nesting can't occur. */
function markEvidence(text: string, evidence: string[]): React.ReactNode {
  if (evidence.length === 0) return text;

  const phrases = [...evidence]
    .map((e) => e.trim())
    .filter((e) => e.length > 3)
    .sort((a, b) => b.length - a.length);

  let segments: React.ReactNode[] = [text];

  for (const phrase of phrases) {
    const next: React.ReactNode[] = [];
    for (const segment of segments) {
      if (typeof segment !== "string") {
        next.push(segment);
        continue;
      }
      const index = segment.toLowerCase().indexOf(phrase.toLowerCase());
      if (index === -1) {
        next.push(segment);
        continue;
      }
      const before = segment.slice(0, index);
      const hit = segment.slice(index, index + phrase.length);
      const after = segment.slice(index + phrase.length);
      if (before) next.push(before);
      next.push(
        <mark
          key={`${phrase}-${index}`}
          title="Cited by CALL-E as evidence for the extracted result"
          className="rounded-[3px] bg-state-success/18 px-0.5 text-inherit decoration-state-success/60 underline-offset-4 [text-decoration-line:underline] [text-decoration-style:dotted]"
        >
          {hit}
        </mark>,
      );
      if (after) next.push(after);
    }
    segments = next;
  }

  return segments;
}

export function Transcript({
  turns,
  evidence,
  live,
}: {
  turns: TranscriptTurn[];
  evidence: string[];
  live: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);
  const reduced = useReducedMotion() ?? false;

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setPinned(distance < 48);
  }, []);

  useEffect(() => {
    if (!pinned) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [turns, pinned]);

  const jumpToLive = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: reduced ? "auto" : "smooth" });
    setPinned(true);
  };

  if (turns.length === 0) {
    return (
      <EmptyState
        icon={Quote}
        title="No conversation yet"
        body="Turns appear here word by word once the call connects. When CALL-E returns its structured result, the exact phrases it cited as evidence are highlighted in place."
      />
    );
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-3"
        tabIndex={0}
        role="log"
        aria-live="polite"
        aria-label="Call transcript"
      >
        <AnimatePresence initial={false}>
          {turns.map((turn) => {
            const agent = turn.speaker === "AGENT";
            return (
              <motion.div
                key={turn.id}
                initial={reduced ? false : riseIn.initial}
                animate={riseIn.animate}
                transition={T.base}
                className={cn(
                  "border-l-2 py-2 pl-3 font-mono text-sm leading-relaxed",
                  agent ? "border-state-active" : "border-line-strong",
                )}
              >
                <span className="mb-1 flex items-baseline gap-2">
                  <span
                    className={cn(
                      "micro",
                      agent ? "text-state-active" : "text-ink-dim",
                    )}
                  >
                    {turn.speaker}
                  </span>
                  <span className="data-value text-[10px] text-ink-faint">{turn.ts}</span>
                </span>
                <span className={cn("block", agent ? "text-state-active" : "text-ink")}>
                  {markEvidence(turn.text, evidence)}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {!pinned && live && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={T.fast}
            className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center"
          >
            <Button
              variant="primary"
              size="sm"
              onClick={jumpToLive}
              className="pointer-events-auto shadow-lg shadow-black/30"
            >
              <ArrowDown className="h-3.5 w-3.5" />
              Jump to live
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
