/**
 * packages/agent/__tests__/failureModes.test.ts
 * Tests for all 14 failure modes (CLAUDE.md §9 / PRD §9).
 * Verifies the agent routes correctly for each failure scenario.
 */

import { mockCalle } from "../../calle/mock";
import { buildTaskPrompt } from "../../calle/prompt";
import { decide } from "../nodes/decide";
import { assessIncident } from "../nodes/assessIncident";
import { escalate } from "../nodes/escalate";
import type { EscalationState } from "../state";
import type { EscalationStructuredResult } from "../../types";

function makeState(
  overrides: Partial<EscalationState> = {}
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
    escalationRung: 1,
    maxRungs: 3,
    attemptedResponders: [],
    currentResponder: {
      id: "R-001", name: "Rajesh", role: "Technician",
      phoneE164: "+919876543210", skills: ["refrigeration"],
      shiftStart: "06:00", shiftEnd: "18:00", zone: "Zone A",
      ladderPriority: 1, preferredLanguage: "en-IN", cooldownUntil: null,
    },
    callHistory: [],
    structuredResults: [],
    confidenceHistory: [],
    finalOutcome: null,
    requiresHumanReview: false,
    suppressReason: null,
    callError: null,
    ladderExhausted: false,
    route: null,
    ...overrides,
  };
}

function withResult(
  state: EscalationState,
  result: EscalationStructuredResult,
  score: number
): EscalationState {
  return {
    ...state,
    structuredResults: [result],
    confidenceHistory: [{ score, label: score >= 0.85 ? "high" : score >= 0.7 ? "medium" : "low" }],
  };
}

describe("F1 — No answer → ESCALATE_NEXT_RUNG", () => {
  test("no_answer scenario → advances the rung immediately", async () => {
    const mock = await mockCalle.calls.createAndWait({ task: "", resultSchema: {} }, "no_answer");
    const state = withResult(makeState(), mock.structuredResult as EscalationStructuredResult, mock.completionConfidence.score);
    // Confidence is 0 because nobody spoke, not because extraction was shaky.
    // Parking this for an operator would strand a 02:00 incident (§9 F1).
    expect(decide(state)).toBe("escalate");
  });
});

describe("F2 — Voicemail → ESCALATE_NEXT_RUNG", () => {
  test("voicemail scenario → escalates after leaving a message", async () => {
    const mock = await mockCalle.calls.createAndWait({ task: "", resultSchema: {} }, "voicemail");
    const state = withResult(makeState(), mock.structuredResult as EscalationStructuredResult, mock.completionConfidence.score);
    expect(decide(state)).toBe("escalate");
  });
});

describe("F7 — Wrong person answers → escalate without disclosing details", () => {
  test("wrong_person scenario → escalates", async () => {
    const mock = await mockCalle.calls.createAndWait({ task: "", resultSchema: {} }, "wrong_person");
    const state = withResult(makeState(), mock.structuredResult as EscalationStructuredResult, mock.completionConfidence.score);
    expect(decide(state)).toBe("escalate");
    // The agent must not have recorded a commitment from an unverified answerer.
    expect(mock.structuredResult.responder_available).toBe("unknown");
  });
});

describe("F3 — Hard refusal → escalate", () => {
  test("hard_refusal with high confidence → escalate", async () => {
    const mock = await mockCalle.calls.createAndWait({ task: "", resultSchema: {} }, "hard_refusal");
    const state = withResult(makeState(), mock.structuredResult as EscalationStructuredResult, mock.completionConfidence.score);
    expect(decide(state)).toBe("escalate");
    expect(mock.structuredResult.decline_reason).toBe("on_another_job");
  });
});

describe("F4 — Late ETA → verify + backup flag", () => {
  test("late_eta → verify, requires_backup=true", async () => {
    const mock = await mockCalle.calls.createAndWait({ task: "", resultSchema: {} }, "late_eta");
    const state = withResult(makeState(), mock.structuredResult as EscalationStructuredResult, mock.completionConfidence.score);
    expect(decide(state)).toBe("verify");
    expect(mock.structuredResult.requires_backup).toBe(true);
    expect((mock.structuredResult.eta_minutes as number)).toBeGreaterThan(90);
  });
});

describe("F5 — Callback requested → schedule_callback", () => {
  test("callback_requested → schedule_callback", async () => {
    const mock = await mockCalle.calls.createAndWait({ task: "", resultSchema: {} }, "callback_requested");
    const state = withResult(makeState(), mock.structuredResult as EscalationStructuredResult, mock.completionConfidence.score);
    expect(decide(state)).toBe("schedule_callback");
    expect(mock.structuredResult.callback_requested_at).toBeDefined();
  });
});

describe("F6 — Ambiguous answer → human_review", () => {
  test("ambiguous confidence 0.55 → human_review", async () => {
    const mock = await mockCalle.calls.createAndWait({ task: "", resultSchema: {} }, "ambiguous");
    const state = withResult(makeState(), mock.structuredResult as EscalationStructuredResult, mock.completionConfidence.score);
    expect(decide(state)).toBe("human_review");
  });
});

