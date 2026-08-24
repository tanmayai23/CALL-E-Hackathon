# Product Requirements Document — SENTINEL OPS

**CALL-E Hackathon: "Your Code Is Calling"**

| Field | Value |
|---|---|
| Product name | **Sentinel Ops** — The Autonomous Escalation Agent |
| Version | v1.0 (Hackathon Build) |
| Owner | Tanmay Kala (Technical Lead) |
| Team | Tanmay, Aryan, Sameer, Soham, Vishal |
| Deadline | **Sep 14, 2026 @ 9:15 PM IST** |
| Target prize | Most Practical Use Case ($4,000) + Most Valuable Feedback ($200) |
| Doc status | Locked for build. Scope changes require lead approval. |

---

## 0. TL;DR (Read this if you read nothing else)

Machines, systems and services fail at 2 AM. Dashboards light up red. Slack notifications get ignored. **Nobody picks up a dashboard.**

Sentinel Ops watches real signals (IoT sensors, system webhooks, business thresholds), decides when a failure genuinely requires a human, then **autonomously phones the right human through CALL-E**, holds a real conversation, negotiates an ETA, escalates to the next person if the first one declines, and writes the confirmed outcome back into the system as structured data.

**One sentence for judges:**
> "We don't just detect problems — we autonomously coordinate the humans required to solve them."

**Why CALL-E is irreplaceable here:** a notification is a broadcast with no guaranteed receipt. A phone call is the only channel that produces a *confirmed, negotiated, human commitment* — and CALL-E is what turns that commitment into structured data our workflow can act on.

---

## 1. Problem Statement

### 1.1 The real, specific problem

In field operations, facility management, and industrial maintenance, the failure is not detection. Detection is solved — every plant, clinic, and fleet already has sensors and dashboards.

**The failure is the human coordination gap between "alert fired" and "technician confirmed en route."**

Today that gap is filled by a human operator who:

1. Sees the alert on a dashboard.
2. Decides whether it is real or noise.
3. Opens a contact sheet and finds the on-call technician.
4. Calls them. No answer.
5. Calls the second technician. They are on another job.
6. Negotiates: "Can you be there by 4 PM?"
7. Writes the outcome into a ticket by hand.
8. Repeats this 15–40 times a day.

Steps 3–7 take **8–25 minutes per incident** and are pure phone labour. At night and on weekends, this role is often unstaffed entirely — so critical alerts sit unacknowledged for hours.

### 1.2 Why existing tools do not solve it

| Approach | Why it fails |
|---|---|
| Push notification / SMS | Fire-and-forget. No receipt, no negotiation, no ETA. Ignored at night. |
| PagerDuty-style escalation | Escalates *notifications*, not conversations. Still requires the human to call back and a human to coordinate. |
| Chatbot / AI text assistant | Technicians in the field are driving, gloved, or on a factory floor. They do not read chat. |
| Human call centre | Expensive, does not scale to 24/7, high attrition, inconsistent data capture. |

**The channel that actually reaches a field technician is a phone call. That channel was previously un-automatable. CALL-E makes it programmable.**

### 1.3 Quantified pain

| Metric | Current state (baseline for demo) |
|---|---|
| Time from alert to confirmed human commitment | 8–25 min (staffed) / 2–9 hrs (unstaffed nights) |
| Operator phone-labour per incident | ~12 min average |
| Incidents per mid-size facility per day | 15–40 |
| Daily operator hours lost to coordination calls | **3–8 hours** |
| Alerts that never receive a confirmed human ack | 20–35% |

---

## 2. Product Vision

Sentinel Ops is the **autonomous operations layer that closes the loop between a machine problem and a human commitment.**

```
Signal → Reasoning → Decision → Real Phone Call → Negotiation → Structured Commitment → System Update
```

The product is not "an AI that makes calls." The product is **a closed-loop escalation engine** where the phone call is one instrumented step inside a reliable, auditable workflow.

---

## 3. Hackathon Alignment (Explicit Judging Criteria Mapping)

The four official criteria are **equally weighted at 25% each**. Every requirement in this PRD is traceable to one of them.

### 3.1 Real World Impact (25%)

| Requirement | How we satisfy it |
|---|---|
| Specific phone-work problem | Named, quantified: the alert→technician-commitment coordination gap (§1) |
| Credible case it solves for real users | Live measured demo: 12 min human labour → 90 sec autonomous (§6) |
| Worth building further after hackathon | Vertical-agnostic trigger layer; roadmap in §22; usable by any ops team with an alerting system |
| Not a generic "AI that makes phone calls" | The call is triggered by a real physical/system event and produces a state change in a real workflow |

### 3.2 Quality of the Idea (25%)

| Requirement | How we satisfy it |
|---|---|
| Creative, non-obvious use of CALL-E | Most entrants will build outbound sales/booking. We build **event-driven autonomous escalation with multi-party fallback** — the agent decides *who* to call and *what to do when refused*. |
| Genuine understanding of problem space | Full failure taxonomy (§9): no-answer, refusal, ambiguity, callback, wrong-person, drop, voicemail, gatekeeper |
| Clear, well-scoped contribution | Ships as a reusable **Agent Skill** + **App**, both PR'd to `awesome-phone-call-agents` (§17) |
| Reusable by the community | The escalation skill is domain-independent — swap the trigger source and contact roster, reuse everything else |

### 3.3 Technical Implementation (25%)

| Requirement | How we satisfy it |
|---|---|
| CALL-E imported and called at runtime | `@call-e/calle` SDK, `client.calls.createAndWait()` with a `resultSchema`, plus MCP `plan_call`/`run_call`/`get_call_run` (§7) |
| Thorough and skilful use | We use `resultSchema` for typed extraction, `completionConfidence` for routing decisions, and `evidence` for the audit trail — not just "dial a number" |
| Non-trivial working implementation | LangGraph state machine, escalation ladder, idempotent webhooks, trace IDs, retry policy |
| Genuine effort in the code | Typed contracts, DB persistence, real-time streaming, test suite, deployed URL |

### 3.4 Product Experience & Demo (25%)

| Requirement | How we satisfy it |
|---|---|
| Complete, coherent experience | Trigger → Decide → Call → Negotiate → Resolve → Audit, all visible in one dashboard |
| Demo clearly communicates what and why | Scripted 3-minute video (§18), problem-first, with a real audible phone call as the centrepiece |

---

## 4. Primary Use Case (Locked Scope)

### 4.1 The hero scenario — Cold-chain / critical equipment failure

**Setting:** A vaccine cold-storage unit (or industrial chiller) in a facility.

**Trigger:** Temperature sensor crosses threshold — reading 12.4°C against a safe ceiling of 8°C, and rising. Compressor current draw is abnormal.

**What Sentinel Ops does autonomously:**

