/**
 * ASSET UNREACHABLE — failure mode F12.
 *
 * DK-07 misses its heartbeat window. This is a monitoring failure, not a
 * confirmed thermal excursion, so it opens as its own WARNING incident with a
 * call plan that asks for a physical check rather than a repair.
 */

import { turn, turnEnd, type ScriptStep } from "./script";
import { responderById } from "../facility";

export function buildSensorOffline(incidentId: string): ScriptStep[] {
  const anjali = responderById("resp-anjali-menon");
  const steps: ScriptStep[] = [];

  steps.push({
    at: 0,
    event: {
      type: "signal.received",
      incidentId,
      value: -18.4,
      ts: new Date().toISOString(),
    },
  });

  steps.push({
    at: 2600,
    event: { type: "incident.opened", incidentId, severity: "WARNING", safeWindowMinutes: 45 },
  });

  steps.push({
    at: 3800,
    event: { type: "responder.selected", incidentId, responder: anjali, rung: 1 },
  });

  steps.push({
    at: 5000,
    event: {
      type: "plan.composed",
      incidentId,
      summary:
        "Automated operations line for Northgate. DK-07 has not reported telemetry for 5 minutes and 12 seconds against a 3 minute heartbeat window. The unit itself may be fine — this is a monitoring failure, not a confirmed thermal excursion. Ask for a physical check of the dock gateway and a callback with the panel reading.",
      mustAsk: [
        "Can you physically check the DK-07 gateway in Dock 7?",
        "What does the unit's own panel read right now?",
        "How long until you can get there?",
      ],
    },
  });

  steps.push({ at: 6000, event: { type: "call.state", incidentId, callId: "call-01", state: "queued" } });
  steps.push({ at: 6600, event: { type: "call.state", incidentId, callId: "call-01", state: "dialling" } });
  steps.push({ at: 10400, event: { type: "call.state", incidentId, callId: "call-01", state: "connected" } });
  steps.push({ at: 11000, event: { type: "call.state", incidentId, callId: "call-01", state: "in_conversation" } });

  const s1 =
    "This is the automated operations line for Northgate Facility. Dock freezer DK-07 has stopped reporting telemetry for five minutes. This may be a gateway fault rather than a temperature problem. Can you physically check the unit?";
  const s2 = "Yeah, I'm two minutes from Dock 7. Probably the gateway again.";
  const s3 = "Understood. What does the unit's own panel read when you get there?";
  const s4 = "I'll call it in. Give me five minutes.";
  const s5 =
    "Logged — Anjali Menon attending DK-07, ETA five minutes, reporting the panel reading on arrival. Thank you.";

  let cursor = 11300;
  steps.push(...turn(cursor, incidentId, "AGENT", "01:52:08", s1));
  cursor = turnEnd(cursor, s1) + 640;
  steps.push(...turn(cursor, incidentId, "HUMAN", "01:52:22", s2));
  cursor = turnEnd(cursor, s2) + 600;
  steps.push(...turn(cursor, incidentId, "AGENT", "01:52:26", s3));
  cursor = turnEnd(cursor, s3) + 700;
  steps.push(...turn(cursor, incidentId, "HUMAN", "01:52:31", s4));
  cursor = turnEnd(cursor, s4) + 620;
  steps.push(...turn(cursor, incidentId, "AGENT", "01:52:34", s5));
  cursor = turnEnd(cursor, s5) + 850;

  steps.push({ at: cursor, event: { type: "call.state", incidentId, callId: "call-01", state: "extracting" } });
  cursor += 1700;

  steps.push({
    at: cursor,
    event: {
      type: "result.extracted",
      incidentId,
      structured: {
        responder_available: "yes",
        eta_minutes: 5,
        eta_within_safe_window: true,
        acknowledged_severity: true,
        requires_backup: false,
        requires_parts: false,
        decline_reason: "none",
        verbatim_commitment: "I'll call it in. Give me five minutes.",
        next_action: "SCHEDULE_VERIFICATION_CALL",
      },
      confidence: { score: 0.88, label: "HIGH" },
      evidence: [
        "Yeah, I'm two minutes from Dock 7. Probably the gateway again.",
        "I'll call it in. Give me five minutes.",
      ],
    },
  });
  cursor += 800;

  steps.push({ at: cursor, event: { type: "call.state", incidentId, callId: "call-01", state: "completed" } });
  cursor += 1000;

  steps.push({
    at: cursor,
    event: {
      type: "incident.resolved",
      incidentId,
      outcome:
        "Monitoring gap acknowledged — Anjali Menon attending DK-07, ETA 5 min, panel reading to be reported on arrival.",
      timeSavedMinutes: 7.4,
    },
  });

  return steps;
}
