/**
 * Scenario scripting primitives.
 *
 * A scenario is a list of `{ at, event }` steps that the SSE route replays in
 * real time. Every event conforms to the FROZEN contract in CLAUDE.md §8.3, so
 * the dashboard cannot tell a scripted run apart from the real backend —
 * swapping to it is a base-URL change, not a rewrite.
 *
 * HONESTY (Rule 8): every scenario in this directory is a labelled fixture.
 * None of it is real CALL-E output, and none of it is presented in the UI as
 * such — the dashboard shows a persistent "Mock driver" chip whenever it is the
 * source. The demo and the deployed app run the real SDK path.
 */

import type { SentinelEvent } from "@/lib/contracts/events";
import type { Severity } from "@/lib/contracts/domain";

export interface ScriptStep {
  at: number;
  event: SentinelEvent;
}

export interface Scenario {
  id: string;
  name: string;
  tagline: string;
  description: string;
  assetId: string;
  severity: Severity;
  expectedOutcome: string;
  /** Telemetry history rendered behind the live curve, oldest first. */
  baseline: number[];
  threshold: number;
  unit: string;
  metricLabel: string;
  build: (incidentId: string) => ScriptStep[];
}

/** Milliseconds between streamed words. Tuned to read as speech, not a printer. */
export const WORD_MS = 58;

/**
 * Stream one transcript turn word by word. Every delta of a turn shares a `ts`,
 * which is how the client groups them back into a single turn — no field is
 * added to the frozen event shape to carry turn identity.
 */
export function turn(
  startAt: number,
  incidentId: string,
  speaker: "AGENT" | "HUMAN",
  ts: string,
  text: string,
): ScriptStep[] {
  const words = text.split(" ");
  return words.map((word, i) => ({
    at: startAt + i * WORD_MS,
    event: {
      type: "transcript.delta",
      incidentId,
      speaker,
      ts,
      text: i === words.length - 1 ? word : `${word} `,
    } satisfies SentinelEvent,
  }));
}

/** When a turn started at `startAt` finishes streaming. */
export function turnEnd(startAt: number, text: string): number {
  return startAt + text.split(" ").length * WORD_MS;
}

/** FR-4.2 — every plan carries the same three must-ask questions. */
export const MUST_ASK = [
  "Are you available to attend this incident?",
  "If not available now — what is the earliest realistic time you could reach the site?",
  "Do you need a backup technician or any replacement parts?",
];

/** Emit a run of telemetry readings at a fixed cadence. */
export function readings(
  incidentId: string,
  values: number[],
  everyMs: number,
): ScriptStep[] {
  return values.map((value, i) => ({
    at: i * everyMs,
    event: {
      type: "signal.received",
      incidentId,
      value,
      ts: new Date(Date.now() + i * everyMs).toISOString(),
    } satisfies SentinelEvent,
  }));
}
