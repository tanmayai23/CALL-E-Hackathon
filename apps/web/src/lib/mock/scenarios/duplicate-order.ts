/**
 * DUPLICATE ORDER → SUPPRESSED — FR-2.3.
 *
 * A request arrives that an open or recently settled request already covers.
 * The assessment step suppresses it before any call is planned: calling again
 * would ask the same person the same question. Restraint is a feature, and it
 * only counts if it is visible.
 *
 * The rule the mock applies, in order: an earlier request with the same
 * reference; otherwise the most recent request to the same seller for the same
 * SKU that is still in progress or already settled.
 */

import type { Order, OrderStatus } from "@/lib/contracts/domain";
import { ScriptBuilder, type Scenario } from "./script";

const COVERING: ReadonlySet<OrderStatus> = new Set([
  "CALLING",
  "CONFIRMED",
  "PARTIALLY_CONFIRMED",
  "APPROVAL_REQUIRED",
  "CALLBACK_SCHEDULED",
]);

function findCovering(order: Order, prior: Order[]): Order | undefined {
  const earlier = prior
    .filter((o) => o.id !== order.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    earlier.find((o) => o.reference === order.reference) ??
    earlier.find(
      (o) =>
        o.seller.id === order.seller.id && o.item.sku === order.item.sku && COVERING.has(o.status),
    )
  );
}

export const duplicateOrder: Scenario = {
  id: "duplicate-order",
  name: "Duplicate order",
  tagline: "It's already covered. Nobody's phone rings.",
  description:
    "The request repeats one that is already in progress with the same wholesaler. The assessment step recognises it and suppresses it before a call is planned — no one is asked the same question twice.",
  expectedOutcome: "Suppressed · no call placed",

  build(ctx) {
    const { order } = ctx;
    const covering = findCovering(order, ctx.priorOrders);

    const reason = covering
      ? `Matches ${covering.reference}, received ${Math.max(
          1,
          Math.round((ctx.startedAt - Date.parse(covering.createdAt)) / 60_000),
        )} min ago and already ${covering.status.toLowerCase().replace(/_/g, " ")} with ${covering.seller.name}. ` +
        "Calling again would ask the same person the same question — no call placed."
      : `An open request to ${order.seller.name} already covers this item. Calling again would ask the same person the same question — no call placed.`;

    return new ScriptBuilder(order.id, ctx.startedAt)
      .emit(
        {
          type: "event.received",
          orderId: order.id,
          triggerType: order.trigger.type,
          summary: order.trigger.summary,
          ts: new Date(ctx.startedAt).toISOString(),
        },
        1600,
      )
      .emit({
        type: "order.suppressed",
        orderId: order.id,
        reason,
        duplicateOf: covering?.reference,
      })
      .build();
  },
};
