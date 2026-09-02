/**
 * THE DIFFERENTIATOR — PRD demo storyboard, 2:25–2:40.
 *
 * Rung 1 does not answer (F1). Rung 2 is out of zone and refuses (F3). The
 * agent raises urgency at each rung and reaches the night supervisor, who
 * commits — three calls, no human in the loop. This exercises the escalation
 * ladder animation, which §12 ranks second among the details that make a judge
 * read this as a real product.
 */

import { MUST_ASK, readings, turn, turnEnd, type ScriptStep } from "./script";
import { responderById } from "../facility";

export function buildRefusalEscalation(incidentId: string): ScriptStep[] {
  const ravi = responderById("resp-ravi-sharma");
  const anjali = responderById("resp-anjali-menon");
  const devendra = responderById("resp-devendra-rathi");
  const steps: ScriptStep[] = [];

  steps.push(...readings(incidentId, [5.2, 6.4, 7.1, 8.3, 9.0], 640));

  steps.push({
    at: 3400,
    event: { type: "incident.opened", incidentId, severity: "CRITICAL", safeWindowMinutes: 60 },
  });

  /* ---- Rung 1: no answer (F1) ---- */
  steps.push({ at: 4400, event: { type: "responder.selected", incidentId, responder: ravi, rung: 1 } });
  steps.push({
    at: 5400,
    event: {
      type: "plan.composed",
      incidentId,
      summary:
        "Automated operations line for Northgate. CS-01 is at 9.0°C against an 8.0°C ceiling with roughly 60 minutes of margin. Be professional and concise. Obtain a yes or no and a concrete ETA in minutes.",
      mustAsk: MUST_ASK,
    },
  });
  steps.push({ at: 6200, event: { type: "call.state", incidentId, callId: "call-01", state: "dialling" } });
  steps.push({ at: 13000, event: { type: "call.state", incidentId, callId: "call-01", state: "no_answer" } });
  steps.push({ at: 14200, event: { type: "incident.escalated", incidentId, fromRung: 1, toRung: 2 } });

  /* ---- Rung 2: hard refusal (F3) ---- */
  steps.push({ at: 15400, event: { type: "responder.selected", incidentId, responder: anjali, rung: 2 } });
  steps.push({
    at: 16400,
    event: {
      type: "plan.composed",
      incidentId,
      summary:
        "The primary responder was unavailable. Convey elevated urgency. CS-01 is at 9.0°C with roughly 60 minutes of margin and no assigned responder. Obtain a commitment and a concrete ETA.",
      mustAsk: MUST_ASK,
    },
  });
  steps.push({ at: 17200, event: { type: "call.state", incidentId, callId: "call-02", state: "dialling" } });
  steps.push({ at: 20400, event: { type: "call.state", incidentId, callId: "call-02", state: "connected" } });
  steps.push({ at: 21000, event: { type: "call.state", incidentId, callId: "call-02", state: "in_conversation" } });

  const r1 =
    "This is the automated operations line for Northgate Facility. The primary technician was unreachable. Cold storage CS-01 is at 9.0 degrees with about 60 minutes of margin and no one assigned. Can you attend?";
  const r2 = "I'm off site in Panvel tonight, that's a ninety minute drive. I can't make that window.";
  const r3 = "Understood. Do you need me to arrange a backup, or should this go to the supervisor?";
  const r4 = "Send it to Devendra. He's on site tonight.";

  let cursor = 21300;
  steps.push(...turn(cursor, incidentId, "AGENT", "03:41:12", r1));
  cursor = turnEnd(cursor, r1) + 620;
  steps.push(...turn(cursor, incidentId, "HUMAN", "03:41:26", r2));
  cursor = turnEnd(cursor, r2) + 600;
  steps.push(...turn(cursor, incidentId, "AGENT", "03:41:32", r3));
  cursor = turnEnd(cursor, r3) + 640;
  steps.push(...turn(cursor, incidentId, "HUMAN", "03:41:37", r4));
  cursor = turnEnd(cursor, r4) + 800;

  steps.push({ at: cursor, event: { type: "call.state", incidentId, callId: "call-02", state: "extracting" } });
  cursor += 1600;
  steps.push({
    at: cursor,
    event: {
      type: "result.extracted",
      incidentId,
      structured: {
        responder_available: "no",
        acknowledged_severity: true,
        requires_backup: true,
        requires_parts: false,
        decline_reason: "out_of_zone",
        verbatim_commitment: "I can't make that window.",
        next_action: "ESCALATE_NEXT_RUNG",
      },
      confidence: { score: 0.94, label: "HIGH" },
      evidence: [
        "I'm off site in Panvel tonight, that's a ninety minute drive. I can't make that window.",
        "Send it to Devendra. He's on site tonight.",
      ],
    },
  });
  cursor += 700;
  steps.push({ at: cursor, event: { type: "call.state", incidentId, callId: "call-02", state: "completed" } });
  cursor += 900;
  steps.push({ at: cursor, event: { type: "incident.escalated", incidentId, fromRung: 2, toRung: 3 } });
  cursor += 1200;

  /* ---- Rung 3: supervisor commits ---- */
  steps.push({ at: cursor, event: { type: "responder.selected", incidentId, responder: devendra, rung: 3 } });
  cursor += 1000;
  steps.push({
    at: cursor,
    event: {
      type: "plan.composed",
      incidentId,
      summary:
        "Two responders have already been unreachable. This is now a supervisor escalation — state clearly that the incident is unassigned. CS-01 is at 9.0°C with roughly 45 minutes of remaining margin.",
      mustAsk: MUST_ASK,
    },
  });
  cursor += 800;
  steps.push({ at: cursor, event: { type: "call.state", incidentId, callId: "call-03", state: "dialling" } });
  cursor += 2800;
  steps.push({ at: cursor, event: { type: "call.state", incidentId, callId: "call-03", state: "connected" } });
  cursor += 600;
  steps.push({ at: cursor, event: { type: "call.state", incidentId, callId: "call-03", state: "in_conversation" } });
  cursor += 300;

  const d1 =
    "This is the automated operations line for Northgate Facility. Cold storage CS-01 is at 9.0 degrees and unassigned — two technicians were unreachable or out of zone. Roughly 45 minutes of margin remain.";
  const d2 = "Main hoon site pe. I'll take it myself, twenty five minutes.";
  const d3 = "Twenty five minutes is inside the window. Logging you as confirmed. Do you need a second pair of hands?";
  const d4 = "No, bas compressor reset hoga. I'll handle it.";
  const d5 =
    "Confirmed. Devendra Rathi, ETA twenty five minutes, cold storage CS-01. Verification call at thirty minutes. Thank you.";

  steps.push(...turn(cursor, incidentId, "AGENT", "03:44:02", d1));
  cursor = turnEnd(cursor, d1) + 600;
  steps.push(...turn(cursor, incidentId, "HUMAN", "03:44:15", d2));
  cursor = turnEnd(cursor, d2) + 580;
  steps.push(...turn(cursor, incidentId, "AGENT", "03:44:19", d3));
  cursor = turnEnd(cursor, d3) + 640;
  steps.push(...turn(cursor, incidentId, "HUMAN", "03:44:25", d4));
  cursor = turnEnd(cursor, d4) + 600;
  steps.push(...turn(cursor, incidentId, "AGENT", "03:44:28", d5));
  cursor = turnEnd(cursor, d5) + 850;

  steps.push({ at: cursor, event: { type: "call.state", incidentId, callId: "call-03", state: "extracting" } });
  cursor += 1700;
  steps.push({
    at: cursor,
    event: {
      type: "result.extracted",
      incidentId,
      structured: {
        responder_available: "yes",
        eta_minutes: 25,
        eta_within_safe_window: true,
        acknowledged_severity: true,
        requires_backup: false,
        requires_parts: false,
        decline_reason: "none",
        verbatim_commitment: "I'll take it myself, twenty five minutes.",
        next_action: "SCHEDULE_VERIFICATION_CALL",
      },
      confidence: { score: 0.9, label: "HIGH" },
      evidence: [
        "Main hoon site pe. I'll take it myself, twenty five minutes.",
        "No, bas compressor reset hoga. I'll handle it.",
      ],
    },
  });
  cursor += 800;
  steps.push({ at: cursor, event: { type: "call.state", incidentId, callId: "call-03", state: "completed" } });
  cursor += 1000;
  steps.push({
    at: cursor,
    event: {
      type: "incident.resolved",
      incidentId,
      outcome:
        "Escalated across 3 rungs in 3 min 12 s with no human in the loop. Devendra Rathi committed, ETA 25 min. Verification call scheduled for T+30.",
      timeSavedMinutes: 18.2,
    },
  });

  return steps;
}
