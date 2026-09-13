# Product Requirements Document - SENTINEL OPS

**CALL-E Hackathon: "Your Code Is Calling"**

| Field | Value |
|---|---|
| Product name | **Sentinel Ops** - The Wholesale Coordination Agent |
| Version | v2.0 (Hackathon Build) |
| Owner | Tanmay Kala (Technical Lead) |
| Team | Tanmay, Aryan, Sameer, Soham, Vishal |
| Deadline | **Sep 14, 2026 @ 9:15 PM IST** |
| Target prize | Most Practical Use Case ($4,000) + Most Valuable Feedback ($200) |
| Document status | Locked for build. Scope changes require lead approval. |

## 0. Executive Summary

Small and mid-sized businesses still coordinate wholesale transactions over phone calls. A distributor may need to confirm stock, negotiate quantity, ask for the latest price, arrange dispatch, or report a delay. The wholesaler may have the answer in an ERP or inventory system, but the final commitment still depends on a person answering a phone.

Sentinel Ops is an AI operations agent that sits between a wholesaler and a distributor. When an order, inventory event, delivery delay, or replenishment need requires human confirmation, Sentinel Ops selects the correct contact, calls them through CALL-E, conducts the conversation, negotiates a concrete commitment, extracts structured commercial data, and updates the workflow.

**One sentence for judges:**

> "Sentinel Ops turns wholesale phone coordination into a reliable, auditable workflow: it calls the right business, gets a real commitment, and updates the order automatically."

**Why CALL-E is essential:** inventory systems can show what is recorded, but they cannot reliably obtain a supplier's current stock, dispatch promise, negotiated quantity, or exception reason. A phone call produces a live human confirmation, and CALL-E turns that conversation into structured data.

## 1. Problem Statement

### 1.1 The specific problem

Wholesale and distribution teams lose hours every day making repetitive coordination calls:

1. A distributor needs stock or a delivery update.
2. An operator searches for the right wholesaler contact.
3. The operator calls, waits, retries, or reaches the wrong person.
4. The wholesaler gives a conditional answer such as "we can dispatch tomorrow" or "we only have 120 units."
5. The operator negotiates quantity, price, dispatch time, and fallback options.
6. The operator writes the outcome into an order or spreadsheet.

This process is slow, difficult to audit, and especially fragile when several suppliers must be contacted quickly. Chat and email often do not work because local businesses and field sales teams respond faster to phone calls.

### 1.2 Why current tools fail

| Approach | Limitation |
|---|---|
| Inventory or ERP dashboard | Shows recorded data, not the supplier's current commitment |
| SMS or messaging | Fire-and-forget; no reliable negotiation or acknowledgement |
| Generic chatbot | Cannot reach a supplier who only works by phone |
| Human operator | Expensive, slow, inconsistent, and difficult to scale across suppliers |
| Static robocall | Cannot handle refusal, partial stock, counteroffers, or ambiguous ETAs |

### 1.3 Quantified demo pain

| Metric | Baseline target |
|---|---|
| Manual time per supplier coordination | 8-20 minutes |
| Suppliers contacted for one urgent order | 1-5 |
| Order updates captured manually | 100% of completed calls |
| Target automated call duration | Under 90 seconds |
| Target time from trigger to structured result | Under 3 minutes |

## 2. Product Vision

Sentinel Ops is the communication and commitment layer between business systems and the people who operate the supply chain.

```text
Order or inventory event
        -> Agent assesses the task
        -> Selects wholesaler/distributor contact
        -> CALL-E places a real phone call
        -> Agent confirms stock, price, dispatch, or exception
        -> Structured result updates the order
        -> Verification or escalation is scheduled
```

The product is not a generic AI phone caller. It is a closed-loop wholesale workflow in which the phone call is an instrumented action with typed output, confidence, evidence, escalation, and audit history.

## 3. Hackathon Alignment

The official judging criteria are equally weighted at 25% each.

### 3.1 Real-world impact

- Solves a specific and frequent business operation: supplier and distributor coordination.
- Removes repetitive phone labour while preserving human confirmation.
- Works for businesses where phone communication remains the fastest operational channel.
- Produces a measurable state change: confirmed quantity, price, dispatch time, delivery ETA, or exception.

### 3.2 Quality of idea

- More specific than "AI makes phone calls": the agent coordinates a multi-party wholesale workflow.
- Handles partial stock, refusal, counteroffers, delayed dispatch, callback requests, and escalation.
- Supports both wholesaler and distributor workflows using one reusable coordination skill.
- Can be triggered by an order event, low inventory, delivery exception, or operator request.

