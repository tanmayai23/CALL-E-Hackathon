"use client";

/**
 * The escalation ladder — §6.3 #4, and #2 on the list of details that make a
 * judge say "this is a real product". The travelling marker is what makes an
 * autonomous decision legible: when rung 1 does not answer, you *see* the
 * system move down.
 */

import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, ChevronRight, PhoneMissed, XCircle } from "lucide-react";
import type { LadderRung } from "@/lib/contracts/domain";
import { maskPhone } from "@/lib/mock/facility";
import { T } from "@/lib/motion";
import { cn } from "@/lib/utils";

const ROW = 50;

const STATE_ICON = {
  committed: CheckCircle2,
  declined: XCircle,
  no_answer: PhoneMissed,
} as const;

export function EscalationLadder({
  ladder,
  currentRung,
}: {
  ladder: LadderRung[];
  currentRung: number;
}) {
  const reduced = useReducedMotion() ?? false;
  const activeIndex = Math.max(0, ladder.findIndex((r) => r.rung === currentRung));

  return (
    <div className="px-4 py-1.5">
      <div className="relative">
        {/* The travelling marker */}
        {ladder.length > 0 && (
          <motion.span
            aria-hidden
            className="absolute left-0 w-0.5 rounded-full bg-state-active"
            style={{ height: ROW - 12 }}
            initial={false}
            animate={{ y: activeIndex * ROW + 6 }}
            transition={reduced ? { duration: 0 } : T.spring}
          />
        )}

        <ol>
          {ladder.map((rung) => {
            const active = rung.rung === currentRung;
            const Icon =
              rung.state in STATE_ICON
                ? STATE_ICON[rung.state as keyof typeof STATE_ICON]
                : null;

            return (
              <li
                key={rung.rung}
                style={{ height: ROW }}
                className={cn(
                  "flex items-center gap-3 border-b border-line pl-3 last:border-b-0",
                  !active && rung.state === "pending" && "opacity-55",
                )}
              >
                <span
                  className={cn(
                    "data-value flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border text-[11px]",
                    active
                      ? "border-state-active text-state-active"
                      : "border-line-strong text-ink-faint",
                  )}
                >
                  {rung.rung}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-medium text-ink">
                      {rung.responder.name}
                    </span>
                    {active && (
                      <ChevronRight className="h-3 w-3 shrink-0 text-state-active" aria-hidden />
                    )}
                  </span>
                  <span className="data-value block truncate text-[10px] text-ink-faint">
                    {rung.responder.role} · {maskPhone(rung.responder.phoneE164)}
                  </span>
                </span>

                <span className="flex shrink-0 items-center gap-1.5">
                  {rung.detail && (
                    <span
                      className={cn(
                        "data-value text-[10px]",
                        rung.state === "committed"
                          ? "text-state-success"
                          : rung.state === "declined" || rung.state === "no_answer"
                            ? "text-state-critical"
                            : "text-ink-faint",
                      )}
                    >
                      {rung.detail}
                    </span>
                  )}
                  {Icon && (
                    <Icon
                      className={cn(
                        "h-3.5 w-3.5",
                        rung.state === "committed" ? "text-state-success" : "text-state-critical",
                      )}
                      aria-label={rung.state.replace(/_/g, " ")}
                    />
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/** Shown in the panel header — the cap is enforced in code, not in the prompt. */
export function LadderCap({ currentRung, maxRungs }: { currentRung: number; maxRungs: number }) {
  return (
    <span className="data-value text-[10px] text-ink-faint">
      rung {currentRung}/{maxRungs} · cap enforced in code
    </span>
  );
}
