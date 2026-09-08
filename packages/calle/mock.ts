/**
 * packages/calle/mock.ts
 * Mock CALL-E driver for development and testing.
 * Owner: Aryan
 *
 * ⚠️  THIS IS A DEV HARNESS. It must NEVER appear in:
 *     - The demo recording
 *     - The deployed app
 *     - Any test fixture labelled as real output
 *
 * It satisfies the identical interface as the real SDK so all
 * 5 developers can build in parallel without spending live calls.
 *
 * Usage:
 *   import { mockCalle } from "../calle/mock";
 *   // use mockCalle.calls.createAndWait() exactly like the real client
 */

import type { EscalationStructuredResult, CallStatus } from "../types";
import type { CallProgressHooks } from "./progress";

export type MockScenario =
  | "accept_immediately"      // technician says yes, ETA 20 min
  | "accept_after_pushback"   // "I'm busy" → negotiated to 40 min
  | "hard_refusal"            // flat no, on another job
  | "no_answer"               // call not picked up
  | "voicemail"               // reached voicemail
  | "ambiguous"               // vague answer, low confidence
  | "callback_requested"      // asks to be called back at specific time
  | "late_eta"                // ETA beyond safe window
  | "wrong_person"            // someone else picks up
  | "gatekeeper"              // IVR / switchboard answers, not a person
  | "call_drops";             // call disconnects mid-conversation

interface MockCallResult {
  status: string;
  taskCompleted: boolean;
  completionConfidence: { score: number; label: string };
  evidence: string[];
  structuredResult: EscalationStructuredResult;
}

