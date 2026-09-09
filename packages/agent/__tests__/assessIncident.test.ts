/**
 * packages/agent/__tests__/assessIncident.test.ts
 * Tests for the assess_incident node.
 */

import { assessIncident, getSuppressReason } from "../nodes/assessIncident";
import type { EscalationState } from "../state";

function makeState(
  severity: "INFO" | "WARNING" | "CRITICAL",
  safeWindowMinutes: number,
  readingValue: number,
  threshold: number
): EscalationState {
  return {
    incidentId: "INC-001",
    traceId: "trace-abc",
    severity,
    safeWindowMinutes,
    consequence: "inventory at risk",
    asset: { id: "CS-04", type: "cold-storage", location: "Zone A" },
    reading: { metric: "temperature_c", value: readingValue, unit: "C", threshold },
    facility: { id: "northgate", name: "Northgate", timezone: "Asia/Kolkata" },
    escalationRung: 1,
    maxRungs: 3,
    attemptedResponders: [],
    currentResponder: null,
    callHistory: [],
    structuredResults: [],
    confidenceHistory: [],
    finalOutcome: null,
    requiresHumanReview: false,
    suppressReason: null,
    callError: null,
    ladderExhausted: false,
    route: null,
  };
}

describe("assessIncident node", () => {
  test("INFO severity → suppress", () => {
    expect(assessIncident(makeState("INFO", 90, 9, 8))).toBe("suppress");
  });

  test("WARNING with safe window > 8 hours → suppress", () => {
    expect(assessIncident(makeState("WARNING", 500, 9, 8))).toBe("suppress");
  });

  test("WARNING with safe window <= 8 hours and above threshold → select_responder", () => {
    expect(assessIncident(makeState("WARNING", 120, 9, 8))).toBe("select_responder");
  });

  test("CRITICAL always → select_responder regardless of window", () => {
    expect(assessIncident(makeState("CRITICAL", 900, 12.4, 8))).toBe("select_responder");
  });

  test("reading at or below threshold (stale incident) → suppress", () => {
    expect(assessIncident(makeState("WARNING", 60, 7.9, 8))).toBe("suppress");
  });

  test("reading exactly at threshold with WARNING → suppress", () => {
    expect(assessIncident(makeState("WARNING", 60, 8.0, 8))).toBe("suppress");
  });

  test("reading just above threshold with WARNING → select_responder", () => {
    expect(assessIncident(makeState("WARNING", 60, 8.1, 8))).toBe("select_responder");
  });

  test("getSuppressReason gives a reason string for INFO", () => {
    const reason = getSuppressReason(makeState("INFO", 90, 9, 8));
    expect(reason).toContain("INFO");
  });

  test("getSuppressReason gives a reason string for long safe window", () => {
    const reason = getSuppressReason(makeState("WARNING", 500, 9, 8));
    expect(reason).toContain("8 hours");
  });
});
