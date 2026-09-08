# Failure taxonomy

A happy-path demo handles one conversation. A product handles the fourteen ways a phone call goes wrong.

Every row below is implemented and tested. The scenario names map to the mock driver, so each can be reproduced without spending a call.

---

## The fourteen

| # | Failure | Detected by | Agent behaviour | Outcome |
|---|---|---|---|---|
| **F1** | No answer | Call status `no_answer` | Advance rung immediately | `ESCALATE_NEXT_RUNG` |
| **F2** | Voicemail | Detected in conversation | Leave a short message (asset ID + callback), end, escalate | `ESCALATE_NEXT_RUNG` |
| **F3** | Hard refusal | `responder_available: "no"` | Capture `decline_reason`, escalate | `ESCALATE_NEXT_RUNG` |
| **F4** | Late / conditional ETA | `eta_minutes > safe_window` | Accept the commitment **and** arrange a backup in parallel | `SCHEDULE_VERIFICATION_CALL` |
| **F5** | Callback requested | `callback_requested_at` set | Schedule retry; CRITICAL also starts a parallel rung | `SCHEDULE_CALLBACK` |
| **F6** | Ambiguous answer | Confidence `< 0.7` | Ask once for a number; still vague → park | `HUMAN_REVIEW` |
| **F7** | Wrong person answers | Identity mismatch | Ask if the responder is reachable; **withhold all details**; escalate | `ESCALATE_NEXT_RUNG` |
| **F8** | Gatekeeper / IVR | Non-human respondent | **Do not navigate menus.** End and escalate | `ESCALATE_NEXT_RUNG` |
| **F9** | Call drops mid-conversation | `status != completed` | Escalate (retry policy lives in the call layer) | `ESCALATE_NEXT_RUNG` |
| **F10** | API error / rate limit | SDK exception | Exponential backoff ×3, then human alert | Human review |
| **F11** | Ladder exhausted | Rung > max | Mark UNRESOLVED, loud alert naming everyone tried | `UNRESOLVED` |
| **F12** | Sensor offline | No heartbeat in window | Distinct "asset unreachable" incident — never a call | Separate incident |
| **F13** | Flapping signal | Correlation + dedup | Suppress; enrich the existing incident | Suppression logged |
| **F14** | Confirms but never arrives | Verification call at T+ETA | Re-escalate | `ESCALATE_NEXT_RUNG` |

---

## The ones people get wrong

**F1, F2, F7, F9 all carry low confidence.** Nobody spoke, or the wrong person did. A naive implementation gates every branch on `confidence >= 0.7` and sends all four to human review — which means an unanswered 2 AM call waits for a human instead of trying the next one. The confidence gate must block *closing*, not *escalating*.

**F4 cannot be trusted to the model.** `requires_backup` reflects what the responder *said*. A technician who quotes 120 minutes against a 90-minute window and adds "no, I'll make it" has told you `requires_backup: false`. The ETA comparison must be arithmetic, in code. An unknown ETA counts as outside the window — you cannot prove a commitment is safe, so do not assume it.

**F8 is a safety boundary, not a capability gap.** The agent could navigate an IVR. It must not: pressing options on an unknown switchboard can reach an unintended party, and incident details must never reach one.

**F10 must not retry a timeout.** A transient 503 before the call connects is worth retrying. A call that exceeded its duration ceiling already rang someone's phone — retrying rings it a second time for the same incident.

**F11 must be enforced in code.** The prompt says "three attempts". A model in a persuasive conversation will still make a fourth. Caps live in the graph.

---

## Reproducing them

Every failure has a mock scenario. No live calls, no budget spend:

```bash
SENTINEL_MOCK_SCENARIO=no_answer            # F1
SENTINEL_MOCK_SCENARIO=voicemail            # F2
SENTINEL_MOCK_SCENARIO=hard_refusal         # F3
SENTINEL_MOCK_SCENARIO=late_eta             # F4
SENTINEL_MOCK_SCENARIO=callback_requested   # F5
SENTINEL_MOCK_SCENARIO=ambiguous            # F6
SENTINEL_MOCK_SCENARIO=wrong_person         # F7
SENTINEL_MOCK_SCENARIO=gatekeeper           # F8
SENTINEL_MOCK_SCENARIO=call_drops           # F9
```

F10 is reproduced by making the call layer throw; F11 by exhausting the roster; F12–F14 sit in the correlation and verification layers.

> Mock fixtures are clearly labelled dev data. Never present mock output as a real CALL-E transcript.
