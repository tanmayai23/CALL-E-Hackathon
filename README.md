# Sentinel Ops

**The autonomous escalation agent.** Built on [CALL-E](https://heycall-e.com) for the *CALL-E: Your Code Is Calling* hackathon.

> We don't just detect problems — we autonomously coordinate the humans required to solve them.

---

## What it does

Machines fail at 2 AM. Dashboards light up. Notifications get ignored. **Nobody picks up a dashboard.**

Sentinel Ops watches real signals (IoT sensors, system webhooks), decides when a failure genuinely needs a human, then **phones the right human through CALL-E** — holds a real conversation, negotiates an ETA, escalates to the next responder if the first one declines, and writes the confirmed outcome back as structured data.

```
Signal → Reasoning → Decision → Real Phone Call → Negotiation → Structured Commitment → System Update
```

**Why a phone call?** A notification is a broadcast with no guaranteed receipt. A phone call is the only channel that produces a *confirmed, negotiated, human commitment* — and CALL-E turns that commitment into data a workflow can act on.

---

## Documentation

| Document | Purpose |
|---|---|
| **[CLAUDE.md](CLAUDE.md)** | Agent operating instructions — **read first** |
| [docs/PRD_CALL_E_HACKATHON.md](docs/PRD_CALL_E_HACKATHON.md) | Product Requirements Document — source of truth |
| [docs/FRONTEND_DESIGN_PLUGINS.md](docs/FRONTEND_DESIGN_PLUGINS.md) | Frontend design system, plugins, motion, 3D |
| [docs/CALLE_TESTING_LOG.md](docs/CALLE_TESTING_LOG.md) | CALL-E findings + call budget tracker |

---

## Team

| Member | Owns |
|---|---|
| **Tanmay** | Tech lead · AI architecture · conversation quality · submission |
| **Aryan** | LangGraph agent · CALL-E SDK/MCP · API contracts |
| **Sameer** | Database · correlation engine · queue · deployment |
| **Vishal** | Dashboard · 3D/motion · MQTT · simulator · ESP32 |
| **Soham** | Design system · UX · conversation design · demo visuals |

---

## Stack

Next.js 15 · TypeScript · Tailwind · shadcn/ui · Framer Motion · React Three Fiber
Fastify · LangGraph · PostgreSQL · BullMQ · MQTT · Zod
**CALL-E SDK + MCP** · ElevenLabs · Sarvam AI

---

## Status

Pre-build. Scope locked, contracts frozen. See [PRD §16](docs/PRD_CALL_E_HACKATHON.md) for the delivery plan.

**Deadline:** Sep 14, 2026 @ 9:15 PM IST · **Target submission:** Sep 13