### 3.3 Technical implementation

- Imports and calls `@call-e/calle` at runtime.
- Dynamically composes the CALL-E `task` for every order and contact.
- Uses a typed `resultSchema`, `completionConfidence`, and `evidence`.
- Uses a deterministic LangGraph workflow for selection, escalation, review, and verification.
- Preserves `trace_id` across the trigger, call, result, and order update.

### 3.4 Product experience and demo

- One dashboard shows the order, call plan, live call state, transcript, extracted result, and updated commitment.
- The key demo moment is an initial refusal or partial-stock answer followed by a useful negotiated commitment.
- The application makes it obvious why the call was necessary and what changed afterward.

## 4. Primary Use Case

### 4.1 Hero scenario: urgent wholesale replenishment

**Participants:**

- Distributor: Northgate Distributors
- Wholesaler: Metro Supply Co.
- Product: 200 cases of temperature-sensitive medical supplies
- Order: `ORD-482`
- Required dispatch: today

**Trigger:** Northgate's inventory system reports that available stock will fall below its reorder point. The distributor needs 200 cases, but current system data is stale. A human confirmation is required before promising the customer a delivery date.

**Sentinel Ops flow:**

1. Receives an authenticated order or inventory event.
2. Validates the event and assigns a `trace_id`.
3. Confirms that the request is not a duplicate and calculates the delivery time window.
4. Selects the consented Metro Supply contact responsible for this product and region.
5. Composes a CALL-E plan with the order number, quantity, product, target date, and required questions.
6. Calls the wholesaler through CALL-E.
7. Conducts the conversation:

   > **Agent:** "This is the automated operations line for Northgate Distributors. I am calling about order 482 for 200 cases of medical supplies. Can Metro Supply confirm the available quantity and dispatch date?"
   >
   > **Wholesaler:** "We only have 120 cases ready today."
   >
   > **Agent:** "Thank you. Can you dispatch the 120 cases today and confirm when the remaining 80 will be available?"
   >
   > **Wholesaler:** "Yes, 120 today and the remaining 80 tomorrow morning."

8. Extracts quantity, partial fulfilment, dispatch dates, price changes, conditions, and commitment confidence.
9. Updates the order as `PARTIALLY_CONFIRMED` and creates a follow-up for the remaining 80 cases.
10. Schedules a verification call or escalates to the wholesaler's backup contact if the commitment is not confirmed.

### 4.2 Supported coordination tasks

| Task | Required result |
|---|---|
| Stock confirmation | Available quantity and stock status |
| Price confirmation | Unit price, changed price, and approval requirement |
| Dispatch coordination | Dispatch date, carrier, and dispatch commitment |
| Delivery follow-up | Current status, ETA, and delay reason |
| Partial fulfilment | Confirmed quantity and remaining quantity/date |
| Exception handling | Reason, proposed resolution, and next action |
| Callback scheduling | Requested callback time and owner |

### 4.3 Why the call is unavoidable

The product must answer the judge's question: "Why not send a notification?"

Because the inventory record is not the commitment. The supplier may have partial stock, a changed price, a dispatch constraint, or a different ETA. Sentinel Ops calls the person who knows the current reality, negotiates a concrete answer, and writes that answer back into the order workflow.

## 5. Target Users and Roles

| Persona | Role in the workflow | Value |
|---|---|---|
| Distributor operations manager | Creates or monitors purchase requests | Gets confirmed supply commitments without repeated calls |
| Wholesaler sales or dispatch contact | Receives coordination calls | Provides stock, price, and dispatch information once |
| Procurement operator | Handles exceptions and approvals | Reviews only ambiguous or high-risk outcomes |
| Business owner | Needs reliable fulfilment visibility | Reduces missed deliveries and manual follow-up |

The system treats the wholesaler and distributor as business contacts, not anonymous public numbers. Every outbound number must be registered and consented.

## 6. Success Metrics

| Metric | Target | Measurement |
|---|---|---|
| Trigger to confirmed commercial commitment | Under 3 minutes | Event and structured-result timestamps |
| Manual operator labour in the happy path | 0 minutes | No operator intervention before completion |
| Required-field extraction accuracy | Above 90% | Manual scoring across rehearsed calls |
| Calls resulting in a usable next action | Above 80% | Resolved, callback, escalation, or review |
| Ambiguous results auto-closed | 0% | Confidence below 0.7 always reaches review |
| Demo order update latency | Under 5 seconds after result | SSE event timestamp |
| Demo video length | 2:45-3:00 | Public video duration |

