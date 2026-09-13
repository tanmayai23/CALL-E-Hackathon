# Sentinel Ops — Dashboard

The operator-facing frontend for **Sentinel Ops**, the wholesale coordination agent built on [CALL-E](https://heycall-e.com).

> **The dashboard's job is to make an invisible thing visible: an agent calling a supplier, negotiating what is possible, and turning what was said into a commitment the order is updated from.**

Owner: **Vishal** (implementation) · **Soham** (design system, UX)
Requirements: [`docs/PRD_CALL_E_HACKATHON.md`](../../docs/PRD_CALL_E_HACKATHON.md) v2.0 · Backend contract: [`docs/FRONTEND_BACKEND_CONTRACT.md`](../../docs/FRONTEND_BACKEND_CONTRACT.md)

---

## Contents

1. [Quick start](#1-quick-start)
2. [Configuration](#2-configuration)
3. [Architecture](#3-architecture)
4. [Contracts](#4-contracts)
5. [The mock driver](#5-the-mock-driver)
6. [Design system](#6-design-system)
7. [Screens](#7-screens)
8. [Accessibility and QA](#8-accessibility-and-qa)
9. [Deliberate deviations](#9-deliberate-deviations)
10. [Not built in this pass](#10-not-built-in-this-pass)

---

## 1. Quick start

```bash
pnpm install              # from the repository root — it is a pnpm workspace
pnpm --dir apps/web dev
```

Open <http://localhost:3000>, choose **New order**, keep the pre-filled ORD-482 (200 cases, due today) and the **Partial stock** supplier behaviour, and place the call. You land on the order screen and watch the order become a call, a negotiation and a typed commitment: **120 cases today, 80 tomorrow morning**, with a follow-up scheduled for the 80.

| Script | Purpose |
|---|---|
| `pnpm --dir apps/web dev` | Development server |
| `pnpm --dir apps/web build` | Production build — **record the demo against this, never `dev`** |
| `pnpm --dir apps/web start` | Serve the production build |
| `pnpm --dir apps/web lint` | ESLint |
| `./node_modules/.bin/tsc --noEmit` (in `apps/web`) | Type check. Plain `npx tsc` resolves the wrong package inside a workspace. |

**Requirements:** Node 20+, pnpm 10+.

---

## 2. Configuration

One variable decides where the dashboard's data comes from. See [`.env.example`](.env.example).

```bash
# Unset (default) → the in-app mock driver.
# Set            → the real backend.
NEXT_PUBLIC_API_BASE=https://sentinel-api.up.railway.app
```

Every screen talks to the REST + SSE contract in [`docs/FRONTEND_BACKEND_CONTRACT.md`](../../docs/FRONTEND_BACKEND_CONTRACT.md), and only through [`src/lib/api.ts`](src/lib/api.ts). No component knows where its data came from, so **moving to the real backend is a base-URL change, not a rewrite.**

While the mock driver is the source, the command bar shows a persistent `Mock driver` chip. That chip is a requirement, not decoration — see [§5](#5-the-mock-driver).

---

## 3. Architecture

### 3.1 Data flow

```
  ┌──────────────────────────────────────────────────────────────┐
  │  GET  /api/v1/orders/:id           → order + contact ladder  │
  │  GET  /api/v1/orders/:id/stream    → SentinelEvent SSE       │
  └───────────────────────────────┬──────────────────────────────┘
                                  │
                     Zod validation at the boundary
                     (a malformed frame is dropped
                      and counted, never thrown)
                                  │
                                  ▼
               lib/order-view.ts · reduceOrderView()
               pure fold: events → OrderView
                                  │
                                  ▼
               hooks/useOrderStream.ts
               load state · connection state · dispatch
                                  │
                                  ▼
               components/order/OrderTheatre.tsx
               orchestration only — hands each region to a column
```

The reducer has no React and no I/O. Given the same ordered events it always produces the same view, so an order can be replayed from its event log and asserted against without a browser.

The orders board polls `GET /api/v1/orders` and `GET /api/v1/followups` through [`useOrderFeed`](src/hooks/useOrderFeed.ts): every 2 s while something is moving, every 8 s otherwise.

### 3.2 Directory map

```
src/
├── app/
│   ├── page.tsx                     Landing
│   ├── ops/
│   │   ├── layout.tsx               Ops shell wrapper
│   │   ├── page.tsx                 Orders board
│   │   ├── orders/[id]/page.tsx     Order call screen
│   │   └── simulator/page.tsx       New order (business-event simulator)
│   ├── api/v1/                      Mock driver route handlers (see §5)
│   └── globals.css                  Design tokens — the single source of colour
│
├── components/
│   ├── ui/                          Button · Panel · StateChip · ChoicePills · BrandMark · ConnectionStatus
│   ├── shell/                       CommandBar · Navigation · OpsShell
│   ├── landing/                     The nine landing sections
│   ├── ops/                         OrdersBoard · OrderRow · MetricsRail · FollowUpsPanel · NewOrderConsole
│   └── order/                       The order call screen and its panels
│
├── hooks/
│   ├── useOrderStream.ts            SSE subscription + load state
│   ├── useOrderFeed.ts              Polled order list and follow-ups
│   ├── useCallCues.ts               Audible call-state cues
│   └── useClientValue.ts            Browser-only reads without cascading renders
│
└── lib/
    ├── contracts/                   Domain types + Zod event schema (see §4)
    ├── mock/                        The dev harness (see §5)
    ├── order-view.ts                Pure event → view projection
    ├── state-map.ts                 State → colour + icon + label, in one place
    ├── time.ts                      Facility time (IST) — the only place a timezone appears
    ├── motion.ts                    Motion tokens
    ├── sound.ts                     Synthesised call cues
    └── api.ts                       The backend swap point
```

### 3.3 Conventions

- **Panels own their layout; screens own composition.** `OrderTheatre` resolves the five states and delegates. It contains no panel markup.
- **State is derived, not synced.** No effect exists only to copy one piece of state into another.
- **The order update is authoritative.** Once `order.updated` arrives, its quantities are what the order shows — a `null` means nothing was confirmed. Before it, a result counts only if its confidence clears the review floor (`isTrusted` in `order-view.ts`).
- **Grid tracks use `minmax(0, 1fr)`, never a bare `1fr` or an implicit column.** An automatic minimum lets any `truncate` inside force the track wider than its container.
- **`cn()` knows the display sizes.** `tailwind-merge` only knows Tailwind's default scale; [`src/lib/utils.ts`](src/lib/utils.ts) teaches it `text-display-*`, otherwise it reads them as colours and drops them.

---

## 4. Contracts

The dashboard implements the wholesale contract in [`docs/FRONTEND_BACKEND_CONTRACT.md`](../../docs/FRONTEND_BACKEND_CONTRACT.md). **Its status is proposed:** the dashboard runs it end to end against the mock, and it becomes canonical when the backend and agent owners adopt it.

| Contract | Defined here |
|---|---|
| `SentinelEvent` union + Zod schema | [`src/lib/contracts/events.ts`](src/lib/contracts/events.ts) |
| Domain types (`Order`, `Contact`, `WholesaleResult`, `FollowUp`, …) | [`src/lib/contracts/domain.ts`](src/lib/contracts/domain.ts) |
| REST endpoints | [`src/app/api/v1/`](src/app/api/v1) |

> **`packages/types` is deliberately untouched.** The agent and its tests import it, and it still describes the v1 incident model. These files are dashboard-local until the owners migrate; the contract document lists the v1 → v2 event mapping to make that migration mechanical.

### Event handling

Every SSE frame is validated with Zod before it reaches state. Members are **loose objects**: unknown keys pass through rather than being stripped, so a backend carrying `traceId` on the wire keeps it, and an added field never breaks the dashboard mid-demo.

A frame that fails validation is dropped and counted, and the count is shown next to the connection indicator. One malformed event degrades one panel; it never white-screens the dashboard.

---

## 5. The mock driver

A mock that satisfies the identical interface, so the team can build in parallel without spending the 20-call CALL-E budget.

**It is a dev harness. It is never the demo path.** The recorded demo and the deployed app run the real SDK.

```
src/lib/mock/
├── directory.ts             Northgate Distributors, Metro Supply Co., three consented contacts, the product
├── store.ts                 Orders, runs, follow-ups, approvals, kill switch, seeded history
└── scenarios/
    ├── script.ts            ScriptBuilder — word-by-word transcript streaming, IST times
    ├── partial-stock.ts     The hero (PRD §4.1)
    ├── no-answer-escalation.ts
    ├── price-change.ts
    ├── callback.ts
    ├── vague-answer.ts
    └── duplicate-order.ts
```

| Supplier behaviour | What happens | Ends in |
|---|---|---|
| **Partial stock** (hero) | 60% ready today; the agent confirms that part and dates the rest | `PARTIALLY_CONFIRMED`, follow-ups for the remainder and a verification |
| No answer → backup | The primary contact never picks up; the backup confirms everything | `CONFIRMED` on rung 2 |
| Price changed | Stock is fine but the price rose ₹1,850 → ₹2,050; the agent refuses to accept it | `APPROVAL_REQUIRED` → Approve (`CONFIRMED`) or Reject (`HUMAN_REVIEW`) |
| Callback requested | "Call me back at four" | `CALLBACK_SCHEDULED` with a callback follow-up |
| Vague answer | "Sometime this week, probably" — asked once for a date, still none; confidence 0.58 | `HUMAN_REVIEW`; the floor wins over the suggested action |
| Duplicate order | The same order is already awaiting confirmation | `SUPPRESSED`; no call placed |

Every scenario is parameterised by the order from the form: the reference, the quantity and the dates. Each is a list of `{ at, event }` steps replayed in real time over the contract. The SSE route replays the emitted buffer on connect, so a page opened mid-call catches up instead of showing a half-built timeline. `call.state` events carry their own `ts`, so a replayed call keeps its real duration.

The store seeds five past orders across the outcomes, so the board and the follow-ups panel are never empty on a cold start. **Clear live runs** on the New order screen returns to that seed.

### Honesty rules

Everything in `src/lib/mock/` is a **labelled fixture**. None of it is real CALL-E output and none of it is presented as such:

- The command bar shows a persistent `Mock driver` chip whenever the mock is the source.
- The New order screen states plainly that no call is placed and no credit is spent. Its supplier-behaviour picker exists only in mock mode; on the real path the supplier's answer is whatever the person says.
- The call waveform labels itself **"Turn-taking indicator — not an audio visualisation"**, because its bars are driven by call state, not audio.
- The landing's ORD-482 figures are labelled as an example from the hero scenario, and its numbers (90 s ceiling, 3 contacts, 0.70 floor, 1 trace ID) are system properties, not claimed results.

### Data realism

Contacts use realistic Indian names, roles, regions and working hours (09:00–19:00 IST). Phone numbers render **masked** (`+91 98204 ••207`), which is what a real operations console does with contact PII and what keeps a demo recording safe.

---

## 6. Design system

Warm, editorial and minimal: a cream ground, ink type, a serif display face, one lilac call to action and a deep teal brand accent. The reference is [wisprflow.ai](https://wisprflow.ai) — its palette, type and rhythm were measured, not copied.

> **Status:** this replaces the v1 dark mission-control palette. It is flagged for **Soham's review**, since the design tokens are his contract. [`docs/FRONTEND_DESIGN_PLUGINS.md`](../../docs/FRONTEND_DESIGN_PLUGINS.md) still describes v1 and has not been rewritten.

### Tokens

Tokens live in [`src/app/globals.css`](src/app/globals.css). **A colour on screen that is not derived from that block is a bug.**

| Role | Light (default) | Tailwind |
|---|---|---|
| Ground · panel · stone | `#FFFFEB` · `#FFFFF6` · `#E4E4D0` | `bg-canvas` `bg-panel` `bg-stone` |
| Ink · secondary · muted | `#1A1A1A` · `#4D4C45` · `#67665C` | `text-ink` `text-ink-dim` `text-ink-faint` |
| Call to action | lilac `#F0D7FF` with a 2 px ink border | `bg-lilac` `text-on-lilac` |
| Brand bands | teal `#034F46` · ink `#1A1A1A`, cream text | `bg-teal` `bg-band` `text-on-band` |
| States | idle `#67665C` · info `#35578A` · active `#6A3DBF` · warning `#8F5400` · critical `#B8341D` · success `#0A6656` | `text-state-*` |
| Confidence | high · medium · low follow success · warning · critical | `text-conf-*` |

Every text colour clears WCAG 4.5:1 on its ground. The dark theme is warm charcoal and carries the **same semantic roles** at dark-safe values; it is a toggle in the command bar, and cream is the demo theme.

**Brand colours never mean a state.** Lilac and teal are identity; success, warning and so on are the only colours that carry meaning, and each appears with an icon and a label.

### Type

| Face | Use |
|---|---|
| **EB Garamond** 400 | Headlines (`.display`) and big figures (`.display-num`, lining + tabular). The second line of a headline is set in *italic*. |
| **Figtree** 400–600 | Interface text, labels (`.micro`), eyebrows (`.eyebrow`) |
| **Geist Mono** | Every live value (`.data-value`, tabular), so 118 → 120 shifts nothing |

The interface scale is fixed: 12 / 14 / 16 / 20 / 24 / 32 / 48. The landing adds a fluid display scale — `text-display-s/m/l/xl`, 48 to 120 px — that shrinks to fit a phone.

The type classes live in `@layer components`, so a utility on the same element still wins (`eyebrow text-on-band/70`). `.display` and `.display-num` set Tailwind's `--tw-leading`, so a size utility keeps their tight leading while an explicit `leading-*` still overrides it.

### Layout

- One container: max 1200 px, 24/40 px gutters (`.container-page`), on a 12-column grid.
- Section rhythm: 72 px on mobile, 120 px on desktop (`.section`). The landing alternates cream → ink → cream → teal → cream → teal.
- Radii: 8 px small, 12 px buttons, 16 px cards and panels, 32–48 px feature blocks, full pills for nav and chips.
- Flat: elevation comes from surface contrast, not shadow. The one shadow (`--shadow-float`) is reserved for floating elements such as the landing nav.

### Motion

Tokens in [`src/lib/motion.ts`](src/lib/motion.ts). Motion signals a change, never decoration: 150–250 ms, ease-out, one hero animation per screen. `prefers-reduced-motion` stops every loop — the ring pulse, the waveform, the transcript ribbon and the marquee — and they fall back to static states.

---

## 7. Screens

| Route | Screen |
|---|---|
| `/` | Landing — nine sections: floating nav, hero with the call ribbon, "The inventory record is not *the commitment*", how it works, guardrails, the result, safety, FAQ, closing call to action |
| `/ops` | **Orders board** — five metrics, the coordination queue with a fulfilment bar per order, and the follow-ups panel |
| `/ops/simulator` | **New order** — the business-event form (validated with Zod) and, in mock mode, the supplier behaviour |
| `/ops/orders/[id]` | **Order call screen** — on camera for most of the demo |

### The order call screen

Pinned to the viewport from 1280 px wide (the demo runs at 1440 × 900), so **the structured-result strip never leaves the screen**; regions scroll inside. Below 1280 px it becomes two columns with the conversation full width beneath, and the page scrolls.

| Region | Component | Carries |
|---|---|---|
| Header | `OrderHeader` | Reference, buyer → seller, status and urgency, the required-by countdown, trace ID, connection |
| Banner | `ApprovalBanner` / `SuppressionBanner` | Old → new price with Approve and Reject; or why no call was placed |
| Column A | `OrderColumn` | Quantity, price, required-by, the fulfilment bar, why this call, call activity |
| Column B | `ReasoningColumn` | The contact, the contact ladder with its cap, the agent timeline |
| Column C | `ConversationColumn` | Call plan → live transcript, or the suppression case |
| Outcome | `OrderOutcome` | The closing state, the next follow-up, operator time saved |
| Payoff | `StructuredResult` | Confidence against the 0.70 floor, the quantity split, the typed fields with their evidence |

**Details that carry the most weight:**

1. **Evidence highlighting** — the exact phrases CALL-E cited are marked in the transcript, and each field says whether it is evidence-backed or inferred. Numbers are matched as digits or words ("120" or "one hundred twenty"), and "today" or "tomorrow morning" are matched as said.
2. **The quantity split** — "120 / 200 cases secured" over a two-part bar. The whole idea, in one figure.
3. **The review floor drawn on the confidence bar** — and obeyed everywhere: below 0.70 the split reads "claimed", the ladder reads "Unclear · review", and nothing is counted as confirmed.
4. **The approval banner** — persistent, never a toast; the agent cannot accept a changed price, and the screen says so.
5. **Honest connection status** — `Reconnecting…` rather than a silently frozen screen.
6. **The suppression case** — a duplicate order gets its own panels, rather than call panels reading "no conversation *yet*".

### Every screen, every state

All five states exist on every screen: **empty · loading · success · error · partial**. Loading uses skeletons in the shape of the real content, never a centred spinner.

---

## 8. Accessibility and QA

- [x] All five states on every screen
- [x] No dead buttons — unbuilt routes render visibly disabled with a reason
- [x] Focus rings visible; the transcript and timeline are keyboard-reachable regions
- [x] Every state is colour **+ icon + text**
- [x] Text contrast ≥ 4.5:1 on cream, verified per token
- [x] `prefers-reduced-motion` stops every loop
- [x] No horizontal page scroll at 1440, 1280, 1024, 768 and 390
- [x] Tabular figures on every changing value
- [x] A cold start looks intentional (seeded history)
- [ ] Contrast audit with a measuring tool across the dark theme (spot-checked only)
- [ ] Lighthouse run on a production build
- [ ] Tested on the exact machine and browser used for recording

### Performance notes

- The waveform is one `<canvas>`, not dozens of animated DOM nodes.
- The feed polls on an activity-dependent interval rather than a fixed timer.
- Browser-only state is read with `useSyncExternalStore`, not a mount-time `setState`, so no screen renders twice before first paint.

---

## 9. Deliberate deviations

| Spec | What was built | Why |
|---|---|---|
| Shared types in `packages/types` | Dashboard-local contracts | The agent and its tests still import the v1 incident types. Changing them under the owners would break their work; the contract document is the migration path. |
| shadcn/ui | Hand-built primitives with `cva` + `tailwind-merge` | The same copy-in ownership model, without restyling a component library to nothing. |
| Per-field confidence badge | One call-level confidence + per-field **evidence provenance** | CALL-E returns one `completionConfidence` per call. Inventing a score per field would be fabricating a confidence value. Evidence-backed vs inferred is a real, checkable property. |

---

## 10. Not built in this pass

Present in the navigation as **visibly disabled with a reason**:

- **History** — past orders with replay. The event contract already carries everything it needs; it is a screen, not a data problem.
- **Contacts** — the contact directory and ladder configuration.
- A ⌘K command palette.
