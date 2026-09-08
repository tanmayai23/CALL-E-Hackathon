/**
 * scripts/test-scenario-call.mjs
 * P2 Conversation Quality Test — real cold-chain scenario.
 *
 * This uses the actual buildTaskPrompt() from the agent.
 * You are playing the role of the technician.
 *
 * SUGGESTED RESPONSES TO TEST:
 *   - Say "I'm busy" → agent should ask for ETA, not accept as final no
 *   - Say "40 minutes" → agent should confirm and close
 *   - Say "I don't know" → agent should ask once more then mark ambiguous
 *
 * Spends 1 call from P2 budget (4 allocated).
 */

import { readFileSync } from "fs";
import { CalleClient } from "@call-e/calle";

// ─── Load .env ────────────────────────────────────────────────────────────────
const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
const getEnv = (key) => env.match(new RegExp(`^${key}=(.+)$`, "m"))?.[1]?.trim();

const apiKey = getEnv("CALLE_API_KEY");
if (!apiKey) { console.error("❌ CALLE_API_KEY not found in .env"); process.exit(1); }

const client = new CalleClient({ apiKey });

// ─── Simulated EscalationContext (hero demo scenario) ────────────────────────
const ctx = {
  incidentId: "INC-TEST-001",
  traceId:    "trace-p2-test",
  severity:   "CRITICAL",
  safeWindowMinutes: 90,
  consequence: "vaccine inventory is at risk of spoilage",
  escalationRung: 1,
  facility: { id: "northgate", name: "Northgate Facility", timezone: "Asia/Kolkata" },
  asset:    { id: "CS-04", type: "cold-storage unit", location: "Zone A, Building 2" },
  reading:  { metric: "temperature_c", value: 12.4, unit: "C", threshold: 8 },
  responder: {
    name: "Aryan",
    role: "Refrigeration Technician",
    phoneE164: process.env.CALLE_TEST_PHONE ?? "",
    preferredLanguage: "en-IN",
  },
};

// ─── Build the real task prompt ───────────────────────────────────────────────
const TASK = `
You are calling ${ctx.responder.name}, a ${ctx.responder.role} at ${ctx.facility.name}.
You are the first automated call for this incident. Be professional and factual.

OPEN WITH (say this exactly at the start):
"This is the automated operations line for ${ctx.facility.name}. I'm calling about a critical incident with ${ctx.asset.type} unit ${ctx.asset.id} at ${ctx.asset.location}."

INCIDENT DETAILS
  Asset:       ${ctx.asset.id} — ${ctx.asset.type} at ${ctx.asset.location}
  Reading:     ${ctx.reading.metric} = ${ctx.reading.value} ${ctx.reading.unit} (threshold: ${ctx.reading.threshold} ${ctx.reading.unit})
  Severity:    ${ctx.severity}
  Time window: Approximately ${ctx.safeWindowMinutes} minutes before ${ctx.consequence}.
  Consequence: ${ctx.consequence}

This is a CRITICAL incident. Every minute of delay increases the damage.

OBJECTIVE
  Get a clear YES or NO and a specific ETA in minutes.
  Do not end the call without one of these two outcomes.

MUST ASK (in this order)
  1. "Are you available to attend this incident at ${ctx.asset.location}?"
  2. If not immediately: "What is the earliest realistic time you could arrive?"
  3. If ETA > ${ctx.safeWindowMinutes} min: "That is outside our safe window. Should I arrange a backup technician?"
  4. "Do you need any replacement parts or tools arranged before you arrive?"

HANDLING DIFFICULT RESPONSES

  "I'm busy" / "I'm on another job":
    → Do NOT accept as a final no.
    → Say: "Understood. Given the ${ctx.safeWindowMinutes}-minute window, what is the earliest you could realistically reach ${ctx.facility.name}?"
    → Get a number. Even 45 minutes is acceptable if within the window.

  "Call me later" / "I'll call back":
    → Say: "I understand, but this is time-sensitive. Can you give me a specific time you'll be available in the next ${Math.round(ctx.safeWindowMinutes / 2)} minutes?"

  Vague answer ("soon", "maybe", "I'll try"):
    → Ask ONCE: "Just to confirm — are we talking 20 minutes, 40 minutes, or longer?"

CONFIRMATION (when they agree)
  Say back: "Thank you. I'm confirming ${ctx.responder.name} will attend ${ctx.asset.id} at ${ctx.asset.location} with an ETA of [X] minutes. Is that correct?"
  Wait for verbal confirmation before ending.

STOP CONDITIONS
  ✓ Clear YES with a numeric ETA confirmed → end the call.
  ✓ Clear NO with a reason → thank them, end the call.
  ✓ Two consecutive non-answers → end, mark human review.
  ✓ Call exceeds 90 seconds → wrap up immediately.

HARD RULES
  - Never imply you are human.
  - Keep the total call under 90 seconds.
`.trim();

