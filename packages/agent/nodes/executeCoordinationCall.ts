/**
 * packages/agent/nodes/executeCoordinationCall.ts
 * Node: execute_call (wholesale coordination)
 * Owner: Aryan
 *
 * The core node — invokes CALL-E and hands every artifact back for persistence.
 * Exits to: "decide"
 *
 * RULE: With `./executeCall.ts`, this is one of only two places in the codebase
 * that places a CALL-E call. Never dial from anywhere else.
 *
 * Uses the real SDK in production; the mock driver only when explicitly asked
 * (CALLE_USE_MOCK=true). The mock is a dev harness — CLAUDE.md Rule 1 keeps it
 * out of the demo, the video and the deployed app.
 *
 * We drive the call with create() + our own poll loop rather than
 * createAndWait(), because the dashboard needs live `call.state` transitions
 * while the phone is ringing (FR-5.2). See ../../calle/progress.ts.
 */

import type { Contact } from "../../types/wholesale";
import type { CoordinationState } from "../coordinationState";
import {
  WHOLESALE_COORDINATION_RESULT_SCHEMA,
  buildWholesaleTaskPrompt,
  type WholesaleCallContext,
} from "../../calle/wholesale";
import {
  pollCallToCompletion,
  withRetry,
  toSentinelCallState,
  collectTurns,
  DEFAULT_CALL_TIMEOUT_MS,
  DEFAULT_POLL_INTERVAL_MS,
  type CallProgressHooks,
  type PollableCall,
} from "../../calle/progress";

/** Matches the real CALL-E SDK `Call` shape, narrowed to what we consume. */
export interface CoordinationCallResult {
  id?: string;
  status: string;
  taskCompleted: boolean | null;
  completionConfidence: { score: number; label: string } | null;
  evidence: string[];
  structuredResult: Record<string, unknown> | null;
  transcript?: { speaker: "AGENT" | "HUMAN"; text: string; offsetSeconds: number | null }[];
}

/**
 * Persistence callback. The agent never writes to the database directly — it
 * hands artifacts to the backend, which keeps the graph pure and replayable.
 */
export type PersistCoordinationCallFn = (params: {
  orderId: string;
  traceId: string;
  contactId: string;
  rung: number;
  status: string;
  taskCompleted: boolean;
  confidence: { score: number; label: string };
  evidence: string[];
  structuredResult: Record<string, unknown>;
  taskPrompt: string;
}) => Promise<{ callId: string }>;

export interface ExecuteCoordinationCallOptions {
  useMock?: boolean;
  /** FR-5.2 — live progress out to the SSE stream. */
  hooks?: CallProgressHooks;
  /** FR-5.4 — hard ceiling on call duration. */
  timeoutMs?: number;
  pollIntervalMs?: number;
}

/**
 * FR-7.2 / SAFETY.md — only consented numbers are ever dialled.
 *
 * This is the last gate before the SDK. It lives here, not in the selection
 * node, so that no caller can reach the dial by assembling a state by hand.
 * Throwing (rather than returning) is deliberate: a missing consent record is
 * a bug or a data problem, never something to route around.
 */
function assertCallable(contact: Contact, orderId: string): void {
  if (!contact.consentAt) {
    throw new Error(
      `Refusing to dial ${contact.id} for order ${orderId}: no recorded consent (FR-7.2).`
    );
  }

  const consentedAt = new Date(contact.consentAt);
  if (Number.isNaN(consentedAt.getTime())) {
    throw new Error(
      `Refusing to dial ${contact.id} for order ${orderId}: consent timestamp is unparseable.`
    );
  }

  if (!/^\+[1-9]\d{7,14}$/.test(contact.phoneE164)) {
    throw new Error(
      `Refusing to dial ${contact.id} for order ${orderId}: phone number is not valid E.164.`
    );
  }
}

/** Builds the prompt context from graph state. One prompt builder, one schema. */
function toCallContext(state: CoordinationState, contact: Contact): WholesaleCallContext {
  return {
    contactName: contact.name,
    phoneE164: contact.phoneE164,
    companyName: state.order.seller.name,
    orderReference: state.order.reference,
    product: state.order.item.description,
    requestedQuantity: state.order.item.requestedQuantity,
    requiredBy: state.order.requiredBy,
  };
}

