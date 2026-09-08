# The escalation ladder

How the agent decides *who* to call, *what to say*, and *when to stop*.

---

## The shape

```
rung 1 — Primary responder      → no answer / refusal
   ↓  urgency raised
rung 2 — Secondary responder    → no answer / refusal
   ↓  urgency raised again
rung 3 — Supervisor             → no answer / refusal
   ↓
UNRESOLVED → loud human alert
```

Defaults: **3 rungs, 5 calls per incident.** Both configurable, both enforced in code.

The two caps are deliberately independent. A rung is "a person we tried"; a call is "a phone that rang". Callback retries and dropped-call retries burn calls without advancing a rung, so a rung cap alone does not bound how many times someone's phone rings.

---

## Selecting a responder

A candidate must pass **every** filter:

| Filter | Why |
|---|---|
| Not already attempted this incident | Never ring the same person twice for one incident |
| Has the required skill | A generalist cannot fix a compressor |
| In the required zone | Travel time is the whole point of the ETA |
| On shift now | Calling someone off-shift is how you lose a roster |
| Past their cooldown | Rate limiting, per person |

Survivors are ordered by `ladderPriority` ascending. If nobody survives, the incident goes straight to UNRESOLVED — an empty ladder is not a reason to relax a filter.

> **Shift windows cross midnight.** `22:00 → 06:00` is a valid shift and is handled explicitly. Getting this wrong silently empties your night roster, which is exactly when escalation matters.

---

## Urgency adaptation

The same incident is framed differently at each rung. **A static prompt is a robocall; a composed prompt is an agent.** This is also what stops rung 3 sounding like a repeat of rung 1 to a supervisor who can hear that it is.

| Rung | Framing |
|---|---|
| 1 | First contact. Professional and factual. |
| 2 | "The primary technician was unavailable." Time has already been lost; urgency is higher. |
| 3 | Supervisor escalation. The incident is **unassigned**, the clock is running, a management decision is needed. |

Time pressure is also scaled to the remaining window — under 30 minutes reads as `URGENT`, under 60 as `Time-sensitive`, above that as a plain statement. Panic degrades human response quality, so the language escalates in precision, not volume.

---

## What advances a rung

| Outcome | Advances? |
|---|---|
| No answer | Yes, immediately |
| Voicemail | Yes, after leaving a short message |
| Hard refusal | Yes, with `decline_reason` captured |
| Gatekeeper / IVR | Yes — the agent does not navigate menus |
| Wrong person | Yes, without disclosing incident details |
| Dropped call | Yes |
| Ambiguous answer | **No** — human review |
| Callback requested | **No** — schedules a retry; CRITICAL also starts a parallel rung |
| Commitment with ETA | **No** — verification scheduled at T+ETA |

---

## The confidence rule

`completionConfidence < 0.7` blocks **closing** actions — `CLOSE_RESOLVED`, `SCHEDULE_VERIFICATION_CALL`, `SCHEDULE_CALLBACK`. Those route to human review instead.

It does **not** block `ESCALATE_NEXT_RUNG`.

This asymmetry is the single most important decision in the ladder. An unanswered call carries confidence 0.0 because nobody spoke — not because extraction was shaky. Treating that as "too uncertain to act" parks the incident for an operator who, at 2 AM, is the very person who is not there. Escalating on a weak signal costs one extra phone call. Closing on one, or waiting on one, costs the inventory.

**Escalating is fail-safe. Closing is not. Gate the direction that can hurt you.**

---

## Stopping

The ladder terminates when:

- Someone commits, with an ETA → verification scheduled at T+ETA+5min
- Rung cap reached → UNRESOLVED
- Call cap reached → human review
- No eligible responder remains → UNRESOLVED
- Kill switch active → refuses to dial

UNRESOLVED raises a loud facility-manager alert **regardless of quiet hours**, and names every responder attempted. It is the worst-case terminal state and it must never be silent.

> Caps are enforced in the graph, never in the prompt. An LLM instruction is not a control — a model that has been told "only three attempts" will still make a fourth if the conversation leads there.

---

## Closing the loop twice

A commitment is not an outcome. At **T+ETA+5min** the agent calls back to confirm the responder actually arrived. If they did not, the incident re-enters the ladder.

This is what separates an operations system from a dialler: the first call gets a promise, the second call verifies it. F14 — "confirms but never arrives" — is otherwise completely invisible.

If the committed ETA falls **outside** the safe window, the commitment is accepted *and* a backup is arranged in parallel. A late technician beats no technician, but you do not discover the shortfall at T+ETA when it is too late to act.
