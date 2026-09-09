/**
 * packages/agent/__tests__/mockScenarios.test.ts
 * Integration-style tests: run the decide node against all mock CALL-E scenarios.
 * Verifies the full output → routing chain without any real calls.
 */

import { mockCalle } from "../../calle/mock";
import { decide } from "../nodes/decide";
import type { EscalationState } from "../state";
import type { EscalationStructuredResult } from "../../types";

function makeStateFromResult(
  structuredResult: EscalationStructuredResult,
  confidenceScore: number,
  escalationRung = 1
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
    maxRungs: 3,
    attemptedResponders: [],
    currentResponder: null,
    callHistory: [],
    structuredResults: [structuredResult],
    confidenceHistory: [{ score: confidenceScore, label: confidenceScore >= 0.85 ? "high" : "medium" }],
    finalOutcome: null,
    requiresHumanReview: false,
    suppressReason: null,
    callError: null,
    ladderExhausted: false,
    route: null,
  };
}

describe("mock scenario → decide routing", () => {
  test("accept_immediately → resolve", async () => {
    const result = await mockCalle.calls.createAndWait(
      { task: "test", resultSchema: {} },
      "accept_immediately"
    );
    const state = makeStateFromResult(
      result.structuredResult as EscalationStructuredResult,
      result.completionConfidence.score
    );
    // SCHEDULE_VERIFICATION_CALL with high confidence → verify
    expect(decide(state)).toBe("verify");
  });

  test("accept_after_pushback → verify (hero demo scenario)", async () => {
    const result = await mockCalle.calls.createAndWait(
      { task: "test", resultSchema: {} },
      "accept_after_pushback"
    );
    const state = makeStateFromResult(
      result.structuredResult as EscalationStructuredResult,
      result.completionConfidence.score
    );
    expect(decide(state)).toBe("verify");
    expect(result.structuredResult.verbatim_commitment).toContain("forty minutes");
  });

  test("hard_refusal → escalate", async () => {
    const result = await mockCalle.calls.createAndWait(
      { task: "test", resultSchema: {} },
      "hard_refusal"
    );
    const state = makeStateFromResult(
      result.structuredResult as EscalationStructuredResult,
      result.completionConfidence.score
    );
    expect(decide(state)).toBe("escalate");
    expect(result.structuredResult.decline_reason).toBe("on_another_job");
  });

  test("no_answer → escalate (low confidence does not block escalation)", async () => {
    const result = await mockCalle.calls.createAndWait(
      { task: "test", resultSchema: {} },
      "no_answer"
    );
    const state = makeStateFromResult(
      result.structuredResult as EscalationStructuredResult,
      result.completionConfidence.score  // score = 0
    );
    // An unanswered call has confidence 0 by construction. §9 F1 requires the
    // rung to advance immediately — the confidence gate only blocks closing.
    expect(decide(state)).toBe("escalate");
  });

  test("ambiguous → human_review (confidence 0.55 < threshold)", async () => {
    const result = await mockCalle.calls.createAndWait(
      { task: "test", resultSchema: {} },
      "ambiguous"
    );
    const state = makeStateFromResult(
      result.structuredResult as EscalationStructuredResult,
      result.completionConfidence.score
    );
    expect(decide(state)).toBe("human_review");
  });

  test("callback_requested → schedule_callback", async () => {
    const result = await mockCalle.calls.createAndWait(
      { task: "test", resultSchema: {} },
      "callback_requested"
    );
    const state = makeStateFromResult(
      result.structuredResult as EscalationStructuredResult,
      result.completionConfidence.score
    );
    expect(decide(state)).toBe("schedule_callback");
  });

  test("late_eta → verify (ETA beyond window — still verify, backup logic in verify node)", async () => {
    const result = await mockCalle.calls.createAndWait(
      { task: "test", resultSchema: {} },
      "late_eta"
    );
    const state = makeStateFromResult(
      result.structuredResult as EscalationStructuredResult,
      result.completionConfidence.score
    );
    expect(decide(state)).toBe("verify");
    expect(result.structuredResult.eta_minutes).toBeGreaterThan(90); // beyond safe window
    expect(result.structuredResult.requires_backup).toBe(true);
  });

  test("call_drops → escalate (F9: retry lives in execute_call, not decide)", async () => {
    const result = await mockCalle.calls.createAndWait(
      { task: "test", resultSchema: {} },
      "call_drops"
    );
    const state = makeStateFromResult(
      result.structuredResult as EscalationStructuredResult,
      result.completionConfidence.score
    );
    expect(decide(state)).toBe("escalate");
  });
});

describe("all mock scenarios have valid structuredResult shape", () => {
  const scenarios = Object.keys(mockCalle._scenarios) as Array<keyof typeof mockCalle._scenarios>;

  scenarios.forEach((scenario) => {
    test(`${scenario} has required fields`, async () => {
      const result = await mockCalle.calls.createAndWait(
        { task: "test", resultSchema: {} },
        scenario
      );
      expect(result.structuredResult).toHaveProperty("responder_available");
      expect(result.structuredResult).toHaveProperty("acknowledged_severity");
      expect(result.structuredResult).toHaveProperty("next_action");
      expect(result.completionConfidence).toHaveProperty("score");
      expect(result.completionConfidence).toHaveProperty("label");
      expect(Array.isArray(result.evidence)).toBe(true);
    });
  });
});
