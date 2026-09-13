/**
 * NO ANSWER → BACKUP CONTACT — PRD v2.0 §9, demo storyboard 2:30–2:45.
 *
 * The primary contact does not pick up. The agent retries once, as the failure
 * taxonomy requires, then moves down the ladder to the backup contact, who
 * confirms the full order. The ladder visibly travelling is the point.
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

export const noAnswerEscalation: Scenario = {
  id: "no-answer-escalation",
  name: "No answer → backup",
  tagline: "The first contact never picks up. The order still gets confirmed.",
  description:
    "The primary contact does not answer. The agent retries once, then escalates to the backup contact at the same wholesaler, who confirms the whole order for dispatch today.",
  expectedOutcome: "Escalated to rung 2 · confirmed",

  build(ctx) {
    const { order } = ctx;
    const unit = order.item.unit;
    const qty = order.item.requestedQuantity;
    const [primary, backup] = ctx.ladder;
    const ref = spokenReference(order.reference);

    const answer = `${primary.name.split(" ")[0]} is on the dispatch floor. I can see all ${qty} in the system — yes, we can dispatch all ${qty} today by five.`;
    const confirm = "Yes, confirm it.";

    const b = new ScriptBuilder(order.id, ctx.startedAt);
    openOrder(b, ctx);
    selectAndPlan(b, ctx, 1, "Be professional and concise.");

    b.call("call-01", "queued", 700)
      .call("call-01", "dialling", 5200)
      .call("call-01", "no_answer", 1100)
      // §9: retry once before moving down the ladder.
      .call("call-02", "dialling", 5200)
      .call("call-02", "no_answer", 1000)
      .emit(
        {
          type: "order.escalated",
          orderId: order.id,
          fromRung: 1,
          toRung: 2,
          reason: `${primary.name} did not answer twice`,
        },
        1100,
      );

    selectAndPlan(
      b,
      ctx,
      2,
      `The primary contact, ${primary.name}, did not answer. Say so, and that the order is still unconfirmed.`,
    );

    b.call("call-03", "queued", 600)
      .call("call-03", "dialling", 3200)
      .call("call-03", "connected", 600)
      .call("call-03", "in_conversation", 300)
      .say("AGENT", opener(ctx, `I tried ${primary.name} but could not get through. `), 800)
      .say("HUMAN", answer)
      .say(
        "AGENT",
        `Thank you. That is all ${qty} ${unit} dispatched today by 5 PM, at the price on the order. Shall I confirm order ${ref}?`,
        750,
      )
      .say("HUMAN", confirm)
      .say(
        "AGENT",
        `Confirmed. Order ${ref}, ${qty} ${unit}, dispatch today by 5 PM. A verification call will follow at dispatch time. Thank you.`,
        900,
      )
      .call("call-03", "extracting", 1700)
      .emit(
        {
          type: "result.extracted",
          orderId: order.id,
          structured: {
            contact_reached: "yes",
            stock_status: "confirmed",
            confirmed_quantity: qty,
            remaining_quantity: 0,
            unit_price: order.item.unitPrice,
            currency: order.item.currency,
            dispatch_date: "today by 5 PM",
            requires_approval: false,
            verbatim_commitment: `yes, we can dispatch all ${qty} today by five`,
            next_action: "CONFIRM_ORDER",
          },
          confidence: { score: 0.9, label: "HIGH" },
          evidence: [answer, confirm],
        },
        700,
      )
      .call("call-03", "completed", 900)
      .followUp(
        {
          id: `${order.id}-verify`,
          orderId: order.id,
          kind: "VERIFICATION",
          dueAt: nextIst(ctx.startedAt, 17, 15).iso,
          contactId: backup.id,
          note: `Verify all ${qty} ${unit} dispatched`,
          status: "SCHEDULED",
        },
        700,
      )
      .emit({
        type: "order.updated",
        orderId: order.id,
        status: "CONFIRMED",
        confirmedQuantity: qty,
        remainingQuantity: 0,
        summary: `All ${qty} ${unit} confirmed with ${backup.name} for dispatch today by 5 PM, after ${primary.name} did not answer.`,
        operatorMinutesSaved: 18,
      });

    return b.build();
  },
};