## 7. CALL-E Integration Specification

### 7.1 Required runtime capabilities

| Capability | Sentinel Ops use |
|---|---|
| `task` | Generated from order, product, quantity, contact, urgency, and escalation rung |
| `resultSchema` | Extracts commercial facts instead of parsing prose |
| `completionConfidence` | Below 0.7 routes to human review |
| `evidence` | Stores the exact supporting evidence for every outcome |

```typescript
const call = await calle.calls.createAndWait({
  task: buildWholesaleCoordinationPrompt(context),
  resultSchema: WHOLESALE_COORDINATION_RESULT_SCHEMA,
});
```

### 7.2 Wholesale coordination result schema

```typescript
export const WHOLESALE_COORDINATION_RESULT_SCHEMA = {
  type: "object",
  required: ["contact_reached", "stock_status", "next_action"],
  properties: {
    contact_reached: {
      type: "string",
      enum: ["yes", "no", "wrong_person", "voicemail", "unknown"],
    },
    stock_status: {
      type: "string",
      enum: ["confirmed", "partial", "unavailable", "unknown"],
    },
    confirmed_quantity: { type: "number" },
    remaining_quantity: { type: "number" },
    unit_price: { type: "number" },
    currency: { type: "string" },
    dispatch_date: { type: "string" },
    delivery_eta: { type: "string" },
    delay_reason: { type: "string" },
    callback_requested_at: { type: "string" },
    requires_approval: { type: "boolean" },
    verbatim_commitment: { type: "string" },
    next_action: {
      type: "string",
      enum: [
        "CONFIRM_ORDER",
        "PARTIAL_CONFIRMATION",
        "REQUEST_APPROVAL",
        "SCHEDULE_CALLBACK",
        "ESCALATE_NEXT_CONTACT",
        "HUMAN_REVIEW",
      ],
    },
  },
} as const;
```

### 7.3 Dynamic call prompt requirements

Every call prompt must include:

- Automated-line disclosure and business identity.
- Order ID, product, requested quantity, and required date.
- The exact information to confirm: stock, quantity, price, dispatch, delivery ETA, and conditions.
- A partial-fulfilment branch.
- A refusal, callback, wrong-person, voicemail, and ambiguous-answer branch.
- A clear stop condition and a maximum call duration.
- No sensitive details to an unverified person.

The agent may negotiate logistics, but it must not invent prices, approve credit, accept legal terms, or commit either business beyond the extracted authority and configured limits.

### 7.4 Call budget

The initial account has 20 free calls. Use MCP `plan_call` for prompt iteration and mocks for failure testing.

| Phase | Budget | Purpose |
|---|---:|---|
| Connectivity | 2 | Verify authentication and one live call |
| Conversation quality | 4 | Test stock, partial quantity, and refusal branches |
| Edge cases | 5 | No answer, callback, wrong person, ambiguity, voicemail |
| Escalation | 3 | Backup wholesaler or distributor contact |
| Rehearsal | 3 | Full order-to-update flow |
| Recording reserve | 3 | Reserved for final demo; never use early |

## 8. Functional Requirements

### FR-1 - Business event ingestion `[RWI][TI]`

| # | Requirement | Priority |
|---|---|---|
| 1.1 | Accept order, inventory, delivery, and exception events through authenticated HTTP | P0 |
| 1.2 | Accept optional IoT/MQTT inventory or cold-chain signals through an adapter | P1 |
| 1.3 | Provide a deterministic simulator for the hero replenishment scenario | P0 |
| 1.4 | Validate payloads and assign a `trace_id` before workflow execution | P0 |
| 1.5 | Deduplicate repeated order and signal events | P0 |
| 1.6 | Persist the original event for audit | P0 |

### FR-2 - Order and coordination assessment `[RWI][TI]`

| # | Requirement | Priority |
|---|---|---|
| 2.1 | Decide whether the event requires a phone confirmation | P0 |
| 2.2 | Calculate urgency from required date, stock risk, and delivery window | P0 |
| 2.3 | Suppress duplicate or already-confirmed requests | P0 |
| 2.4 | Mark high-risk requests for human approval before commercial commitment | P0 |
| 2.5 | Record every suppression and assessment decision | P1 |

### FR-3 - Contact selection `[TI]`