export async function executeCoordinationCall(
  state: CoordinationState,
  persistCall: PersistCoordinationCallFn,
  options: ExecuteCoordinationCallOptions = {}
): Promise<{ callId: string; result: CoordinationCallResult }> {
  const contact = state.currentContact;
  if (!contact) {
    throw new Error(
      `execute_call: no currentContact set on state for order ${state.orderId}`
    );
  }

  assertCallable(contact, state.orderId);

  const useMock = options.useMock ?? process.env.CALLE_USE_MOCK === "true";
  const hooks = options.hooks ?? {};
  const timeoutMs = options.timeoutMs ?? DEFAULT_CALL_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  const taskPrompt = buildWholesaleTaskPrompt(toCallContext(state, contact));

  // ── Place the call and follow it to completion ────────────────────────────
  // F10: transient SDK failures get 3 attempts with exponential backoff.
  // A duration-ceiling breach is never retried — the supplier's phone already
  // rang, and redialling would ring it again.
  const result = await withRetry<CoordinationCallResult>(async () => {
    if (useMock) {
      // ── Dev harness — never in the demo or the deployed app ───────────────
      // The wholesale mock, not the v1 escalation one: it returns results in
      // the schema this graph actually routes on.
      const { wholesaleMock } = await import("../../calle/wholesaleMock");
      const scenario = process.env.SENTINEL_MOCK_SCENARIO ?? "confirm_after_pushback";
      const delayMs = Number(process.env.SENTINEL_MOCK_DELAY_MS ?? 1500);

      const mockResult = await wholesaleMock.runCall(
        { task: taskPrompt, resultSchema: WHOLESALE_COORDINATION_RESULT_SCHEMA },
        scenario as never,
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

    // ── Real CALL-E SDK ──────────────────────────────────────────────────────
    // RULE: before this path runs you must have explicit confirmation, and the
    // call must be logged in docs/CALLE_TESTING_LOG.md (CLAUDE.md Rule 2).
    const { getCalle } = await import("../../calle/client");
    const calle = await getCalle();

    const created = await calle.calls.create({
      task: taskPrompt,
      recipient: {
        phone: contact.phoneE164,
        locale: contact.preferredLanguage,
      },
      resultSchema: WHOLESALE_COORDINATION_RESULT_SCHEMA as unknown as Record<
        string,
        unknown
      >,
      metadata: {
        orderId: state.orderId,
        orderReference: state.order.reference,
        traceId: state.traceId,
        rung: state.rung,
      },
    });

    // Emit the opening state immediately so the dashboard reacts on dial, not
    // on the first poll tick. Handed to the poller as `alreadyEmitted` so the
    // first tick doesn't repeat it.
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
      // The MAPPED state, not CALL-E's raw task status — the task-level status
      // lags the attempt by several seconds, so persisting the raw value can
      // record a failed call as "queued". See executeCall.ts for the observed
      // case from the 2026-09-09 live test.
      status: toSentinelCallState(final as unknown as PollableCall),
      taskCompleted: final.taskCompleted ?? false,
      completionConfidence: final.completionConfidence as
        | { score: number; label: string }
        | null,
      evidence: final.evidence,
      structuredResult: final.structuredResult,
      transcript: collectTurns(final as unknown as PollableCall),
    } satisfies CoordinationCallResult;
  });

  // ── Hand artifacts to the backend for persistence ─────────────────────────
  const confidence = result.completionConfidence ?? { score: 0, label: "none" };
  const structuredResult = result.structuredResult ?? {};

  const { callId } = await persistCall({
    orderId: state.orderId,
    traceId: state.traceId,
    contactId: contact.id,
    rung: state.rung,
    status: result.status,
    taskCompleted: result.taskCompleted ?? false,
    confidence,
    evidence: result.evidence,
    structuredResult,
    taskPrompt,
  });

  return { callId, result };
}
