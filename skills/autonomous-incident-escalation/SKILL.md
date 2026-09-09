---
name: autonomous-incident-escalation
description: Phone a human when a system fails, negotiate a concrete commitment, and escalate to the next responder when refused. Use when an alert needs a confirmed human ETA rather than another ignored notification — on-call escalation, field dispatch, cold-chain and equipment failures, SLA response. Places REAL outbound calls via CALL-E; read the Side effects section before running.
---

# Autonomous Incident Escalation

Turn an alert into a **confirmed human commitment**.

A notification is a broadcast with no guaranteed receipt. This skill phones the right person, holds a real conversation, refuses to accept a vague "I'll get to it", negotiates a numeric ETA, and moves down an escalation ladder when someone declines or does not answer — returning a typed, confidence-scored result a workflow can branch on.

```
Signal → Decide → Call → Negotiate → Structured commitment → Escalate or close
```

## When to use this

Use it when **the answer must come from a specific human, and you need proof they committed**:

- On-call escalation where a page went unacknowledged
- Field-service dispatch needing an ETA, not an acknowledgement
- Cold-chain / equipment failure with a hard consequence deadline
- Any workflow that currently ends in "…and then someone phones them"

Do **not** use it for broadcast notifications, marketing calls, or anything where a message with no reply is acceptable. It dials real people.

## Setup

```bash
pnpm add @call-e/calle

export CALLE_API_KEY="..."                    # dashboard.heycall-e.com/account/api-keys
export CALLE_BASE_URL="https://api.heycall-e.com"

export CALLE_USE_MOCK=true                    # develop against the mock driver first
```

Optional MCP server for free dry runs:

```jsonc
{ "mcpServers": { "calle": {
  "type": "http",
  "url": "https://seleven-mcp-sg.airudder.com/mcp/openagent_oauth"
} } }
```

You supply two things: a **roster** of consented responders (`assets/sample-roster.json`) and an **incident context**. Everything else is in this skill.

## Usage

### 1. Validate the plan without spending a call

```ts
import { planEscalationCall } from "./scripts/plan_call.ts";

const report = await planEscalationCall(ctx, mcpTransport);
if (!report.ok) throw new Error(JSON.stringify(report.issues));
```

`plan_call` is a dry run. It costs nothing, and it catches the failures that
actually happen: an unrendered template hole reaching a technician, a prompt
long enough to blow the 90-second ceiling, a missing self-identification.
**Iterate the prompt here, not on live calls.**

### 2. Place the escalation call

```ts
import { runEscalation } from "./scripts/run_escalation.ts";

const outcome = await runEscalation({
  incident: {
    assetId: "CS-04",
    assetType: "cold-storage",
    location: "Zone A",
    metric: "temperature_c",
    value: 12.4,
    unit: "C",
    threshold: 8,
    severity: "CRITICAL",
    safeWindowMinutes: 90,
    consequence: "inventory is at risk",
  },
  facility: { id: "northgate", name: "Northgate Facility", timezone: "Asia/Kolkata" },
  roster: require("./assets/sample-roster.json"),
  requiredSkill: "refrigeration",
  requiredZone: "Zone A",
  isKillSwitchActive: async () => false,
});
```

### 3. Branch on the typed result

```jsonc
{
  "responder_available": "conditional",
  "eta_minutes": 40,
  "acknowledged_severity": true,
  "requires_backup": false,
  "verbatim_commitment": "Give me about forty minutes.",
  "next_action": "SCHEDULE_VERIFICATION_CALL"
}
```

Full contract: `references/result-schema.json`.

## How it decides

Routing is **deterministic code, not a second LLM call**. The model already did its job inside the conversation; branching on its output must be predictable and testable.

| Signal | Behaviour |
|---|---|
| `next_action` | Selects the branch |
| `completionConfidence < 0.7` | Blocks **closing** actions → human review |
| `completionConfidence < 0.7` + `ESCALATE_NEXT_RUNG` | Still escalates — see below |
| `eta_minutes > safe_window` | Commitment accepted **and** a backup arranged |
| Rung ≥ max, or call cap hit | Terminates UNRESOLVED with a loud alert |

**Why low confidence still escalates.** An unanswered call has confidence 0.0 by construction — nobody spoke. Parking that for an operator strands the incident at 2 AM, exactly when no operator is on shift. Escalating on a weak signal is fail-safe; closing on one is not. So confidence gates *closing*, never *trying the next human*.

See `references/escalation-ladder.md` and `references/failure-taxonomy.md`.

## Adapting it to your domain

The escalation engine is domain-independent. To reuse it:

1. **Swap the trigger** — anything that produces `{severity, safeWindowMinutes, consequence}` works: a sensor, a webhook, a queue depth, a failed job.
2. **Swap the roster** — `assets/sample-roster.json` shape: skills, shift window, zone, ladder priority, consent timestamp.
3. **Keep the schema** — `references/result-schema.json` is what makes the output branchable. Changing it means rewriting your decision logic.

Nothing above the roster and trigger is cold-chain specific.

## Side effects

**This skill places real outbound phone calls to real people.** Running it will:

- **Ring a human's phone**, potentially at night — CRITICAL severity overrides quiet hours by design
- **Consume CALL-E call credits** (new accounts start with 20)
- **Create permanent audit records** — transcript, evidence, confidence, structured result

Safeguards, all enforced in code rather than in the prompt:

| Control | Behaviour |
|---|---|
| Consented roster | Only pre-registered numbers, ever. No exceptions path exists. |
| Self-identification | Every call opens by stating it is an automated line. Never remove this. |
| Third-party protection | If the wrong person answers, incident details are withheld and the call ends. |
| Quiet hours | Enforced per facility; only CRITICAL overrides. |
| Call cap | Default 5 calls per incident, independent of the rung cap. |
| Rung cap | Default 3. |
| Per-responder cooldown | A person is not re-called inside their cooldown window. |
| Duration ceiling | 180s hard timeout per call; never retried. |
| Kill switch | Checked before **every** dial. **Fails closed.** |

Full detail: `references/safety.md`.

## Cancellation

- **Stop all future calls:** activate the kill switch. It is checked immediately before every dial, on every rung. If the check throws — or was never wired up — the agent refuses to dial.
- **Stop calling one person:** remove them from the roster. They will not be selected again.
- **A call already in progress** cannot be cancelled from here; it ends when CALL-E ends it or the 180s ceiling trips.

There is no configuration, prompt, or model output that can raise a cap or bypass the kill switch. If you find one, that is a bug.

## Files

```
references/
  safety.md               consent, side effects, cancellation
  examples.md             worked runs: hero path, ladder, kill switch, failures
  result-schema.json      the typed extraction contract
  escalation-ladder.md    rung design + urgency adaptation
  failure-taxonomy.md     14 failure modes and the agent's response to each
scripts/
  build_task_prompt.ts    dynamic, rung-aware prompt composition
  plan_call.ts            free dry-run validation (MCP plan_call)
  run_escalation.ts       runnable end-to-end example
assets/
  sample-roster.json      roster shape, with consent fields
```
