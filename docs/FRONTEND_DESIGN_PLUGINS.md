# Frontend Design & Plugins Guide — Sentinel Ops

**Owners:** Vishal (implementation) · Soham (design system, UX architecture, visual polish)
**Consumes:** the SSE + REST contract owned by Sameer · design tokens owned by Soham
**Judged under:** Product Experience & Demo (25% of the total score)

---

## 0. The one rule that governs every decision in this document

> **The dashboard's job is to make an invisible thing visible: an AI agent thinking, deciding, and talking to a human on the phone — live.**

Everything that serves that goal gets built beautifully. Everything that doesn't gets cut. A judge watching the demo video must understand what the agent is doing *without narration*.

**The single most important screen is not the landing page.** It is the **Live Call Theatre** (§4) — the screen that is on camera for 60 of the demo's 180 seconds. Budget your effort accordingly:

| Screen | Effort budget | Why |
|---|---|---|
| Live Call Theatre | **45%** | On camera for a third of the demo |
| Incident Command (ops overview) | 20% | Establishes context in the opening shot |
| Structured Result panel | 15% | The payoff moment — proves CALL-E returns real data |
| Incident Timeline / Audit | 10% | Credibility, technical depth |
| Landing page | 5% | Judges see it for 3 seconds |
| Settings / roster admin | 5% | Functional, unstyled is acceptable |

---

## 1. Core Stack

```bash
# Framework
next@15                    # App Router, React Server Components, streaming
typescript@5
tailwindcss@4
@tailwindcss/typography

# Component system
shadcn/ui                  # copy-in components — own the code, no version lock
lucide-react               # icon set — one family, no mixing
class-variance-authority   # typed component variants
tailwind-merge clsx        # className composition

# Motion & 3D
framer-motion              # layout + state transitions
@react-three/fiber         # 3D facility view
@react-three/drei          # helpers: OrbitControls, Environment, Html, Float
three

# Data
@tanstack/react-query      # server state, caching, polling
zod                        # shared FE/BE validation — same schemas as backend

# Forms
react-hook-form
@hookform/resolvers

# Charts
recharts                   # telemetry curves, metrics

# Realtime
# Native EventSource for SSE — no library needed.
# socket.io-client only if we fall back to WebSockets.

# Utilities
date-fns                   # timestamps, durations, "4 minutes ago"
sonner                     # toast notifications
cmdk                       # command palette (⌘K) — high perceived polish, low cost
```

### 1.1 Install

```bash
pnpm create next-app@latest sentinel-ops --typescript --tailwind --app --use-pnpm
cd sentinel-ops
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button card badge dialog sheet tabs table \
  form input select separator skeleton tooltip scroll-area sonner command
pnpm add framer-motion @react-three/fiber @react-three/drei three \
  @tanstack/react-query zod react-hook-form @hookform/resolvers \
  recharts date-fns lucide-react class-variance-authority tailwind-merge clsx cmdk
```

### 1.2 Deliberate omissions

| Not using | Why |
|---|---|
| Redux / Zustand / Jotai | React Query + URL state covers everything here. Extra state libraries are a liability in a 21-day build. |
| GSAP | Framer Motion covers our needs and integrates with React lifecycle. |
| Three.js post-processing stack | Bloom/DOF costs frames and adds nothing at our scale. |
| Component libraries with heavy runtimes (MUI, Chakra) | shadcn/ui gives us owned, tweakable code with no theme-fighting. |
| Lottie | One more asset pipeline. CSS + Framer Motion covers our animations. |

---

## 2. Visual Design System (Soham owns)

### 2.1 Design direction

**Mission-control instrument panel.** The reference points are an aircraft cockpit, a NOC wall, a trading terminal — not a SaaS marketing site.

