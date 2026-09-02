"use client";

/**
 * Audible call cues — FRONTEND_DESIGN_PLUGINS.md §4.2 ("sound cue, optional").
 *
 * Kept out of the Live Call Theatre so that component stays layout and nothing
 * else. Every cue is a no-op unless the operator has switched sound on in the
 * command bar; see `lib/sound.ts` for why it is off by default.
 */

import { useEffect, useRef } from "react";
import type { CallState } from "@/lib/contracts/domain";
import { cue } from "@/lib/sound";

const RING_INTERVAL_MS = 2600;

export interface CallCueInput {
  callState: CallState | null;
  /** Current escalation rung — a rise means the ladder advanced. */
  rung: number;
  resolved: boolean;
}

export function useCallCues({ callState, rung, resolved }: CallCueInput): void {
  const ringTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const previousRung = useRef(rung);

  /* Ringing repeats until the state changes; every other cue fires once. */
  useEffect(() => {
    if (callState === "dialling") {
      cue.ring();
      ringTimer.current = setInterval(cue.ring, RING_INTERVAL_MS);
    } else if (callState === "connected") {
      cue.connect();
    } else if (callState === "no_answer" || callState === "failed") {
      cue.error();
    }

    return () => {
      if (ringTimer.current) {
        clearInterval(ringTimer.current);
        ringTimer.current = null;
      }
    };
  }, [callState]);

  useEffect(() => {
    if (rung > previousRung.current) cue.escalate();
    previousRung.current = rung;
  }, [rung]);

  useEffect(() => {
    if (resolved) cue.success();
  }, [resolved]);
}
