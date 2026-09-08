/**
 * packages/agent/nodes/executeCall.ts
 * Node: execute_call
 * Owner: Aryan
 *
 * The core node — invokes CALL-E and persists all artifacts.
 * Exits to: "decide"
 *
 * RULE: This is the ONLY place in the codebase that places a CALL-E call.
 * Never dial from anywhere else.
 *
 * Uses the real SDK in production.
 * Uses the mock driver in development (CALLE_USE_MOCK=true in .env).
 *
 * We drive the call with create() + our own poll loop rather than
 * createAndWait(), because the dashboard needs live `call.state` transitions
 * while the phone is ringing (FR-5.2). See ../../calle/progress.ts.
 */

import type { EscalationContext } from "../../types";
import type { MockScenario } from "../../calle/mock";
import type { EscalationState } from "../state";
import { ESCALATION_RESULT_SCHEMA } from "../../calle/schema";
import { buildTaskPrompt } from "../../calle/prompt";
import {
  pollCallToCompletion,
  withRetry,
  toSentinelCallState,
  DEFAULT_CALL_TIMEOUT_MS,
  DEFAULT_POLL_INTERVAL_MS,
  type CallProgressHooks,
  type PollableCall,
} from "../../calle/progress";

// ─── Call result type — matches real CALL-E SDK `Call` shape ────────────────

export interface CallEResult {
  id?: string;
  status: string;
  taskCompleted: boolean | null;
  completionConfidence: { score: number; label: string } | null;
  evidence: string[];
  structuredResult: Record<string, unknown> | null;
}

// ─── Persistence callback ─────────────────────────────────────────────────────
// Agent never writes to DB directly — calls this callback (Sameer implements).

export type PersistCallFn = (params: {
  incidentId: string;
  traceId: string;
  responderId: string;
  escalationRung: number;
  status: string;
  taskCompleted: boolean;
  confidence: { score: number; label: string };
  evidence: string[];
  structuredResult: Record<string, unknown>;
  taskPrompt: string;
}) => Promise<{ callId: string }>;

export interface ExecuteCallOptions {
  useMock?: boolean;
  /** FR-5.2 — live progress out to the SSE stream. */
  hooks?: CallProgressHooks;
  /** FR-5.4 — hard ceiling on call duration. */
  timeoutMs?: number;
  pollIntervalMs?: number;
}

// ─── Main execute function ────────────────────────────────────────────────────

export async function executeCall(
  state: EscalationState,
  persistCall: PersistCallFn,
  options: ExecuteCallOptions = {}
): Promise<{ callId: string; result: CallEResult }> {
  if (!state.currentResponder) {
    throw new Error(
      `execute_call: no currentResponder set on state for incident ${state.incidentId}`
    );
  }

  const useMock = options.useMock ?? process.env.CALLE_USE_MOCK === "true";
  const hooks = options.hooks ?? {};
  const timeoutMs = options.timeoutMs ?? DEFAULT_CALL_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  const ctx: EscalationContext = {
    incidentId: state.incidentId,
    traceId: state.traceId,
    severity: state.severity,
    safeWindowMinutes: state.safeWindowMinutes,
    consequence: state.consequence,
    escalationRung: state.escalationRung,
    facility: state.facility,
    asset: state.asset,
    reading: state.reading,
    responder: state.currentResponder,
  };

  const taskPrompt = buildTaskPrompt(ctx);

  // ── Place the call and follow it to completion ────────────────────────────
  // F10: transient SDK failures get 3 attempts with exponential backoff.
  // A duration-ceiling breach is never retried — the technician's phone
  // already rang, and redialling would ring it again.
  const result = await withRetry<CallEResult>(async () => {
    if (useMock) {
      // ── Dev harness — never in demo or deployed app ────────────────────────
      // SENTINEL_MOCK_SCENARIO selects which responder behaviour to replay so
      // tests can drive every branch. Defaults to the hero scenario.
      const { mockCalle } = await import("../../calle/mock");
      const scenario = (process.env.SENTINEL_MOCK_SCENARIO ??
        "accept_after_pushback") as MockScenario;
      const delayMs = Number(process.env.SENTINEL_MOCK_DELAY_MS ?? 1500);

      const mockResult = await mockCalle.runCall(
        { task: taskPrompt, resultSchema: ESCALATION_RESULT_SCHEMA },
        scenario,
        hooks,
        delayMs
      );

      return {
        status: mockResult.status,
        taskCompleted: mockResult.taskCompleted,
        completionConfidence: mockResult.completionConfidence,
        evidence: mockResult.evidence,
        structuredResult: mockResult.structuredResult as unknown as Record<string, unknown>,
      };
    }

    // ── Real CALL-E SDK ─────────────────────────────────────────────────────
    // RULE: Before this code path runs, you must have explicit confirmation.
    // Log every live call in docs/CALLE_TESTING_LOG.md (CLAUDE.md Rule 2).
    const { getCalle } = await import("../../calle/client");
    const calle = await getCalle();

    const created = await calle.calls.create({
      task: taskPrompt,
      recipient: {
        phone: state.currentResponder!.phoneE164,
        locale: state.currentResponder!.preferredLanguage,
      },
      resultSchema: ESCALATION_RESULT_SCHEMA as unknown as Record<string, unknown>,
      metadata: {
        incidentId: state.incidentId,
        traceId: state.traceId,
        escalationRung: state.escalationRung,
      },
    });

    // Emit the opening state immediately so the dashboard reacts on dial,
    // not on the first poll tick. Hand it to the poller as `alreadyEmitted`
    // so the first tick doesn't repeat it.
    const openingState = toSentinelCallState(created as unknown as PollableCall);
    hooks.onState?.(openingState, created.id);

    const final = (await pollCallToCompletion(
      created.id,
      async (id) => (await calle.calls.get(id)) as unknown as PollableCall,
      hooks,
      { intervalMs: pollIntervalMs, timeoutMs, alreadyEmitted: openingState }
    )) as unknown as typeof created;

    return {
      id: final.id,
      status: final.status,
      taskCompleted: final.taskCompleted ?? false,
      completionConfidence: final.completionConfidence as
        | { score: number; label: string }
        | null,
      evidence: final.evidence,
      structuredResult: final.structuredResult,
    } satisfies CallEResult;
  });

  // ── Persist call artifacts (Sameer's backend handles DB write) ───────────
  const confidence = result.completionConfidence ?? { score: 0, label: "none" };
  const structuredResult = result.structuredResult ?? {};

  const { callId } = await persistCall({
    incidentId: state.incidentId,
    traceId: state.traceId,
    responderId: state.currentResponder.id,
    escalationRung: state.escalationRung,
    status: result.status,
    taskCompleted: result.taskCompleted ?? false,
    confidence,
    evidence: result.evidence,
    structuredResult,
    taskPrompt,
  });

  return { callId, result };
}
