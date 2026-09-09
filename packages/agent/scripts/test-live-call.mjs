/**
 * scripts/test-live-call.mjs
 * P1 Connectivity Test — places ONE real CALL-E call.
 *
 * RULE: This spends 1 of your 20 free calls. Only run when ready.
 * Log the result in docs/CALLE_TESTING_LOG.md after running.
 *
 * Run with:
 *   node scripts/test-live-call.mjs
 */

import { readFileSync } from "fs";
import { CalleClient } from "@call-e/calle";

// ─── Load .env manually (no dotenv dependency needed) ────────────────────────
const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
const getEnv = (key) => {
  const match = env.match(new RegExp(`^${key}=(.+)$`, "m"));
  return match?.[1]?.trim();
};

const apiKey = getEnv("CALLE_API_KEY");
const baseUrl = getEnv("CALLE_BASE_URL") || "https://api.heycall-e.com";

if (!apiKey) {
  console.error("❌ CALLE_API_KEY not found in .env");
  process.exit(1);
}

const client = new CalleClient({ apiKey });

// ─── Test call config ─────────────────────────────────────────────────────────
const TEST_PHONE = process.env.CALLE_TEST_PHONE;  // consented roster number, from .env
if (!TEST_PHONE) {
  console.error("CALLE_TEST_PHONE is not set. Only ever call a consented number.");
  process.exit(1);
}

const TASK = `
Call ${TEST_PHONE}. This is a connectivity test for Sentinel Ops.

You are the automated operations line for Northgate Facility.

Say exactly this: "Hello, this is the automated Sentinel Ops test line. 
This is a connectivity test for the CALL-E integration. 
Please say 'confirmed' so we can verify the call is working. 
Thank you."

Wait for a response. If they say anything, end the call politely.
Keep the call under 30 seconds.
`.trim();

const RESULT_SCHEMA = {
  type: "object",
  required: ["call_confirmed"],
  properties: {
    call_confirmed: {
      type: "string",
      enum: ["yes", "no", "no_answer"],
      description: "Did the person confirm they received the call?",
    },
    response: {
      type: "string",
      description: "What the person said in response.",
    },
  },
};

// ─── Place the call ───────────────────────────────────────────────────────────
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("🚨 LIVE CALL — This will ring a real phone and spend 1 credit");
console.log(`📞 Calling: ${TEST_PHONE}`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("\nPlacing call... (your phone will ring shortly)\n");

const startTime = Date.now();

try {
  const result = await client.calls.createAndWait(
    {
      task: TASK,
      recipient: {
        phone: TEST_PHONE,
        locale: "en-IN",
      },
      resultSchema: RESULT_SCHEMA,
      metadata: {
        purpose: "P1-connectivity-test",
        phase: "P1",
        tester: "Aryan",
      },
    },
    {
      timeoutMs: 180_000, // 3 min max wait
      intervalMs: 3_000,  // poll every 3 seconds
    }
  );

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ CALL COMPLETED");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`\nCall ID:       ${result.id}`);
  console.log(`Status:        ${result.status}`);
  console.log(`Task complete: ${result.taskCompleted}`);
  console.log(`Confidence:    ${result.completionConfidence?.score} (${result.completionConfidence?.label})`);
  console.log(`Duration:      ${duration}s`);
  console.log(`\nStructured result:`);
  console.log(JSON.stringify(result.structuredResult, null, 2));
  console.log(`\nEvidence:`);
  result.evidence?.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));

  if (result.status === "completed") {
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎉 P1 CONNECTIVITY TEST PASSED");
    console.log("   Real CALL-E SDK is working end-to-end.");
    console.log("   Log this call in docs/CALLE_TESTING_LOG.md");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`\n📋 LOG ENTRY (copy to CALLE_TESTING_LOG.md):`);
    console.log(`| 1 | ${new Date().toISOString().split("T")[0]} | P1 | Connectivity test | ${result.status} | Call ID: ${result.id} |`);
  } else {
    console.log(`\n⚠️  Call ended with status: ${result.status}`);
    console.log("   Check the CALL-E dashboard for details.");
  }

} catch (err) {
  console.error("\n❌ CALL FAILED");
  console.error(err.message || err);
  console.log("\nCommon causes:");
  console.log("  - CALLE_API_KEY is invalid or expired");
  console.log("  - Phone number format wrong (must be +91XXXXXXXXXX)");
  console.log("  - Network/firewall blocking outbound request");
  console.log("  - Account has no remaining credits");
  process.exit(1);
}