| # | Requirement | Priority |
|---|---|---|
| 3.1 | Maintain a consented contact roster for wholesalers and distributors | P0 |
| 3.2 | Select by company, product/category, region, working hours, and escalation priority | P0 |
| 3.3 | Support a primary contact, backup contact, and supervisor rung | P0 |
| 3.4 | Enforce cooldown and maximum calls per contact | P0 |
| 3.5 | Allow an operator to override the selected contact | P1 |

### FR-4 - Call planning and execution `[QOI][TI][PXD]`

| # | Requirement | Priority |
|---|---|---|
| 4.1 | Show a human-readable plan before dialing | P0 |
| 4.2 | Place the real call with CALL-E's SDK at runtime | P0 |
| 4.3 | Stream call state and transcript events to the dashboard | P0 |
| 4.4 | Persist status, confidence, evidence, transcript, and structured result | P0 |
| 4.5 | Provide an identical mock driver for development and automated tests | P0 |

### FR-5 - Decision and workflow update `[RWI][TI]`

| # | Requirement | Priority |
|---|---|---|
| 5.1 | Confirm a fully available order when required fields are reliable | P0 |
| 5.2 | Record partial confirmation with confirmed and remaining quantities | P0 |
| 5.3 | Route changed price, credit, or contractual terms to approval | P0 |
| 5.4 | Schedule callbacks and verification calls | P0 |
| 5.5 | Escalate no-answer, refusal, and unusable results to the next contact | P0 |
| 5.6 | Route low-confidence outcomes to human review | P0 |

### FR-6 - Dashboard and audit `[PXD][TI]`

| # | Requirement | Priority |
|---|---|---|
| 6.1 | Display order, contact, call plan, live call state, and extracted fields | P0 |
| 6.2 | Show evidence and confidence beside each important result | P0 |
| 6.3 | Show the original trigger and every decision in a timeline | P0 |
| 6.4 | Allow operator correction before final order commit | P1 |
| 6.5 | Provide replayable demo scenarios without spending live calls | P0 |

### FR-7 - Safety and consent `[QOI]`

| # | Requirement | Priority |
|---|---|---|
| 7.1 | Identify the agent as an automated operations line | P0 |
| 7.2 | Call only pre-registered, explicitly consented business contacts | P0 |
| 7.3 | Enforce business working hours and emergency override policy | P0 |
| 7.4 | Enforce global kill switch, contact cooldown, and incident call caps | P0 |
| 7.5 | Withhold order details from an unverified third party | P0 |
| 7.6 | Document setup, usage, side effects, and cancellation in `SAFETY.md` | P0 |

## 9. Failure Taxonomy

| Failure | Agent behaviour | Outcome |
|---|---|---|
| No answer | Retry once, then call the next consented contact | Escalate |
| Voicemail | Leave a minimal callback message without sensitive order details | Escalate |
| Wrong person | Ask only whether the named contact is reachable | Retry or escalate |
| Partial stock | Confirm available quantity and ask for remaining quantity/date | Partial confirmation |
| Price changed | Extract the new price but require configured approval | Human approval |
| Supplier refuses | Capture reason and ask for the earliest alternative or backup | Escalate |
| Callback requested | Schedule the requested callback; parallel escalation only for urgent orders | Callback |
| Vague ETA | Ask once for a concrete date or number; then review | Human review |
| Call drops | Retry once with the same trace; then escalate | Retry or escalate |
| CALL-E error | Exponential backoff with a fixed cap; then alert an operator | System alert |
| Conflicting quantities | Preserve both statements and route to review | Human review |
| Commitment not fulfilled | Verification call checks dispatch or delivery; then escalate | Exception |

## 10. System Architecture

```text
Order / inventory / optional IoT event
                 |
                 v
       Ingest + Zod validation + trace_id
                 |
                 v
       Correlation and business-rule engine
                 |
                 v
       LangGraph coordination agent
   assess -> select contact -> plan -> call -> decide
      ^                         |          |
      |                         v          v
   escalate <------------- CALL-E     review/approval
                                 |
                                 v
                    Wholesale structured result
                                 |
                                 v
             Order update + callback + verification
                                 |
                                 v
                  Next.js live operations dashboard
```

### 10.1 Agent nodes

