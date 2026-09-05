# Sentinel Ops — Dashboard

The operator-facing frontend for **Sentinel Ops**, the autonomous incident escalation agent built on [CALL-E](https://heycall-e.com).

> **The dashboard's job is to make an invisible thing visible: an AI agent thinking, deciding, and talking to a human on the phone — live.**

Owner: **Vishal** (implementation) · **Soham** (design system, UX architecture)
Specification: [`docs/FRONTEND_DESIGN_PLUGINS.md`](../../docs/FRONTEND_DESIGN_PLUGINS.md) · Contracts: [`CLAUDE.md`](../../CLAUDE.md) §8

---

## Contents

1. [Quick start](#1-quick-start)
2. [Configuration](#2-configuration)
3. [Architecture](#3-architecture)
4. [Contracts consumed](#4-contracts-consumed)
5. [The mock driver](#5-the-mock-driver)
6. [Design system](#6-design-system)
7. [Screens](#7-screens)
8. [The 3D layer](#8-the-3d-layer)
9. [Accessibility and QA](#9-accessibility-and-qa)
10. [Deliberate deviations](#10-deliberate-deviations)
11. [Not built in this pass](#11-not-built-in-this-pass)

---

## 1. Quick start

```bash
cd apps/web
npm install
npm run dev
```

Open <http://localhost:3000>, go to **Simulator**, and trigger **Cold-chain critical**. You will land in the Live Call Theatre and watch a signal become an incident, a call, a negotiation, and a typed commitment in about thirty seconds.

| Script | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build — **record the demo against this, never `dev`** |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type check |

**Requirements:** Node 20+. The project uses npm (the spec suggests pnpm; either works — only the lockfile differs).

---

## 2. Configuration

One variable decides where the dashboard's data comes from. See [`.env.example`](.env.example).

```bash
# Unset (default) → the in-app mock driver.
# Set            → Sameer's backend.
NEXT_PUBLIC_API_BASE=https://sentinel-api.up.railway.app
```

Every screen talks to the REST + SSE contract in [`CLAUDE.md`](../../CLAUDE.md) §8.2/§8.3 and nothing else, through [`src/lib/api.ts`](src/lib/api.ts). No component knows where its data came from, so **integration is a one-line change, not a week of discovery.**

When the mock driver is active the command bar shows a persistent `Mock driver` chip. That indicator is not decorative — see [§5](#5-the-mock-driver).

---

## 3. Architecture

### 3.1 Data flow

```
  ┌──────────────────────────────────────────────────────────┐
  │  GET  /api/v1/incidents/:id          → incident + meta   │
  │  GET  /api/v1/incidents/:id/stream   → SentinelEvent SSE │
  └───────────────────────────┬──────────────────────────────┘
                              │
                    Zod validation at the boundary
                    (a malformed frame is dropped
                     and counted, never thrown)
                              │
                              ▼
              lib/incident-view.ts · reduceIncidentView()
              pure fold: events → IncidentView
                              │
                              ▼
              hooks/useIncidentStream.ts
              load state · connection state · dispatch
                              │
                              ▼
              components/incident/IncidentTheatre.tsx
              orchestration only — hands each region to a column
```

The reducer is deliberately free of React and I/O. Given the same ordered events it always produces the same view, so an incident can be replayed from its event log and asserted against without a browser.

### 3.2 Directory map

```
src/
├── app/
│   ├── page.tsx                     Landing
│   ├── ops/
│   │   ├── layout.tsx               Ops shell wrapper
│   │   ├── page.tsx                 Incident Command
│   │   ├── incident/[id]/page.tsx   Live Call Theatre
│   │   └── simulator/page.tsx       Scenario control
│   ├── api/v1/                      Mock driver route handlers
│   └── globals.css                  Design tokens — the single source of colour
│
├── components/
│   ├── ui/                          StateChip · Panel · Button · ConnectionStatus
│   ├── shell/                       CommandBar · Navigation · OpsShell
│   ├── ops/                         IncidentCommand · IncidentRow · MetricsRail
│   ├── incident/                    The Live Call Theatre and its panels
│   └── three/                       FacilityStage (lazy boundary) · FacilityView (R3F)
│
├── hooks/
│   ├── useIncidentStream.ts         SSE subscription + load state
│   ├── useIncidentFeed.ts           Polled incident list
│   ├── useCallCues.ts               Audible call-state cues
│   └── useClientValue.ts            Browser-only reads without cascading renders
│
└── lib/
    ├── contracts/                   Frozen types + Zod schemas (see §4)
    ├── mock/                        The dev harness (see §5)
    ├── incident-view.ts             Pure event → view projection
    ├── state-map.ts                 State → colour + icon + label, in one place
    ├── motion.ts                    Motion tokens
    ├── sound.ts                     Synthesised call cues
    └── api.ts                       The backend swap point
```

### 3.3 Component conventions

- **Panels own their layout; screens own composition.** `IncidentTheatre` resolves the five states and delegates; it contains no panel markup.
- **State is derived, not synced.** No effect exists purely to copy one piece of state into another.
- **`Panel` bodies fill by default.** Pass `flex-none` alongside a height when a panel must stay a fixed size — `flex-1` otherwise wins and the body grows.
- **Grid tracks use `minmax(0, 1fr)`, never a bare `1fr`.** A bare `1fr` has an automatic minimum, so any `truncate` inside (which sets `white-space: nowrap`) forces the track wider than its container and pushes a horizontal scrollbar onto the page.

---

## 4. Contracts consumed

**These are frozen and owned by Sameer** ([`CLAUDE.md`](../../CLAUDE.md) §8, Rule 4). Changing one silently breaks four other people's work.

| Contract | Defined here | Canonical source |
|---|---|---|
| `SentinelEvent` union + Zod schema | [`src/lib/contracts/events.ts`](src/lib/contracts/events.ts) | CLAUDE.md §8.3 |
| Domain types (`Incident`, `Responder`, …) | [`src/lib/contracts/domain.ts`](src/lib/contracts/domain.ts) | CLAUDE.md §7, §8.1 |
| REST endpoints | [`src/app/api/v1/`](src/app/api/v1) | CLAUDE.md §8.2 |

> **⚠️ Known duplication.** [`CLAUDE.md`](../../CLAUDE.md) §13 places the canonical types in `packages/types`, imported by both frontend and backend — one definition, never two. **That package does not exist in this repository yet.** The files above are a faithful mirror, kept in one place so the swap is a single import change:
>
> ```ts
> import { SentinelEventSchema, type SentinelEvent } from "@sentinel/types";
> ```
>
> Until then, treat them as read-only. If a field must change, it changes in both places at once with the owner's agreement.

### Event handling

Every SSE frame is validated with Zod before it reaches state. Members are **loose objects**: unknown keys pass through rather than being stripped, so a backend carrying `traceId` on the wire (Rule 7) does not get it silently deleted, and an added field never breaks the dashboard mid-demo.

A frame that fails validation is dropped, counted, and the count is shown next to the connection indicator. One malformed event degrades one panel; it never white-screens the dashboard.

---

## 5. The mock driver

Implements FR-5.6 — a mock that satisfies the identical interface so five people can build in parallel without burning the 20-call CALL-E budget.

**It is a dev harness. It is never the demo path.** The recorded demo and the deployed app both run the real SDK.

```
src/lib/mock/
├── facility.ts              Northgate: 5 assets, 4 consented responders
├── store.ts                 In-memory incidents, replay engine, kill switch
└── scenarios/
    ├── script.ts            ScriptStep, word-by-word transcript streaming
    ├── cold-chain-critical.ts   The hero scenario (PRD §4.1)
    ├── refusal-escalation.ts    3 rungs, no human in the loop
    ├── transient-spike.ts       Suppression — F13
    └── sensor-offline.ts        Asset unreachable — F12
```

Each scenario is a list of `{ at, event }` steps replayed in real time over the frozen contract. The SSE route replays its whole emitted buffer on connect, so a page loaded mid-call catches up rather than showing a half-built timeline.

### Honesty rules (Rule 8)

Everything in `src/lib/mock/` is a **labelled fixture**. None of it is real CALL-E output and none is presented as such:

- The command bar shows a persistent `Mock driver` chip whenever the mock is the source.
- The simulator states plainly that no call is placed and no credit is spent.
- The call waveform labels itself **"Turn-taking indicator — not an audio visualisation"**, because its bars are driven by call state, not audio. Per §4.4 it must never be called "live audio" in the UI or the narration. When real audio is available, swap the amplitude source for an `AnalyserNode` and change that label with it.

### Data realism

The roster uses realistic Indian names, roles, shifts and zones — §13 lists `John Doe` / `+1 555-0100` / lorem ipsum as an anti-pattern that instantly undermines credibility. Phone numbers render **masked** (`+91 98204 ••207`), which is what a real ops console does with responder PII and what keeps a demo recording safe.

---

## 6. Design system

Tokens live in [`src/app/globals.css`](src/app/globals.css) and are the single source of colour.

> **Rule: if a colour appears on screen that is not derived from that block, it is a bug.**

| Layer | Tokens |
|---|---|
| Surfaces | `--bg-base` `--bg-panel` `--bg-elevated` `--border-subtle` `--border-strong` |
| Text | `--text-primary` `--text-secondary` `--text-muted` |
| Semantic states | `--state-idle` `--state-info` `--state-active` `--state-warning` `--state-critical` `--state-success` |
| Confidence | `--conf-high` `--conf-medium` `--conf-low` |

Exposed to Tailwind through `@theme` as `bg-panel`, `text-ink-dim`, `border-state-critical/50` and so on. **Colour is semantic only** — never an accent for aesthetics.

Light mode re-renders the *same semantic roles* at contrast-safe values on light surfaces. No new hues are introduced. Dark is the default and the demo theme.

### Non-negotiables

- **Every state is colour + icon + text.** [`StateChip`](src/components/ui/StateChip.tsx) has no variant that renders a bare dot, because a bare dot fails both a screen reader and a judge watching a compressed video. All state → chip mappings live in [`src/lib/state-map.ts`](src/lib/state-map.ts).
- **All live numbers use `.data-value`** (monospace + `tabular-nums`), so a temperature ticking 9.8 → 10.4 shifts nothing.
- **Fixed type scale:** 12 / 14 / 16 / 20 / 24 / 32 / 48. Nothing between.
- **Elevation is border contrast, not shadow.** Shadows only on true overlays.

### Art direction

Mission-control instrument panel — an aircraft cockpit, a NOC wall, a trading terminal. Not a SaaS marketing site. Visual interest comes from typography, grid tension, density, and texture built from existing tokens at varying alpha: a 32px survey grid, film grain, hairline rules, viewfinder corner brackets, diagonal hatching for deliberately blank regions.

§13 lists the purple/blue AI gradient hero as the first anti-pattern. There are no decorative gradients in this app.

### Motion

Tokens in [`src/lib/motion.ts`](src/lib/motion.ts). Motion signals change, never decoration; 150–250 ms; ease-out; 60 ms stagger; **one hero animation per screen**.

`prefers-reduced-motion` is respected globally and **looping animations stop entirely** — the ring pulse, the sweep and the waveform all fall back to static indicators.

---

## 7. Screens

| Route | Screen | Effort budget |
|---|---|---|
| `/` | Landing | 5% |
| `/ops` | Incident Command | 20% |
| `/ops/incident/[id]` | **Live Call Theatre** | **45%** |
| `/ops/simulator` | Scenario control | — |

### The Live Call Theatre

The screen that is on camera for 60 of the demo's 180 seconds. Layout follows §4.1 and is pinned to the viewport at 1440×900 so **the structured-result strip never leaves the screen**; regions scroll internally instead.

| Region | Component | Carries |
|---|---|---|
| Header | `IncidentHeader` | Asset, severity, draining safe-window clock, trace ID, connection status |
| Column A | `SignalColumn` | 3D facility, telemetry curve, call activity |
| Column B | `ReasoningColumn` | Responder, escalation ladder, agent timeline |
| Column C | `ConversationColumn` | Call plan → live transcript (or the suppression case) |
| Outcome | `IncidentOutcome` | Closing state and human time saved |
| Payoff | `StructuredResult` | Typed extraction, confidence, evidence |

**Details that carry the most weight** (§12, ranked):

1. **Evidence highlighting** — when extraction lands, the exact phrases CALL-E cited are marked *in place* in the transcript. Nothing else proves as cheaply that the extraction is not hallucinated.
2. **The escalation ladder travelling** on refusal — one animation that makes an autonomous decision legible.
3. **The human-review threshold drawn on the confidence bar** — the system showing it knows what it does not know.
4. **A live time-saved counter** — the technical demo connected to a business number.
5. **Honest connection status** — `● Reconnecting…` rather than a silently frozen UI.
6. **The suppression case** — a suppressed incident gets its own panels rather than call panels reading "no conversation *yet*". Nothing is coming, and an empty state that implies otherwise is a small lie the UI does not need to tell.

### Every screen, every state

All five states are implemented on every screen: **empty · loading · success · error · partial**. Loading uses skeletons shaped like the real content — never a centred spinner, which causes layout shift when content arrives.

---

## 8. The 3D layer

React Three Fiber, scoped hard per §5.

**Justification:** a unit failing in Zone A while the technician is in Sector 7 is a spatial fact, and spatial facts read faster in 3D than in a table. If it stops communicating state faster than a 2D card, it gets cut.

- Extruded boxes, severity-coloured, pulse rate encoding urgency. No PBR, no physics, no post-processing.
- Colours are read from the CSS custom properties at runtime, so the 3D layer obeys the same token contract as the DOM and follows the light/dark switch.
- The camera solves its distance from the facility bounds and the panel's actual aspect ratio, so one component frames correctly in both the wide overview and the narrow theatre column.
- **Lazy-loaded** via `next/dynamic` with `ssr: false`. It never blocks first paint.
- **Degrades to a 2D floor plan** on a toggle, persisted per operator — which is also the documented fallback if the recording machine drops below 60fps.

---

## 9. Accessibility and QA

Current status against the §8.1 checklist:

- [x] All five states implemented on every built screen
- [x] No dead buttons — unbuilt routes render visibly disabled with a stated reason
- [x] Focus rings visible; transcript and timeline are keyboard-reachable regions
- [x] All state conveyed by colour **+ icon + text**
- [x] `prefers-reduced-motion` respected; loops stop entirely
- [x] Responsive at 1440 (demo), 1024, 768, and 390 — no horizontal page scroll at any width
- [x] `tabular-nums` on every changing value
- [x] Cold start with an empty store looks intentional
- [x] 3D lazy-loaded and degrades to 2D
- [ ] Contrast audit with a measuring tool (spot-checked only)
- [ ] Lighthouse run on a production build
- [ ] Tested on the exact machine and browser used for recording

### Performance notes

- The waveform is a single `<canvas>`, not 68 animated DOM nodes.
- The canvas is absolutely positioned inside a relative box. As a replaced element its intrinsic size sets `min-height: auto`, so a plain `flex-1` canvas cannot shrink below the pixel height assigned to it and slowly grows out of its panel.
- The incident feed polls on an activity-dependent interval (2s busy / 8s idle) rather than a fixed timer.
- Browser-only state is read with `useSyncExternalStore`, not a mount-time `setState`, so no screen cascades an extra render before first paint.

---

## 10. Deliberate deviations

Three choices differ from the letter of the spec. Each is a judgement call and is open to being reversed.

| Spec | What was built | Why |
|---|---|---|
| recharts | Hand-drawn SVG telemetry curve | The instrument look — shaded safe band, dashed ceiling, right-rail ticks, breathing head marker — fights a chart library's defaults the whole way. ~90 lines and no bundle cost. |
| shadcn/ui | Hand-built primitives with `cva` + `tailwind-merge` | Same ownership model the spec wants from shadcn (copy-in, no version lock), following the same file conventions, without theme-fighting a component library that would be restyled to nothing anyway. |
| Per-field confidence badge (§4.5) | One call-level confidence + per-field **evidence provenance** | CALL-E returns one `completionConfidence`; it is call-level. Inventing a score per field to fill the layout would be fabricating a confidence value, which Rule 8 forbids. Evidence-backed vs inferred is a real, checkable property — and it does the §12 #1 job better. |

---

## 11. Not built in this pass

Scoped out deliberately. Present in the nav as **visibly disabled with a reason**, per the rule that a settings page full of non-functional switches is worse than no settings page.

- `/ops/history` and `/ops/history/[id]` — incident history and one-click replay (P1)
- `/ops/roster` — responder roster and ladder configuration (P2)
- `/ops/assets` — asset and threshold configuration (P2)
- ⌘K command palette (P2)

The event contract already carries everything history needs; it is a screen, not a data problem.
