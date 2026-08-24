# CLAUDE.md — Sentinel Ops (CALL-E Hackathon)

> Operating instructions and complete system reference for any AI coding agent working in this repository.
> **Read this before writing code.** It encodes decisions that are already locked.

---

## Contents

1. [Project](#1-project)
2. [The nine rules](#2-the-nine-rules)
3. [System architecture](#3-system-architecture)
4. [End-to-end flow](#4-end-to-end-flow)
5. [The LangGraph agent](#5-the-langgraph-agent)
6. [CALL-E integration](#6-call-e-integration)
7. [Data model](#7-data-model)
8. [API + event contracts](#8-api--event-contracts)
9. [Failure handling](#9-failure-handling)
10. [Voice & language layer](#10-voice--language-layer)
11. [IoT / signal layer](#11-iot--signal-layer)
12. [Safety layer](#12-safety-layer)
13. [Repository layout](#13-repository-layout)
14. [Code standards](#14-code-standards)
15. [Working style](#15-working-style)
16. [Ownership](#16-ownership)
17. [Submission](#17-submission)

---

## 1. Project

**Sentinel Ops** — an autonomous incident escalation agent. It watches real signals (IoT sensors, system webhooks), decides when a failure genuinely needs a human, **phones that human through CALL-E**, negotiates a commitment, escalates when refused, and writes the confirmed outcome back as structured data.

**Submission deadline: Sep 14, 2026 @ 9:15 PM IST. Target submission date: Sep 13.**

| Document | Purpose |
|---|---|
| **CLAUDE.md** (this file) | Architecture, flows, contracts, standards — the technical reference |
| [docs/PRD_CALL_E_HACKATHON.md](docs/PRD_CALL_E_HACKATHON.md) | **Source of truth** for requirements, scope, delivery plan, judging strategy |
| [docs/FRONTEND_DESIGN_PLUGINS.md](docs/FRONTEND_DESIGN_PLUGINS.md) | Frontend only — design system, components, motion, 3D, plugins |
| `docs/CALLE_TESTING_LOG.md` | CALL-E findings for the Most Valuable Feedback prize |

**If this file and the PRD disagree on scope or requirements, the PRD wins.** This file is authoritative for *technical implementation* — architecture, contracts, schemas, standards.

---

## 2. The nine rules

### 1. CALL-E must be called at runtime. Always.

This is the hackathon's core scored requirement: *"CALL-E imported and actually called at runtime, not just referenced."*

- The real SDK path (`@call-e/calle` → `calle.calls.createAndWait()`) is the **only** path that ships.
- A mock driver exists for parallel development. **It is a dev harness. It never appears in the demo, the recorded video, or the deployed app.**
- Never remove, stub out, or bypass a real CALL-E call to make something pass. If a CALL-E call is failing, fix the integration or report the failure — do not route around it.

### 2. Never spend a CALL-E call without permission.

The account starts with **20 free calls**. Budget in PRD §7.7.

- Never place a live call to test a code path a mock can prove.
- Use MCP `plan_call` for all prompt iteration — it validates structure without spending a call.
- Before any code you write places a real call, say so explicitly and get confirmation.
- Log every live call in `docs/CALLE_TESTING_LOG.md`.

### 3. Never place a real call to an unregistered number.

- Only numbers in the consented roster, ever.
- The agent identifies itself as an automated line at the start of every call.
- Respect quiet hours; only CRITICAL severity overrides.
- The kill switch must always work. Never write code that can bypass it.
- Test numbers belong to team members who have agreed to receive test calls.

### 4. Frozen contracts are frozen.

Five people build in parallel against five interface contracts (§8). Changing one silently breaks someone else's work.

| Contract | Owner | Defined in |
|---|---|---|
| MQTT telemetry payload | Vishal | §11.2 |
| `EscalationContext` type | Sameer | §8.1 |
| CALL-E `task` + `resultSchema` | Aryan + Tanmay | §6.4, §6.5 |
| SSE event schema | Sameer | §8.3 |
| Design tokens | Soham | Frontend doc §2.2 |

**To change one: flag it, get the owner's agreement, update both sides in the same change.** Never adapt one side to a drifted other side.

### 5. Scope is locked. Don't add features.

The hero scenario (cold-chain escalation) is locked. Out-of-scope list is PRD §21.

- Build what's asked. Don't add adjacent features because they'd be nice.
- If you spot a genuine gap, say so in a sentence — then continue with the assigned work.
- New features require the technical lead's approval. Suggest, don't implement.

### 6. Every failure mode is handled. No happy-path-only code.

§9 lists 14 failure modes (F1–F14). They are a Day-13 gate, not a stretch goal.

Before calling any agent-path feature done, answer: what happens on no answer, refusal, voicemail, ambiguity, callback request, wrong person, dropped call, API error, ladder exhaustion?

### 7. `trace_id` flows everywhere.

Every signal generates a `trace_id` that propagates through every table, log line, agent event, and CALL-E call. One ID must reconstruct an entire incident. This is what makes the audit view credible on camera. Never drop it across a boundary.

### 8. Report honestly.

- If tests fail, say so and show the output.
- If something is partially done, say which part.
- Never claim a CALL-E integration works because the mock worked.
- Never fabricate call results, transcripts, or confidence scores in test fixtures that could be mistaken for real output. Label all fixtures clearly.

### 9. Don't commit or push unless asked.

Never commit secrets. `.env` is gitignored. `CALLE_API_KEY` never appears in code, logs, error messages, or docs.

---

## 3. System architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  SIGNAL SOURCES                                                     │
│  ESP32 sensors → MQTT   ·   ERP/system webhooks   ·   Simulator     │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  INGEST LAYER                            Vishal (MQTT) + Sameer     │
│  validate (Zod) · normalise · assign trace_id · persist raw signal  │
└────────────────────────────────┬────────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  CORRELATION ENGINE                                        Sameer   │
│  rolling window · suppress transients · dedupe ·                    │
│  classify severity · compute safe_window_minutes                    │
└────────────────────────────────┬────────────────────────────────────┘
                                 │  opens an incident
                                 ▼
╔═════════════════════════════════════════════════════════════════════╗
║  LANGGRAPH AGENT                              Aryan + Tanmay        ║
║                                                                     ║
║   assess_incident ──► select_responder ──► plan_call                ║
║         │                    ▲                  │                   ║
║         │ suppress           │                  ▼                   ║
║         ▼                    │            execute_call ─────────────╫──► CALL-E SDK
║       END                 escalate              │                   ║    createAndWait
║                              ▲                  ▼                   ║    + resultSchema
║                              │               decide                 ║       │
║                              │        ┌────────┼────────┐           ║       ▼
║                              └────────┤        │        │           ║   ☎ REAL PHONE CALL
║                                       ▼        ▼        ▼           ║       │
║                            human_review   schedule_   resolve       ║       ▼
║                                           callback       │          ║  ┌──────────────┐
║                                                          ▼          ║  │ ElevenLabs   │
║                                                       verify        ║  │ Sarvam       │
╚══════════════════════════════════════════════════════════╤══════════╝  └──────────────┘
                                                           │  structuredResult
                                                           │  confidence · evidence
                                                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  OUTCOME ENGINE                                            Sameer   │
│  persist outcome · notify manager · outbound webhook · metrics      │
└────────────────────────────────┬────────────────────────────────────┘
                                 │  SSE stream
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  DASHBOARD (Next.js)                              Vishal + Soham    │
│  Incident Command · Live Call Theatre · Audit timeline · Simulator  │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.1 Stack

| Layer | Choice | Owner |
|---|---|---|
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui | Vishal |
| Motion / 3D | Framer Motion · React Three Fiber | Vishal |
| Realtime | SSE (native EventSource) | Sameer |
| Backend | Node.js + Fastify + TypeScript | Sameer |
| Agent | LangGraph (JS) | Aryan |
| **Telephony** | **CALL-E SDK + MCP** | **Aryan + Tanmay** |
| Voice | ElevenLabs · Sarvam AI | Tanmay + Soham |
| Database | PostgreSQL | Sameer |
| Queue | BullMQ + Redis | Sameer |
| IoT | MQTT + ESP32 (+ simulator) | Vishal |
| Validation | Zod (shared FE/BE) | Sameer |
| Deploy | Vercel (FE) + Railway/Render (BE) | Sameer |

### 3.2 Why these boundaries

- **Correlation is separate from the agent.** The agent should never see noise. Suppression is deterministic, cheap, and testable — keep it out of the LLM path.
- **The agent never touches the database directly.** It receives an `EscalationContext` and returns decisions. Persistence is the outcome engine's job. This keeps the graph pure and replayable.
- **SSE is one-directional.** Call state flows server → client only. If bidirectional control (operator barge-in) ever becomes P0, that's a WebSocket, not a widened SSE.

---

## 4. End-to-end flow

The happy path, with owners and the data that crosses each boundary.

| # | Step | Owner | Input → Output |
|---|---|---|---|
| 1 | Sensor publishes telemetry | Vishal | MQTT message (§11.2) |
| 2 | Ingest validates + persists | Sameer | Raw payload → `signals` row + `trace_id` |
| 3 | Correlation evaluates window | Sameer | Last N signals → suppress, or open incident |
| 4 | Severity + safe window computed | Sameer | Threshold delta + rate → `INFO`/`WARNING`/`CRITICAL`, `safe_window_minutes` |
| 5 | Incident opened, agent invoked | Sameer → Aryan | `incidents` row → `EscalationContext` |
| 6 | Agent assesses | Aryan | Context → call-worthy? |
| 7 | Responder selected | Aryan | Roster ∩ skill ∩ shift ∩ zone → `Responder` |
| 8 | Call plan composed | Aryan + Tanmay | Context + responder + rung → `task` string |
| 9 | **CALL-E places the call** | Aryan | `task` + `resultSchema` → live phone call |
| 10 | Conversation happens | CALL-E + voice layer | Agent ↔ human |
| 11 | Structured result returned | CALL-E | `structuredResult`, `completionConfidence`, `evidence` |
| 12 | Agent decides | Aryan | `next_action` + confidence → resolve / escalate / review |
| 13 | Outcome persisted + notified | Sameer | Decision → `outcomes` row, manager notification |
| 14 | Verification scheduled | Sameer | ETA → BullMQ job at T+ETA |
| 15 | Dashboard reflects everything | Vishal | SSE events → live UI |

**Every step emits an SSE event and an `agent_events` row carrying the same `trace_id`.**

### 4.1 The escalation loop

When step 12 returns `ESCALATE_NEXT_RUNG`:

```
rung 1 (Primary technician)   → no answer / refusal
   ↓  urgency raised
rung 2 (Secondary technician) → no answer / refusal
   ↓  urgency raised again
rung 3 (Supervisor)           → no answer / refusal
   ↓
UNRESOLVED → loud human alert
```

Cap: **3 rungs, default max 5 calls per incident.** Both configurable, both enforced in code — never rely on the LLM to stop.

---

## 5. The LangGraph agent

**Owner: Aryan. Conversation quality: Tanmay.**

### 5.1 Nodes

| Node | Responsibility | Exits to |
|---|---|---|
| `assess_incident` | Confirm the incident is real and warrants a call | `select_responder` \| `suppress` |
| `select_responder` | Pick responder for the current rung | `plan_call` \| `escalate` |
| `plan_call` | Compose the dynamic CALL-E task prompt | `execute_call` |
| `execute_call` | Invoke CALL-E SDK; persist all artifacts | `decide` |
| `decide` | Branch on `next_action` + confidence | `resolve` \| `escalate` \| `human_review` \| `schedule_callback` |
| `escalate` | Advance rung, raise urgency | `select_responder` \| `unresolved` |
| `human_review` | Park for operator decision | `resolve` \| `escalate` |
| `verify` | T+ETA confirmation call | `resolve` \| `escalate` |
| `resolve` | Close, notify, compute time saved | END |
| `unresolved` | Ladder exhausted, loud alert | END |

### 5.2 Graph state

```ts
interface EscalationState {
  incidentId: string;
  traceId: string;

  // Incident facts
  severity: "INFO" | "WARNING" | "CRITICAL";
  safeWindowMinutes: number;
  asset: Asset;
  reading: Reading;
  facility: Facility;

  // Escalation progress
  escalationRung: number;              // 1-indexed
  maxRungs: number;                    // default 3
  attemptedResponders: string[];       // responder IDs
  currentResponder: Responder | null;

  // Call history
  callHistory: CallRecord[];
  structuredResults: Record<string, unknown>[];
  confidenceHistory: { score: number; label: string }[];

  // Outcome
  finalOutcome: Outcome | null;
  requiresHumanReview: boolean;
}
```

### 5.3 Decision logic (`decide` node)

This is deterministic code, **not** an LLM call. The LLM already did its job inside the phone conversation; routing on its output must be predictable and testable.

```ts
function decide(state: EscalationState): NextNode {
  const result = last(state.structuredResults);
  const confidence = last(state.confidenceHistory);

  // Low confidence never auto-closes. Rule 6 + FR-6.3.
  if (confidence.score < 0.7) return "human_review";

  switch (result.next_action) {
    case "CLOSE_RESOLVED":              return "resolve";
    case "SCHEDULE_VERIFICATION_CALL":  return "verify";
    case "SCHEDULE_CALLBACK":           return "schedule_callback";
    case "HUMAN_REVIEW":                return "human_review";
    case "ESCALATE_NEXT_RUNG":
      return state.escalationRung >= state.maxRungs ? "unresolved" : "escalate";
  }
}
```

**Invariants:**
- Confidence below threshold **always** wins over `next_action`.
- The rung cap is enforced here, not in the prompt.
- Every branch is reachable and has a test.

---

## 6. CALL-E integration

**Owner: Aryan (implementation) + Tanmay (prompt + conversation quality).**

### 6.1 Setup

```bash
pnpm add @call-e/calle          # TypeScript
pip install calle-ai            # Python
npm install -g @call-e/cli

export CALLE_API_KEY="..."      # from dashboard.heycall-e.com/account/api-keys
export CALLE_BASE_URL="https://api.heycall-e.com"

calle auth login
calle auth status
```

### 6.2 Client

```typescript
// packages/calle/client.ts
import { CalleClient } from "@call-e/calle";

export const calle = new CalleClient({ apiKey: process.env.CALLE_API_KEY! });
```

### 6.3 Placing a call

```typescript
const call = await calle.calls.createAndWait({
  task: buildTaskPrompt(ctx),              // ALWAYS dynamic, never a static string
  resultSchema: ESCALATION_RESULT_SCHEMA,  // ALWAYS typed extraction
});

call.status;                // "completed" | ...
call.taskCompleted;         // boolean
call.completionConfidence;  // { score, label }  → drives control flow
call.evidence;              // string[]          → audit trail
call.structuredResult;      // typed object      → workflow branches on this
```

**MCP:** `https://seleven-mcp-sg.airudder.com/mcp/openagent_oauth` (Streamable HTTP, OAuth)
Tools: `plan_call` (dry run, free) · `run_call` (live) · `get_call_run` (status)

### 6.4 Four capabilities, used deliberately

Depth here is what scores on *"thoroughly and skilfully."*

| Capability | Requirement |
|---|---|
| `task` | Composed per call from severity + responder + escalation rung. A static prompt is a robocall. |
| `resultSchema` | Every call declares typed extraction. Never parse prose. |
| `completionConfidence` | `< 0.7` routes to human review. Confidence drives control flow. |
| `evidence` | Persisted verbatim. Surfaced in the UI as transcript highlights. |

### 6.5 Result schema (frozen contract)

```typescript
export const ESCALATION_RESULT_SCHEMA = {
  type: "object",
  required: ["responder_available", "acknowledged_severity", "next_action"],
  properties: {
    responder_available: { type: "string", enum: ["yes", "no", "conditional", "unknown"] },
    eta_minutes:         { type: "number" },
    acknowledged_severity: { type: "boolean" },
    requires_backup:     { type: "boolean" },
    requires_parts:      { type: "boolean" },
    decline_reason: {
      type: "string",
      enum: ["on_another_job", "off_shift", "out_of_zone", "not_qualified", "no_reason", "none"],
    },
    callback_requested_at: { type: "string" },
    verbatim_commitment:   { type: "string" },
    next_action: {
      type: "string",
      enum: ["CLOSE_RESOLVED", "ESCALATE_NEXT_RUNG", "SCHEDULE_VERIFICATION_CALL",
             "SCHEDULE_CALLBACK", "HUMAN_REVIEW"],
    },
  },
} as const;
```

Full prompt-composition function: PRD §7.5. **Do not inline a different prompt anywhere.** One `buildTaskPrompt`, one schema.

### 6.6 Call budget

20 free calls. Phased allocation in PRD §7.7. Reserve 3 for recording day and **never touch them early**. Iterate prompts with MCP `plan_call`, which is free.

---

## 7. Data model

**Owner: Sameer.** Migrations only — never manual schema edits.

```sql
facilities        (id, name, timezone, quiet_hours_start, quiet_hours_end)

assets            (id, facility_id, type, label, location,
                   metric, safe_min, safe_max, critical_delta,
                   consequence_desc, safe_window_minutes, last_heartbeat_at)

signals           (id, asset_id, metric, value, unit, received_at,
                   source, raw_payload, trace_id)

incidents         (id, asset_id, severity, opened_at, closed_at,
                   status,          -- OPEN|CALLING|RESOLVED|UNRESOLVED|HUMAN_REVIEW
                   safe_window_minutes, escalation_rung,
                   final_outcome, time_saved_minutes, trace_id)

responders        (id, facility_id, name, role, skills[], phone_e164,
                   shift_start, shift_end, zone, ladder_priority,
                   preferred_language, consent_at, cooldown_until)

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

**Rules:**
- `trace_id` on every row that participates in an incident. One ID reconstructs the whole story.
- Timestamps are UTC `timestamptz`. Format at the display layer only.
- `calls.structured_result` and `calls.evidence` store CALL-E's output **verbatim**. Never normalise away the original — it's the audit trail.

---

## 8. API + event contracts

**Owner: Sameer. Frozen Day 2.** Shared types live in `packages/types` and are imported by both frontend and backend. One definition, never two.

### 8.1 `EscalationContext` (backend → agent)

```ts
interface EscalationContext {
  incidentId: string;
  traceId: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  safeWindowMinutes: number;
  consequence: string;              // "inventory is at risk"
  escalationRung: number;
  facility: { id: string; name: string; timezone: string };
  asset:    { id: string; type: string; location: string };
  reading:  { metric: string; value: number; unit: string; threshold: number };
  responder: Responder;
}
```

### 8.2 REST endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/signals` | Generic webhook signal ingest (authenticated) |
| `GET` | `/api/v1/incidents` | List incidents (filter: status, severity, asset) |
| `GET` | `/api/v1/incidents/:id` | Incident detail + full timeline |
| `GET` | `/api/v1/incidents/:id/stream` | **SSE stream** for live updates |
| `POST` | `/api/v1/incidents/:id/override` | Operator override of extracted fields |
| `POST` | `/api/v1/incidents/:id/escalate` | Manual escalation trigger |
| `GET` | `/api/v1/responders` | Roster |
| `POST` | `/api/v1/simulator/trigger` | Fire a demo scenario |
| `POST` | `/api/v1/killswitch` | Halt all outbound calling |

### 8.3 SSE event schema (frozen)

```ts
type SentinelEvent =
  | { type: "signal.received";     incidentId: string; value: number; ts: string }
  | { type: "incident.opened";     incidentId: string; severity: Severity; safeWindowMinutes: number }
  | { type: "incident.suppressed"; assetId: string; reason: string }
  | { type: "responder.selected";  incidentId: string; responder: Responder; rung: number }
  | { type: "plan.composed";       incidentId: string; summary: string; mustAsk: string[] }
  | { type: "call.state";          incidentId: string; callId: string; state: CallState }
  | { type: "transcript.delta";    incidentId: string; speaker: "AGENT" | "HUMAN"; text: string; ts: string }
  | { type: "result.extracted";    incidentId: string; structured: Record<string, unknown>;
                                    confidence: { score: number; label: string }; evidence: string[] }
  | { type: "incident.escalated";  incidentId: string; fromRung: number; toRung: number }
  | { type: "incident.resolved";   incidentId: string; outcome: string; timeSavedMinutes: number }
  | { type: "incident.unresolved"; incidentId: string; reason: string };

type CallState =
  | "queued" | "dialling" | "connected" | "in_conversation"
  | "extracting" | "completed" | "failed" | "no_answer";
```

Every event carries enough context to render its panel without a refetch. Validate with Zod at both ends.

---

## 9. Failure handling

**Owners: Vishal + Sameer.** All 14 are a Day-13 gate.

| # | Failure | Detection | Agent behaviour | Outcome |
|---|---|---|---|---|
| F1 | No answer | Call status = no-answer | Advance rung immediately | `ESCALATE_NEXT_RUNG` |
| F2 | Voicemail | Detected in conversation | Short message (asset ID + callback), end, escalate | `ESCALATE_NEXT_RUNG` |
| F3 | Hard refusal | `responder_available: "no"` | Capture `decline_reason`, escalate | `ESCALATE_NEXT_RUNG` |
| F4 | Conditional / late ETA | `eta_minutes > safe_window` | Accept, and call backup in parallel | `SCHEDULE_VERIFICATION_CALL` |
| F5 | Callback requested | `callback_requested_at` set | Schedule retry; parallel rung if CRITICAL | `SCHEDULE_CALLBACK` |
| F6 | Ambiguous answer | Confidence `< 0.7` | Ask once for a number; still vague → review | `HUMAN_REVIEW` |
| F7 | Wrong person answers | Identity mismatch | Ask if responder is reachable; **withhold details** | Retry or escalate |
| F8 | Gatekeeper / IVR | Non-human respondent | Do not navigate menus; end, escalate | `ESCALATE_NEXT_RUNG` |
| F9 | Call drops | `status != completed` | Retry once; second drop → escalate | Retry, then escalate |
| F10 | CALL-E API error | SDK exception | Exponential backoff ×3, then human alert | System alert |
| F11 | Ladder exhausted | Rung > max | Mark UNRESOLVED, loud alert | `UNRESOLVED` |
| F12 | Sensor offline | No heartbeat in window | Distinct "asset unreachable" incident | Separate incident |
| F13 | Flapping signal | Correlation + dedup | Suppress; enrich existing incident | Suppression logged |
| F14 | Confirms but never arrives | Verification call at T+ETA | Re-escalate | `ESCALATE_NEXT_RUNG` |

**Every external call has an explicit timeout. Every retry has a cap. Every handler is idempotent.**

---

## 10. Voice & language layer

**Owners: Tanmay + Soham.**

CALL-E owns telephony and the conversation runtime. This layer governs **persona, language routing, and conversational quality**.

> **Verify in Phase 0:** confirm what CALL-E exposes for voice/persona selection before building a parallel pipeline. Where CALL-E provides the voice, configure it — don't duplicate platform infrastructure.

### 10.1 Persona

| Attribute | Setting | Reason |
|---|---|---|
| Identity | "Automated operations line for {facility}" | Rule 3 — never implies human |
| Tone | Calm, professional, non-alarmist | Panic degrades human response quality |
| Pace | Slightly slower than conversational | Field environments are noisy |
| Verbosity | Incident stated once, repeated at most twice | Under a 90-second ceiling |
| Turn-taking | Yields immediately on interruption | Talking over a technician kills trust |

### 10.2 Language routing

```
responder.preferred_language
   ├─ en-IN  → ElevenLabs (professional Indian-English)
   ├─ hi-IN  → Sarvam (native Hindi)
   ├─ Indic  → Sarvam (regional)
   └─ unknown → Hinglish fallback, log the fallback
```

Every call persists `voice_provider` and `language`. **A voice-layer failure must never block a call** — fall back one tier and continue.

### 10.3 Conversation training loop

Where the demo is won. The call must survive an unscripted human.

1. Scenario bank — 25+ responder behaviours (cooperative, busy, hostile, vague, noisy, hands-off-phone, hangs up).
2. Rehearse offline — role-play against the prompt. Zero credits spent.
3. Dry-run with MCP `plan_call`.
4. Score: commitment obtained? numeric ETA? handled "no"? under 90s? extraction matched reality?
5. Every failure becomes an explicit conversation rule in `buildTaskPrompt`.
6. **Freeze the prompt 48 hours before recording.**

**Highest-value target: the "I'm busy" branch.** The agent hearing *no* and negotiating an ETA anyway is the most persuasive 15 seconds of the demo.

---

## 11. IoT / signal layer

**Owner: Vishal.**

### 11.1 Two tiers

| Tier | What | Status |
|---|---|---|
| **Simulator** | Deterministic telemetry replaying normal → degrading → critical | **P0 — the demo path** |
| **ESP32 hardware** | Real sensors publishing to the same MQTT topic | P2 — optional B-roll |

**Tier 2 must never block Tier 1.** Identical topic and payload, so the backend can't tell them apart. Hardware failure on recording day must not affect the demo.

### 11.2 Payload contract (frozen)

Topic: `sentinel/{facility_id}/{asset_id}/telemetry`

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

### 11.3 Reliability

- Device offline → heartbeat timeout raises F12
- Out-of-range / NaN → rejected at ingest, logged, never triggers a call
- Duplicate `sequence` → idempotent, deduplicated
- Broker disconnect → auto-reconnect with backoff, buffer locally
- Clock skew → server-side `received_at` is authoritative

---

## 12. Safety layer

**Owner: Sameer (enforcement) + Tanmay (policy).** This is scored — the target repo has a dedicated Safety Patterns area.

| Control | Rule |
|---|---|
| Self-identification | Agent states it's an automated line at the start of every call |
| Consented roster | Only pre-registered numbers, ever |
| Quiet hours | Enforced per facility; only CRITICAL overrides |
| Rate limits | Max calls per responder/hour, max calls per incident |
| Kill switch | Global halt on outbound calling. Always works. Never bypassable. |
| Third-party protection | Never disclose incident details to an unverified answerer |
| Documentation | `SAFETY.md` covering consent, side effects, cancellation |

**Enforce in code, never in the prompt.** An LLM instruction is not a safety control.

---

## 13. Repository layout

```
sentinel-ops/
├── apps/
│   ├── web/                    # Next.js dashboard          (Vishal)
│   └── api/                    # Fastify backend            (Sameer)
├── packages/
│   ├── types/                  # Shared Zod schemas + types (Sameer)
│   ├── calle/                  # CALL-E client wrapper      (Aryan)
│   └── agent/                  # LangGraph graph + nodes    (Aryan)
├── services/
│   ├── ingest/                 # MQTT + webhook ingest      (Vishal/Sameer)
│   ├── correlation/            # Windowing, suppression     (Sameer)
│   └── simulator/              # Telemetry generator        (Vishal)
├── hardware/
│   └── esp32/                  # Firmware (optional tier)   (Vishal)
├── docs/
└── CLAUDE.md
```

---

## 14. Code standards

**TypeScript**
- `strict: true`. No `any` — use `unknown` and narrow.
- Zod schemas at every external boundary (CALL-E responses, webhooks, MQTT payloads, SSE events).
- Shared types in `packages/types`, imported by both FE and BE. One definition, never two.

**Error handling**
- Never swallow errors. Log with `trace_id` and re-throw or handle explicitly.
- Every external call (CALL-E, voice providers, MQTT) has an explicit timeout.
- Retries use exponential backoff with a cap. Never retry indefinitely.
- Webhook and event handlers are idempotent — duplicate delivery must be safe.

**Agent code**
- Routing logic is deterministic code, not an LLM call.
- Caps and limits enforced in code, never in the prompt.
- Every graph node is independently testable with a fixture state.

**Database**
- Migrations, never manual schema edits.
- `trace_id` on every incident-participating row.
- Timestamps UTC `timestamptz`. Format at the display layer.

**Frontend** — see [docs/FRONTEND_DESIGN_PLUGINS.md](docs/FRONTEND_DESIGN_PLUGINS.md). Summary: all five states on every screen, tokens only (no raw hex), state = colour + icon + text, `tabular-nums` on changing values, respect `prefers-reduced-motion`.

---

## 15. Working style

- **Match the surrounding code.** Same naming, same comment density, same idioms.
- **Read before editing.** Don't guess at a file's contents.
- **Prefer editing over creating.** New files only when genuinely needed.
- **No docs unless asked.** Code is the deliverable.
- **Small, reviewable changes.** Five people are working in parallel.
- **Reference code as clickable links:** `[file.ts:42](src/file.ts#L42)`.

### Before saying a task is done

- [ ] It runs, and you have seen it run
- [ ] Relevant failure modes handled (§9)
- [ ] `trace_id` propagates through it
- [ ] Contracts unchanged, or changed on both sides with the owner's agreement
- [ ] No secrets, no `any`, no swallowed errors
- [ ] If CALL-E is involved: the **real** SDK path works, not just the mock

---

## 16. Ownership

| Member | Owns | Ask them about |
|---|---|---|
| **Tanmay** | Tech lead · AI · architecture · conversation quality · submission | Scope changes, prompt design, CALL-E strategy, final integration |
| **Aryan** | LangGraph · CALL-E SDK/MCP · API contracts | Agent graph, result schema, decision logic |
| **Sameer** | Database · correlation · queue · webhooks · deployment | Schema, ingest, SSE contract, infra |
| **Vishal** | Dashboard · 3D/motion · MQTT · simulator · ESP32 | Frontend implementation, telemetry, IoT |
| **Soham** | Design system · UX · conversation design · demo visuals | Tokens, component specs, video storyboard |

---

## 17. Submission

Before any submission-related work is called complete:

- [ ] CALL-E imported and called at runtime in the submitted code
- [ ] PR opened to `CALLE-AI/awesome-phone-call-agents`
- [ ] `python3 scripts/validate_repository.py` passes in that repo
- [ ] Branch/commit/PR title follow its `docs/git-naming-conventions.md`
- [ ] `SKILL.md` covers setup, usage, **side effects, and cancellation**
- [ ] `SAFETY.md` present and substantive
- [ ] Demo video public on YouTube, ≈3 minutes
- [ ] Devpost form: PR URL + video URL + **CALL-E account email**
- [ ] CALL-E Feedback Survey submitted
- [ ] Submitted by **Sep 13** — never on deadline day

---

## Definition of winning

> A judge watches three minutes, hears a real phone call in which an AI agent is told *"I'm on another job"* and negotiates a concrete forty-minute commitment anyway — then sees that commitment become typed, confidence-scored data that closes an incident and schedules its own verification.

**"It phones the human who can actually fix the problem, and won't take no for an answer."**

Every decision in this repo serves that sentence.