const SCENARIOS: Record<MockScenario, MockCallResult> = {
  accept_immediately: {
    status: "completed",
    taskCompleted: true,
    completionConfidence: { score: 0.95, label: "high" },
    evidence: [
      "The technician confirmed availability immediately.",
      "Stated ETA of 20 minutes explicitly.",
    ],
    structuredResult: {
      responder_available: "yes",
      eta_minutes: 20,
      acknowledged_severity: true,
      requires_backup: false,
      requires_parts: false,
      decline_reason: "none",
      verbatim_commitment: "Yes, I can be there in 20 minutes.",
      next_action: "SCHEDULE_VERIFICATION_CALL",
    },
  },

  accept_after_pushback: {
    status: "completed",
    taskCompleted: true,
    completionConfidence: { score: 0.92, label: "high" },
    evidence: [
      "Initially indicated being on another job.",
      "When pressed for ETA, committed to 40 minutes.",
    ],
    structuredResult: {
      responder_available: "conditional",
      eta_minutes: 40,
      acknowledged_severity: true,
      requires_backup: false,
      requires_parts: false,
      decline_reason: "none",
      verbatim_commitment: "Give me about forty minutes.",
      next_action: "SCHEDULE_VERIFICATION_CALL",
    },
  },

  hard_refusal: {
    status: "completed",
    taskCompleted: true,
    completionConfidence: { score: 0.91, label: "high" },
    evidence: [
      "Technician clearly stated they are on another job.",
      "Declined to provide an ETA.",
    ],
    structuredResult: {
      responder_available: "no",
      acknowledged_severity: true,
      requires_backup: false,
      requires_parts: false,
      decline_reason: "on_another_job",
      verbatim_commitment: "I'm on another job, I can't come.",
      next_action: "ESCALATE_NEXT_RUNG",
    },
  },

  no_answer: {
    status: "no_answer",
    taskCompleted: false,
    completionConfidence: { score: 0.0, label: "none" },
    evidence: ["Call was not answered."],
    structuredResult: {
      responder_available: "unknown",
      acknowledged_severity: false,
      next_action: "ESCALATE_NEXT_RUNG",
    },
  },

  voicemail: {
    status: "completed",
    taskCompleted: false,
    completionConfidence: { score: 0.1, label: "low" },
    evidence: ["Reached voicemail. Left message with asset ID and callback request."],
    structuredResult: {
      responder_available: "unknown",
      acknowledged_severity: false,
      next_action: "ESCALATE_NEXT_RUNG",
    },
  },

  ambiguous: {
    status: "completed",
    taskCompleted: false,
    completionConfidence: { score: 0.55, label: "low" },
    evidence: [
      "Respondent gave vague answers.",
      "Said 'soon' but would not commit to a number.",
    ],
    structuredResult: {
      responder_available: "unknown",
      acknowledged_severity: false,
      next_action: "HUMAN_REVIEW",
    },
  },

  callback_requested: {
    status: "completed",
    taskCompleted: false,
    completionConfidence: { score: 0.82, label: "medium" },
    evidence: ["Technician asked to be called back in 30 minutes."],
    structuredResult: {
      responder_available: "conditional",
      acknowledged_severity: true,
      requires_backup: false,
      decline_reason: "none",
      callback_requested_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      verbatim_commitment: "Call me back in half an hour.",
      next_action: "SCHEDULE_CALLBACK",
    },
  },

  late_eta: {
    status: "completed",
    taskCompleted: true,
    completionConfidence: { score: 0.88, label: "high" },
    evidence: [
      "Technician committed to attending.",
      "ETA of 120 minutes stated — exceeds safe window.",
    ],
    structuredResult: {
      responder_available: "conditional",
      eta_minutes: 120,
      acknowledged_severity: true,
      requires_backup: true,
      requires_parts: false,
      decline_reason: "none",
      verbatim_commitment: "I can be there in two hours.",
      next_action: "SCHEDULE_VERIFICATION_CALL",
    },
  },

  wrong_person: {
    status: "completed",
    taskCompleted: false,
    completionConfidence: { score: 0.3, label: "low" },
    evidence: ["Person who answered did not identify as the expected responder."],
    structuredResult: {
      responder_available: "unknown",
      acknowledged_severity: false,
      next_action: "ESCALATE_NEXT_RUNG",
    },
  },

  gatekeeper: {
    status: "completed",
    taskCompleted: false,
    completionConfidence: { score: 0.25, label: "low" },
    evidence: [
      "An automated switchboard answered and offered a menu of options.",
      "No human respondent was reached. The agent did not navigate the menu.",
    ],
    structuredResult: {
      responder_available: "unknown",
      acknowledged_severity: false,
      next_action: "ESCALATE_NEXT_RUNG",
    },
  },

  call_drops: {
    status: "failed",
    taskCompleted: false,
    completionConfidence: { score: 0.0, label: "none" },
    evidence: ["Call dropped mid-conversation."],
    structuredResult: {
      responder_available: "unknown",
      acknowledged_severity: false,
      next_action: "ESCALATE_NEXT_RUNG",
    },
  },
};

/**
 * The `call.state` sequence each scenario walks through.
 *
 * ⚠️  THESE MATCH WHAT CALL-E ACTUALLY DOES, not what we wish it did.
 *
 * Verified against live calls on 2026-09-08/09 (docs/CALLE_TESTING_LOG.md
 * F-003, F-006). Two things a UI author needs to know:
 *
 *   - `connected` NEVER fires. The attempt goes straight from absent to
 *     `in_progress` to terminal; CALL-E exposes no "answered but not yet
 *     talking" signal.
 *   - `in_conversation` only fires once a transcript turn exists — and turns
 *     arrive in ONE BURST at completion, not during the call. So on a real
 *     call it is effectively skipped too.
 *
 * A dashboard built against an idealised sequence will show states that never
 * arrive in the demo. Set SENTINEL_MOCK_OPTIMISTIC=true to replay the fuller
 * sequence while developing those components — but do not ship a UI that
 * depends on it.
 */
const OBSERVED_TALKING: CallStatus[] = ["queued", "dialling", "extracting", "completed"];
const OPTIMISTIC_TALKING: CallStatus[] = [
  "queued", "dialling", "connected", "in_conversation", "extracting", "completed",
];

