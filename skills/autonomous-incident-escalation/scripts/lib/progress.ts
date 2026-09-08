/**
 * VENDORED — do not edit.
 *
 * Generated from packages/calle/progress.ts by scripts/vendor-skill.mjs.
 * Edit the source file and re-run the generator; edits here are overwritten.
 */

/**
 * packages/calle/progress.ts
 * Live call progress: status mapping + the polling loop behind FR-5.2.
 * Owner: Aryan
 *
 * `calle.calls.createAndWait()` blocks until the call is over and returns one
 * final object. That is fine for the agent's control flow but gives the
 * dashboard nothing to render while the phone is actually ringing — and the
 * Live Call Theatre is 60 seconds of the demo.
 *
 * So we drive the call ourselves: create() → poll get() → emit a `call.state`
 * event on every transition → return the final Call. Transcript turns arrive
 * on the same poll, so we stream those too.
 *
 * This module owns the CALL-E → Sentinel status vocabulary. Nothing else
 * should map these strings.
 */

import type { CallStatus as SentinelCallState } from "./types";

// ─── CALL-E's own vocabulary (from @call-e/calle generated schema) ───────────

/** Per-dial-attempt lifecycle — the most granular signal CALL-E exposes. */
export type CalleAttemptStatus =
  | "queued"
  | "dialing"
  | "in_progress"
  | "completed"
  | "failed"
  | "canceled";

/** Task-level lifecycle. Coarser than the attempt status. */
export type CalleTaskStatus =
  | "queued"
  | "in_progress"
  | "completed"
  | "failed"
  | "canceled";

// ─── Shape we need from a polled Call ────────────────────────────────────────
// Structural, not the SDK's `Call` type, so the mock driver can satisfy it too.

export interface PollableAttempt {
  status: CalleAttemptStatus;
  failureCode?: string | null;
  failureMessage?: string | null;
  transcriptTurns?: { speaker: string; text: string; offset_seconds: number | null }[];
}

export interface PollableCall {
  id: string;
  status: CalleTaskStatus;
  taskCompleted?: boolean | null;
  recipients?: { attempts?: PollableAttempt[] }[];
}

// ─── Status mapping ──────────────────────────────────────────────────────────

/**
 * Failure codes that mean "the phone rang and nobody picked up", as opposed to
 * a genuine transport/platform failure. F1 and F9 are handled differently
 * downstream, so the distinction matters.
 *
 * NOTE: CALL-E's OpenAPI schema types `failureCode` as an open string and does
 * not enumerate its values, so this list is matched loosely and may be
 * incomplete. Verify against real failure payloads before the demo and log any
 * unmapped code in docs/CALLE_TESTING_LOG.md.
 */
const NO_ANSWER_HINTS = ["no_answer", "no-answer", "noanswer", "unanswered", "busy", "voicemail"];

function isNoAnswer(attempt: PollableAttempt | undefined): boolean {
  if (!attempt) return false;
  const haystack = `${attempt.failureCode ?? ""} ${attempt.failureMessage ?? ""}`.toLowerCase();
  return NO_ANSWER_HINTS.some((hint) => haystack.includes(hint));
}

/** The attempt CALL-E is currently working, i.e. the last one on the recipient. */
export function latestAttempt(call: PollableCall): PollableAttempt | undefined {
  const attempts = call.recipients?.[0]?.attempts;
  return attempts?.[attempts.length - 1];
}

/**
 * Maps a polled CALL-E call onto the frozen Sentinel `CallState` union
 * (CLAUDE.md §8.3), which the dashboard's visual language keys off.
 *
 * Note the deliberate spelling shift: CALL-E says "dialing", our frozen SSE
 * contract says "dialling". Do not "fix" either side independently.
 */
export function toSentinelCallState(call: PollableCall): SentinelCallState {
  const attempt = latestAttempt(call);

  if (attempt) {
    switch (attempt.status) {
      case "queued":
        return "queued";
      case "dialing":
        return "dialling";
      case "in_progress":
        // OBSERVED (live call 2026-09-08, docs/live-call-raw.json): CALL-E
        // reported `in_progress` for ~50s on a call that never connected —
        // zero transcript turns, attempt.startedAt == completedAt. So
        // `in_progress` means "this attempt is being worked", which includes
        // ringing; it does NOT mean anyone is talking.
        //
        // We only claim in_conversation once a transcript turn exists. That
        // same call also never reported `dialing` at all, so this branch is
        // where the dashboard's ringing state actually comes from.
        return (attempt.transcriptTurns?.length ?? 0) > 0
          ? "in_conversation"
          : "dialling";
      case "failed":
        return isNoAnswer(attempt) ? "no_answer" : "failed";
      case "canceled":
        return "failed";
      case "completed":
        // The dial finished but the task hasn't resolved yet — CALL-E is
        // still extracting the structured result.
        return call.status === "completed" ? "completed" : "extracting";
    }
  }

  switch (call.status) {
    case "queued":
      return "queued";
    case "in_progress":
      return "dialling";
    case "completed":
      return "completed";
    case "failed":
      return isNoAnswer(latestAttempt(call)) ? "no_answer" : "failed";
    case "canceled":
      return "failed";
  }
}

