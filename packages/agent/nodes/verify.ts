/**
 * packages/agent/nodes/verify.ts
 * Node: verify
 * Owner: Aryan
 *
 * Verification call at T+ETA — confirms the responder actually arrived.
 * This is FR-7.6 — "closing the loop twice" is what makes this an
 * operations system rather than a dialer.
 *
 * Exits to: "resolve" | "escalate"
 */

import type { EscalationState } from "../state";
import type { EscalationStructuredResult } from "../../types";
import { lastStructuredResult } from "../state";
import { needsBackup, etaOutsideSafeWindow } from "./decide";
import { buildVerificationPrompt } from "../../calle/prompt";

export type VerifyResult = "resolve" | "escalate";

export interface VerifyCallbacks {
  scheduleVerificationJob: (params: {
    incidentId: string;
    traceId: string;
    responderId: string;
    etaMinutes: number;
    runAt: string; // ISO-8601
  }) => Promise<void>;
  /**
   * FR-6.4 — arrange a backup responder when the accepted commitment does not
   * beat the safe window, or the responder asked for one. Optional so existing
   * callers keep working, but the backend should always provide it.
   */
  arrangeBackup?: (params: {
    incidentId: string;
    traceId: string;
    excludeResponderId: string;
    reason: string;
  }) => Promise<void>;
  emitSSE: (incidentId: string, message: string) => void;
}

/**
 * Schedules a BullMQ job via Sameer's queue to run the verification call
 * at T+ETA minutes. The actual second CALL-E call is placed by that job.
 *
 * Returns the updated state fields.
 */
export async function verify(
  state: EscalationState,
  callbacks: VerifyCallbacks
): Promise<Partial<EscalationState>> {
  const result = lastStructuredResult(state);

  // Default ETA buffer: if no ETA was extracted, verify at T+60min
  const etaMinutes = result?.eta_minutes ?? 60;

  // Add 5-minute buffer — give responder time to actually arrive
  const verifyAfterMinutes = etaMinutes + 5;
  const runAt = new Date(
    Date.now() + verifyAfterMinutes * 60 * 1000
  ).toISOString();

  await callbacks.scheduleVerificationJob({
    incidentId: state.incidentId,
    traceId: state.traceId,
    responderId: state.currentResponder?.id ?? "",
    etaMinutes: verifyAfterMinutes,
    runAt,
  });

  callbacks.emitSSE(
    state.incidentId,
    `Verification call scheduled in ${verifyAfterMinutes} minutes (at ${runAt}).`
  );

  // ── FR-6.4 — a commitment that misses the safe window is not enough ───────
  // We accept it (a late technician still beats no technician) and arrange a
  // backup in parallel rather than waiting for T+ETA to discover the gap.
  if (needsBackup(state)) {
    const outsideWindow = etaOutsideSafeWindow(state);
    const reason = outsideWindow
      ? `ETA ${result?.eta_minutes ?? "unknown"}min exceeds the ${state.safeWindowMinutes}min safe window.`
      : `Responder explicitly requested a backup.`;

    await callbacks.arrangeBackup?.({
      incidentId: state.incidentId,
      traceId: state.traceId,
      excludeResponderId: state.currentResponder?.id ?? "",
      reason,
    });

    callbacks.emitSSE(state.incidentId, `Backup responder requested — ${reason}`);
  }

  return {};
}

/**
 * Called when the verification job fires at T+ETA.
 * Builds the short confirmation task prompt for CALL-E.
 *
 * There is exactly ONE verification prompt, in ../../calle/prompt.ts. This is
 * a thin adapter from graph state to that builder — do not inline a second
 * copy here (CLAUDE.md §6.5).
 */
export function buildVerificationTaskPrompt(state: EscalationState): string {
  if (!state.currentResponder) {
    throw new Error(
      `buildVerificationTaskPrompt: no currentResponder on incident ${state.incidentId}`
    );
  }

  const result = lastStructuredResult(state) as EscalationStructuredResult | null;

  return buildVerificationPrompt({
    incidentId: state.incidentId,
    traceId: state.traceId,
    severity: state.severity,
    // The verification call is framed around the ETA they committed to, not
    // the original safe window.
    safeWindowMinutes: result?.eta_minutes ?? state.safeWindowMinutes,
    consequence: state.consequence,
    escalationRung: state.escalationRung,
    facility: state.facility,
    asset: state.asset,
    reading: state.reading,
    responder: state.currentResponder,
  });
}