function talkingSequence(): CallStatus[] {
  return process.env.SENTINEL_MOCK_OPTIMISTIC === "true"
    ? OPTIMISTIC_TALKING
    : OBSERVED_TALKING;
}

const STATE_SEQUENCES: Record<MockScenario, () => CallStatus[]> = {
  accept_immediately:    talkingSequence,
  accept_after_pushback: talkingSequence,
  hard_refusal:          talkingSequence,
  callback_requested:    talkingSequence,
  late_eta:              talkingSequence,
  ambiguous:             talkingSequence,
  wrong_person:          talkingSequence,
  voicemail:             talkingSequence,
  gatekeeper:            talkingSequence,
  // SIP 480/486 and friends — observed on a real call (F-009).
  no_answer:             () => ["queued", "dialling", "no_answer"],
  call_drops:            () => ["queued", "dialling", "failed"],
};

/**
 * Illustrative transcript for the hero scenario. Clearly synthetic — this is a
 * dev fixture and must never be presented as a real CALL-E transcript
 * (CLAUDE.md Rule 8).
 */
const MOCK_TRANSCRIPTS: Partial<Record<MockScenario, { speaker: "AGENT" | "HUMAN"; text: string }[]>> = {
  accept_after_pushback: [
    { speaker: "AGENT", text: "[MOCK] This is the automated operations line for Northgate Facility." },
    { speaker: "HUMAN", text: "[MOCK] I'm on another job in Sector 7 right now." },
    { speaker: "AGENT", text: "[MOCK] Understood. What time could you realistically reach Northgate?" },
    { speaker: "HUMAN", text: "[MOCK] Give me about forty minutes." },
    { speaker: "AGENT", text: "[MOCK] Logging you as confirmed with an ETA of forty minutes." },
  ],
};

/**
 * Simulates placing a call and following it to completion, emitting the same
 * progress hooks the real driver does (FR-5.2).
 *
 * `delayMs` is the total simulated call duration, spread across the states.
 */
async function runCall(
  _params: { task: string; resultSchema: unknown },
  scenario: MockScenario = "accept_after_pushback",
  hooks: CallProgressHooks = {},
  delayMs = 1500
): Promise<MockCallResult> {
  const result = SCENARIOS[scenario];
  if (!result) throw new Error(`Unknown mock scenario: ${scenario}`);

  const states = STATE_SEQUENCES[scenario]();
  const callId = `mock-call-${scenario}`;
  const perState = Math.max(0, Math.floor(delayMs / states.length));

  // Turns arrive in one burst at completion, not during the call — CALL-E
  // publishes `transcriptTurns` only once the attempt finishes (F-006).
  // Under SENTINEL_MOCK_OPTIMISTIC they stream at `in_conversation` instead,
  // for developing a UI against a future streaming API.
  const optimistic = process.env.SENTINEL_MOCK_OPTIMISTIC === "true";
  const emitTurnsAt: CallStatus = optimistic ? "in_conversation" : "extracting";

  for (const state of states) {
    if (perState > 0) await new Promise((res) => setTimeout(res, perState));
    hooks.onState?.(state, callId);

    if (state === emitTurnsAt) {
      for (const turn of MOCK_TRANSCRIPTS[scenario] ?? []) {
        hooks.onTranscript?.({ ...turn, offsetSeconds: null }, callId);
      }
    }
  }

  return result;
}

/**
 * Simulates calle.calls.createAndWait() with a configurable scenario.
 * Retained for direct unit tests that don't care about live progress.
 */
async function createAndWait(
  params: { task: string; resultSchema: unknown },
  scenario: MockScenario = "accept_after_pushback",
  delayMs = 1500   // simulate call duration
): Promise<MockCallResult> {
  return runCall(params, scenario, {}, delayMs);
}

export const mockCalle = {
  runCall,
  calls: {
    createAndWait,
  },
  _scenarios: SCENARIOS,       // expose for tests
  _stateSequences: STATE_SEQUENCES,
};
