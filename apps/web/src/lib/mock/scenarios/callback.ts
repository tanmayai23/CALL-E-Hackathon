/**
 * CALLBACK REQUESTED — PRD v2.0 §9, FR-5.4.
 *
 * The contact is mid stock-count and asks to be called back. The agent agrees a
 * concrete time instead of guessing at stock, and the system schedules the
 * callback as a follow-up rather than leaving it to someone's memory.
 */

import {
  ScriptBuilder,
  nextIst,
  openOrder,
  opener,
  selectAndPlan,
  spokenReference,
  type Scenario,
} from "./script";

export const callback: Scenario = {
  id: "callback",
  name: "Callback requested",
  tagline: "They're busy. The agent books a time instead of guessing.",
  description:
    "The contact is in the middle of a stock count and asks to be called back at four. The agent confirms the time and number, and the callback is scheduled as a follow-up.",
  expectedOutcome: "Callback scheduled for 16:00",

  build(ctx) {
    const { order } = ctx;
    const primary = ctx.ladder[0];
    const slot = nextIst(ctx.startedAt, 16, 0);

    const request = "I am in the middle of a stock count. Can you call me back at four? I will know the numbers then.";

    const b = new ScriptBuilder(order.id, ctx.startedAt);
    openOrder(b, ctx);
    selectAndPlan(b, ctx, 1, "Be professional and concise.");

    b.call("call-01", "queued", 700)
      .call("call-01", "dialling", 3600)
      .call("call-01", "connected", 600)
      .call("call-01", "in_conversation", 300)
      .say("AGENT", opener(ctx), 800)
      .say("HUMAN", request)
      .say(
        "AGENT",
        `Of course. I will call you back at 4 PM ${slot.day} about order ${spokenReference(order.reference)}. Is this the best number to reach you?`,
        750,
      )
      .say("HUMAN", "Yes, this number is fine.")
      .say("AGENT", "Thank you. Speak to you at four.", 900)
      .call("call-01", "extracting", 1600)
      .emit(
        {
          type: "result.extracted",
          orderId: order.id,
          structured: {
            contact_reached: "yes",
            stock_status: "unknown",
            callback_requested_at: slot.iso,
            requires_approval: false,
            verbatim_commitment: "Can you call me back at four?",
            next_action: "SCHEDULE_CALLBACK",
          },
          confidence: { score: 0.88, label: "HIGH" },
          evidence: [request],
        },
        700,
      )
      .call("call-01", "completed", 900)
      .followUp(
        {
          id: `${order.id}-callback`,
          orderId: order.id,
          kind: "CALLBACK",
          dueAt: slot.iso,
          contactId: primary.id,
          note: `Call ${primary.name} back after the stock count`,
          status: "SCHEDULED",
        },
        700,
      )
      .emit({
        type: "order.updated",
        orderId: order.id,
        status: "CALLBACK_SCHEDULED",
        confirmedQuantity: null,
        remainingQuantity: null,
        summary: `${primary.name} asked for a callback at 16:00 ${slot.day} — it is scheduled.`,
        operatorMinutesSaved: 9,
      });

    return b.build();
  },
};
