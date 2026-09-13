/**
 * Scenario scripting primitives.
 *
 * A scenario is a list of `{ at, event }` steps that the SSE route replays in
 * real time, over the same event contract a real backend would stream — so the
 * dashboard cannot tell a scripted run from a live one, and swapping to the
 * real API is a base-URL change.
 *
 * HONESTY (Rule 8): every scenario in this directory is a labelled fixture.
 * None of it is real CALL-E output, and the dashboard says so with a persistent
 * "Mock driver" chip whenever it is the source.
 */

import type { SentinelEvent } from "@/lib/contracts/events";
import type { CallState, Contact, FollowUp, Order, Speaker } from "@/lib/contracts/domain";
import { formatters, istDate } from "@/lib/time";

export { istAt, nextIst } from "@/lib/time";

export interface ScriptStep {
  at: number;
  event: SentinelEvent;
}

export interface ScenarioContext {
  order: Order;
  /** The seller's contacts, primary first. */
  ladder: Contact[];
  /** Everything already in the store — duplicate detection reads this. */
  priorOrders: Order[];
  /** Epoch ms the run starts at. Seeded history uses a time in the past. */
  startedAt: number;
}

export type ScenarioId =
  | "partial-stock"
  | "no-answer-escalation"
  | "price-change"
  | "callback"
  | "vague-answer"
  | "duplicate-order";

export interface Scenario {
  id: ScenarioId;
  /** What the supplier does — the choice the simulator offers. */
  name: string;
  tagline: string;
  description: string;
  expectedOutcome: string;
  build: (ctx: ScenarioContext) => ScriptStep[];
}

/** Milliseconds between streamed words — reads as speech, not a printer. */
export const WORD_MS = 58;

/** "ORD-482" → "482", the way a person reads an order number aloud. */
export function spokenReference(reference: string): string {
  const digits = reference.match(/\d+/g);
  return digits ? digits.join(" ") : reference;
}

/** "today", "tomorrow", or "by 18 Sep" — how a required-by date is said aloud. */
export function requiredPhrase(requiredBy: string, from: number): string {
  const target = istDate(Date.parse(requiredBy));
  if (target === istDate(from)) return "today";
  if (target === istDate(from + 86_400_000)) return "tomorrow";
  return `by ${formatters.shortDate.format(new Date(requiredBy))}`;
}

/** Format an amount the way the call would say it: 2050 → "2,050". */
export function spokenAmount(n: number): string {
  return new Intl.NumberFormat("en-IN").format(n);
}

const HOUR_WORDS = [
  "twelve", "one", "two", "three", "four", "five",
  "six", "seven", "eight", "nine", "ten", "eleven",
];

/**
 * A cut-off `hoursAhead` whole hours after `from`, in facility time — both as a
 * supplier says it ("five") and as it is written down ("5 PM"). Keeps a
 * scripted deadline ahead of the clock whenever the demo is run.
 */
export function cutOffHour(from: number, hoursAhead: number): { spoken: string; written: string } {
  const h24 = (Number(formatters.hour24.format(new Date(from))) + hoursAhead) % 24;
  return {
    spoken: HOUR_WORDS[h24 % 12],
    written: `${h24 % 12 || 12} ${h24 < 12 ? "AM" : "PM"}`,
  };
}

/**
 * Builds a script with a moving cursor, so each scenario reads top to bottom
 * as the conversation it is — instead of a column of hand-maintained offsets.
 */
export class ScriptBuilder {
  private readonly steps: ScriptStep[] = [];
  private cursor = 0;

  constructor(
    private readonly orderId: string,
    private readonly startedAt: number,
  ) {}

  /** Advance the cursor. */
  wait(ms: number): this {
    this.cursor += ms;
    return this;
  }

  /** Emit an event at the cursor. */
  emit(event: SentinelEvent, thenWait = 0): this {
    this.steps.push({ at: this.cursor, event });
    this.cursor += thenWait;
    return this;
  }

  call(callId: string, state: CallState, thenWait = 0): this {
    return this.emit({ type: "call.state", orderId: this.orderId, callId, state, ts: this.isoNow() }, thenWait);
  }

  followUp(followUp: FollowUp, thenWait = 0): this {
    return this.emit({ type: "followup.scheduled", orderId: this.orderId, followUp }, thenWait);
  }

  /**
   * Stream one turn word by word. Every delta of a turn shares a `ts`, which is
   * how the client groups them back into one turn — no field is added to the
   * event shape to carry turn identity.
   */
  say(speaker: Speaker, text: string, pauseAfter = 650): this {
    const ts = formatters.clock.format(new Date(this.startedAt + this.cursor));
    const words = text.split(" ");
    words.forEach((word, i) => {
      this.steps.push({
        at: this.cursor + i * WORD_MS,
        event: {
          type: "transcript.delta",
          orderId: this.orderId,
          speaker,
          ts,
          text: i === words.length - 1 ? word : `${word} `,
        },
      });
    });
    this.cursor += words.length * WORD_MS + pauseAfter;
    return this;
  }

  /** The time the cursor points at, for ISO timestamps inside events. */
  isoNow(): string {
    return new Date(this.startedAt + this.cursor).toISOString();
  }

  build(): ScriptStep[] {
    return this.steps;
  }
}

/**
 * The opening every call-placing scenario shares: the trigger arrives, the
 * order is assessed, and the primary contact is selected and planned for.
 */
export function openOrder(b: ScriptBuilder, ctx: ScenarioContext): void {
  const { order } = ctx;
  b.emit(
    {
      type: "event.received",
      orderId: order.id,
      triggerType: order.trigger.type,
      summary: order.trigger.summary,
      ts: b.isoNow(),
    },
    900,
  ).emit(
    { type: "order.opened", orderId: order.id, urgency: order.urgency, requiredBy: order.requiredBy },
    1100,
  );
}

export function selectAndPlan(
  b: ScriptBuilder,
  ctx: ScenarioContext,
  rung: number,
  urgencyNote: string,
): void {
  const { order } = ctx;
  const contact = ctx.ladder[rung - 1];
  const qty = order.item.requestedQuantity;

  b.emit({ type: "contact.selected", orderId: order.id, contact, rung }, 1000).emit(
    {
      type: "plan.composed",
      orderId: order.id,
      summary:
        `Automated operations line for ${order.buyer.name}. ${urgencyNote} ` +
        `Order ${order.reference}: ${qty} ${order.item.unit} of ${order.item.description.toLowerCase()}, ` +
        `required ${requiredPhrase(order.requiredBy, ctx.startedAt)}. ` +
        "Confirm available quantity, price and dispatch date. If only part is available, confirm that part and get a date for the rest. " +
        "Never accept a changed price, credit or terms — record it for approval. Keep the call under 90 seconds.",
      mustAsk: [
        `Can ${order.seller.name} confirm how many of the ${qty} ${order.item.unit} are available?`,
        "What is the dispatch date for what is available?",
        "If it is not all available — when will the remainder be ready?",
        "Is the price still as quoted on the order?",
      ],
    },
    900,
  );
}

/** The agent's opener — identifies itself as automated, per FR-7.1. */
export function opener(ctx: ScenarioContext, lead = ""): string {
  const { order } = ctx;
  return (
    `This is the automated operations line for ${order.buyer.name}. ${lead}` +
    `I am calling about order ${spokenReference(order.reference)} for ${order.item.requestedQuantity} ${order.item.unit} ` +
    `of ${order.item.description.toLowerCase()}. Can ${order.seller.name.replace(/\.$/, "")} confirm the available quantity and dispatch date?`
  );
}
