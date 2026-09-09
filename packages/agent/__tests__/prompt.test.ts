/**
 * packages/agent/__tests__/prompt.test.ts
 * Tests for buildTaskPrompt() — verifies the prompt adapts correctly
 * per rung, severity, and time pressure.
 */

import { buildTaskPrompt, buildVerificationPrompt, getMustAskQuestions } from "../../calle/prompt";
import type { EscalationContext } from "../../types";

function makeCtx(overrides: Partial<EscalationContext> = {}): EscalationContext {
  return {
    incidentId: "INC-001",
    traceId: "trace-abc",
    severity: "CRITICAL",
    safeWindowMinutes: 90,
    consequence: "inventory is at risk",
    escalationRung: 1,
    facility: { id: "northgate", name: "Northgate Facility", timezone: "Asia/Kolkata" },
    asset: { id: "CS-04", type: "cold-storage unit", location: "Zone A, Building 2" },
    reading: { metric: "temperature_c", value: 12.4, unit: "C", threshold: 8 },
    responder: {
      id: "R-001",
      name: "Rajesh Sharma",
      role: "Refrigeration Technician",
      phoneE164: "+919876543210",
      skills: ["refrigeration"],
      shiftStart: "06:00",
      shiftEnd: "18:00",
      zone: "Zone A",
      ladderPriority: 1,
      preferredLanguage: "en-IN",
      cooldownUntil: null,
    },
    ...overrides,
  };
}

describe("buildTaskPrompt", () => {
  test("always starts with automated identification", () => {
    const prompt = buildTaskPrompt(makeCtx());
    expect(prompt).toContain("automated operations line");
    expect(prompt).toContain("Northgate Facility");
  });

  test("includes asset ID, type and location", () => {
    const prompt = buildTaskPrompt(makeCtx());
    expect(prompt).toContain("CS-04");
    expect(prompt).toContain("cold-storage unit");
    expect(prompt).toContain("Zone A, Building 2");
  });

  test("includes correct reading values", () => {
    const prompt = buildTaskPrompt(makeCtx());
    expect(prompt).toContain("12.4");
    expect(prompt).toContain("8");
    expect(prompt).toContain("temperature_c");
  });

  test("includes responder name", () => {
    const prompt = buildTaskPrompt(makeCtx());
    expect(prompt).toContain("Rajesh Sharma");
  });

  test("rung 1 — professional tone, no mention of previous misses", () => {
    const prompt = buildTaskPrompt(makeCtx({ escalationRung: 1 }));
    expect(prompt).toContain("first automated call");
    expect(prompt).not.toContain("primary technician was unavailable");
  });

  test("rung 2 — mentions previous miss, elevated urgency", () => {
    const prompt = buildTaskPrompt(makeCtx({ escalationRung: 2 }));
    expect(prompt).toContain("primary technician was unavailable");
    expect(prompt).toContain("time has already been lost");
  });

  test("rung 3 — supervisor escalation language", () => {
    const prompt = buildTaskPrompt(makeCtx({ escalationRung: 3 }));
    expect(prompt).toContain("supervisor escalation");
    expect(prompt).toContain("currently unassigned");
  });

  test("CRITICAL severity — urgent framing", () => {
    const prompt = buildTaskPrompt(makeCtx({ severity: "CRITICAL" }));
    expect(prompt).toContain("CRITICAL");
    expect(prompt).toContain("Every minute of delay");
  });

  test("WARNING severity — degrading framing", () => {
    const prompt = buildTaskPrompt(makeCtx({ severity: "WARNING" }));
    expect(prompt).toContain("degrading");
  });

  test("short safe window (<=30min) — URGENT language", () => {
    const prompt = buildTaskPrompt(makeCtx({ safeWindowMinutes: 25 }));
    expect(prompt).toContain("URGENT");
    expect(prompt).toContain("25 minutes");
  });

  test("medium safe window (<=60min) — Time-sensitive language", () => {
    const prompt = buildTaskPrompt(makeCtx({ safeWindowMinutes: 45 }));
    expect(prompt).toContain("Time-sensitive");
  });

  test("long safe window (>60min) — Approximately language", () => {
    const prompt = buildTaskPrompt(makeCtx({ safeWindowMinutes: 90 }));
    expect(prompt).toContain("Approximately");
  });

  test("handles 'I'm busy' branch explicitly", () => {
    const prompt = buildTaskPrompt(makeCtx());
    expect(prompt).toContain("I'm busy");
    expect(prompt).toContain("Do NOT accept as a final no");
  });

  test("handles voicemail branch", () => {
    const prompt = buildTaskPrompt(makeCtx());
    expect(prompt).toContain("Voicemail");
    expect(prompt).toContain("Leave this message");
  });

  test("handles wrong person answering", () => {
    const prompt = buildTaskPrompt(makeCtx());
    expect(prompt).toContain("Someone else answers");
    expect(prompt).toContain("Do NOT share any incident details");
  });

  test("has confirmation script", () => {
    const prompt = buildTaskPrompt(makeCtx());
    expect(prompt).toContain("I'm confirming");
    expect(prompt).toContain("Is that correct?");
  });

  test("has 90-second ceiling rule", () => {
    const prompt = buildTaskPrompt(makeCtx());
    expect(prompt).toContain("90 seconds");
  });

  test("has never-imply-human rule", () => {
    const prompt = buildTaskPrompt(makeCtx());
    expect(prompt).toContain("Never imply you are human");
  });
});

describe("buildVerificationPrompt", () => {
  test("mentions it is a follow-up call", () => {
    const prompt = buildVerificationPrompt(makeCtx());
    expect(prompt).toContain("follow-up");
    expect(prompt).toContain("verification");
  });

  test("asks if they have arrived", () => {
    const prompt = buildVerificationPrompt(makeCtx());
    expect(prompt).toContain("Have you arrived");
  });

  test("under 45 seconds rule", () => {
    const prompt = buildVerificationPrompt(makeCtx());
    expect(prompt).toContain("45 seconds");
  });
});

describe("getMustAskQuestions", () => {
  test("returns 3 questions", () => {
    const questions = getMustAskQuestions(makeCtx());
    expect(questions).toHaveLength(3);
  });

  test("first question asks about availability", () => {
    const questions = getMustAskQuestions(makeCtx());
    expect(questions[0]).toContain("available");
    expect(questions[0]).toContain("CS-04");
  });

  test("short window triggers backup question", () => {
    const questions = getMustAskQuestions(makeCtx({ safeWindowMinutes: 30 }));
    expect(questions[2]).toContain("backup");
    expect(questions[2]).toContain("30 minutes");
  });
});
