"use client";

/**
 * THE ORDER SCREEN — the live call theatre for one coordination request.
 *
 * On camera for most of the demo. Its job is to make an invisible thing
 * visible: an agent calling a supplier, negotiating, and turning what was said
 * into a commitment the order is updated from.
 *
 * Orchestration only — it resolves the stream into the five required states
 * and hands each region to a component that owns its own layout:
 *
 *     ┌──────────────────── OrderHeader ────────────────────┐
 *     │                (ApprovalBanner when held)            │
 *     │ OrderColumn │ ReasoningColumn │ ConversationColumn   │
 *     ├──────────────────── OrderOutcome ───────────────────┤
 *     └─────────────────── StructuredResult ─────────────────┘
 */

import { useOrderStream, type OrderDetail, type OrderView } from "@/hooks/useOrderStream";
import { useCallCues } from "@/hooks/useCallCues";
import { Panel } from "@/components/ui/Panel";
import { TERMINAL_STATUSES, isTrusted } from "@/lib/order-view";
import { ApprovalBanner } from "./ApprovalBanner";
import { ConversationColumn } from "./ConversationColumn";
import { OrderColumn } from "./OrderColumn";
import { OrderHeader } from "./OrderHeader";
import { OrderLoadError, OrderNotFound, OrderSkeleton } from "./OrderFallback";
import { OrderOutcome } from "./OrderOutcome";
import { ReasoningColumn } from "./ReasoningColumn";
import { StructuredResult } from "./StructuredResult";
import { SuppressionBanner } from "./SuppressionBanner";
import { THEATRE_GRID } from "./layout";

export function OrderTheatre({ orderId }: { orderId: string }) {
  const { view, detail, load, error, connected, live, retry } = useOrderStream(orderId);

  useCallCues({
    callState: view.callState,
    rung: view.rung,
    resolved: view.update?.status === "CONFIRMED" || view.update?.status === "PARTIALLY_CONFIRMED",
  });

  if (load === "not_found") return <OrderNotFound orderId={orderId} />;
  if (load === "error") return <OrderLoadError message={error} onRetry={retry} />;
  if (load === "loading" || !detail) return <OrderSkeleton />;

  return <Theatre detail={detail} view={view} connected={connected} live={live} />;
}

/**
 * The success state. Split from the component above so that every value below
 * is non-null by construction rather than by assertion.
 */
function Theatre({
  detail,
  view,
  connected,
  live,
}: {
  detail: OrderDetail;
  view: OrderView;
  connected: boolean;
  live: boolean;
}) {
  const { order } = detail;
  const status = view.status ?? order.status;
  const settled = TERMINAL_STATUSES.has(status);
  const suppression = view.suppression;
  const lastSpeaker = view.turns.at(-1)?.speaker ?? null;

  // What the call secured. The order update is authoritative once it exists — a
  // null there means nothing was confirmed. Before it, a result counts only if
  // it clears the review floor; a low-confidence answer is a claim, not stock.
  const provisional = view.result && isTrusted(view.result) ? view.result.structured : null;
  const confirmed = view.update ? view.update.confirmedQuantity : (provisional?.confirmed_quantity ?? null);
  const remaining = view.update ? view.update.remainingQuantity : (provisional?.remaining_quantity ?? null);
  const remainingLabel = view.result?.structured.delivery_eta ?? "later";
  const unitPrice = view.update?.unitPrice ?? order.item.unitPrice;

  return (
    <div className="flex min-h-0 flex-col xl:h-full">
      <OrderHeader
        order={order}
        status={status}
        urgency={view.urgency ?? order.urgency}
        settled={settled}
        connected={connected}
        dropped={view.dropped}
      />

      {suppression && <SuppressionBanner reason={suppression.reason} />}
      {view.approval && <ApprovalBanner orderId={order.id} approval={view.approval} />}

      <div className={`grid gap-3 p-3 xl:min-h-0 xl:flex-1 xl:overflow-hidden ${THEATRE_GRID}`}>
        <OrderColumn
          order={order}
          unitPrice={unitPrice}
          confirmed={confirmed}
          remaining={remaining}
          remainingLabel={remainingLabel}
          triggerSummary={view.trigger?.summary ?? null}
          callState={view.callState}
          speaker={live ? lastSpeaker : null}
          showCallActivity={!suppression}
        />

        <ReasoningColumn
          contact={view.contact}
          company={order.seller.name}
          rung={view.rung}
          maxRungs={order.maxRungs}
          ladder={view.ladder}
          callState={view.callState}
          connectedAt={view.connectedAt}
          endedAt={view.endedAt}
          timeline={view.timeline}
          autoScrollTimeline={live}
          showCall={!suppression}
        />

        <ConversationColumn
          suppression={suppression}
          seller={order.seller.name}
          plan={view.plan}
          turns={view.turns}
          evidence={view.result?.evidence ?? []}
          live={live}
          hasCallState={view.callState !== null}
          hasResult={view.result !== null}
        />
      </div>

      <OrderOutcome update={view.update} unresolved={view.unresolved} followUps={view.followUps} />

      {suppression ? (
        <p className="m-3 mt-0 shrink-0 rounded-lg border border-line bg-panel px-5 py-3 text-xs text-ink-dim">
          <span className="font-medium text-ink">No structured result.</span> Extraction is a property of a
          call, and this request never needed one — which is the correct outcome. The suppression itself is the
          record.
        </p>
      ) : (
        <Panel
          label="Structured result"
          className="m-3 mt-0 shrink-0"
          bodyClassName="p-0"
          right={<span className="micro">CALL-E resultSchema · typed extraction</span>}
        >
          <StructuredResult
            orderId={order.id}
            requested={order.item.requestedQuantity}
            unit={order.item.unit}
            result={view.result}
            extracting={view.callState === "extracting"}
          />
        </Panel>
      )}
    </div>
  );
}
