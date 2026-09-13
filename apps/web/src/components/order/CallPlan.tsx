"use client";

/**
 * FR-4.3 — surface the generated plan in the UI *before* dialling. Seeing the
 * objective and the must-ask list ahead of the call is what separates a
 * composed agent prompt from a robocall.
 */

import { useState } from "react";
import { ChevronDown, ListChecks } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import type { CallPlan as CallPlanType } from "@/hooks/useOrderStream";
import { EmptyState } from "@/components/ui/Panel";
import { T, riseIn } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * The plan is a *pre-call* artifact, so it sits above the transcript and folds
 * itself away once the conversation it produced begins — the column tells the
 * story in order without the plan competing with the live turns for space.
 */
export function CallPlanPanel({
  plan,
  collapseWhen,
}: {
  plan: CallPlanType | null;
  collapseWhen: boolean;
}) {
  /* Derived, not synced: the panel follows `collapseWhen` until the operator
     expresses a preference, and then honours that instead. */
  const [pinned, setPinned] = useState<boolean | null>(null);
  const open = pinned ?? !collapseWhen;

  return (
    <div className="shrink-0 rounded-md border border-line bg-panel">
      <button
        onClick={() => setPinned(!open)}
        aria-expanded={open}
        disabled={!plan}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left disabled:cursor-default"
      >
        <span className="micro rule-label min-w-0 flex-1">Call plan</span>
        {plan && (
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-ink-faint transition-transform",
              open && "rotate-180",
            )}
            aria-hidden
          />
        )}
      </button>

      {open && (
        <div className="border-t border-line">
          <CallPlan plan={plan} />
        </div>
      )}
    </div>
  );
}

export function CallPlan({ plan }: { plan: CallPlanType | null }) {
  const reduced = useReducedMotion() ?? false;

  if (!plan) {
    return (
      <EmptyState
        compact
        icon={ListChecks}
        title="No call plan yet"
        body="The call prompt is composed for every order and contact — order number, quantity, required date and the questions to ask. It appears here before the number is dialled."
      />
    );
  }

  return (
    <motion.div
      initial={reduced ? false : riseIn.initial}
      animate={riseIn.animate}
      transition={T.base}
      className="space-y-3 px-4 py-3"
    >
      <p className="text-xs leading-relaxed text-ink-dim">{plan.summary}</p>

      <div>
        <p className="micro mb-1.5">Must ask</p>
        <ol className="space-y-1">
          {plan.mustAsk.map((question, i) => (
            <li key={question} className="flex gap-2 text-[11px] leading-snug text-ink">
              <span className="data-value shrink-0 text-ink-faint">{i + 1}.</span>
              <span>{question}</span>
            </li>
          ))}
        </ol>
      </div>

      <p className="micro border-t border-line pt-2.5">
        Stop conditions · a quantity and date · a clear no with a reason · a changed price →
        approval · two non-answers → human review
      </p>
    </motion.div>
  );
}