| Node | Responsibility | Exits to |
|---|---|---|
| `assess_order` | Decide whether confirmation is needed and calculate urgency | `select_contact` / `suppress` |
| `select_contact` | Choose primary, backup, or supervisor contact | `plan_call` / `human_review` |
| `plan_call` | Build the dynamic wholesale coordination prompt | `execute_call` |
| `execute_call` | Invoke CALL-E and persist all artifacts | `decide` |
| `decide` | Route from structured result and confidence | `confirm` / `partial` / `approval` / `escalate` / `callback` / `review` |
| `escalate` | Advance to the next contact and increase urgency | `select_contact` / `unresolved` |
| `confirm` | Update the order with the verified commitment | `verify` / END |
| `verify` | Confirm dispatch or delivery at the promised time | `confirm` / `escalate` |
| `human_review` | Park uncertain or commercially sensitive cases | `confirm` / `escalate` / END |

Every node emits an event and preserves the same `trace_id`.

## 11. Technology and Repository Plan

| Layer | Choice | Owner |
|---|---|---|
| Frontend | Next.js + TypeScript + Tailwind | Sameer + Vishal |
| Product design | Design tokens, responsive call theatre, accessible states | Soham |
| Realtime | SSE | Sameer |
| Backend | Node.js + Fastify or Next.js route handlers | Sameer |
| Agent | LangGraph for deterministic state transitions | Aryan |
| Telephony | CALL-E SDK + MCP | Aryan + Tanmay |
| Data | PostgreSQL and durable job queue | Sameer |
| Optional physical signal | MQTT + ESP32 inventory/cold-chain simulator | Vishal |
| Validation | Shared Zod schemas | Sameer |
| Deployment | Vercel frontend plus hosted backend | Sameer |

The existing dashboard and agent packages are valuable implementation foundations. The remaining integration work is to connect the business event simulator/API to the agent and stream the real structured outcome back into the dashboard.

## 12. Data Model

```sql
organizations (id, name, role) -- WHOLESALER or DISTRIBUTOR
contacts      (id, organization_id, name, role, phone_e164,
               product_categories[], region, working_hours,
               escalation_priority, consent_at, cooldown_until)
orders        (id, buyer_org_id, seller_org_id, external_order_id,
               status, required_by, trace_id)
order_items   (id, order_id, sku, description, requested_quantity,
               confirmed_quantity, remaining_quantity, unit_price, currency)
signals       (id, organization_id, source, metric, value, raw_payload,
               received_at, trace_id)
coordination_requests (id, order_id, trigger_type, urgency,
                       current_rung, safe_window_minutes, trace_id)
call_plans    (id, request_id, contact_id, task_prompt, result_schema, created_at)
calls         (id, request_id, call_plan_id, calle_call_id, status,
               confidence_score, confidence_label, evidence jsonb,
               structured_result jsonb, transcript text, trace_id)
agent_events  (id, request_id, node, input jsonb, output jsonb,
               decision, reason, created_at, trace_id)
outcomes      (id, request_id, stock_status, confirmed_quantity,
               dispatch_date, delivery_eta, unit_price, next_action,
               verified_at, trace_id)
```

Original payloads and CALL-E results are stored verbatim. No extracted value may silently replace the evidence that supports it.

## 13. IoT and Event Adapters

IoT is optional for the wholesale hero flow, but useful when inventory or cold-chain conditions create the business need for a call.

```text
Temperature / shelf / warehouse sensor
                 -> MQTT adapter
                 -> inventory-risk event
                 -> Sentinel Ops coordination request
                 -> CALL-E wholesaler/distributor call
```

The P0 demo uses a deterministic simulator or authenticated order webhook. The MQTT/ESP32 path is P1/P2 and must never block the core wholesale call demo. Its purpose is to provide an automatic trigger such as low stock, storage risk, or a delivery-condition exception, not to become a second unrelated product.

## 14. Team Ownership

| Member | Role | Owns |
|---|---|---|
| **Tanmay** | Technical Lead / AI Product Engineer | Product scope, system architecture, CALL-E integration, prompt quality, safety gate, final demo and submission |
| **Aryan** | Agent and CALL-E Engineer | LangGraph workflow, dynamic prompts, result schema, confidence routing, escalation and verification |
| **Sameer** | Backend and Data Engineer | Event API, database, order persistence, SSE, queues, retries, deployment |
| **Vishal** | Systems, IoT, and Dashboard Engineer | Business-event simulator, optional MQTT/ESP32 adapter, reliability scenarios, dashboard integration and live states |
| **Soham** | Product Designer and Conversation Experience Lead | UX, design system, call theatre, structured-result presentation, scenario bank, demo visuals |

### 14.1 Frozen contracts