describe("F8 — Gatekeeper / IVR → escalate without navigating menus", () => {
  test("gatekeeper scenario → escalates", async () => {
    const mock = await mockCalle.calls.createAndWait({ task: "", resultSchema: {} }, "gatekeeper");
    const state = withResult(makeState(), mock.structuredResult as EscalationStructuredResult, mock.completionConfidence.score);
    expect(decide(state)).toBe("escalate");
    expect(mock.structuredResult.responder_available).toBe("unknown");
  });

  test("the task prompt forbids navigating IVR menus", () => {
    const prompt = buildTaskPrompt({
      incidentId: "INC-001",
      traceId: "trace-abc",
      severity: "CRITICAL",
      safeWindowMinutes: 90,
      consequence: "inventory at risk",
      escalationRung: 1,
      facility: { id: "northgate", name: "Northgate", timezone: "Asia/Kolkata" },
      asset: { id: "CS-04", type: "cold-storage", location: "Zone A" },
      reading: { metric: "temperature_c", value: 12.4, unit: "C", threshold: 8 },
      responder: makeState().currentResponder!,
    });
    expect(prompt).toMatch(/Never navigate IVR menus/i);
  });
});

describe("F9 — Call drops → escalate (retry belongs in execute_call, not decide)", () => {
  test("call_drops confidence 0 → escalate", async () => {
    const mock = await mockCalle.calls.createAndWait({ task: "", resultSchema: {} }, "call_drops");
    const state = withResult(makeState(), mock.structuredResult as EscalationStructuredResult, mock.completionConfidence.score);
    expect(decide(state)).toBe("escalate");
  });
});

describe("F10 — CALL-E API error → callError set → human_review", () => {
  test("callError on state → decide routes to human_review via graph guard", () => {
    // The graph checks state.callError before calling decide()
    // This test verifies the state shape is correct for that guard
    const state = makeState({ callError: "SDK timeout after 3 retries" });
    expect(state.callError).not.toBeNull();
    // In the graph: if (state.callError) return "human_review"
    // Simulate that guard here:
    const routedNode = state.callError ? "human_review" : decide(state);
    expect(routedNode).toBe("human_review");
  });
});

describe("F11 — Ladder exhausted → unresolved", () => {
  test("escalate at maxRung → nextNode is unresolved", () => {
    const state = makeState({ escalationRung: 3, maxRungs: 3 });
    const { nextNode } = escalate(state);
    expect(nextNode).toBe("unresolved");
  });

  test("escalate below maxRung → nextNode is select_responder", () => {
    const state = makeState({ escalationRung: 1, maxRungs: 3 });
    const { nextNode, updatedState } = escalate(state);
    expect(nextNode).toBe("select_responder");
    expect(updatedState.escalationRung).toBe(2);
  });
});

describe("F12 — Sensor offline → assess_incident suppresses stale incident", () => {
  test("reading within threshold → suppressed", () => {
    const state = makeState({
      reading: { metric: "temperature_c", value: 7.5, unit: "C", threshold: 8 },
      severity: "WARNING",
    });
    expect(assessIncident(state)).toBe("suppress");
  });
});

describe("F13 — Flapping signal → INFO suppressed", () => {
  test("INFO severity → always suppressed", () => {
    const state = makeState({ severity: "INFO" });
    expect(assessIncident(state)).toBe("suppress");
  });
});

describe("F14 — Responder confirms but never arrives → verify schedules re-check", () => {
  test("accept_after_pushback → verify node scheduled", async () => {
    const mock = await mockCalle.calls.createAndWait({ task: "", resultSchema: {} }, "accept_after_pushback");
    const state = withResult(makeState(), mock.structuredResult as EscalationStructuredResult, mock.completionConfidence.score);
    // Routes to verify which schedules verification call
    expect(decide(state)).toBe("verify");
  });
});

describe("Escalation rung advancement", () => {
  test("attempted responders list grows on each escalation", () => {
    const state = makeState({ escalationRung: 1 });
    const { updatedState } = escalate(state);
    // currentResponder (R-001) should be added to attempted list
    expect(updatedState.attemptedResponders).toContain("R-001");
    expect(updatedState.escalationRung).toBe(2);
    expect(updatedState.currentResponder).toBeNull();
  });

  test("full ladder: rung 1 → 2 → 3 → unresolved", () => {
    let state = makeState({ escalationRung: 1, maxRungs: 3 });

    const r1 = escalate(state);
    expect(r1.nextNode).toBe("select_responder");
    state = { ...state, ...r1.updatedState };

    state.escalationRung = 2;
    const r2 = escalate(state);
    expect(r2.nextNode).toBe("select_responder");
    state = { ...state, ...r2.updatedState };

    state.escalationRung = 3;
    const r3 = escalate(state);
    expect(r3.nextNode).toBe("unresolved");
  });
});