1. **Ingests** the sensor event via MQTT/webhook.
2. **Correlates** — is this a spike or a sustained trend? Checks the last 15 readings. Suppresses if it self-corrects.
3. **Classifies severity** — CRITICAL: perishable inventory at risk, ~90 min until spoilage.
4. **Selects the responder** — queries the on-call roster for a refrigeration technician who is on shift and within the service zone.
5. **Plans the call** — builds objective, must-ask questions, fallback branches, and stop conditions.
6. **Calls via CALL-E** — real outbound phone call.
7. **Converses and negotiates:**
   > *Agent:* "This is the automated operations line for Northgate Facility. Cold storage unit CS-04 has crossed its critical temperature threshold — it is at 12.4 degrees and rising, with roughly 90 minutes before inventory is at risk. Are you available to attend?"
   > *Technician:* "I'm on another job in Sector 7 right now."
   > *Agent:* "Understood. What time could you realistically reach Northgate?"
   > *Technician:* "Give me about forty minutes."
   > *Agent:* "Forty minutes puts you inside the safe window. I'm logging you as confirmed with an ETA of 40 minutes. Should I arrange a backup in case you're delayed?"
   > *Technician:* "No, I'll make it."
8. **Extracts structured data** via CALL-E's `resultSchema`.
9. **Decides** — ETA (40 min) is inside the safety window (90 min) → accept, close escalation.
10. **Acts** — updates incident state, notifies the facility manager, schedules a verification call for T+45 min.

**If the technician had refused or been unreachable**, the agent escalates down the ladder to Technician B, then to the Supervisor, adjusting the script's urgency at each rung — all without a human touching it.

### 4.2 Structured output the call produces

```json
{
  "responder_available": "conditional",
  "eta_minutes": 40,
  "eta_within_safe_window": true,
  "acknowledged_severity": true,
  "requires_backup": false,
  "requires_parts": false,
  "verbatim_commitment": "Give me about forty minutes.",
  "next_action": "SCHEDULE_VERIFICATION_CALL",
  "escalation_resolved": true
}
```

### 4.3 Why this scenario wins

- **Visceral stakes** — spoiled vaccines is a story a judge remembers.
- **The call is unavoidable** — you cannot text someone into a commitment at 2 AM.
- **Negotiation is visible** — the agent handles a "no" live on camera. This is the moment that separates us from a scripted robocall.
- **Demonstrably measurable** — 12 minutes of human labour → 90 seconds autonomous.

### 4.4 Secondary demo scenario (backup, if primary call fails live)

**Supplier dispatch follow-up** — same engine, different trigger: an ERP order flag instead of a sensor. Proves the trigger layer is pluggable. Keep one pre-recorded successful run of each scenario as demo insurance.

---

## 5. Target Users

| Persona | Role | Pain | Why they pay |
|---|---|---|---|
| **Primary: Ops / Facility Manager** | Runs a mid-size facility, 15–40 alerts/day | Spends 3–8 hrs/day on coordination calls | Recovers a full-time-equivalent of labour |
| **Secondary: NOC / Control-room operator** | Monitors dashboards on shift | Night shifts unstaffed; alerts go stale | 24/7 coverage without 24/7 staffing |
| **Tertiary: Field-service company owner** | Dispatches technicians to client sites | Manual dispatch, no ETA accountability | Faster response = SLA compliance |
| **Buyer** | Operations Director / Plant Head | SLA penalties, spoilage cost, overtime | Direct, quantifiable cost avoidance |

---

## 6. Success Metrics

### 6.1 Product metrics (must be provable in the demo)

| Metric | Target | How measured |
|---|---|---|
| Alert → confirmed human commitment | **< 3 minutes** | Timestamp delta, displayed live in UI |
| Human labour per incident | **0 minutes** (from ~12) | Operator touches nothing in happy path |
| Structured extraction accuracy | **> 90%** on required fields | Manual scoring across ≥ 20 test calls |
| Escalation ladder success rate | **> 80%** reach a confirmed commitment within 3 rungs | Test-run log |
| False-escalation (noise) rate | **< 10%** | Correlation-layer suppression log |

### 6.2 Demo metrics

| Metric | Target |
|---|---|
| Full flow completes without manual intervention | 100% of rehearsed runs |
| Time from trigger to visible dashboard update | < 5 s |
| Demo video length | 2:45–3:00 |

### 6.3 Anti-metrics (things we deliberately do NOT optimise)

- Number of integrations. Number of AI models used. Lines of code. Feature count.
- **Rationale:** judges reward one thing done excellently over many things done shallowly.

---

## 7. CALL-E Integration Specification (The Technical Core)

> This is the single most heavily-weighted technical section. CALL-E must be **imported and called at runtime**, and used *skilfully*, not superficially.

### 7.1 Verified platform surface

| Item | Value |
|---|---|
| TypeScript SDK | `pnpm add @call-e/calle` |
| Python SDK | `pip install calle-ai` |
| Base URL | `https://api.heycall-e.com` |
| Auth env vars | `CALLE_API_KEY`, `CALLE_BASE_URL` |
| API keys | `https://dashboard.heycall-e.com/account/api-keys` |
| CLI | `npm install -g @call-e/cli` → `calle auth login`, `calle auth status` |
| MCP transport | Streamable HTTP, OAuth |
| MCP tools | `plan_call`, `run_call`, `get_call_run` |
| Skill install | `npx -y skills add https://github.com/CALLE-AI/call-e-integrations --skill calle -g` |
| Free calls | 20 per new account; more via the official request form |

### 7.2 Client initialisation

```typescript
// packages/calle/client.ts
import { CalleClient } from "@call-e/calle";

export const calle = new CalleClient({
  apiKey: process.env.CALLE_API_KEY!,
});
```

### 7.3 The escalation call — full runtime usage

We use **four** CALL-E capabilities deliberately. This depth is what scores on "thoroughly and skilfully."

| CALL-E capability | How Sentinel Ops uses it |
|---|---|
| `task` | Dynamically composed from incident severity, responder role, and escalation rung — never a static string |
| `resultSchema` | Enforces typed extraction so the workflow can branch on real data, not on parsed prose |
| `completionConfidence` | Below 0.7 → route to human review instead of auto-closing. **Confidence drives control flow.** |
| `evidence` | Persisted verbatim into the audit trail so every automated decision is defensible |

```typescript
// services/agent/nodes/executeCall.ts
import { calle } from "@/packages/calle/client";
import { ESCALATION_RESULT_SCHEMA } from "./schema";

export async function executeEscalationCall(ctx: EscalationContext) {
  const call = await calle.calls.createAndWait({
    task: buildTaskPrompt(ctx),          // severity + responder + rung aware
    resultSchema: ESCALATION_RESULT_SCHEMA,
  });

  await persistCallArtifacts({
    incidentId: ctx.incidentId,
    traceId: ctx.traceId,
    rung: ctx.escalationRung,
    status: call.status,
    taskCompleted: call.taskCompleted,
    confidence: call.completionConfidence,   // { score, label }
    evidence: call.evidence,                 // string[] — audit trail
    structured: call.structuredResult,
  });

  return call;
}
```