| Principle | Meaning in practice |
|---|---|
| **Dark-first** | Ops rooms are dark. Dark mode is the default and the demo theme; light mode is a supported alternative, not an afterthought. |
| **Data is the decoration** | No decorative gradients, no stock illustrations, no glassmorphism for its own sake. The live numbers ARE the visual interest. |
| **Colour is semantic only** | Every colour means a state. Never use accent colour for aesthetics. |
| **Motion signals change** | Animation exists to show that something changed, never to entertain. |
| **Density over whitespace** | An operator needs many facts at once. This is not a landing page. |

### 2.2 Colour tokens

Semantic, not decorative. Define once in `globals.css` as CSS variables.

```css
:root {
  /* Surfaces — dark-first */
  --bg-base:        #0A0C10;   /* page background */
  --bg-panel:       #12151C;   /* cards, panels */
  --bg-elevated:    #1A1F29;   /* modals, popovers */
  --border-subtle:  #232935;
  --border-strong:  #333B4A;

  /* Text */
  --text-primary:   #E8ECF2;
  --text-secondary: #98A2B3;
  --text-muted:     #5F6B7F;

  /* Semantic states — these are the ONLY accent colours */
  --state-idle:     #5F6B7F;   /* grey    — nothing happening */
  --state-info:     #3B82F6;   /* blue    — informational */
  --state-active:   #06B6D4;   /* cyan    — agent is working / call live */
  --state-warning:  #F59E0B;   /* amber   — degrading, attention needed */
  --state-critical: #EF4444;   /* red     — critical incident */
  --state-success:  #10B981;   /* green   — resolved, commitment secured */

  /* Confidence scale — used on extracted fields */
  --conf-high:      #10B981;   /* >= 0.85 */
  --conf-medium:    #F59E0B;   /* 0.70–0.84 */
  --conf-low:       #EF4444;   /* < 0.70 → human review */
}
```

**Rule:** if a colour appears on screen that is not in this list, it is a bug.

### 2.3 Typography

| Role | Font | Usage |
|---|---|---|
| UI / headings | **Geist Sans** (or Inter) | All interface text |
| Data / numbers / IDs | **Geist Mono** (or JetBrains Mono) | Telemetry values, asset IDs, trace IDs, timestamps, transcript |
| Scale | 12 / 14 / 16 / 20 / 24 / 32 / 48 | Nothing between — a fixed scale prevents drift |

**Monospace for all live data.** Numbers that change must not reflow the layout — use `tabular-nums` and monospace so a temperature ticking from 9.8 → 10.4 doesn't shift pixels. This detail is what separates a professional dashboard from a student project on camera.

```css
.data-value {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
```

### 2.4 Spacing, radius, elevation

- **Spacing:** 4px base scale — 4, 8, 12, 16, 24, 32, 48, 64. Nothing else.
- **Radius:** `--radius-sm: 6px`, `--radius-md: 10px`, `--radius-lg: 14px`. Panels use md. Never mix more than two radii on one screen.
- **Elevation:** dark UI uses *border contrast*, not shadow. `--border-subtle` for resting, `--border-strong` for focus/active. Shadows only on true overlays (modal, popover).

### 2.5 The state chip — the most reused component in the app

Every state in the system renders through one component. Consistency here is what makes the UI read as a system.

```tsx
// components/StateChip.tsx
const chipVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium " +
  "border transition-colors",
  {
    variants: {
      state: {
        idle:     "border-[--state-idle]/30     bg-[--state-idle]/10     text-[--state-idle]",
        info:     "border-[--state-info]/30     bg-[--state-info]/10     text-[--state-info]",
        active:   "border-[--state-active]/40   bg-[--state-active]/15   text-[--state-active]",
        warning:  "border-[--state-warning]/40  bg-[--state-warning]/15  text-[--state-warning]",
        critical: "border-[--state-critical]/50 bg-[--state-critical]/15 text-[--state-critical]",
        success:  "border-[--state-success]/40  bg-[--state-success]/15  text-[--state-success]",
      },
      pulse: { true: "animate-pulse-ring", false: "" },
    },
    defaultVariants: { state: "idle", pulse: false },
  }
);
```

