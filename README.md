# Sentinel Ops

**The wholesale coordination agent powered by [CALL-E](https://heycall-e.com).** Built for the *CALL-E: Your Code Is Calling* hackathon.

> It calls the business that knows the answer, negotiates what is possible, and turns the conversation into an order commitment.

## What It Does

Wholesale and distribution teams still use phone calls to confirm stock, quantity, price, dispatch dates, delivery ETAs, and exceptions. Sentinel Ops sits between a distributor and a wholesaler:

```text
Order or inventory event
        -> Sentinel Ops selects the right business contact
        -> CALL-E places a real phone call
        -> The agent confirms or negotiates the supply commitment
        -> Structured result updates the order
        -> Callback, verification, or escalation is scheduled
```

The hero scenario is an urgent order for 200 units. The wholesaler has 120 ready today and 80 tomorrow. Sentinel Ops captures that partial commitment, updates the order, and schedules follow-up without requiring an operator to transcribe the call.

This is not a generic AI phone caller. CALL-E is the execution layer that obtains live human confirmation when an inventory record, notification, or chatbot cannot provide a reliable commercial commitment.

## Core Capabilities

- Dynamic CALL-E prompts containing order, product, quantity, urgency, and contact context
- Typed extraction of stock, confirmed quantity, remaining quantity, price, dispatch date, delivery ETA, and next action
- Confidence- and evidence-based decisioning
- Escalation from primary contact to backup contact or supervisor
- Handling for partial stock, refusal, voicemail, callback, wrong person, ambiguity, and dropped calls
- Order timeline, call plan, transcript, structured result, and audit evidence
- Optional order, inventory, or IoT/MQTT event triggers
- Mock CALL-E driver for development and the real SDK path for permitted live calls

## Documentation

| Document | Purpose |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Repository architecture and agent operating instructions |
| [docs/PRD_CALL_E_HACKATHON.md](docs/PRD_CALL_E_HACKATHON.md) | Product requirements and locked wholesale workflow |
| [docs/FRONTEND_DESIGN_PLUGINS.md](docs/FRONTEND_DESIGN_PLUGINS.md) | Frontend design system and interaction guidance |
| [apps/web/README.md](apps/web/README.md) | Next.js dashboard setup and implementation notes |
| [SAFETY.md](SAFETY.md) | Consent, side effects, cancellation, and live-call safety |
| [docs/CALLE_TESTING_LOG.md](docs/CALLE_TESTING_LOG.md) | CALL-E findings and live-call budget log |
| [skills/autonomous-incident-escalation/SKILL.md](skills/autonomous-incident-escalation/SKILL.md) | Reusable CALL-E escalation skill |

## Repository Layout

```text
apps/web/                 Next.js operations dashboard
packages/agent/           LangGraph coordination workflow
packages/calle/           CALL-E client, prompt, schema, and mock driver
packages/types/           Shared TypeScript contracts
skills/                   Reusable CALL-E agent skill
logs and docs/            Safety, testing, product, and design documentation
```

The current dashboard includes the operations view, incident/order-style simulator, live call theatre, transcript, timeline, responder/contact states, and safety controls. The remaining integration work is connecting the business-event simulator/API to the agent and streaming the real structured wholesale result back into the dashboard.

## Quick Start

### Requirements

- Node.js 20+
- pnpm 10+
- A CALL-E account for permitted live calls

### Install

```bash
pnpm install
```

### Configure

Copy `.env.example` to `.env` and set the required values:

```dotenv
CALLE_API_KEY=your_key_here
CALLE_BASE_URL=https://api.heycall-e.com
CALLE_USE_MOCK=true
```

Keep `CALLE_USE_MOCK=true` for development and tests. Never place a live call without explicit permission, a consented recipient, and an entry in [docs/CALLE_TESTING_LOG.md](docs/CALLE_TESTING_LOG.md). The recorded demo and deployed path must use the real CALL-E SDK, not a fake result.

### Run the dashboard

```bash
pnpm --dir apps/web dev
```

Open the local URL shown by Next.js, normally `http://localhost:3000`.

### Validate the workspace

```bash
pnpm test
pnpm build
pnpm --dir apps/web build
```

The repository test suite uses the mock driver and does not spend CALL-E calls.

## Real CALL-E Flow

The production path is:

1. An authenticated order, inventory, delivery, or optional IoT event enters the system.
2. The event is validated and receives a `trace_id`.
3. The coordination agent selects a consented wholesaler or distributor contact.
4. A dynamic task prompt and wholesale result schema are created.
5. `@call-e/calle` calls `calle.calls.createAndWait()`.
6. The agent evaluates `structuredResult`, `completionConfidence`, and `evidence`.
7. The order is confirmed, partially confirmed, sent for approval, scheduled for callback, escalated, or routed to human review.

CALL-E's `plan_call` MCP tool should be used for prompt rehearsal before spending live calls. The initial account has 20 calls; three are reserved for final recording.

## Safety Requirements

- Call only pre-registered, explicitly consented business contacts.
- Identify the agent as an automated operations line.
- Do not disclose order details to an unverified person.
- Do not autonomously approve changed prices, credit, legal terms, or other configured commercial boundaries.
- Enforce working hours, contact cooldowns, call caps, timeouts, retries, and the global kill switch.
- Preserve the same `trace_id` through the event, agent, call, result, and order update.

Read [SAFETY.md](SAFETY.md) before configuring live calls.

## Team

| Member | Ownership |
|---|---|
| **Tanmay** | Technical lead, architecture, AI behavior, CALL-E integration, safety, final demo and submission |
| **Aryan** | LangGraph workflow, CALL-E SDK/MCP, prompts, result schema, escalation logic |
| **Sameer** | Backend, database, order persistence, SSE, queues, retries, deployment |
| **Vishal** | Dashboard integration, business-event simulator, optional MQTT/ESP32 adapter, reliability testing |
| **Soham** | UX, design system, call theatre, conversation scenarios, demo visuals |

## Hackathon Submission

The submission requires:

- A functional application using CALL-E SDK, API, MCP, CLI, or Skill
- A pull request to `CALLE-AI/awesome-phone-call-agents`
- A public demonstration video of approximately three minutes
- The CALL-E account email
- A functional demo URL where possible
- Genuine feedback submitted through the CALL-E feedback survey

The intended demo shows a distributor order for 200 units, a real wholesaler call, a partial-stock negotiation, structured extraction, and an automatic order update.

**Deadline:** September 14, 2026 at 9:15 PM IST. **Target submission:** September 13.