**Example CALL-E response shape** (from the official quickstart):

```json
{
  "status": "completed",
  "taskCompleted": true,
  "completionConfidence": { "score": 0.92, "label": "high" },
  "evidence": ["The recipient clearly answered yes."],
  "structuredResult": { "can_hear_clearly": "yes" }
}
```

### 7.4 The result schema (typed extraction contract)

```typescript
export const ESCALATION_RESULT_SCHEMA = {
  type: "object",
  required: ["responder_available", "acknowledged_severity", "next_action"],
  properties: {
    responder_available: {
      type: "string",
      enum: ["yes", "no", "conditional", "unknown"],
      description: "Whether the responder committed to attending the incident.",
    },
    eta_minutes: {
      type: "number",
      description: "Minutes until the responder can arrive on site. Null if not committed.",
    },
    acknowledged_severity: {
      type: "boolean",
      description: "Did the responder verbally acknowledge the severity level stated?",
    },
    requires_backup: {
      type: "boolean",
      description: "Did the responder request that a backup technician be arranged?",
    },
    requires_parts: {
      type: "boolean",
      description: "Did the responder indicate replacement parts are needed?",
    },
    decline_reason: {
      type: "string",
      enum: ["on_another_job", "off_shift", "out_of_zone", "not_qualified", "no_reason", "none"],
    },
    callback_requested_at: {
      type: "string",
      description: "ISO-8601 time if the responder asked to be called back later.",
    },
    verbatim_commitment: {
      type: "string",
      description: "The responder's exact words committing to or declining the task.",
    },
    next_action: {
      type: "string",
      enum: [
        "CLOSE_RESOLVED",
        "ESCALATE_NEXT_RUNG",
        "SCHEDULE_VERIFICATION_CALL",
        "SCHEDULE_CALLBACK",
        "HUMAN_REVIEW",
      ],
    },
  },
} as const;
```

### 7.5 Dynamic task prompt construction

The `task` string is **generated per call**, adapting tone and content to the escalation rung. This is a core differentiator — a static prompt is a robocall; a composed prompt is an agent.

```typescript
export function buildTaskPrompt(ctx: EscalationContext): string {
  const urgency = {
    1: "Be professional and concise.",
    2: "The primary responder was unavailable. Convey elevated urgency.",
    3: "Two responders have already been unreachable. This is now a supervisor escalation — state clearly that the incident is unassigned.",
  }[ctx.escalationRung];

  return `
Call ${ctx.responder.phoneE164} — this is ${ctx.responder.name}, a ${ctx.responder.role}.

You are the automated operations line for ${ctx.facility.name}. ${urgency}

INCIDENT
  Asset:      ${ctx.asset.id} (${ctx.asset.type}), located at ${ctx.asset.location}
  Condition:  ${ctx.reading.metric} is ${ctx.reading.value}${ctx.reading.unit}, threshold ${ctx.reading.threshold}${ctx.reading.unit}
  Severity:   ${ctx.severity}
  Time window: approximately ${ctx.safeWindowMinutes} minutes before ${ctx.consequence}

OBJECTIVE
  Obtain a clear commitment on whether they can attend, and a concrete ETA in minutes.

MUST ASK
  1. Are you available to attend this incident?
  2. If not available now — what is the earliest realistic time you could reach the site?
  3. Do you need a backup technician or any replacement parts?

CONVERSATION RULES
  - Open by identifying yourself as an automated operations line. Never imply you are human.
  - If they say they are busy, do NOT accept that as a final no — ask for the earliest realistic ETA.
  - If they give a vague answer such as "soon" or "later", ask once for a specific number of minutes.
  - If the stated ETA exceeds ${ctx.safeWindowMinutes} minutes, tell them that is outside the safe window and ask whether a backup should be arranged.
  - If a person other than ${ctx.responder.name} answers, ask whether ${ctx.responder.name} is reachable at this number. Do not deliver incident details to an unidentified third party.
  - If you reach voicemail, leave a short message with the asset ID and a callback number, then end the call.
  - Keep the call under 90 seconds. Do not repeat the incident details more than twice.

STOP CONDITIONS
  - A clear yes with an ETA → confirm it back to them and end.
  - A clear no with a reason → thank them and end.
  - Two consecutive non-answers to the same question → end and mark for human review.
`.trim();
}
```

### 7.6 MCP integration (second, independent integration path)

Beyond the SDK, Sentinel Ops registers CALL-E's MCP server so the LangGraph planner can invoke `plan_call` for pre-flight rehearsal before committing a real call. **This directly conserves our 20 free calls** and demonstrates two distinct CALL-E surfaces.

```jsonc
// .mcp.json
{
  "mcpServers": {
    "calle": {
      "type": "http",
      "url": "https://seleven-mcp-sg.airudder.com/mcp/openagent_oauth"
    }
  }
}
```

| MCP tool | Role in our system |
|---|---|
| `plan_call` | Dry-run the composed task prompt, validate structure, **without spending a call** |
| `run_call` | Execute the live escalation call |
| `get_call_run` | Poll status for the live dashboard timeline and post-hoc audit |

### 7.7 Call budget policy (20 free calls — treat as a hard constraint)

| Phase | Budget | Purpose |
|---|---|---|
| P1 — Connectivity | 2 | Prove auth + one live call end-to-end |
| P2 — Conversation quality | 4 | Tune the task prompt, verify negotiation behaviour |
| P3 — Edge cases | 5 | No-answer, refusal, voicemail, ambiguity, callback |
| P4 — Escalation ladder | 3 | Full multi-rung fallback chain |
| P5 — Demo rehearsal | 3 | Full-flow dry runs |
| P6 — Final recording | 3 | Reserve. **Never touch before recording day.** |

**Rules:** use MCP `plan_call` for all prompt iteration. Never burn a live call to test a code path that a mock can prove. Request additional calls via the official form on **Day 2** — not on Day 18. Log every call in the CALL-E Testing Log (§19).

---

## 8. Functional Requirements

Traceability: every FR maps to a judging criterion. `[RWI]` Real World Impact · `[QOI]` Quality of Idea · `[TI]` Technical Implementation · `[PXD]` Product Experience & Demo.

### FR-1 — Signal Ingestion `[RWI][TI]`

| # | Requirement | Priority |
|---|---|---|
| 1.1 | Accept IoT telemetry over MQTT (topic `sentinel/{facility}/{asset}/telemetry`) | P0 |
| 1.2 | Accept generic events over authenticated HTTP webhook `POST /api/v1/signals` | P0 |
| 1.3 | Provide a deterministic simulator that replays realistic sensor curves (normal → degrading → critical) | P0 |
| 1.4 | Persist every raw signal with `received_at`, `source`, `trace_id` | P0 |
| 1.5 | Support ERP/business triggers (order flags) via the same webhook contract | P1 |
| 1.6 | Reject malformed payloads with typed validation errors; never crash the ingest loop | P0 |

