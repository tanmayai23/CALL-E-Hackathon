"use client";

/** The agent thinking out loud — the left column of §4.1's timeline. */

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Cpu } from "lucide-react";
import type { AgentEvent } from "@/lib/contracts/domain";
import { EmptyState } from "@/components/ui/Panel";
import { T, riseIn } from "@/lib/motion";
import { cn } from "@/lib/utils";

const DOT: Record<AgentEvent["state"], string> = {
  done: "bg-state-idle border-state-idle",
  live: "bg-state-active border-state-active",
  pending: "bg-transparent border-line-strong",
  failed: "bg-state-critical border-state-critical",
};

export function AgentTimeline({
  events,
  autoScroll = false,
}: {
  events: AgentEvent[];
  autoScroll?: boolean;
}) {
  const reduced = useReducedMotion() ?? false;
  const endRef = useRef<HTMLDivElement>(null);

  /* Keep the newest node in view while the graph is running. */
  useEffect(() => {
    if (!autoScroll) return;
    endRef.current?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
  }, [events.length, autoScroll, reduced]);

  if (events.length === 0) {
    return (
      <EmptyState
        icon={Cpu}
        title="The agent has not run yet"
        body="Each graph node writes a line here as it executes — ingest, correlation, severity, responder selection, call plan, then the call itself. Every line carries the incident trace ID."
      />
    );
  }

  return (
    <ol className="relative space-y-0 px-4 py-3">
      <span aria-hidden className="absolute bottom-4 left-[22px] top-4 w-px bg-line" />
      <AnimatePresence initial={false}>
        {events.map((event) => (
          <motion.li
            key={event.id}
            initial={reduced ? false : riseIn.initial}
            animate={riseIn.animate}
            transition={T.base}
            className="relative flex gap-3 py-1.5"
          >
            <span className="relative z-10 mt-1 flex h-3 w-3 shrink-0 items-center justify-center">
              {event.state === "live" && (
                <span
                  aria-hidden
                  className="animate-pulse-ring absolute inset-0 rounded-full border border-state-active"
                />
              )}
              <span
                className={cn("h-2.5 w-2.5 rounded-full border-2 ring-4 ring-panel", DOT[event.state])}
              />
            </span>

            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block truncate text-xs font-medium",
                  event.state === "live"
                    ? "text-state-active"
                    : event.state === "failed"
                      ? "text-state-critical"
                      : "text-ink",
                )}
              >
                {event.label}
              </span>
              {event.detail && (
                <span className="mt-0.5 block text-[11px] leading-snug text-ink-dim">
                  {event.detail}
                </span>
              )}
            </span>

            <span className="data-value mt-0.5 shrink-0 text-[10px] text-ink-faint">
              {event.ts.slice(11, 19)}
            </span>
          </motion.li>
        ))}
      </AnimatePresence>
      <div ref={endRef} aria-hidden />
    </ol>
  );
}
