# SAFETY

**This skill places real, automated outbound phone calls to real people.**

Read this before running it in any environment. The default configuration dials nobody — you have to opt in deliberately, and the sections below explain exactly what you are opting into.

---

## Consent

### Who may be called

Only numbers in a **pre-registered, consented roster**. There is no code path that dials an arbitrary number, and adding one would defeat every control below.

Each roster entry carries a `consentAt` timestamp — the date that person agreed to receive automated calls from your system. Before you record it, they must have been told:

- what the system is and what triggers a call
- **which hours they may be called, including at night**
- how to opt out, and that opting out is honoured immediately

Consent to be on an on-call rota is not the same as consent to be phoned by software at 3 AM. Ask explicitly.

### What the agent says

Every call opens with a variant of:

> *"This is the automated operations line for [Facility]."*

The agent never implies it is human. **Never edit the prompt to remove this.** If you fork `build_task_prompt.ts`, the self-identification check in `plan_call.ts` will fail your prompt — that check exists precisely to stop this being dropped by accident.

### Third parties

If someone other than the named responder answers, the agent asks only whether the responder is reachable at that number. It **discloses no incident details** — not the asset, not the fault, not the severity — then ends the call and escalates.

An operations incident can imply commercially or personally sensitive information. Someone who picked up a colleague's phone has not consented to hear it.

---

## Setup

```bash
pnpm add @call-e/calle

export CALLE_API_KEY="..."        # never commit this
export CALLE_BASE_URL="https://api.heycall-e.com"

export CALLE_USE_MOCK=true        # start here
```

The skill refuses to start without `CALLE_API_KEY`.

**Develop against the mock driver.** It reproduces all ten responder behaviours — refusal, voicemail, gatekeeper, ambiguity, dropped call — with zero credits spent and zero phones rung. There is no reason to place a live call to test routing logic.

When you are ready for a live call, set `CALLE_USE_MOCK=false` and confirm, for that specific call:

1. the number is in the consented roster
2. it is not inside that facility's quiet hours, or severity is genuinely CRITICAL
3. the kill switch is off
4. you have logged the call

---

## Side effects

Running with `CALLE_USE_MOCK=false` will:

- **Ring a real person's phone**, potentially at night
- **Consume CALL-E call credits** (new accounts start with 20)
- **Create permanent audit records** — full transcript, evidence strings, confidence score, structured result

The transcript and evidence are stored **verbatim**. That is deliberate — it is what makes an automated decision defensible after the fact — but it means conversation content is retained. Tell your responders that calls are recorded and transcribed, and apply your own retention policy to the audit tables.

### Quiet hours

Per facility, with one intentional override:

| Severity | During quiet hours |
|---|---|
| INFO | Never calls |
| WARNING | Blocked |
| CRITICAL | **Calls anyway** |

The CRITICAL override is the reason the system exists — a cold-storage failure at 3 AM cannot wait for morning. It is also the control most likely to make someone angry with you. Set your CRITICAL threshold conservatively, and make sure your roster knows the override exists.

### Limits

All enforced in code, none in the prompt. An LLM instruction is not a safety control.

| Control | Default |
|---|---|
| Max calls per incident | 5 |
| Max escalation rungs | 3 |
| Per-responder cooldown | Per roster entry |
| Call duration ceiling | 180s, never retried |
| API retry | 3 attempts, exponential backoff |

The call cap and the rung cap are separate on purpose. Callback retries burn calls without advancing a rung, so the rung cap alone does not bound how often a phone rings.

---

## Cancellation

### Kill switch — stop all outbound calling

Wire a check into the agent's dependencies:

```ts
isKillSwitchActive: async () => readKillSwitchFromYourStore(),
```

It is checked immediately before **every** dial, on every rung — not once per incident.

**It fails closed.** If the check throws, or you never supplied one, the agent treats the switch as ACTIVE and refuses to dial. A safety control that degrades to "allow" when it breaks is not a safety control.

There is no configuration value, prompt edit, or model output that bypasses it. If you find one, that is a bug — please report it.

### Stop calling one person

Remove them from the roster. They are not selected again. Record the opt-out date.

### A call already in progress

Cannot be cancelled from here. It ends when CALL-E ends it, or when the 180-second duration ceiling trips — whichever comes first. The kill switch prevents the *next* call; it does not hang up the current one.

---

## What it will not do

- Dial a number that is not on the roster
- Navigate an IVR or press keypad options
- Disclose incident details to an unverified answerer
- Claim to be human
- Retry a call that already timed out
- Exceed its caps because a conversation seemed to warrant it

---

## Reporting a safety issue

If you find a way to bypass any control above, treat it as a security issue rather than a bug report, and disclose it privately to the maintainers before filing publicly.
