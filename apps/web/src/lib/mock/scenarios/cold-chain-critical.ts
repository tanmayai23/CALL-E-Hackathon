/**
 * THE HERO SCENARIO — PRD §4.1.
 *
 * CS-04 crosses its 8°C ceiling and keeps climbing. The technician is on
 * another job in Sector 7; the agent refuses to take that as a final answer and
 * negotiates a concrete forty-minute commitment. This is the run that the demo
 * video is built around, and the one the definition of winning describes.
 */

import { MUST_ASK, readings, turn, turnEnd, type ScriptStep } from "./script";
import { responderById } from "../facility";

export function buildColdChainCritical(incidentId: string): ScriptStep[] {
  const ravi = responderById("resp-ravi-sharma");
  const steps: ScriptStep[] = [];

  steps.push(...readings(incidentId, [9.1, 9.8, 10.6, 11.3, 12.0, 12.4], 780));

  steps.push({
    at: 4300,
    event: {
      type: "incident.opened",
      incidentId,
      severity: "CRITICAL",
      safeWindowMinutes: 90,
    },
  });

  steps.push({
    at: 5400,
    event: { type: "responder.selected", incidentId, responder: ravi, rung: 1 },
  });

  steps.push({
    at: 6600,
    event: {
      type: "plan.composed",
      incidentId,
      summary:
        "Automated operations line for Northgate. State that CS-04 is at 12.4°C against an 8°C ceiling with roughly 90 minutes before vaccine inventory is at risk. Obtain a yes or no and a concrete ETA in minutes. Do not accept “busy” as a final answer — ask for the earliest realistic ETA. Keep the call under 90 seconds.",
      mustAsk: MUST_ASK,
    },
  });

  steps.push({ at: 7600, event: { type: "call.state", incidentId, callId: "call-01", state: "queued" } });
  steps.push({ at: 8300, event: { type: "call.state", incidentId, callId: "call-01", state: "dialling" } });
  steps.push({ at: 12500, event: { type: "call.state", incidentId, callId: "call-01", state: "connected" } });
  steps.push({ at: 13200, event: { type: "call.state", incidentId, callId: "call-01", state: "in_conversation" } });

  const t1 =
    "This is the automated operations line for Northgate Facility. Cold storage unit CS-04 has crossed its critical temperature threshold — it is at 12.4 degrees and rising, with roughly 90 minutes before inventory is at risk. Are you available to attend?";
  const t2 = "I'm on another job in Sector 7 right now.";
  const t3 = "Understood. What time could you realistically reach Northgate?";
  const t4 = "Give me about forty minutes.";
  const t5 =
    "Forty minutes puts you inside the safe window. I'm logging you as confirmed with an ETA of 40 minutes. Should I arrange a backup in case you're delayed?";
  const t6 = "No, I'll make it.";
  const t7 =
    "Confirmed. Ravi Sharma, ETA forty minutes, cold storage CS-04 at Northgate. A verification call will follow at forty-five minutes. Thank you.";

  let cursor = 13500;
  steps.push(...turn(cursor, incidentId, "AGENT", "02:14:41", t1));
  cursor = turnEnd(cursor, t1) + 700;

  steps.push(...turn(cursor, incidentId, "HUMAN", "02:14:58", t2));
  cursor = turnEnd(cursor, t2) + 620;

  steps.push(...turn(cursor, incidentId, "AGENT", "02:15:01", t3));
  cursor = turnEnd(cursor, t3) + 780;

  steps.push(...turn(cursor, incidentId, "HUMAN", "02:15:06", t4));
  cursor = turnEnd(cursor, t4) + 640;

  steps.push(...turn(cursor, incidentId, "AGENT", "02:15:09", t5));
  cursor = turnEnd(cursor, t5) + 700;

  steps.push(...turn(cursor, incidentId, "HUMAN", "02:15:17", t6));
  cursor = turnEnd(cursor, t6) + 600;

  steps.push(...turn(cursor, incidentId, "AGENT", "02:15:20", t7));
  cursor = turnEnd(cursor, t7) + 900;

  steps.push({ at: cursor, event: { type: "call.state", incidentId, callId: "call-01", state: "extracting" } });
  cursor += 1900;

  steps.push({
    at: cursor,
    event: {
      type: "result.extracted",
      incidentId,
      structured: {
        responder_available: "conditional",
        eta_minutes: 40,
        eta_within_safe_window: true,
        acknowledged_severity: true,
        requires_backup: false,
        requires_parts: false,
        decline_reason: "on_another_job",
        verbatim_commitment: "Give me about forty minutes.",
        next_action: "SCHEDULE_VERIFICATION_CALL",
      },
      confidence: { score: 0.92, label: "HIGH" },
      evidence: [
        "I'm on another job in Sector 7 right now.",
        "Give me about forty minutes.",
        "No, I'll make it.",
      ],
    },
  });
  cursor += 800;

  steps.push({ at: cursor, event: { type: "call.state", incidentId, callId: "call-01", state: "completed" } });
  cursor += 1100;

  steps.push({
    at: cursor,
    event: {
      type: "incident.resolved",
      incidentId,
      outcome:
        "Commitment secured — Ravi Sharma, ETA 40 min, inside the 90 min safe window. Facility manager notified. Verification call scheduled for T+45.",
      timeSavedMinutes: 11.67,
    },
  });

  return steps;
}