**Accessibility rule (non-negotiable):** every state is communicated by **colour + icon + text label**. Never colour alone. A red dot with no label fails both accessibility and a judge watching a compressed video.

---

## 3. Screen Architecture

```
/                          Landing — 3 seconds of judge attention. One sentence + demo CTA.
/ops                       Incident Command — the operational overview (opening shot)
/ops/incident/[id]         Live Call Theatre — THE screen (money shot)
/ops/history               Incident history + one-click replay
/ops/history/[id]          Full audit timeline for a past incident
/ops/roster                Responder roster + escalation ladder config
/ops/assets                Asset + threshold configuration
/ops/simulator             Trigger control — fire a scenario on demand (demo tool)
```

### 3.1 `/ops/simulator` is a real screen, not a hack

Give the demo trigger a proper UI: pick a scenario (cold-chain critical / transient spike / sensor offline), press **Trigger**. It reads as a product feature ("scenario testing"), it makes the demo reproducible, and it means the judge can run the flow themselves on the deployed URL. This single screen materially raises the Product Experience score.

---

## 4. THE LIVE CALL THEATRE (`/ops/incident/[id]`)

> 45% of the frontend effort. 60 seconds of the demo video. Build this first, polish it last.

### 4.1 Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ CS-04 · Cold Storage · Northgate      [CRITICAL]  Safe window: 87m ▾         │  Header
├────────────────────────────┬─────────────────────────────────────────────────┤
│                            │                                                 │
│   ┌────────────────────┐   │   AGENT TIMELINE                                │
│   │                    │   │   ● Signal received          02:14:33           │
│   │   3D ASSET VIEW    │   │   ● Correlated 15 readings   02:14:34           │
│   │   pulsing red      │   │   ● Severity: CRITICAL       02:14:34           │
│   │   temp: 12.4°C     │   │   ● Responder: R. Sharma     02:14:35           │
│   │                    │   │   ● Call plan composed       02:14:36           │
│   └────────────────────┘   │   ◉ Calling…                 02:14:41  ← live   │
│                            │                                                 │
│   ┌────────────────────┐   ├─────────────────────────────────────────────────┤
│   │ TELEMETRY CURVE    │   │   LIVE TRANSCRIPT                    ◉ 00:42    │
│   │  ╱                 │   │   ┌─────────────────────────────────────────┐   │
│   │ ╱  threshold ─ ─ ─ │   │   │ AGENT  This is the automated operations │   │
│   └────────────────────┘   │   │        line for Northgate Facility…     │   │
│                            │   │ HUMAN  I'm on another job in Sector 7.  │   │
│   ┌────────────────────┐   │   │ AGENT  Understood. What time could you  │   │
│   │ CALL WAVEFORM      │   │   │        realistically reach Northgate?   │   │
│   │  ▁▃▅█▅▃▁▃▅█▃▁      │   │   └─────────────────────────────────────────┘   │
│   └────────────────────┘   │                                                 │
├────────────────────────────┴─────────────────────────────────────────────────┤
│  STRUCTURED RESULT         Confidence 0.92 HIGH        [Accept] [Override]   │  Result
│  responder_available: conditional   eta_minutes: 40   within_window: ✓       │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Call state machine → visual language

Each state has a distinct, unmistakable visual signature. A viewer should know the state from a still frame.

| State | Chip | Motion | Sound cue (optional) |
|---|---|---|---|
| `queued` | idle · "Queued" | Static | — |
| `dialling` | active · "Dialling…" | Concentric ring pulse, 1.2s loop | Soft ring |
| `connected` | active · "Connected" | Ring snaps to solid, single flash | Connect blip |
| `in_conversation` | active · "In conversation" | Live waveform + typing transcript | Live audio |
| `extracting` | info · "Extracting result" | Shimmer over the result panel | — |
| `completed` | success · "Completed" | Fields settle in with stagger | Success tone |
| `failed` / `no_answer` | critical · "No answer" | Sharp shake, then escalation arrow animates to next rung | Error tone |
| `escalating` | warning · "Escalating → rung 2" | Ladder rung highlights, arrow travels down | — |