export function isTerminalState(state: SentinelCallState): boolean {
  return state === "completed" || state === "failed" || state === "no_answer";
}

// ─── Progress hooks ──────────────────────────────────────────────────────────

export interface TranscriptTurn {
  speaker: "AGENT" | "HUMAN";
  text: string;
  offsetSeconds: number | null;
}

export interface CallProgressHooks {
  /** Fired once per state CHANGE, never on an unchanged poll. */
  onState?: (state: SentinelCallState, callId: string) => void;
  /** Fired once per new transcript turn, in order. */
  onTranscript?: (turn: TranscriptTurn, callId: string) => void;
}

function normaliseSpeaker(speaker: string): "AGENT" | "HUMAN" {
  const s = speaker.toLowerCase();
  return s.includes("agent") || s.includes("assistant") || s.includes("bot")
    ? "AGENT"
    : "HUMAN";
}

/** Flattens transcript turns across every attempt, in order. */
export function collectTurns(call: PollableCall): TranscriptTurn[] {
  const turns: TranscriptTurn[] = [];
  for (const recipient of call.recipients ?? []) {
    for (const attempt of recipient.attempts ?? []) {
      for (const turn of attempt.transcriptTurns ?? []) {
        turns.push({
          speaker: normaliseSpeaker(turn.speaker),
          text: turn.text,
          offsetSeconds: turn.offset_seconds,
        });
      }
    }
  }
  return turns;
}

// ─── The polling loop ────────────────────────────────────────────────────────

export interface PollOptions {
  /** How often to ask CALL-E for the current state. */
  intervalMs?: number;
  /** Hard ceiling on the whole call (FR-5.4). Exceeding it is a failure. */
  timeoutMs?: number;
  /**
   * A state the caller has already emitted (e.g. straight after create()).
   * Prevents a duplicate event on the first poll — the dashboard treats each
   * `call.state` as a transition, so emitting "queued" twice is a defect.
   */
  alreadyEmitted?: SentinelCallState;
}

export const DEFAULT_POLL_INTERVAL_MS = 2_000;

/** FR-5.4 — a call may never run longer than this. Prompt targets 90s. */
export const DEFAULT_CALL_TIMEOUT_MS = 180_000;

export class CallTimeoutError extends Error {
  constructor(readonly callId: string, readonly timeoutMs: number) {
    super(`CALL-E call ${callId} exceeded the ${timeoutMs}ms duration ceiling.`);
    this.name = "CallTimeoutError";
  }
}

/**
 * Polls a call to completion, emitting state and transcript progress.
 *
 * Deliberately does NOT swallow errors from `getCall` — transient SDK failures
 * are retried by the caller (F10), and a persistent one must surface.
 */
export async function pollCallToCompletion(
  callId: string,
  getCall: (callId: string) => Promise<PollableCall>,
  hooks: CallProgressHooks = {},
  options: PollOptions = {}
): Promise<PollableCall> {
  const intervalMs = options.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_CALL_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;

  let lastState: SentinelCallState | null = options.alreadyEmitted ?? null;

  // OBSERVED (live call 2026-09-08): CALL-E revises transcript turns after
  // first publishing them — "hello." became "Hello." on a later poll. Counting
  // by array length re-streams every revised turn, so the dashboard shows the
  // tail of the conversation twice. Track identity instead.
  const emittedTurns = new Set<string>();

  for (;;) {
    const call = await getCall(callId);

    const state = toSentinelCallState(call);
    if (state !== lastState) {
      hooks.onState?.(state, callId);
      lastState = state;
    }

    for (const [index, turn] of collectTurns(call).entries()) {
      // Position + speaker + normalised text: a turn whose only change is
      // casing or trailing punctuation is the same turn, revised.
      const identity = `${index}|${turn.speaker}|${turn.text.trim().toLowerCase()}`;
      if (emittedTurns.has(identity)) continue;
      emittedTurns.add(identity);
      hooks.onTranscript?.(turn, callId);
    }

    if (isTerminalState(state)) return call;

    if (Date.now() >= deadline) {
      hooks.onState?.("failed", callId);
      throw new CallTimeoutError(callId, timeoutMs);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

// ─── Retry policy (F10) ──────────────────────────────────────────────────────

export const DEFAULT_MAX_ATTEMPTS = 3;

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  /** Injected in tests so we don't actually sleep. */
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Retries a CALL-E operation with exponential backoff (F10: 3 attempts, then
 * a human alert). A timeout is NOT retried — the call really did happen and
 * redialling would ring a technician twice.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? 1_000;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (err) {
      if (err instanceof CallTimeoutError) throw err;
      lastError = err;
      if (attempt === maxAttempts) break;
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }

  throw lastError;
}