const RESULT_SCHEMA = {
  type: "object",
  required: ["responder_available", "acknowledged_severity", "next_action"],
  properties: {
    responder_available: {
      type: "string",
      enum: ["yes", "no", "conditional", "unknown"],
    },
    eta_minutes: { type: "number" },
    acknowledged_severity: { type: "boolean" },
    requires_backup: { type: "boolean" },
    requires_parts: { type: "boolean" },
    decline_reason: {
      type: "string",
      enum: ["on_another_job", "off_shift", "out_of_zone", "not_qualified", "no_reason", "none"],
    },
    verbatim_commitment: { type: "string" },
    next_action: {
      type: "string",
      enum: ["CLOSE_RESOLVED", "ESCALATE_NEXT_RUNG", "SCHEDULE_VERIFICATION_CALL", "SCHEDULE_CALLBACK", "HUMAN_REVIEW"],
    },
  },
};

// ─── Place the call ───────────────────────────────────────────────────────────
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("🚨 P2 SCENARIO CALL — Real cold-chain incident prompt");
console.log(`📞 Calling: ${ctx.responder.phoneE164}`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("\n💡 TIP: Try saying 'I'm busy' — see if it negotiates an ETA");
console.log("💡 TIP: Then say '40 minutes' — it should confirm and close\n");
console.log("Placing call... pick up your phone!\n");

const startTime = Date.now();

try {
  const result = await client.calls.createAndWait(
    {
      task: TASK,
      recipient: { phone: ctx.responder.phoneE164, locale: "en-IN" },
      resultSchema: RESULT_SCHEMA,
      metadata: { purpose: "P2-scenario-test", incidentId: ctx.incidentId, traceId: ctx.traceId },
    },
    { timeoutMs: 180_000, intervalMs: 3_000 }
  );

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(result.status === "completed" ? "✅ CALL COMPLETED" : `⚠️  CALL STATUS: ${result.status}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`\nCall ID:          ${result.id}`);
  console.log(`Status:           ${result.status}`);
  console.log(`Task complete:    ${result.taskCompleted}`);
  console.log(`Confidence:       ${result.completionConfidence?.score} (${result.completionConfidence?.label})`);
  console.log(`Duration:         ${duration}s`);
  console.log(`\nStructured result:`);
  console.log(JSON.stringify(result.structuredResult, null, 2));
  console.log(`\nEvidence:`);
  result.evidence?.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));

  // ── Score the result ────────────────────────────────────────────────────────
  const r = result.structuredResult;
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 PROMPT QUALITY SCORE");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Commitment obtained:    ${r?.responder_available !== "unknown" ? "✅" : "❌"}`);
  console.log(`  Numeric ETA extracted:  ${r?.eta_minutes ? `✅ ${r.eta_minutes} min` : "❌ none"}`);
  console.log(`  Severity acknowledged:  ${r?.acknowledged_severity ? "✅" : "❌"}`);
  console.log(`  Within 90s:             ${parseFloat(duration) <= 90 ? "✅" : "❌ " + duration + "s"}`);
  console.log(`  Confidence >= 0.7:      ${(result.completionConfidence?.score ?? 0) >= 0.7 ? "✅" : "❌"}`);
  console.log(`  next_action:            ${r?.next_action ?? "not extracted"}`);

  console.log(`\n📋 LOG ENTRY (copy to CALLE_TESTING_LOG.md):`);
  console.log(`| 3 | ${new Date().toISOString().split("T")[0]} | P2 | Cold-chain scenario — negotiation test | ${result.status} | Call ID: ${result.id}. ETA: ${r?.eta_minutes ?? "none"}min. next_action: ${r?.next_action} |`);

} catch (err) {
  console.error("\n❌ CALL FAILED:", err.message || err);
}
