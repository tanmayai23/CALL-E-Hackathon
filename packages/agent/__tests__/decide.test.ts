/**
 * packages/agent/__tests__/decide.test.ts
 * Tests for the decide node — the most critical piece of the agent.
 *
 * Every branch must be reachable and tested (CLAUDE.md §5.3 invariant).
 */

import { decide } from "../nodes/decide";
import type { EscalationState } from "../state";
import type { EscalationStructuredResult } from "../../types";

function makeState(
  structuredResult: EscalationStructuredResult,
  confidenceScore: number,
  escalationRung = 1,
  maxRungs = 3
): EscalationState {
  return {
    incidentId: "INC-001",
    traceId: "trace-abc",
    severity: "CRITICAL",
    safeWindowMinutes: 90,
    consequence: "inventory at risk",
    asset: { id: "CS-04", type: "cold-storage", location: "Zone A" },
    reading: { metric: "temperature_c", value: 12.4, unit: "C", threshold: 8 },
    facility: { id: "northgate", name: "Northgate", timezone: "Asia/Kolkata" },
    escalationRung,
    maxRungs,
    attemptedResponders: [],
    currentResponder: null,
    callHistory: [],
    structuredResults: [structuredResult],
    confidenceHistory: [{ score: confidenceScore, label: confidenceScore >= 0.85 ? "high" : confidenceScore >= 0.7 ? "medium" : "low" }],
    finalOutcome: null,
    requiresHumanReview: false,
    suppressReason: null,
    callError: null,
    ladderExhausted: false,
    route: null,
  };
}

describe("decide node", () => {
  test("CLOSE_RESOLVED + high confidence → resolve", () => {
    const state = makeState(
      { responder_available: "yes", acknowledged_severity: true, next_action: "CLOSE_RESOLVED" },
      0.95
    );
    expect(decide(state)).toBe("resolve");
  });

  test("SCHEDULE_VERIFICATION_CALL + high confidence → verify", () => {
    const state = makeState(
      { responder_available: "conditional", eta_minutes: 40, acknowledged_severity: true, next_action: "SCHEDULE_VERIFICATION_CALL" },
      0.92
    );
    expect(decide(state)).toBe("verify");
  });

  test("ESCALATE_NEXT_RUNG within ladder → escalate", () => {
    const state = makeState(
      { responder_available: "no", acknowledged_severity: false, next_action: "ESCALATE_NEXT_RUNG" },
      0.91,
      1,  // rung 1 of 3
      3
    );
    expect(decide(state)).toBe("escalate");
  });

  test("ESCALATE_NEXT_RUNG at max rung → still escalate (unresolved handled in escalate node)", () => {
    const state = makeState(
      { responder_available: "no", acknowledged_severity: false, next_action: "ESCALATE_NEXT_RUNG" },
      0.91,
      3,  // rung 3 of 3
      3
    );
    // decide still returns "escalate" — the escalate node checks the cap
    expect(decide(state)).toBe("escalate");
  });

  test("SCHEDULE_CALLBACK → schedule_callback", () => {
    const state = makeState(
      { responder_available: "conditional", acknowledged_severity: true,
        callback_requested_at: "2026-09-14T08:00:00Z", next_action: "SCHEDULE_CALLBACK" },
      0.82
    );
    expect(decide(state)).toBe("schedule_callback");
  });

  test("HUMAN_REVIEW next_action → human_review", () => {
    const state = makeState(
      { responder_available: "unknown", acknowledged_severity: false, next_action: "HUMAN_REVIEW" },
      0.75
    );
    expect(decide(state)).toBe("human_review");
  });

  // ── Invariant 1: Low confidence always overrides next_action ─────────────

  test("confidence < 0.7 overrides CLOSE_RESOLVED → human_review", () => {
    const state = makeState(
      { responder_available: "yes", acknowledged_severity: true, next_action: "CLOSE_RESOLVED" },
      0.65  // below threshold
    );
    expect(decide(state)).toBe("human_review");
  });

  test("confidence < 0.7 does NOT override ESCALATE_NEXT_RUNG — escalating is fail-safe", () => {
    const state = makeState(
      { responder_available: "no", acknowledged_severity: false, next_action: "ESCALATE_NEXT_RUNG" },
      0.55
    );
    expect(decide(state)).toBe("escalate");
  });

  test("confidence < 0.7 overrides SCHEDULE_VERIFICATION_CALL → human_review", () => {
    const state = makeState(
      { responder_available: "conditional", eta_minutes: 40, acknowledged_severity: true,
        next_action: "SCHEDULE_VERIFICATION_CALL" },
      0.55
    );
    expect(decide(state)).toBe("human_review");
  });

  test("confidence < 0.7 overrides SCHEDULE_CALLBACK → human_review", () => {
    const state = makeState(
      { responder_available: "conditional", acknowledged_severity: true,
        callback_requested_at: "2026-09-14T08:00:00Z", next_action: "SCHEDULE_CALLBACK" },
      0.4
    );
    expect(decide(state)).toBe("human_review");
  });

  test("confidence exactly 0.7 does NOT route to human_review", () => {
    const state = makeState(
      { responder_available: "yes", acknowledged_severity: true, next_action: "CLOSE_RESOLVED" },
      0.7   // exactly at threshold — should pass
    );
    expect(decide(state)).toBe("resolve");
  });

  test("missing structuredResult → human_review fallback", () => {
    const state = makeState(
      { responder_available: "yes", acknowledged_severity: true, next_action: "CLOSE_RESOLVED" },
      0.95
    );
    state.structuredResults = [];  // empty — simulate missing result
    state.confidenceHistory = [];
    expect(decide(state)).toBe("human_review");
  });
});