### 4.3 The transcript component

This is what the judge reads. Get it right.

- **Streaming word-by-word**, not line-by-line — it must feel live, not batched.
- **Auto-scroll with escape hatch:** pin to bottom while live; if the user scrolls up, stop auto-scrolling and show a "↓ Jump to live" button.
- **Speaker differentiation:** `AGENT` in `--state-active`, `HUMAN` in `--text-primary`. Left border stripe, not a chat bubble — this is a transcript, not a messaging app.
- **Timestamp per turn** in `--text-muted`, monospace.
- **Highlight evidence spans:** when the structured result arrives, highlight the exact transcript phrases CALL-E returned in `evidence[]`. **This is the highest-value detail in the entire UI** — it visually proves the extraction came from the real conversation, not from a hallucination.

```tsx
<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.2, ease: "easeOut" }}
  className={cn(
    "border-l-2 pl-3 py-2 font-mono text-sm",
    speaker === "AGENT"
      ? "border-[--state-active] text-[--state-active]"
      : "border-[--border-strong] text-[--text-primary]"
  )}
>
  <span className="text-xs text-[--text-muted] mr-2">{ts}</span>
  {highlightEvidence(text, evidenceSpans)}
</motion.div>
```

### 4.4 The waveform

A live audio waveform is the strongest possible signal that a **real call is happening**. Do not skip it.

- Render with the Web Audio API `AnalyserNode` if live audio is available; otherwise drive bars from call-state events with a seeded pseudo-random amplitude that responds to speaking turns.
- Canvas, not 60 animated DOM nodes.
- `--state-active` when the agent speaks, `--text-secondary` when the human speaks. The alternating colour makes turn-taking legible at a glance.

> **Honesty rule:** if the bars are not driven by real audio, they are a *state indicator*, not an audio visualisation. Never label it "live audio" in the UI or claim it as such in the demo narration. The call is real; the visualisation just needs to not overstate what it is.

### 4.5 The structured result panel — the payoff

When CALL-E returns `structuredResult`, fields must **land** with weight. This is the moment that proves the whole thesis.

```tsx
// Stagger each field in — 60ms apart. Feels like data arriving, not a page render.
<motion.div
  initial={{ opacity: 0, x: -12 }}
  animate={{ opacity: 1, x: 0 }}
  transition={{ delay: index * 0.06, duration: 0.25 }}
>
  <span className="text-xs text-[--text-muted]">{field.label}</span>
  <span className="font-mono text-lg tabular-nums">{field.value}</span>
  <ConfidenceBadge score={field.confidence} />
</motion.div>
```

Each field shows: **label · monospace value · confidence badge · evidence-quote tooltip on hover**.

Fields with confidence `< 0.70` render in `--conf-low` with an **Edit** affordance and a "Needs review" chip — implementing FR-6.3 and FR-6.6 visibly.

---

## 5. 3D Layer (React Three Fiber) — Scoped and Justified

### 5.1 The justification test

> 3D is included **only** because a facility with physical assets in physical locations is genuinely spatial information. A cold-storage unit failing in Zone A while the technician is in Sector 7 is a spatial fact, and spatial facts read faster in 3D than in a table.

**If it does not communicate state faster than a 2D card, cut it.**

### 5.2 Scope — deliberately small

| Build | Do NOT build |
|---|---|
| Low-poly facility floor plan (extruded boxes) | Realistic PBR-textured 3D models |
| Asset markers that pulse with severity colour | Physics simulation |
| Camera focus-fly to the incident asset | Character models, avatars |
| Optional: responder position marker in zone | Post-processing (bloom, DOF, SSAO) |

