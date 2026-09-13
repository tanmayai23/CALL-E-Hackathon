/**
 * VAGUE ANSWER → HUMAN REVIEW — PRD v2.0 §9, §6 ("ambiguous results auto-closed:
 * 0%").
 *
 * The extraction itself suggests confirming the order, but the supplier never
 * gave a date and the call's confidence is 0.58. The decision is code, not the
 * model: confidence below 0.70 always wins over `next_action`, so the order goes
 * to a person. This scenario exists to make that invariant visible.
 */

import { ScriptBuilder, openOrder, opener, selectAndPlan, type Scenario } from "./script";

export const vagueAnswer: Scenario = {
  id: "vague-answer",
  name: "Vague answer",
  tagline: "“Sometime this week.” The system refuses to guess.",
  description:
    "The supplier sounds positive but will not commit to a date, even when asked once more. The call's own next action says confirm, but its confidence is 0.58 — below the 0.70 floor — so the order goes to human review.",
  expectedOutcome: "Confidence 0.58 · human review",

  build(ctx) {
    const { order } = ctx;
    const unit = order.item.unit;
    const qty = order.item.requestedQuantity;

    const hedge = "Should be fine. We will get it out sometime this week, probably.";
    const noDate = "Hard to say. It depends on the truck. Later this week.";

    const b = new ScriptBuilder(order.id, ctx.startedAt);
    openOrder(b, ctx);
    selectAndPlan(b, ctx, 1, "Be professional and concise.");

    b.call("call-01", "queued", 700)
      .call("call-01", "dialling", 3600)
      .call("call-01", "connected", 600)
      .call("call-01", "in_conversation", 300)
      .say("AGENT", opener(ctx), 800)
      .say("HUMAN", hedge)
      .say(
        "AGENT",
        `To update the order I need a specific date. Which day can you dispatch the ${qty} ${unit}?`,
        800,
      )
      .say("HUMAN", noDate)
      .say(
        "AGENT",
        `Understood. I will pass this to the ${order.buyer.name} team so they can follow up with you directly. Thank you.`,
        900,
      )
      .call("call-01", "extracting", 1800)
      .emit(
        {
          type: "result.extracted",
          orderId: order.id,
          structured: {
            contact_reached: "yes",
            stock_status: "confirmed",
            confirmed_quantity: qty,
            dispatch_date: "later this week",
            delay_reason: "Depends on transport availability",
            requires_approval: false,
            verbatim_commitment: "We will get it out sometime this week, probably.",
            next_action: "CONFIRM_ORDER",
          },
          confidence: { score: 0.58, label: "LOW" },
          evidence: [hedge, noDate],
        },
        700,
      )
      .call("call-01", "completed", 900)
      .emit({
        type: "order.updated",
        orderId: order.id,
        status: "HUMAN_REVIEW",
        confirmedQuantity: null,
        remainingQuantity: null,
        summary:
          "Confidence 0.58 is below the 0.70 floor. The call suggested confirming, but no dispatch date was given — held for a person.",
        operatorMinutesSaved: null,
      });

    return b.build();
  },
};
