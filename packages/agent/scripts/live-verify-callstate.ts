/**
 * packages/agent/scripts/live-verify-callstate.ts
 * ONE live call, through the real agent path, to verify FR-5.2.
 *
 * ⚠️  THIS RINGS A REAL PHONE AND SPENDS ONE CREDIT.
 *
 * What it verifies (both currently inferred from CALL-E's OpenAPI schema
 * rather than observed):
 *   1. create() + poll emits real queued → dialling → in_conversation →
 *      completed transitions — the data Vishal's Live Call Theatre renders.
 *   2. The real shape of attempt.status / failureCode, so the mapping in
 *      packages/calle/progress.ts is grounded in fact.
 *
 * Safety rails, all belt-and-braces so this cannot run away:
 *   - roster contains exactly ONE consented number
 *   - maxRungs = 1 and maxCallsPerIncident = 1
 *   - every raw CALL-E payload is written to docs/live-call-raw.json
 *
 * Run:  node dist-probe/packages/agent/scripts/live-verify-callstate.js
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { runEscalationAgent } from "../index";
import type { AgentDependencies } from "../graph";
import type { EscalationContext, Responder } from "../../types";

// ─── The one consented number ────────────────────────────────────────────────
// Never hardcode a number here — this file is committed. Set CALLE_TEST_PHONE
// in .env, and only ever to a team member who has agreed to receive test calls.
const CONSENTED_PHONE = process.env.CALLE_TEST_PHONE ?? "";

const RESPONDER: Responder = {
  id: "R-ARYAN",
  name: "Aryan",
  role: "Refrigeration Technician",
  phoneE164: CONSENTED_PHONE,
  skills: ["refrigeration"],
  shiftStart: "00:00",
  shiftEnd: "23:59",
  zone: "Zone A",
  ladderPriority: 1,
  preferredLanguage: "en-IN",
  cooldownUntil: null,
};

const CONTEXT: EscalationContext = {
  incidentId: `INC-LIVE-${Date.now()}`,
  traceId: `trace-live-${Date.now()}`,
  severity: "CRITICAL",
  safeWindowMinutes: 90,
  consequence: "inventory is at risk",
  escalationRung: 1,
  facility: { id: "northgate", name: "Northgate Facility", timezone: "Asia/Kolkata" },
  asset: { id: "CS-04", type: "cold-storage", location: "Zone A" },
  reading: { metric: "temperature_c", value: 12.4, unit: "C", threshold: 8 },
  responder: RESPONDER,
};

// ─── Raw payload capture ─────────────────────────────────────────────────────
// Test-harness instrumentation only — wraps the SDK from outside, so the
// shipped code path is exactly what runs.

const rawPolls: unknown[] = [];
const stateTransitions: { at: string; state: string }[] = [];
const transcript: { speaker: string; text: string }[] = [];

async function instrumentSdk() {
  const { getCalle } = await import("../../calle/client");
  const calle = await getCalle();
  const originalGet = calle.calls.get.bind(calle.calls);

  (calle.calls as { get: typeof originalGet }).get = async (callId: string) => {
    const call = await originalGet(callId);
    rawPolls.push({ at: new Date().toISOString(), call });
    const attempt = (call as unknown as {
      recipients?: { attempts?: { status: string; failureCode?: string | null }[] }[];
    }).recipients?.[0]?.attempts?.slice(-1)[0];
    console.log(
      `    raw: task.status=${call.status}` +
      (attempt ? `  attempt.status=${attempt.status}` : "  (no attempt yet)") +
      (attempt?.failureCode ? `  failureCode=${attempt.failureCode}` : "")
    );
    return call;
  };
}

// ─── Go ───────────────────────────────────────────────────────────────────────

async function main() {
  if (process.env.CALLE_USE_MOCK === "true") {
    console.error("CALLE_USE_MOCK is true — this probe is pointless. Unset it.");
    process.exit(1);
  }

  if (!CONSENTED_PHONE) {
    console.error(
      "CALLE_TEST_PHONE is not set. Refusing to dial.\n" +
      "Set it in .env to a consented team member's number (Rule 3)."
    );
    process.exit(1);
  }

  await instrumentSdk();

  console.log("\n  LIVE CALL — a real phone will ring and one credit is spent.");
  console.log(`  Calling ${CONSENTED_PHONE} (consented, roster of one).`);
  console.log("  Caps: 1 rung, 1 call. It cannot escalate.\n");
  console.log("  Pick up. You are a refrigeration technician. Try saying you're");
  console.log("  on another job, then give a number of minutes when pressed.\n");

  const deps: AgentDependencies = {
    getRoster: async () => [RESPONDER],
    requiredSkill: "refrigeration",
    requiredZone: "Zone A",

    isKillSwitchActive: async () => false,
    maxCallsPerIncident: 1,

    persistCall: async ({ status, confidence }) => {
      console.log(`\n  [persist] status=${status} confidence=${confidence.score}`);
      return { callId: "live-call-1" };
    },

    resolveCallbacks: {
      persistOutcome: async () => {},
      notifyManager: async () => {},
      emitSSE: () => {},
    },
    unresolvedCallbacks: {
      persistOutcome: async () => {},
      alertFacilityManager: async () => {},
      emitSSE: () => {},
    },
    verifyCallbacks: {
      scheduleVerificationJob: async ({ runAt }) =>
        console.log(`  [queue] verification would run at ${runAt}`),
      arrangeBackup: async ({ reason }) => console.log(`  [backup] ${reason}`),
      emitSSE: () => {},
    },
    humanReviewCallbacks: {
      parkIncident: async ({ reason }) => console.log(`  [review] ${reason}`),
      alertOperator: async () => {},
      emitSSE: () => {},
    },
    scheduleCallbackCallbacks: {
      scheduleCallbackJob: async () => {},
      emitSSE: () => {},
    },

    emitSSECallState: ({ state }) => {
      const at = new Date().toISOString();
      stateTransitions.push({ at, state });
      console.log(`  >>> call.state = ${state}`);
    },
    emitSSETranscriptDelta: ({ speaker, text }) => {
      transcript.push({ speaker, text });
      console.log(`  ${speaker}: ${text}`);
    },

    emitAgentEvent: ({ node, decision, reason }) =>
      console.log(`[${node}] ${decision} — ${reason}`),
    emitSSEPlanComposed: () => {},
    emitSSEResponderSelected: ({ responder }) =>
      console.log(`  [responder] ${responder.name}`),

    incidentOpenedAt: new Date(),
    useMock: false,
  };

  const final = await runEscalationAgent(CONTEXT, deps);

  // ── Findings ───────────────────────────────────────────────────────────────
  // Relative to the repo root, not __dirname — the compiled output lands at a
  // different depth than the source, and this file has already moved once.
  const outPath = join(process.cwd(), "docs", "live-call-raw.json");
  writeFileSync(
    outPath,
    JSON.stringify({ stateTransitions, transcript, rawPolls }, null, 2)
  );

  console.log("\n─── What we learned ───");
  console.log("call.state sequence :", stateTransitions.map((s) => s.state).join(" → ") || "(none)");
  console.log("transcript turns    :", transcript.length);
  console.log("polls               :", rawPolls.length);
  console.log("calls placed        :", final.callHistory.length);
  console.log("confidence          :", final.confidenceHistory.at(-1)?.score ?? "n/a");
  console.log("structured result   :", JSON.stringify(final.structuredResults.at(-1), null, 2));
  console.log("evidence            :", JSON.stringify(final.callHistory.at(-1)?.evidence, null, 2));
  console.log(`\nRaw payloads written to ${outPath}`);
  console.log("Log this call in docs/CALLE_TESTING_LOG.md.\n");
}

main().catch((err) => {
  console.error("\nProbe failed:", err);
  process.exit(1);
});