**Ceiling: ~150 lines of R3F.** If it grows beyond that, the effort belongs in the Live Call Theatre instead.

### 5.3 Implementation sketch

```tsx
// components/three/FacilityView.tsx
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html, Float } from "@react-three/drei";

function AssetMarker({ asset, severity }) {
  const ref = useRef<Mesh>(null);
  const color = SEVERITY_COLOR[severity];

  // Pulse rate encodes urgency — critical pulses faster.
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const rate = severity === "CRITICAL" ? 4 : severity === "WARNING" ? 2 : 0;
    const s = rate ? 1 + Math.sin(clock.elapsedTime * rate) * 0.12 : 1;
    ref.current.scale.setScalar(s);
  });

  return (
    <Float speed={1} floatIntensity={0.3}>
      <mesh ref={ref} position={asset.position}>
        <boxGeometry args={[1, 1.6, 1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={severity === "CRITICAL" ? 0.8 : 0.2}
        />
        <Html center distanceFactor={10}>
          <div className="font-mono text-xs whitespace-nowrap">
            {asset.id} · {asset.value}{asset.unit}
          </div>
        </Html>
      </mesh>
    </Float>
  );
}
```

### 5.4 Performance guardrails

- `<Canvas frameloop="demand">` when idle — re-render only on state change. Saves battery and keeps the recording machine cool.
- `dpr={[1, 2]}` — cap device pixel ratio.
- Instance repeated geometry; a facility of 40 assets is one instanced mesh, not 40 meshes.
- **Hard rule: 60fps on the recording laptop.** A stuttering 3D view is worse than no 3D view. Profile before the video, and if it drops frames, ship the 2D floor plan instead.
- Lazy-load the whole 3D bundle — `next/dynamic` with `ssr: false`. It must never block first paint.

---

## 6. Motion System (Framer Motion)

### 6.1 Motion principles

| Principle | Rule |
|---|---|
| **Motion means change** | Animate only when state actually changed. Never animate on mount for decoration. |
| **Fast** | 150–250ms for UI transitions. Above 300ms feels sluggish on camera. |
| **Ease out** | Things arrive quickly and settle. `[0.16, 1, 0.3, 1]` for entrances. |
| **Stagger reveals structure** | 40–80ms between siblings shows relationship. Above 100ms feels slow. |
| **One hero animation per screen** | Everything else is subtle. Competing animations read as chaos. |

### 6.2 The motion tokens

```ts
export const motion = {
  fast:   { duration: 0.15, ease: [0.16, 1, 0.3, 1] },
  base:   { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
  slow:   { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  spring: { type: "spring", stiffness: 380, damping: 30 },
  stagger: 0.06,
} as const;
```

### 6.3 Signature animations (the ones judges notice)

| # | Animation | Where | Effect |
|---|---|---|---|
| 1 | **Dialling ring pulse** | Call state = dialling | Concentric rings expand and fade from the responder avatar, 1.2s loop. Instantly reads as "phone ringing." |
| 2 | **Transcript stream-in** | Live transcript | Words appear with 8px rise + fade. Feels alive. |
| 3 | **Result field stagger** | Structured result | Fields land 60ms apart. The payoff beat. |
| 4 | **Escalation ladder travel** | On escalation | An arrow animates down from rung 1 to rung 2, rungs re-colour. Makes an invisible decision visible. |
| 5 | **Severity colour transition** | Asset state change | 400ms colour interpolation green → amber → red. Never a hard swap. |
| 6 | **Number roll** | Any changing metric | Digits roll rather than swap. Use `useMotionValue` + `animate`. |
| 7 | **Layout shift on panel open** | `layoutId` shared element | Panels expand smoothly instead of popping. |