| Boundary | Contract | Owner |
|---|---|---|
| Event -> backend | Order/inventory webhook and optional MQTT payload | Vishal + Sameer |
| Backend -> agent | `WholesaleCoordinationContext` with order, contact, urgency, and `traceId` | Sameer + Aryan |
| Agent -> CALL-E | Dynamic `task` and `WHOLESALE_COORDINATION_RESULT_SCHEMA` | Aryan + Tanmay |
| Backend -> frontend | REST and SSE event schemas | Sameer + Vishal |
| Design -> frontend | Tokens and component specifications | Soham |

## 15. Delivery Plan

### Phase 0 - Validate the core call

- Confirm CALL-E authentication and place one permitted live test call.
- Test stock confirmation, partial stock, refusal, and callback prompts with mocks and `plan_call`.
- Freeze the wholesale coordination result schema and event contracts.
- Finalize the consented wholesaler/distributor demo roster.

### Phase 1 - Vertical slice

```text
Order simulator -> coordination request -> real CALL-E call
-> structured stock/dispatch result -> order update -> dashboard timeline
```

The vertical slice is complete only when a real CALL-E result updates the same order visible in the dashboard.

### Phase 2 - Reliability and safety

- Add backup-contact escalation.
- Add low-confidence review and commercial approval.
- Add callback and verification scheduling.
- Add kill switch, quiet hours, roster consent, rate limits, and idempotency.
- Test every failure in the taxonomy.

### Phase 3 - Demo and submission

- Deploy the demo.
- Run the repository validation script.
- Submit the reusable skill and app contribution to the CALL-E repository.
- Record a public three-minute video.
- Submit the Devpost form, PR URL, video URL, demo URL, and CALL-E account email.
- Submit genuine findings to the CALL-E feedback survey.

## 16. Demo Video Script

| Time | Visual and narration |
|---|---|
| 0:00-0:15 | Show a distributor order waiting for confirmation. "The system knows what was ordered, but not what the wholesaler can actually dispatch." |
| 0:15-0:30 | Enter order `ORD-482`, 200 units, required today. Show Sentinel Ops selecting the consented contact. |
| 0:30-0:45 | Show the generated call plan: stock, quantity, price, dispatch date, and partial-fulfilment questions. |
| 0:45-1:45 | Play the real CALL-E call. The wholesaler says only 120 units are ready; the agent negotiates 120 today and 80 tomorrow. |
| 1:45-2:10 | Show typed result, confidence, evidence, partial confirmation, dispatch dates, and remaining quantity. |
| 2:10-2:30 | Show the order update and scheduled follow-up. Explain that no operator manually transcribed the call. |
| 2:30-2:45 | Show refusal or no-answer escalation to the backup contact. |
| 2:45-3:00 | Show architecture and close: "Sentinel Ops turns wholesale phone coordination into a reliable workflow." |

The real call must be audible before 1:45. The video must remain under three minutes and include subtitles.

## 17. Safety and Compliance

- The agent identifies itself as automated at the beginning of every call.
- Only consented business contacts are callable.
- The agent never discloses order details to an unverified person.
- The agent cannot approve prices, credit, legal terms, or unconfigured commercial exceptions.
- Every call has a timeout, duration cap, retry cap, and trace ID.
- The global kill switch must stop outbound calling.
- `SAFETY.md` remains the authoritative operational safety document.

## 18. Out of Scope for v2.0

1. Automatic payment collection or financial authorization.
2. Binding contracts or legal acceptance by voice.
3. Multi-party conference calls.
4. Inbound call handling.
5. Native mobile applications.
6. Full ERP integrations beyond a generic webhook and demo adapter.
7. More than three escalation rungs.
8. Autonomous approval of changed prices or credit terms.
9. Broad marketplace or public-number calling.

## 19. Post-Hackathon Roadmap

| Horizon | Capability |
|---|---|
| 30 days | ERP connectors, WhatsApp/email handoff, supplier reliability history |
| 90 days | Multi-language supplier conversations and learned contact routing |
| 180 days | Multi-party coordination with buyer, wholesaler, and carrier |
| Vertical expansion | Pharma distribution, restaurant supply, retail replenishment, cold chain |
| Business model | Per-confirmed coordination or per-resolved exception |

## 20. Definition of Winning

> A judge sees an order for 200 units, hears a real wholesaler say only 120 are available, watches the CALL-E agent negotiate a concrete split dispatch, and then sees the typed commitment update the order automatically.

They should be able to repeat:

**"It calls the business that knows the answer, negotiates what is actually possible, and turns the conversation into an order commitment."**

---

*Document owner: Tanmay Kala. Scope changes require lead approval.*
