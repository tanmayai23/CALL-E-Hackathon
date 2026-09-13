/**
 * PRICE CHANGED → APPROVAL — PRD v2.0 §9, FR-5.3.
 *
 * Stock is fine but the supplier has raised the price. The agent is not allowed
 * to accept a changed price (§7.3, §17), so it records the new figure and parks
 * the order for an operator's decision. Approve and Reject are handled by the
 * store, which emits the order update once a person has decided.
 */

import {
  ScriptBuilder,
  cutOffHour,
  openOrder,
  opener,
  selectAndPlan,
  spokenAmount,
  spokenReference,
  type Scenario,
} from "./script";

/** The quoted increase, rounded to a figure a person would say. */
function raisedPrice(price: number): number {
  return Math.round((price * 1.11) / 50) * 50;
}

export const priceChange: Scenario = {
  id: "price-change",
  name: "Price changed",
  tagline: "The supplier raises the price. The agent refuses to agree to it.",
  description:
    "All stock is available, but at a higher price than the order. The agent records the new price, tells the supplier it cannot accept it, and holds the order until an operator approves or rejects the change.",
  expectedOutcome: "Held for approval · operator decides",

  build(ctx) {
    const { order } = ctx;
    const unit = order.item.unit;
    const qty = order.item.requestedQuantity;
    const oldPrice = order.item.unitPrice;
    const newPrice = raisedPrice(oldPrice);
    const money = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: order.item.currency,
      maximumFractionDigits: 0,
    });
    const increase = (((newPrice - oldPrice) / oldPrice) * 100).toFixed(1);

    const quote = `We have all ${qty}. But the price has gone up — it is ${spokenAmount(newPrice)} a case now, not ${spokenAmount(oldPrice)}.`;
    const cutOff = cutOffHour(ctx.startedAt, 2);
    const condition = `If we hear back by ${cutOff.spoken}, yes, today.`;

    const b = new ScriptBuilder(order.id, ctx.startedAt);
    openOrder(b, ctx);
    selectAndPlan(b, ctx, 1, "Be professional and concise.");

    b.call("call-01", "queued", 700)
      .call("call-01", "dialling", 3600)
      .call("call-01", "connected", 600)
      .call("call-01", "in_conversation", 300)
      .say("AGENT", opener(ctx), 800)
      .say("HUMAN", quote)
      .say(
        "AGENT",
        `Understood. I am not able to accept a price change on behalf of ${order.buyer.name}. ` +
          `I will record ${spokenAmount(newPrice)} per case and send it for approval. If it is approved, can you still dispatch today?`,
        750,
      )
      .say("HUMAN", condition)
      .say(
        "AGENT",
        `Thank you. You will have an answer on the new price shortly. Order ${spokenReference(order.reference)} is on hold until then.`,
        900,
      )
      .call("call-01", "extracting", 1700)
      .emit(
        {
          type: "result.extracted",
          orderId: order.id,
          structured: {
            contact_reached: "yes",
            stock_status: "confirmed",
            confirmed_quantity: qty,
            remaining_quantity: 0,
            unit_price: newPrice,
            currency: order.item.currency,
            dispatch_date: `today, if approved by ${cutOff.written}`,
            requires_approval: true,
            verbatim_commitment: condition,
            next_action: "REQUEST_APPROVAL",
          },
          confidence: { score: 0.91, label: "HIGH" },
          evidence: [quote, condition],
        },
        700,
      )
      .call("call-01", "completed", 900)
      .emit(
        {
          type: "approval.required",
          orderId: order.id,
          reason: `${order.seller.name} quoted ${money.format(newPrice)} per ${unit.replace(/s$/, "")} against ${money.format(oldPrice)} on the order (+${increase}%). The agent cannot accept a changed price.`,
          previousUnitPrice: oldPrice,
          proposedUnitPrice: newPrice,
          currency: order.item.currency,
        },
        600,
      )
      .emit({
        type: "order.updated",
        orderId: order.id,
        status: "APPROVAL_REQUIRED",
        confirmedQuantity: qty,
        remainingQuantity: 0,
        summary: `Held for approval — ${order.seller.name} quoted ${money.format(newPrice)} per ${unit.replace(/s$/, "")} (was ${money.format(oldPrice)}).`,
        operatorMinutesSaved: null,
      });

    return b.build();
  },
};