```tsx
// #1 — Dialling ring pulse
<motion.span
  className="absolute inset-0 rounded-full border border-[--state-active]"
  initial={{ scale: 1, opacity: 0.7 }}
  animate={{ scale: 2.2, opacity: 0 }}
  transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
/>
```

### 6.4 Accessibility

Respect `prefers-reduced-motion` globally. Wrap it once:

```tsx
const shouldReduce = useReducedMotion();
const t = shouldReduce ? { duration: 0 } : motion.base;
```

Looping animations (ring pulse, waveform) must stop entirely under reduced motion — replace with a static state indicator.

---

## 7. Realtime Layer (SSE)

### 7.1 Why SSE over WebSockets

Call state flows one direction: server → client. SSE is one line of browser API, auto-reconnects natively, survives proxies, and needs no extra infrastructure. Use WebSockets only if bidirectional control (barge-in, live operator takeover) becomes P0.

### 7.2 The event contract is defined elsewhere

**The `SentinelEvent` union and its Zod schema live in [CLAUDE.md](../CLAUDE.md) and are owned by Sameer.** The frontend imports the shared type from `packages/types` — never redeclares it.

```ts
import { SentinelEventSchema, type SentinelEvent } from "@sentinel/types";
```

What the frontend needs to know:

| Event | Which panel it drives |
|---|---|
| `signal.received` | Telemetry curve |
| `incident.opened` | Severity chip, safe-window countdown |
| `incident.suppressed` | Suppression log |
| `responder.selected` | Responder card, escalation ladder |
| `plan.composed` | Call plan preview |
| `call.state` | Call state machine visuals (§4.2) |
| `transcript.delta` | Live transcript (§4.3) |
| `result.extracted` | Structured result panel (§4.5) |
| `incident.escalated` | Ladder travel animation (§6.3 #4) |
| `incident.resolved` | Success state, time-saved counter |
| `incident.unresolved` | Critical alert state |

**Validate every event with Zod at the boundary.** A malformed event must degrade one panel, never white-screen the dashboard mid-demo.

### 7.3 Hook

```tsx
export function useIncidentStream(incidentId: string) {
  const [events, setEvents] = useState<SentinelEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource(`/api/v1/incidents/${incidentId}/stream`);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);   // EventSource retries automatically
    es.onmessage = (e) => {
      const parsed = SentinelEventSchema.safeParse(JSON.parse(e.data));
      if (parsed.success) setEvents((prev) => [...prev, parsed.data]);
      else console.warn("Dropped malformed event", parsed.error);
    };
    return () => es.close();
  }, [incidentId]);

  return { events, connected };
}
```

### 7.4 Connection status is visible, always

A small `● Live` / `● Reconnecting…` indicator in the header. If the stream drops during the demo, the UI must say so honestly rather than silently freezing — a frozen dashboard that looks fine is far worse on camera than one that says "reconnecting."

---

## 8. Every Screen, Every State

**A screen is not done until all five states are designed and implemented.** This is the most common place hackathon frontends fall apart on camera.

| State | Requirement |
|---|---|
| **Empty** | Explains what will appear here and how to make it happen. Never a blank panel. Include the action ("Trigger a scenario"). |
| **Loading** | Skeleton matching the real layout's shape. Never a centred spinner — spinners cause layout shift when content arrives. |
| **Success** | The designed state. |
| **Error** | Says what failed, in plain language, and offers a retry. Never a raw stack trace or a silent failure. |
| **Partial** | Some data arrived, some didn't. Show what you have, mark what's missing. Critical for live call views. |

### 8.1 Frontend QA checklist (Vishal + Soham sign off before Day 18)

- [ ] All five states implemented on every screen in §3
- [ ] No dead buttons — every control does something or is visibly disabled with a reason
- [ ] Keyboard navigable: tab order logical, focus rings visible, Escape closes overlays
- [ ] Contrast ≥ 4.5:1 for body text, ≥ 3:1 for large text and UI borders
- [ ] All state conveyed by colour **+ icon + text**, never colour alone
- [ ] `prefers-reduced-motion` respected; loops stop
- [ ] Responsive: 1440 (demo), 1024, 768. Mobile ≥ 375 for the ops overview and history
- [ ] Numbers use `tabular-nums` — no layout shift when values change
- [ ] Long transcripts, long asset names, and 40-item rosters don't break layout
- [ ] Works with the backend cold — first load with an empty database looks intentional
- [ ] 3D view lazy-loaded; disabling it degrades gracefully to a 2D floor plan
- [ ] Tested on the exact machine and browser used for recording

---

## 9. Design Workflow & Figma Plugins (Soham)

### 9.1 Figma plugins

| Plugin | Purpose |
|---|---|
| **Figma Variables** (native) | Define colour + spacing tokens once, export to CSS variables. Keeps Figma and code in sync. |
| **Iconify** | Pull Lucide icons directly into Figma so design and code use the identical icon set. |
| **Content Reel** | Realistic responder names, phone numbers, timestamps. Lorem ipsum makes a dashboard look fake. |
| **Autoflow** | Fast user-journey arrows for the architecture and flow diagrams used in the demo video. |
| **Chart** | Mock telemetry curves for mockups before the real data exists. |
| **Figma to Code / Locofy** | Reference only. **Do not ship generated code** — hand-build with shadcn. Generated markup fights Tailwind and costs more time than it saves. |

### 9.2 The token pipeline (do this on Day 2)

```
Figma Variables  →  tokens.json  →  globals.css (CSS vars)  →  tailwind.config.ts
```

One source of truth. When Soham changes a colour in Figma, Vishal changes one CSS variable. No hunting hex codes across 40 components.

### 9.3 Design → engineering handoff rule

Soham delivers a **component spec**, not a picture:

- Component name matching the code file
- Every variant and state (default / hover / active / disabled / loading / error)
- Exact tokens used — never raw hex in a handoff
- Motion notes: what animates, duration, easing
- Responsive behaviour at each breakpoint

---

## 10. Frontend Work Split

### Vishal — Implementation owner

| Priority | Deliverable |
|---|---|
| P0 | Live Call Theatre — layout, call state machine, transcript, waveform, result panel |
| P0 | SSE hook + Zod-validated event handling + connection status |
| P0 | Incident Command overview + live incident feed |
| P0 | Simulator trigger screen |
| P0 | All five states on every screen |
| P1 | Incident history + one-click replay |
| P1 | 3D facility view (within the 150-line ceiling) |
| P1 | Motion system implementation (§6.3 signature animations) |
| P2 | Roster + asset admin screens |
| P2 | ⌘K command palette |

> **Scheduling note:** Vishal also owns MQTT ingest + the telemetry simulator, which are backend work specified in [CLAUDE.md](../CLAUDE.md) and PRD §14 — not in this document. Sequence them **before** the dashboard: the simulator lands Day 3–4 because it unblocks everyone's testing.

### Soham — Design owner

| Priority | Deliverable |
|---|---|
| P0 | Token system → `tokens.json` → CSS variables (Day 2) |
| P0 | Live Call Theatre design — every call state |
| P0 | State chip system, confidence badges, transcript styling |
| P0 | Component specs for all P0 components |
| P0 | **Scenario bank + conversation scripting with Tanmay** (§13.4 of the PRD) |
| P1 | Incident Command + history designs |
| P1 | Demo video storyboard and motion direction |
| P1 | Architecture diagram for the video's 2:40 segment |
| P2 | Landing page |

> **Soham's split responsibility:** roughly 60% design system + screens, 40% conversation design with Tanmay. The agent's *dialogue* is a design surface — how it opens, how it handles refusal, how it confirms — and it is judged as heavily as the UI.

---

## 11. Performance Targets

| Metric | Target | Why |
|---|---|---|
| First Contentful Paint | < 1.2s | Judge's first impression on the deployed URL |
| Time to Interactive | < 2.5s | |
| SSE event → visible UI update | **< 250ms** | This is the "it feels live" threshold |
| Frame rate during live call view | **60fps sustained** | Stutter on camera reads as broken |
| Lighthouse Performance (`/ops`) | > 85 | |
| Lighthouse Accessibility | > 95 | Cheap to achieve, signals craft |
| JS bundle (initial, excluding 3D) | < 250KB gzipped | 3D lazy-loads separately |

### 11.1 Recording-day performance ritual

Two days before recording, on the exact machine used for the video:

1. Run a production build (`pnpm build && pnpm start`) — never record against a dev server.
2. Close every other application; disable browser extensions.
3. Run the full flow three times, watching the frame counter.
4. If the 3D view drops below 60fps, disable it for the recording and use the 2D floor plan.
5. Record at 1440×900 or 1920×1080 — never a scaled/retina-doubled window that softens text.

---

## 12. What Would Make a Judge Say "This Is a Real Product"

Ranked by impact per hour of effort:

1. **Evidence highlighting in the transcript** — extracted values visibly trace back to the exact spoken words. Nothing else proves the AI isn't hallucinating as cheaply as this.
2. **The escalation ladder animating on refusal** — one animation that makes an autonomous decision legible.
3. **Confidence badges with a visible human-review threshold** — shows the system knows what it doesn't know.
4. **A live time-saved counter** — connects the technical demo to a business number in one glance.
5. **Honest connection status** — `● Reconnecting…` instead of a silently frozen UI.
6. **The suppression log** — visible proof that the agent chose *not* to call on a transient spike. Restraint reads as intelligence.
7. **`tabular-nums` on every changing value** — subconscious polish. Nobody notices it's there; everybody notices when it jitters.
8. **One-click replay of a past incident** — lets the judge re-run the story themselves on the deployed URL.

---

## 13. Anti-Patterns — Do Not Ship These

| Anti-pattern | Why it hurts |
|---|---|
| Purple/blue AI gradient hero | Signals "generic AI demo" in the first second. This is an ops instrument. |
| Fake data that looks fake | `John Doe`, `+1 555-0100`, `Lorem ipsum` — instantly undermines credibility. Use realistic rosters. |
| Spinner-in-the-middle loading | Causes layout shift. Use skeletons shaped like the real content. |
| Animating everything | Competing motion reads as chaos and hides the one animation that matters. |
| A landing page that outshines the product | Judges score the product experience, not the marketing page. |
| Toasts for critical state | A CRITICAL incident is not a toast. It belongs in the persistent UI. |
| Claiming capability the UI doesn't have | A "Settings" page full of non-functional switches is worse than no settings page. Ship less, working. |
| Recording against a dev server | Fast Refresh overlays, dev warnings, and slower renders will be visible on camera. |

---

## 14. Day-1 Frontend Bootstrap (Vishal — do this immediately)

```bash
# 1. Scaffold
pnpm create next-app@latest sentinel-ops --typescript --tailwind --app --use-pnpm

# 2. Component system + deps (see §1.1)

# 3. Wire tokens from Soham's tokens.json into globals.css

# 4. Build these four things, in this order, against MOCK data:
#    a) StateChip component (§2.5) — everything else depends on it
#    b) Live Call Theatre layout shell (§4.1)
#    c) useIncidentStream hook against a mock SSE endpoint (§7.3)
#    d) Simulator trigger page (§3.1)

# 5. Only then connect to Sameer's real backend.
```

**Building against mocks from Day 1 is what stops the frontend from being blocked by the backend.** The SSE event contract (§7.2) is frozen on Day 2 — mock it, build the entire UI against it, and swap the endpoint URL when the backend is ready. Integration then becomes a one-line change instead of a week of discovery.

---

*Owners: Vishal (implementation) · Soham (design) · Reviewed by: Tanmay*
