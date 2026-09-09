/**
 * packages/agent/__tests__/selectResponder.test.ts
 * Tests for the select_responder node.
 */

import { selectBestResponder } from "../nodes/selectResponder";
import type { EscalationState } from "../state";
import type { Responder } from "../../types";

// Fixed UTC time for tests: 10:00 UTC
const FIXED_HOUR = 10;
const FIXED_MINUTE = 0;

// Mock Date so shift checks are deterministic
beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(`2026-09-14T${String(FIXED_HOUR).padStart(2, "0")}:${String(FIXED_MINUTE).padStart(2, "0")}:00Z`));
});

afterAll(() => {
  jest.useRealTimers();
});

function makeState(attempted: string[] = []): EscalationState {
  return {
    incidentId: "INC-001",
    traceId: "trace-abc",
    severity: "CRITICAL",
    safeWindowMinutes: 90,
    consequence: "inventory at risk",
    asset: { id: "CS-04", type: "cold-storage", location: "Zone A" },
    reading: { metric: "temperature_c", value: 12.4, unit: "C", threshold: 8 },
    facility: { id: "northgate", name: "Northgate", timezone: "Asia/Kolkata" },
    escalationRung: 1,
    maxRungs: 3,
    attemptedResponders: attempted,
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

function makeResponder(overrides: Partial<Responder> = {}): Responder {
  return {
    id: "R-001",
    name: "Rajesh Sharma",
    role: "Refrigeration Technician",
    phoneE164: "+919876543210",
    skills: ["refrigeration"],
    shiftStart: "06:00",   // on shift at 10:00 UTC
    shiftEnd: "18:00",
    zone: "Zone A",
    ladderPriority: 1,
    preferredLanguage: "en-IN",
    cooldownUntil: null,
    ...overrides,
  };
}

describe("selectBestResponder", () => {
  test("returns eligible responder when all criteria match", () => {
    const roster = [makeResponder()];
    const result = selectBestResponder(makeState(), roster, "refrigeration", "Zone A");
    expect(result).not.toBeNull();
    expect(result?.id).toBe("R-001");
  });

  test("skips already-attempted responders", () => {
    const roster = [makeResponder()];
    const result = selectBestResponder(makeState(["R-001"]), roster, "refrigeration", "Zone A");
    expect(result).toBeNull();
  });

  test("skips responder with wrong skill", () => {
    const roster = [makeResponder({ skills: ["electrical"] })];
    const result = selectBestResponder(makeState(), roster, "refrigeration", "Zone A");
    expect(result).toBeNull();
  });

  test("skips responder in wrong zone", () => {
    const roster = [makeResponder({ zone: "Zone B" })];
    const result = selectBestResponder(makeState(), roster, "refrigeration", "Zone A");
    expect(result).toBeNull();
  });

  test("skips off-shift responder", () => {
    // Shift 20:00–06:00, current time is 10:00 — off shift
    const roster = [makeResponder({ shiftStart: "20:00", shiftEnd: "06:00" })];
    const result = selectBestResponder(makeState(), roster, "refrigeration", "Zone A");
    expect(result).toBeNull();
  });

  test("skips responder in cooldown", () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h from now
    const roster = [makeResponder({ cooldownUntil: future })];
    const result = selectBestResponder(makeState(), roster, "refrigeration", "Zone A");
    expect(result).toBeNull();
  });

  test("responder past cooldown is eligible", () => {
    const past = new Date(Date.now() - 60 * 1000).toISOString(); // 1 min ago
    const roster = [makeResponder({ cooldownUntil: past })];
    const result = selectBestResponder(makeState(), roster, "refrigeration", "Zone A");
    expect(result).not.toBeNull();
  });

  test("selects highest-priority (lowest ladderPriority number) from multiple eligible", () => {
    const roster = [
      makeResponder({ id: "R-002", ladderPriority: 2 }),
      makeResponder({ id: "R-001", ladderPriority: 1 }),
      makeResponder({ id: "R-003", ladderPriority: 3 }),
    ];
    const result = selectBestResponder(makeState(), roster, "refrigeration", "Zone A");
    expect(result?.id).toBe("R-001");
  });

  test("skips R-001 if attempted, picks R-002", () => {
    const roster = [
      makeResponder({ id: "R-001", ladderPriority: 1 }),
      makeResponder({ id: "R-002", ladderPriority: 2 }),
    ];
    const result = selectBestResponder(makeState(["R-001"]), roster, "refrigeration", "Zone A");
    expect(result?.id).toBe("R-002");
  });

  test("handles midnight-crossing shifts correctly — on shift", () => {
    // Current time: 10:00 UTC. Shift: 22:00–12:00 (crosses midnight)
    // 10:00 is inside 22:00–12:00 range
    const roster = [makeResponder({ shiftStart: "22:00", shiftEnd: "12:00" })];
    const result = selectBestResponder(makeState(), roster, "refrigeration", "Zone A");
    expect(result).not.toBeNull();
  });
});
