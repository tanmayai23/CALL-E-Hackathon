# Examples

Worked examples of the escalation agent, from the happy path to the ways it goes wrong.

Every example below runs against the mock driver — **no phone rings and no call credits are spent**:

```bash
CALLE_USE_MOCK=true SENTINEL_MOCK_SCENARIO=<scenario> npx ts-node scripts/run_escalation.ts
```

---

## 1. The hero path — a "no" negotiated into a commitment

**Scenario:** `accept_after_pushback`

A cold-storage unit crosses its critical threshold at 12.4°C against an 8°C ceiling. Roughly 90 minutes before inventory spoils. The on-call technician is already on another job.

```
Incident CS-04: temperature_c = 12.4C (threshold 8). 90 minutes before inventory is at risk.

[assess_incident] select_responder — Incident assessed as call-worthy.
  [responder] rung 1: Rajesh Sharma (Refrigeration Technician)
  [plan] Rung 1: Call Rajesh Sharma re: CS-04 — CRITICAL — 90min window
  [state] queued
  [state] dialling
  [state] connected
  [state] in_conversation
  AGENT: This is the automated operations line for Northgate Facility.
  HUMAN: I'm on another job in Sector 7 right now.
  AGENT: Understood. What time could you realistically reach Northgate?
  HUMAN: Give me about forty minutes.
  AGENT: Logging you as confirmed with an ETA of forty minutes.
  [state] extracting
  [state] completed
[decide] verify — next_action="SCHEDULE_VERIFICATION_CALL", confidence=0.92 (high)
  [queue] verification call scheduled for T+45min
```

Structured result:

```json
{
  "responder_available": "conditional",
  "eta_minutes": 40,
  "acknowledged_severity": true,
  "requires_backup": false,
  "verbatim_commitment": "Give me about forty minutes.",
  "next_action": "SCHEDULE_VERIFICATION_CALL"
}
```

**The point:** "I'm on another job" is not accepted as a final no. The agent asks for the earliest realistic ETA, checks 40 against the 90-minute window, confirms the commitment back, and schedules its own verification call. A notification would have produced none of that.

---

## 2. Refusal all the way down — the ladder

**Scenario:** `hard_refusal`

Nobody can attend. The agent works the ladder without a human touching it.

```
  [responder] rung 1: Rajesh Sharma (Refrigeration Technician)
[escalate] rung_1_to_2 — Advancing from rung 1 to 2
  [responder] rung 2: Priya Nair (Refrigeration Technician)
[escalate] rung_2_to_3 — Advancing from rung 2 to 3
  [responder] rung 3: Anil Kulkarni (Shift Supervisor)
[escalate] ladder_exhausted — Rung cap reached (3/3) — routing to unresolved.
  [ALERT] Escalation ladder exhausted after 3 rung(s).
          Attempted responders: R-001, R-002, R-003.
```

Note the framing changes at each rung — rung 2 conveys that time has been lost, rung 3 tells a supervisor the incident is **unassigned**. The alert names everyone tried, so the manager picking it up knows what has already been attempted.

---

## 3. Nobody answers

**Scenario:** `no_answer`

```
  [state] queued
  [state] dialling
  [state] no_answer
[decide] escalate — confidence is below 0.7, but escalating is fail-safe
         so the ladder advances rather than parking for an operator.
```

**The point:** an unanswered call has confidence `0.0` because nobody spoke. A naive implementation gates every branch on confidence and sends this to human review — stranding the incident at 2 AM, precisely when no operator is on shift. The confidence gate blocks *closing*, never *trying the next person*.

---

## 4. A commitment that misses the deadline

**Scenario:** `late_eta`

The technician commits, but to 120 minutes against a 90-minute safe window.

```
[decide] verify — next_action="SCHEDULE_VERIFICATION_CALL", confidence=0.88
  [queue] verification call scheduled for T+125min
  [backup] arranging — ETA 120min exceeds the 90min safe window.
```

**The point:** the commitment is accepted *and* a backup is arranged in parallel. The responder said `requires_backup: false` — "no, I'll make it" — and the agent overrode that with arithmetic. A late technician beats no technician, but you must not discover the shortfall at T+ETA when it is too late to act.

An ETA that could not be extracted at all is treated the same way: you cannot prove a commitment is safe, so do not assume it.

---

## 5. A vague answer

**Scenario:** `ambiguous`

The respondent says "soon", then will not commit to a number even after one direct follow-up.

```
[decide] human_review — Confidence score 0.55 is below threshold 0.7
         and "HUMAN_REVIEW" would close the incident. → human_review
  [review] parked — Low confidence (0.55) — extraction was ambiguous.
```

The agent asks **once** for a specific number of minutes. If the answer is still vague, it stops rather than badgering someone, and hands the incident to a person with the transcript and the confidence score attached.

---

## 6. The wrong person picks up

**Scenario:** `wrong_person`

```
[decide] escalate
```

The agent asks only whether the named responder is reachable at that number. It discloses **no incident details** — not the asset, not the fault, not the severity — then ends the call and escalates. Someone who answered a colleague's phone has not consented to hear operational information.

---

## 7. The kill switch

```ts
await runEscalationAgent(context, { ...deps, isKillSwitchActive: async () => true });
```

```
[execute_call] kill_switch_active — Outbound calling is halted by the global kill switch.
```

Zero calls placed. The switch is checked immediately before **every** dial, on every rung — not once per incident.

It **fails closed**: if the check throws, or you never supplied one, the agent refuses to dial.

```ts
// Both of these result in zero calls:
{ isKillSwitchActive: undefined }
{ isKillSwitchActive: async () => { throw new Error("redis down"); } }
```

A safety control that degrades to "allow" when it breaks is not a safety control.

---

## 8. Validating a prompt without spending a call

```ts
import { planEscalationCall } from "./scripts/plan_call.ts";

const report = await planEscalationCall(ctx, mcpTransport);
console.log(report.issues);
```

```json
[
  {
    "severity": "error",
    "message": "Task prompt contains the literal \"undefined\" — a context field did not render."
  }
]
```

A new CALL-E account has 20 free calls. Burning one to discover that a roster field was missing is the most expensive possible way to find a typo. Run this on every prompt change.

---

## Adapting these to your domain

Nothing above is cold-chain specific. Swap two things:

1. **The trigger** — anything producing `{severity, safeWindowMinutes, consequence}`: a sensor, a webhook, a queue depth, a failed nightly job.
2. **The roster** — see `../assets/sample-roster.json` for the shape.

Keep `result-schema.json` as-is. It is what makes the output branchable rather than prose you have to parse.