> **Design note:** the simulator is a *first-class product feature*, not a shortcut. It gives judges a reproducible, on-demand trigger and removes hardware from the critical path of a live demo. Physical ESP32 hardware is optional garnish (§14.2).

### FR-2 — Correlation & Noise Suppression `[QOI][TI]`

| # | Requirement | Priority |
|---|---|---|
| 2.1 | Evaluate a rolling window (last N readings) before declaring an incident | P0 |
| 2.2 | Suppress transient spikes that self-correct within the window | P0 |
| 2.3 | Deduplicate — one open incident per asset; new signals enrich, not duplicate | P0 |
| 2.4 | Classify severity: INFO / WARNING / CRITICAL, from threshold delta + rate of change | P0 |
| 2.5 | Compute `safe_window_minutes` — time until real-world consequence | P0 |
| 2.6 | Log every suppression decision with its reason (judge-visible proof we aren't call-spamming) | P1 |

> **Why this matters for judging:** it proves we understand the domain. A naive build calls on every threshold cross. Suppression is the difference between a product and a demo.

### FR-3 — Responder Selection `[RWI][TI]`

| # | Requirement | Priority |
|---|---|---|
| 3.1 | Maintain a contact roster: name, role, skills, phone (E.164), shift window, service zone | P0 |
| 3.2 | Select responder by required skill ∩ on-shift ∩ zone match | P0 |
| 3.3 | Maintain an ordered escalation ladder per incident type (Primary → Secondary → Supervisor) | P0 |
| 3.4 | Respect per-responder cooldown — never re-call the same person within N minutes | P1 |
| 3.5 | Support explicit manual override of the selected responder from the UI | P1 |

### FR-4 — Call Planning `[QOI][TI]`

| # | Requirement | Priority |
|---|---|---|
| 4.1 | Generate the CALL-E `task` prompt dynamically from incident + responder + rung | P0 |
| 4.2 | Include must-ask questions, conversation rules, and stop conditions in every plan | P0 |
| 4.3 | Surface the generated plan in the UI **before** dialling, with a human-readable summary | P0 |
| 4.4 | Optionally validate the plan via MCP `plan_call` before spending a live call | P1 |
| 4.5 | Adapt urgency language per escalation rung | P0 |

### FR-5 — CALL-E Execution `[TI][PXD]`

| # | Requirement | Priority |
|---|---|---|
| 5.1 | Place the call via `@call-e/calle` at runtime with the composed task + result schema | P0 |
| 5.2 | Stream live call state to the dashboard: queued → dialling → connected → in-conversation → completed/failed | P0 |
| 5.3 | Persist `status`, `taskCompleted`, `completionConfidence`, `evidence`, `structuredResult` | P0 |
| 5.4 | Enforce a hard call-duration ceiling and handle timeouts | P0 |
| 5.5 | Tag every call with the incident `trace_id` for end-to-end tracing | P0 |
| 5.6 | Provide a mock CALL-E driver for development that satisfies the identical interface | P0 |

> **FR-5.6 rationale:** the mock driver exists so 5 developers can build in parallel against a stable contract without burning the 20-call budget. **It is a dev harness, never the demo path.** The recorded demo and the deployed app both run the real SDK.

### FR-6 — Structured Extraction & Decisioning `[TI][RWI]`

| # | Requirement | Priority |
|---|---|---|
| 6.1 | Enforce extraction through CALL-E `resultSchema` (typed, not prose parsing) | P0 |
| 6.2 | Branch workflow on `next_action` from the structured result | P0 |
| 6.3 | Route to human review when `completionConfidence.score < 0.7` | P0 |
| 6.4 | Validate ETA against `safe_window_minutes`; auto-arrange backup when outside it | P0 |
| 6.5 | Display confidence and evidence beside every extracted field | P0 |
| 6.6 | Allow operator correction of any extracted field before final commit | P1 |

### FR-7 — Escalation Ladder `[QOI][RWI]`

| # | Requirement | Priority |
|---|---|---|
| 7.1 | On no-answer/refusal, automatically advance to the next rung | P0 |
| 7.2 | Increase urgency framing at each rung | P0 |
| 7.3 | Cap total rungs (default 3) and total calls per incident | P0 |
| 7.4 | On ladder exhaustion, mark UNRESOLVED and raise a prominent human-intervention alert | P0 |
| 7.5 | Honour callback requests by scheduling a retry at the requested time | P1 |
| 7.6 | Schedule a verification call at T+ETA to confirm the responder actually arrived | P1 |

> **FR-7.6 is a signature feature.** Closing the loop *twice* — commitment, then verification — is what makes this an operations system rather than a dialer.

### FR-8 — Outcome Automation `[RWI]`

| # | Requirement | Priority |
|---|---|---|
| 8.1 | Write the confirmed outcome to the incident record | P0 |
| 8.2 | Notify the facility manager on resolution or ladder exhaustion | P0 |
| 8.3 | Emit an outbound webhook so external systems can subscribe | P1 |
| 8.4 | Compute and display time-saved per incident vs. the manual baseline | P0 |

### FR-9 — Audit & History `[TI][PXD]`

| # | Requirement | Priority |
|---|---|---|
| 9.1 | Full incident timeline: signal → suppression → severity → responder → plan → call → extraction → decision → outcome | P0 |
| 9.2 | Store transcript, evidence, confidence, and structured result per call | P0 |
| 9.3 | One-click replay of any historical incident for demo purposes | P0 |
| 9.4 | Filter history by asset, severity, outcome, responder | P1 |
| 9.5 | Export incident audit as JSON | P2 |

### FR-10 — Safety & Consent `[QOI]`

| # | Requirement | Priority |
|---|---|---|
| 10.1 | The agent identifies itself as an automated line at the start of every call | P0 |
| 10.2 | Only call numbers on the pre-registered, consented roster | P0 |
| 10.3 | Enforce quiet-hours policy with an explicit CRITICAL-severity override | P0 |
| 10.4 | Hard rate limit: max calls per responder per hour, max calls per incident | P0 |
| 10.5 | Global kill switch that halts all outbound calling immediately | P0 |
| 10.6 | Never disclose incident details to an unverified third party who answers | P0 |
| 10.7 | Ship `SAFETY.md` documenting consent, side effects, and cancellation | P0 |

> **FR-10 is a scoring requirement, not boilerplate.** The target repo has a dedicated **Safety Patterns** contribution area, and the contribution guidelines explicitly require "setup, usage, side-effect, and cancellation notes." Real-world side effects — this system dials real humans at night — must be documented to be credible.

---

## 9. Failure Taxonomy (Vishal + Sameer own this)

A toy demo handles the happy path. This table is what makes it a product — and it is exactly the depth judges probe in Q&A.

| # | Failure | Detection | Agent behaviour | Recorded outcome |
|---|---|---|---|---|
| F1 | No answer | Call status = no-answer | Advance to next rung immediately | `ESCALATE_NEXT_RUNG` |
| F2 | Voicemail | Detected in conversation | Leave short message (asset ID + callback), end, escalate | `ESCALATE_NEXT_RUNG` + voicemail flag |
| F3 | Hard refusal | `responder_available: "no"` | Capture `decline_reason`, escalate | `ESCALATE_NEXT_RUNG` |
| F4 | Conditional / late ETA | `eta_minutes > safe_window` | Accept, but also call backup in parallel | `SCHEDULE_VERIFICATION_CALL` + backup |
| F5 | Callback requested | `callback_requested_at` present | Schedule retry; start a parallel rung if CRITICAL | `SCHEDULE_CALLBACK` |
| F6 | Ambiguous answer ("soon") | Confidence < 0.7 | Agent asks once for a specific number; if still vague → human review | `HUMAN_REVIEW` |
| F7 | Wrong person answers | Agent detects identity mismatch | Ask if responder is reachable; **withhold incident details** | Retry or escalate |
| F8 | Gatekeeper / IVR | Non-human respondent | Do not navigate menus; end and escalate | `ESCALATE_NEXT_RUNG` |
| F9 | Call drops mid-conversation | `status != completed` | Retry once; if the second attempt drops, escalate | Retry, then escalate |
| F10 | CALL-E API error / rate limit | SDK exception | Exponential backoff, 3 attempts; then human alert | System alert |
| F11 | Ladder exhausted | Rung > max | Mark UNRESOLVED, alert facility manager loudly | `UNRESOLVED` |
| F12 | Sensor goes offline | No heartbeat in window | Raise a distinct "asset unreachable" incident | Separate incident |
| F13 | Duplicate/flapping signal | Dedup + correlation layer | Suppress; enrich the existing incident | Suppression logged |
| F14 | Responder confirms but never arrives | Verification call at T+ETA | Re-escalate to next rung | `ESCALATE_NEXT_RUNG` |

---

## 10. System Architecture

```
                         ┌───────────────────────────┐
   PHYSICAL / BUSINESS   │  ESP32 sensors  ·  MQTT   │
   SIGNAL SOURCES        │  ERP webhooks   ·  Sim    │
                         └─────────────┬─────────────┘
                                       │
                                       ▼
                         ┌───────────────────────────┐
                         │   INGEST LAYER            │   FR-1
                         │   validate · normalise    │   (Vishal + Sameer)
                         │   trace_id · persist      │
                         └─────────────┬─────────────┘
                                       ▼
                         ┌───────────────────────────┐
                         │   CORRELATION ENGINE      │   FR-2
                         │   window · dedup ·        │   (Sameer)
                         │   severity · safe window  │
                         └─────────────┬─────────────┘
                                       ▼
              ╔════════════════════════════════════════════════╗
              ║        LANGGRAPH AGENT  (Aryan + Tanmay)       ║
              ║                                                ║
              ║   assess ──► select_responder ──► plan_call    ║
              ║      ▲                               │         ║
              ║      │                               ▼         ║
              ║   escalate ◄── decide ◄──── execute_call ──────╫──► CALL-E SDK
              ║      │            │                            ║    createAndWait
              ║      │            ▼                            ║    + resultSchema
              ║      │      human_review                       ║       │
              ║      ▼                                         ║       ▼
              ║   resolve ──► verify (T+ETA)                   ║   ☎ REAL CALL
              ╚════════════════════════╤═══════════════════════╝       │
                                       │                               ▼
                                       │                    ┌────────────────────┐
                                       │                    │ ElevenLabs voice   │
                                       │                    │ Sarvam (Indic)     │
                                       │◄───────────────────┤ structuredResult   │
                                       │   typed result     │ confidence·evidence│
                                       ▼                    └────────────────────┘
                         ┌───────────────────────────┐
                         │   OUTCOME ENGINE          │   FR-8
                         │   persist · notify ·      │   (Sameer)
                         │   webhook · metrics       │
                         └─────────────┬─────────────┘
                                       ▼
                         ┌───────────────────────────┐
                         │   DASHBOARD (Next.js)     │   FR-9
                         │   live ops · timeline ·   │   (Vishal + Soham)
                         │   transcript · audit      │
                         └───────────────────────────┘
```

### 10.1 LangGraph state machine

| Node | Responsibility | Exits to |
|---|---|---|
| `assess_incident` | Confirm the incident is real and CALL-worthy | `select_responder` \| `suppress` |
| `select_responder` | Pick responder for the current rung | `plan_call` \| `escalate` |
| `plan_call` | Compose the dynamic CALL-E task prompt | `execute_call` |
| `execute_call` | Invoke CALL-E SDK; persist all artifacts | `decide` |
| `decide` | Branch on `next_action` + confidence | `resolve` \| `escalate` \| `human_review` \| `schedule_callback` |
| `escalate` | Advance rung, raise urgency | `select_responder` \| `unresolved` |
| `human_review` | Park for operator decision | `resolve` \| `escalate` |
| `verify` | T+ETA confirmation call | `resolve` \| `escalate` |
| `resolve` | Close, notify, compute time saved | END |
| `unresolved` | Ladder exhausted, loud alert | END |

**Persisted state:** `incident_id`, `trace_id`, `severity`, `safe_window_minutes`, `escalation_rung`, `attempted_responders[]`, `call_history[]`, `structured_results[]`, `confidence_history[]`, `final_outcome`.

---

## 11. Tech Stack

| Layer | Choice | Owner | Rationale |
|---|---|---|---|
| Frontend | Next.js 15 (App Router) + TypeScript | Vishal | Streaming UI, one deployable |
| Styling | Tailwind CSS + shadcn/ui | Soham + Vishal | Speed with a consistent system |
| Motion | Framer Motion | Vishal | Purposeful state transitions |
| 3D | React Three Fiber + drei | Vishal | Live asset/facility visualisation (§14) |
| Realtime | SSE (primary), Socket.IO (fallback) | Sameer | SSE is simpler and sufficient for one-way live state |
| Backend | Node.js + Fastify + TypeScript | Sameer | Typed contracts end-to-end |
| Agent | LangGraph (JS) | Aryan | Explicit, inspectable state machine |
| **Telephony** | **CALL-E SDK + MCP** | **Aryan + Tanmay** | **The core requirement** |
| Voice | ElevenLabs + Sarvam AI | Tanmay + Soham | Persona quality + Indic language |
| Database | PostgreSQL (Neon/Supabase) | Sameer | Relational audit trail |
| Queue | BullMQ + Redis | Sameer | Retries, scheduled callbacks, verification calls |
| IoT | MQTT (Mosquitto/HiveMQ) + ESP32 | Vishal | Real telemetry path |
| Validation | Zod (shared FE/BE) | Sameer | One schema, both sides |
| Deploy | Vercel (FE) + Railway/Render (BE) | Sameer | Public demo URL |

---

## 12. Data Model

```sql
facilities        (id, name, timezone, quiet_hours_start, quiet_hours_end)

assets            (id, facility_id, type, label, location,
                   metric, safe_min, safe_max, critical_delta,
                   consequence_desc, safe_window_minutes, last_heartbeat_at)

signals           (id, asset_id, metric, value, unit, received_at,
                   source, raw_payload, trace_id)

incidents         (id, asset_id, severity, opened_at, closed_at,
                   status,                      -- OPEN|CALLING|RESOLVED|UNRESOLVED|HUMAN_REVIEW
                   safe_window_minutes, escalation_rung,
                   final_outcome, time_saved_minutes, trace_id)

responders        (id, facility_id, name, role, skills[], phone_e164,
                   shift_start, shift_end, zone, ladder_priority,
                   consent_at, cooldown_until)

call_plans        (id, incident_id, responder_id, escalation_rung,
                   task_prompt, result_schema, created_at)

calls             (id, incident_id, call_plan_id, responder_id,
                   calle_call_id, status, task_completed,
                   confidence_score, confidence_label,
                   evidence jsonb, structured_result jsonb,
                   transcript text, started_at, ended_at,
                   duration_seconds, voice_provider, language, trace_id)

agent_events      (id, incident_id, node, input jsonb, output jsonb,
                   decision, reason, created_at, trace_id)

suppressions      (id, asset_id, reason, window_readings jsonb, created_at)

outcomes          (id, incident_id, responder_id, committed, eta_minutes,
                   verified_at, verification_result, notified_at)
```

**Non-negotiable:** `trace_id` flows from the originating signal through every table. One ID reconstructs an entire incident — this is what makes the audit view credible in a live demo.

---

## 13. Voice & Language Layer (Tanmay + Soham)

### 13.1 Objective

CALL-E owns the telephony and conversation runtime. Our voice layer governs **persona, language routing, and conversational quality** — the things that decide whether the demo call sounds trustworthy or robotic.

### 13.2 Persona specification

| Attribute | Setting | Reason |
|---|---|---|
| Identity | "Automated operations line for {facility}" | FR-10.1 — never implies human |
| Tone | Calm, professional, non-alarmist | Panic degrades human response quality |
| Pace | Slightly slower than conversational | Field environments are noisy |
| Verbosity | Incident stated once, repeated at most twice | Under a 90-second ceiling |
| Turn-taking | Yields immediately on interruption | Talking over a technician kills trust |

### 13.3 Language routing

```
Responder record has preferred_language
        │
        ├─ en-IN  → ElevenLabs (professional Indian-English persona)
        ├─ hi-IN  → Sarvam (native Hindi)
        ├─ Indic  → Sarvam (regional)
        └─ unknown/unsupported
                 → Hinglish fallback persona
                 → log the fallback, store voice metadata on the call record
```

**Every call persists `voice_provider` and `language`.** If a provider fails at runtime, fall back one tier and continue — a call must never be blocked by a voice-layer failure.

> **Integration note:** CALL-E owns the call runtime. Before building a custom voice pipeline, confirm what CALL-E exposes for voice/persona selection in its API. Where CALL-E provides the voice, our layer configures it rather than replacing it — do not duplicate infrastructure the platform already gives us. This must be verified in Phase 0.

### 13.4 Conversation training loop (Tanmay + Soham — this is your core work)

This is where the demo is won or lost. The call must survive an unscripted human.

1. **Build a scenario bank** — 25+ realistic responder behaviours: cooperative, busy, distracted, hostile, vague, non-native speaker, noisy background, hands over the phone, hangs up mid-sentence.
2. **Rehearse offline** — one teammate role-plays each scenario against the prompt. Zero CALL-E credits spent.
3. **Dry-run with MCP `plan_call`** — validate structure without spending live calls.
4. **Score each run** on: did it get a commitment? a numeric ETA? did it handle "no" without giving up? did it stay under 90s? did extraction match reality?
5. **Tighten the prompt** — every failure becomes an explicit conversation rule in §7.5.
6. **Freeze the prompt 48 hours before recording.** No prompt changes after freeze.

**Highest-value rehearsal target: the "I'm busy" branch.** This single moment — the agent hearing "no" and negotiating an ETA anyway — is the most persuasive 15 seconds in the entire demo video.

---

## 14. IoT Layer (Vishal) — Scope and Justification

### 14.1 The justification test

> **IoT is included only because the physical event is what makes the phone call necessary.** A temperature sensor crossing a threshold at 2 AM with no human watching is precisely the situation where a broadcast notification fails and a phone call succeeds.

If IoT were removed, the trigger becomes an ERP webhook and the product still works — **that pluggability is a feature, not a weakness.** We present the trigger layer as an adapter interface with two implementations (MQTT sensor, HTTP webhook).

### 14.2 Two-tier delivery — de-risked

| Tier | What | Status | Purpose |
|---|---|---|---|
| **Tier 1 — Simulator** | Deterministic telemetry generator replaying normal → degrading → critical curves over MQTT | **P0 — required** | The demo path. Reproducible, no hardware on the critical path, judge can trigger on demand |
| **Tier 2 — ESP32 hardware** | Real DHT22/DS18B20 + current sensor publishing to the same MQTT topic | **P2 — optional garnish** | 10 seconds of B-roll in the video: a real thermometer, a real call |

**Rule:** Tier 2 must never block Tier 1. Both publish to an identical topic and payload schema, so the backend cannot tell them apart. If the hardware fails on recording day, the demo is unaffected.

### 14.3 Payload contract

```json
{
  "facility_id": "northgate",
  "asset_id": "CS-04",
  "metric": "temperature_c",
  "value": 12.4,
  "unit": "C",
  "timestamp": "2026-09-14T02:14:33Z",
  "device_id": "esp32-a1",
  "sequence": 1487
}
```

Topic: `sentinel/{facility_id}/{asset_id}/telemetry`

### 14.4 Vishal's reliability checklist

- Device offline → heartbeat timeout raises a distinct incident (F12)
- Out-of-range / NaN readings → rejected at ingest, logged, never trigger a call
- Duplicate `sequence` → idempotent, deduplicated
- MQTT broker disconnect → auto-reconnect with backoff, buffer locally
- Clock skew → server-side `received_at` is authoritative

---

## 15. Team Ownership (Final — Matches Actual Assignment)

| Member | Role | Owns | Primary deliverables |
|---|---|---|---|
| **Tanmay** | Technical Lead / AI & Systems | Architecture, agent conversation quality, CALL-E integration standard, voice strategy, demo narrative, final integration gate | System design, prompt engineering + freeze, scoring rubric, submission package |
| **Aryan** | Backend / Agent Engineering | LangGraph state machine, CALL-E SDK + MCP wiring, API contracts, tool orchestration | Agent graph, `executeEscalationCall`, result schema, decision logic |
| **Sameer** | Backend / Data & Infra | Database schema, correlation engine, queue + retries, webhooks, deployment | Postgres schema, ingest API, BullMQ jobs, SSE stream, deployed backend |
| **Vishal** | Frontend / Dashboards + IoT | Dashboard implementation, live call UI, 3D + animation, MQTT ingest, simulator, ESP32 | Next.js dashboard, live ops view, telemetry simulator, hardware tier |
| **Soham** | Design / Agent Conversation Design | Design system, UX architecture, demo visual polish, conversation scripting with Tanmay | Design tokens, wireframes, call-screen design, video storyboard, scenario bank |

### 15.1 Interface contracts (freeze these on Day 2)

Because five people build in parallel, these boundaries are frozen early so nobody blocks:

| Boundary | Contract | Owner | Consumer |
|---|---|---|---|
| Signal → Backend | MQTT topic + JSON payload (§14.3) | Vishal | Sameer |
| Backend → Agent | `EscalationContext` TypeScript type | Sameer | Aryan |
| Agent → CALL-E | `task` string + `resultSchema` (§7.4) | Aryan + Tanmay | CALL-E |
| Backend → Frontend | REST + SSE event schema (Zod) | Sameer | Vishal |
| Design → Frontend | Tokens + component specs | Soham | Vishal |

**Day-2 deliverable: every contract stubbed with mock data.** Frontend builds against mocks; backend builds against mocks. Integration is then assembly, not discovery.

---

## 16. Delivery Plan (21 Days → Sep 14, 2026)

### Phase 0 — Foundation (Days 1–2)

| Task | Owner |
|---|---|
| Install CALL-E, `calle auth login`, verify `calle auth status` | All |
| Place one live test call end-to-end (budget: 2 calls) | Tanmay + Aryan |
| **Submit the additional-calls request form** | Tanmay |
| Confirm CALL-E's voice/persona configuration surface (§13.3 note) | Tanmay |
| Lock scope: cold-chain hero scenario | Tanmay |
| Freeze all five interface contracts (§15.1) | Tanmay |
| Repo scaffold, monorepo, CI, env management | Sameer |
| Design system tokens + wireframes | Soham |

**Gate:** one real CALL-E call has been placed and its `structuredResult` printed. No further build until this passes.

### Phase 1 — Vertical Slice (Days 3–7)

| Task | Owner |
|---|---|
| Telemetry simulator + MQTT ingest | Vishal |
| Postgres schema + ingest API + correlation engine | Sameer |
| LangGraph skeleton: assess → select → plan → execute → decide | Aryan |
| CALL-E `executeEscalationCall` + result schema | Aryan + Tanmay |
| Dashboard shell + live incident feed | Vishal |
| Scenario bank v1 (25 responder behaviours) | Soham + Tanmay |

**Gate (end of Day 7): thinnest possible end-to-end path works.** Simulated sensor spike → incident → real CALL-E call → structured result → dashboard update. Ugly is fine. It must be real.

### Phase 2 — Depth (Days 8–13)

| Task | Owner |
|---|---|
| Full escalation ladder + urgency adaptation | Aryan |
| Failure taxonomy F1–F14 implemented | Sameer + Vishal |
| Confidence-based routing + human review queue | Aryan |
| Voice layer: ElevenLabs + Sarvam routing | Tanmay + Soham |
| Conversation rehearsal rounds 1–3 | Tanmay + Soham |
| Live call UI, transcript, agent timeline, 3D asset view | Vishal + Soham |
| Verification-call scheduling (BullMQ) | Sameer |
| Safety layer: quiet hours, rate limits, kill switch | Sameer |

**Gate (Day 13): all 14 failure modes demonstrably handled.**

### Phase 3 — Polish & Contribution (Days 14–18)

| Task | Owner |
|---|---|
| Deploy public demo URL | Sameer |
| Design QA pass: every state, mobile, a11y | Soham + Vishal |
| Author the reusable Agent Skill (`SKILL.md` + references/scripts/assets) | Aryan + Tanmay |
| Author the App contribution (`apps/typescript/sentinel-ops`) | Sameer |
| Write `SAFETY.md`, README, setup/cancellation notes | Tanmay |
| Run `python3 scripts/validate_repository.py` | Aryan |
| **Prompt freeze (Day 16)** | Tanmay |
| Demo rehearsal ×3 | All |

### Phase 4 — Submission (Days 19–21)

| Task | Owner |
|---|---|
| Record demo video (2:45–3:00) | Soham + Tanmay |
| Upload to YouTube, **verify public visibility** | Soham |
| Open PR to `CALLE-AI/awesome-phone-call-agents` | Aryan |
| Devpost form: PR URL, video, CALL-E account email, demo URL | Tanmay |
| Submit CALL-E Feedback Survey from the testing log | Tanmay + Vishal |
| **Submit ≥ 24 hours before deadline** | Tanmay |

> **Hard rule: submit by Sep 13.** Never submit on deadline day. Devpost load and upload failures are a known cause of lost entries.

---

## 17. Submission Package

### 17.1 Repository contributions (two areas, one PR)

Per the target repo's structure, we contribute to **two** areas — maximising the "clear, well-scoped, reusable contribution" score:

**A. Agent Skill — `skills/autonomous-incident-escalation/`**

```
skills/autonomous-incident-escalation/
├── SKILL.md                    # what it does, setup, usage, side effects, cancellation
├── references/
│   ├── result-schema.json      # the escalation extraction contract
│   ├── escalation-ladder.md    # rung design + urgency adaptation
│   ├── failure-taxonomy.md     # F1–F14 and agent responses
│   └── SAFETY.md               # consent, quiet hours, rate limits, kill switch
├── scripts/
│   ├── build_task_prompt.ts    # dynamic prompt composition
│   └── run_escalation.ts       # runnable CALL-E example
└── assets/
    └── sample-roster.json
```

This is the genuinely reusable artifact: **any team with an alerting system can drop in their own trigger and roster and get autonomous escalation.**

**B. App — `apps/typescript/sentinel-ops/`**

Full runnable application with README, `.env.example`, setup instructions, and tests.

### 17.2 Pre-submission checklist

- [ ] CALL-E imported and called at runtime in the submitted code (not mocked)
- [ ] `python3 scripts/validate_repository.py` passes
- [ ] Branch, commit, and PR title follow `docs/git-naming-conventions.md`
- [ ] `SKILL.md` documents setup, usage, **side effects, and cancellation**
- [ ] `SAFETY.md` present and substantive
- [ ] PR opened to `CALLE-AI/awesome-phone-call-agents`
- [ ] Demo video public on YouTube, ≈3 minutes
- [ ] Devpost form: PR URL + video URL + **CALL-E account email**
- [ ] Public demo application URL (optional but strongly recommended)
- [ ] CALL-E Feedback Survey submitted (separate $200 × 5 prize)
- [ ] Every team member meets the age-of-majority eligibility rule
- [ ] One team representative designated for submission (Tanmay)

---

## 18. Demo Video Script (3:00 — Storyboard)

> Judges are not required to watch past three minutes. The real phone call must be audible before the 90-second mark.

| Time | Visual | Audio / Narration |
|---|---|---|
| **0:00–0:12** | Dark control room. Dashboard glowing red. Phone on a desk, unanswered. | "At 2 AM, a cold-storage unit starts failing. The dashboard knows. The notification fires. And nobody picks up a dashboard." |
| **0:12–0:22** | Sentinel Ops logo → live dashboard | "Sentinel Ops doesn't just detect the problem. It phones the human who can fix it." |
| **0:22–0:38** | 3D facility view; asset CS-04 pulses amber → red. Live temperature curve climbing. Severity chip: CRITICAL. Safe window: 90 min. | "A real sensor crosses threshold. The agent correlates fifteen readings, rules out a transient spike, and classifies severity." |
| **0:38–0:50** | Responder selection — roster filtered by skill, shift, zone. Call plan renders with must-ask questions. | "It selects an on-shift refrigeration technician in zone, and composes the call — objective, questions, stop conditions." |
| **0:50–1:50** | **THE MONEY SHOT.** Split screen: waveform + live transcript. Dialling → Connected. Real audio. | *Real call plays.* Agent states the incident. **Technician: "I'm on another job in Sector 7."** Agent: "Understood — what time could you realistically reach Northgate?" **"About forty minutes."** Agent confirms and logs it. |
| **1:50–2:10** | Structured result panel populates field by field. Confidence 0.92 · HIGH. Evidence quotes highlighted. | "CALL-E returns typed, structured data — not a transcript to read. ETA forty minutes, inside the ninety-minute safe window. Commitment confirmed." |
| **2:10–2:25** | Incident closes. Manager notified. Verification call auto-scheduled at T+45. Counter: **11m 40s saved.** | "The agent closes the loop, notifies the manager, and schedules a verification call to confirm he actually arrives." |
| **2:25–2:40** | **The differentiator.** Rapid cut: second scenario, responder refuses → agent escalates to rung 2 → supervisor. | "And when someone says no — it escalates. Automatically. Three rungs, rising urgency, no human in the loop." |
| **2:40–2:52** | Clean architecture diagram; CALL-E highlighted at the centre. | "Built on CALL-E's SDK and MCP — dynamic prompts, typed result schemas, and confidence-driven routing." |
| **2:52–3:00** | Tagline card + demo URL + PR link | "We don't just detect problems. We autonomously coordinate the humans who solve them." |

### 18.1 Recording rules

1. **Record the real call live.** Judges can hear a fake.
2. **Record 5+ takes.** Keep the one where the technician says no and the agent recovers.
3. **Subtitle the entire call** — phone audio compresses badly on YouTube.
4. **No dead air.** Cut every loading state.
5. **Hard cut at 3:00.**
6. Keep one pre-recorded successful run in reserve as demo insurance.

---

## 19. CALL-E Testing Log (Feedback Prize — Vishal + Tanmay)

Five $200 prizes are awarded for Most Valuable Feedback. This costs almost nothing since we are testing anyway — **but only genuine, reproducible findings are submitted. No manufactured criticism.**

Maintain `docs/CALLE_TESTING_LOG.md` with one row per observation:

| Field | Description |
|---|---|
| ID | Sequential |
| Date | ISO date |
| Surface | SDK / API / MCP / CLI / SKILL / Docs / Dashboard |
| Scenario | What we were doing |
| Expected | What we thought would happen |
| Actual | What happened |
| Repro steps | Minimal reproduction |
| Severity | Blocker / Major / Minor / Polish |
| Suggested fix | Concrete, actionable |

**High-value feedback categories:** documentation gaps found during onboarding, `resultSchema` edge cases, MCP OAuth flow friction, error-message clarity, webhook/polling ergonomics, call-status granularity, DX papercuts in the CLI.

---

## 20. Risk Register

| # | Risk | Impact | Likelihood | Mitigation | Owner |
|---|---|---|---|---|---|
| R1 | Live demo call fails during recording | Critical | Medium | Reserve 3 calls; keep pre-recorded successful runs; record 5+ takes | Tanmay |
| R2 | 20-call budget exhausted early | Critical | **High** | Strict budget policy (§7.7); MCP `plan_call` for iteration; **request more on Day 2** | Tanmay |
| R3 | Scope creep across 5 people | High | High | Scope locked Day 2; contracts frozen; new features require lead approval | Tanmay |
| R4 | Integration hell in the last week | High | Medium | Vertical slice by Day 7; mock-first contracts; daily integration checkpoint | Sameer |
| R5 | Agent handles the happy path only | High | Medium | Failure taxonomy is a Day-13 gate, not a stretch goal | Aryan + Vishal |
| R6 | Judges see "generic AI phone caller" | Critical | Medium | Lead with the specific problem; show the refusal-and-escalate moment | Tanmay + Soham |
| R7 | ESP32 hardware fails | Low | Medium | Tier 1 simulator is the demo path; hardware is optional garnish | Vishal |
| R8 | Video exceeds 3 minutes | Medium | High | Storyboard to the second; hard cut; script-read timing before recording | Soham |
| R9 | PR rejected on repo conventions | High | Low | Run `validate_repository.py`; follow git-naming-conventions; open PR by Day 19 | Aryan |
| R10 | Voice provider outage | Medium | Low | Tiered fallback; a voice failure never blocks a call | Tanmay |
| R11 | Late submission | Critical | Low | **Submit Sep 13**, 24 hrs early | Tanmay |
| R12 | Ethical/consent objection from judges | Medium | Low | FR-10 + `SAFETY.md`; agent always self-identifies as automated | Tanmay |

---

## 21. Out of Scope (v1)

Explicitly excluded to protect focus. Listing them shows deliberate scoping rather than omission.

1. Multi-tenant enterprise IAM / SSO
2. Billing and subscription systems
3. Inbound call handling (outbound only)
4. Custom model training or fine-tuning
5. Native mobile applications
6. More than three escalation rungs
7. CRM/ERP write-back beyond the generic outbound webhook
8. Historical analytics beyond the core demo metrics

---

## 22. Post-Hackathon Roadmap (Judging Criterion: "worth building further")

| Horizon | Capability |
|---|---|
| **Next 30 days** | Inbound handling — responder calls back and the agent recognises the incident; Slack/Teams incident sync |
| **90 days** | Learned responder-reliability scoring — the ladder reorders itself by who actually shows up |
| **180 days** | Multi-party conference calls (technician + supplier + supervisor on one line) |
| **Vertical expansion** | Healthcare equipment, logistics cold chain, telecom field ops, property management |
| **Business model** | Per-resolved-incident pricing, benchmarked against the operator labour hour it replaces |

---

## 23. Definition of Winning

> A judge watches three minutes, hears a real phone call in which an AI agent is told *"I'm on another job"* and negotiates a concrete forty-minute commitment anyway — then sees that commitment become typed, confidence-scored data that closes an incident and schedules its own verification.

They should be able to restate the value in one sentence without our help:

**"It phones the human who can actually fix the problem, and won't take no for an answer."**

If that happens, we win.

---

*Document owner: Tanmay Kala · Locked for build · Scope changes require lead approval.*
