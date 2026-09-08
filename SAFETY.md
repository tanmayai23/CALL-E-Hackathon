# SAFETY.md — Sentinel Ops

> Required documentation for the CALL-E Hackathon Safety Patterns contribution area.
> Covers: consent, setup, usage, side effects, and cancellation.

---

## What this system does

Sentinel Ops places **real, automated outbound phone calls** to human responders when a monitored asset crosses a critical threshold. The calls are conducted by an AI agent that:

1. Identifies itself as an automated operations line at the start of every call.
2. States the incident, asks for a commitment, and negotiates an ETA.
3. Escalates to the next responder if the first one declines or is unreachable.
4. Records the structured outcome and closes the incident.

**These are real phone calls to real people.** Read this document before running the system in any environment.

---

## Consent requirements

### Who may be called

Only phone numbers that appear in the **pre-registered, consented responder roster** (`responders` table) may ever receive a call.

- Each roster entry requires a `consent_at` timestamp — the date the responder agreed to receive automated calls from this system.
- The consent form must explain: what the system is, why they may be called, at what hours, and how to opt out.
- **Never add a number to the roster without the person's explicit, recorded consent.**

### What the agent tells callers

At the start of every call, the agent states:

> *"This is the automated operations line for [Facility Name]."*

The agent never implies it is human. Never modify the task prompt to remove this self-identification.

### Third-party protection

If someone other than the named responder answers, the agent:
- Asks whether the responder is reachable at this number.
- **Does not disclose any incident details to an unverified third party.**
- Ends the call and escalates.

---

## Setup

```bash
# 1. Install the CALL-E SDK
pnpm add @call-e/calle

# 2. Set environment variables (never commit these)
CALLE_API_KEY=your_key_here          # from dashboard.heycall-e.com/account/api-keys
CALLE_BASE_URL=https://api.heycall-e.com

# 3. During development — use the mock driver (no real calls)
CALLE_USE_MOCK=true

# 4. Before any live call — set to false and confirm with the team
CALLE_USE_MOCK=false
```

The system will refuse to start if `CALLE_API_KEY` is not set.

---

## Usage

### Development (no real calls)

```bash
CALLE_USE_MOCK=true pnpm dev
```

The mock driver (`packages/calle/mock.ts`) simulates all 10 call scenarios without spending any call budget. Use this for all development and CI.

### Staging / live calls

```bash
CALLE_USE_MOCK=false pnpm dev
```

**Before placing any live call:**
1. Confirm the target number is in the consented roster.
2. Confirm it is not outside the facility's quiet hours.
3. Confirm the kill switch is not active.
4. Log the call in `docs/CALLE_TESTING_LOG.md`.

### Call budget

The account starts with **20 free calls**. Allocation:

| Phase | Budget | Purpose |
|---|---|---|
| P1 — Connectivity | 2 | Prove auth + one end-to-end call |
| P2 — Conversation quality | 4 | Tune prompt |
| P3 — Edge cases | 5 | No-answer, refusal, voicemail, etc. |
| P4 — Escalation ladder | 3 | Full multi-rung chain |
| P5 — Demo rehearsal | 3 | Full-flow dry runs |
| P6 — Final recording | 3 | **Reserve — never touch early** |

---

## Side effects

Running Sentinel Ops with `CALLE_USE_MOCK=false` will:

- **Place real outbound phone calls** to numbers in the roster.
- **Ring real people's phones**, including potentially outside business hours if severity is CRITICAL.
- **Consume call credits** from your CALL-E account.
- **Create permanent audit records** in the database.

### Quiet hours

Each facility has configured `quiet_hours_start` and `quiet_hours_end`. The system enforces these:

- **INFO / WARNING** severity: calls are blocked during quiet hours.
- **CRITICAL** severity: quiet hours are overridden. The responder may be called at any time.

This override is intentional — a critical cold-storage failure at 3 AM cannot wait until morning.

### Rate limits

The system enforces hard limits per incident:

- **Max calls per incident:** 5 (configurable)
- **Max escalation rungs:** 3 (configurable)
- **Per-responder cooldown:** configurable per roster entry — a person will not be called again within this window

These limits are enforced in code (`packages/agent/nodes/decide.ts`, `packages/agent/nodes/escalate.ts`). They are **not** enforced by the prompt — an LLM instruction is not a safety control.

---

## Cancellation

### Per-call cancellation

There is no operator-initiated mid-call cancellation. Once a call connects, it runs until CALL-E ends it or the duration ceiling is reached. If calling must be stopped, activate the kill switch (see below) — this prevents further dials but does not terminate a call already in progress.

**Duration ceiling.** Every call is bounded by a hard timeout (default 180s, `DEFAULT_CALL_TIMEOUT_MS` in `packages/calle/progress.ts`). If a call exceeds it the agent stops waiting, emits a `failed` state, and routes the incident to human review. The timeout is never retried — the responder's phone has already rung, and redialling would ring it again.

### Kill switch — halt all outbound calling

```bash
# Via API (Sameer's backend)
POST /api/v1/killswitch

# Response
{ "status": "active", "activatedAt": "2026-09-14T..." }
```

When active:
- No new CALL-E calls will be placed.
- The agent's `execute_call` node checks the kill switch immediately before dialling, on **every** rung — not once per incident.
- In-progress calls complete naturally (CALL-E handles the live call).
- The kill switch persists until explicitly deactivated.

**It fails closed.** If the kill switch check throws, or a caller never wired one into the agent's dependencies, the agent treats the switch as ACTIVE and refuses to dial. A safety control that silently degrades to "allow" is not a safety control.

**The kill switch always works. Never write code that can bypass it.**

To deactivate:
```bash
POST /api/v1/killswitch/deactivate
```

### Removing a responder from the roster

To opt a responder out:

1. Remove or deactivate their record in the `responders` table.
2. They will not be selected for any future escalation.
3. Any in-progress call to them will complete (CALL-E handles the live call).
4. Log the opt-out date.

Sameer's backend (`apps/api`) owns the roster admin endpoint.

---

## Failure handling

The system handles all 14 failure modes documented in `CLAUDE.md §9`. Key safety-relevant ones:

| Failure | What happens |
|---|---|
| No answer | Escalate to next rung — never retry the same person immediately |
| Wrong person answers | Withhold all incident details — end and escalate |
| CALL-E API error | Exponential backoff ×3 — then human alert, never silent failure |
| Ladder exhausted | UNRESOLVED state + loud facility manager alert |
| Sensor offline | Separate "asset unreachable" incident — never triggers a call |

---

## Audit trail

Every call produces a permanent audit record:

- Full transcript (stored in `calls.transcript`)
- Structured extraction result (stored in `calls.structured_result` — verbatim, never normalised)
- Evidence strings from CALL-E (stored in `calls.evidence`)
- Confidence score and label
- `trace_id` linking signal → incident → agent decisions → call → outcome

The audit view is accessible at `/ops/history/[incidentId]` in the dashboard.

---

## Contact

For consent issues, roster management, or safety concerns, contact:

**Tanmay Kala** — Technical Lead  
Sentinel Ops, CALL-E Hackathon Team
