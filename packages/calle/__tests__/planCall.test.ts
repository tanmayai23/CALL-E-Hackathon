/**
 * packages/calle/__tests__/planCall.test.ts
 * FR-4.4 — pre-flight plan validation. Spends zero call budget.
 */

import { planEscalationCall, lintTaskPrompt } from "../planCall";
import type { EscalationContext, Responder } from "../../types";

const RESPONDER: Responder = {
  id: "R-001",
  name: "Rajesh Sharma",
  role: "Refrigeration Technician",
  phoneE164: "+919876543210",
  skills: ["refrigeration"],
  shiftStart: "00:00",
  shiftEnd: "23:59",
  zone: "Zone A",
  ladderPriority: 1,
  preferredLanguage: "en-IN",
  cooldownUntil: null,
};

const CTX: EscalationContext = {
  incidentId: "INC-001",
  traceId: "trace-abc",
  severity: "CRITICAL",
  safeWindowMinutes: 90,
  consequence: "inventory is at risk",
  escalationRung: 1,
  facility: { id: "northgate", name: "Northgate Facility", timezone: "Asia/Kolkata" },
  asset: { id: "CS-04", type: "cold-storage", location: "Zone A" },
  reading: { metric: "temperature_c", value: 12.4, unit: "C", threshold: 8 },
  responder: RESPONDER,
};

describe("lintTaskPrompt", () => {
  test("accepts the real composed prompt", () => {
    const issues = lintTaskPrompt(
      "This is the automated operations line for Northgate. Unit CS-04 is at 12.4C."
    );
    expect(issues).toHaveLength(0);
  });

  test("catches an unrendered template hole before it reaches a technician", () => {
    const issues = lintTaskPrompt(
      "This is the automated operations line for undefined. Unit CS-04."
    );
    expect(issues.some((i) => i.severity === "error" && i.message.includes("undefined"))).toBe(true);
  });

  test("catches a missing self-identification (FR-10.1)", () => {
    const issues = lintTaskPrompt("Hello, please attend unit CS-04 immediately.");
    expect(issues.some((i) => i.message.includes("automated operations line"))).toBe(true);
  });

  test("warns when the prompt is long enough to blow the 90-second ceiling", () => {
    const issues = lintTaskPrompt(
      "automated operations line " + "x".repeat(7000)
    );
    expect(issues.some((i) => i.severity === "warning" && i.message.includes("chars"))).toBe(true);
  });

  test("rejects an empty prompt", () => {
    expect(lintTaskPrompt("   ")[0]).toMatchObject({ severity: "error" });
  });
});

describe("planEscalationCall", () => {
  test("validates the live prompt builder's output cleanly", async () => {
    const report = await planEscalationCall(CTX, async () => ({ valid: true }));
    expect(report.ok).toBe(true);
    expect(report.issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });

  test("sends the task and the frozen result schema to plan_call", async () => {
    let received: { task: string; resultSchema: Record<string, unknown> } | null = null;
    await planEscalationCall(CTX, async (tool, args) => {
      expect(tool).toBe("plan_call");
      received = args;
      return {};
    });

    expect(received!.task).toContain("Northgate Facility");
    expect(received!.task).toContain("CS-04");
    expect(received!.resultSchema).toHaveProperty("properties.next_action");
  });

  test("an MCP outage degrades to a warning — it never blocks an escalation", async () => {
    const report = await planEscalationCall(CTX, async () => {
      throw new Error("OAuth token expired");
    });

    expect(report.ok).toBe(true);   // no ERROR-level issues
    expect(report.issues.some((i) => i.message.includes("OAuth token expired"))).toBe(true);
  });

  test("without a transport it still lints locally and says so", async () => {
    const report = await planEscalationCall(CTX);
    expect(report.raw).toBeNull();
    expect(report.issues.some((i) => i.message.includes("skipped plan_call"))).toBe(true);
  });

  test("catches a broken context before any call is placed", async () => {
    const broken = {
      ...CTX,
      responder: { ...RESPONDER, name: undefined as unknown as string },
    };
    const report = await planEscalationCall(broken, async () => ({}));
    expect(report.ok).toBe(false);
  });
});
