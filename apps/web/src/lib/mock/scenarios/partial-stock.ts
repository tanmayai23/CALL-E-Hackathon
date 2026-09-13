/**
 * THE HERO SCENARIO — PRD v2.0 §4.1.
 *
 * The distributor needs 200 cases today; the wholesaler has 120 ready. The
 * agent secures the 120 for today, gets a date for the remaining 80, and the
 * order is marked partially confirmed with a follow-up for the rest. This is
 * the run the demo video is built around.
 */

import {
  ScriptBuilder,
  istAt,
  openOrder,
  opener,
  selectAndPlan,
  spokenReference,
  type Scenario,
} from "./script";

export const partialStock: Scenario = {
  id: "partial-stock",
  name: "Partial stock",
  tagline: "Only part is ready. The agent secures it and dates the rest.",
  description:
    "The wholesaler has 60% of the order ready today. Instead of recording a failure, the agent confirms that part for dispatch today, asks when the remainder will be ready, and schedules a follow-up for it.",
  expectedOutcome: "Partially confirmed · follow-up for the remainder",

  build(ctx) {
    const { order } = ctx;
    const unit = order.item.unit;
    const requested = order.item.requestedQuantity;
    const confirmed = Math.round(requested * 0.6);
    const remaining = requested - confirmed;
    const primary = ctx.ladder[0];

    const ready = `We only have ${confirmed} ${unit} ready today.`;
    const commitment = `Yes, ${confirmed} today and the remaining ${remaining} tomorrow morning.`;

    const b = new ScriptBuilder(order.id, ctx.startedAt);
    openOrder(b, ctx);
    selectAndPlan(b, ctx, 1, "Be professional and concise.");

    b.call("call-01", "queued", 700)
      .call("call-01", "dialling", 3800)
      .call("call-01", "connected", 600)
      .call("call-01", "in_conversation", 300)
      .say("AGENT", opener(ctx), 800)
      .say("HUMAN", ready)
      .say(
        "AGENT",
        `Thank you. Can you dispatch the ${confirmed} ${unit} today and confirm when the remaining ${remaining} will be available?`,
        750,
      )
      .say("HUMAN", commitment)
      .say(
        "AGENT",
        `Confirmed: ${confirmed} ${unit} dispatch today, and the remaining ${remaining} tomorrow morning, at the price on the order. ` +
          `I will update order ${spokenReference(order.reference)} and schedule a follow-up for the ${remaining}. Thank you.`,
        900,
      )
      .call("call-01", "extracting", 1800)
      .emit(
        {
          type: "result.extracted",
          orderId: order.id,
          structured: {
            contact_reached: "yes",
            stock_status: "partial",
            confirmed_quantity: confirmed,
            remaining_quantity: remaining,
            unit_price: order.item.unitPrice,
            currency: order.item.currency,
            dispatch_date: "today",
            delivery_eta: "tomorrow morning",
            requires_approval: false,
            verbatim_commitment: commitment,
            next_action: "PARTIAL_CONFIRMATION",
          },
          confidence: { score: 0.92, label: "HIGH" },
          evidence: [ready, commitment],
        },
        700,
      )
      .call("call-01", "completed", 900)
      .followUp(
        {
          id: `${order.id}-remaining`,
          orderId: order.id,
          kind: "REMAINING_QUANTITY",
          dueAt: istAt(ctx.startedAt, 1, 10, 0),
          contactId: primary.id,
          note: `Confirm the remaining ${remaining} ${unit} have dispatched`,
          status: "SCHEDULED",
        },
        500,
      )
      .followUp(
        {
          id: `${order.id}-verify`,
          orderId: order.id,
          kind: "VERIFICATION",
          dueAt: new Date(ctx.startedAt + 2 * 3_600_000).toISOString(),
          contactId: primary.id,
          note: `Verify today's ${confirmed} ${unit} left the dock`,
          status: "SCHEDULED",
        },
        700,
      )
      .emit({
        type: "order.updated",
        orderId: order.id,
        status: "PARTIALLY_CONFIRMED",
        confirmedQuantity: confirmed,
        remainingQuantity: remaining,
        summary: `${confirmed} ${unit} dispatch today; the remaining ${remaining} tomorrow morning. Follow-up scheduled for the ${remaining}.`,
        operatorMinutesSaved: 14,
      });

    return b.build();
  },
};
