/**
 * In-memory mock backend — the dev harness described in FR-4.5.
 *
 * Holds coordination requests (orders), replays scenario scripts in real time,
 * and implements the operator actions a real backend would: approve or reject
 * a changed price, correct an extracted field, and halt all calling. Survives
 * Fast Refresh by hanging off `globalThis`.
 *
 * It exists so the dashboard can be built and rehearsed without spending the
 * CALL-E call budget. It is never the demo path.
 */

import type {
  Contact,
  FollowUp,
  Order,
  OrderStatus,
  TriggerType,
  Urgency,
} from "@/lib/contracts/domain";
import type { SentinelEvent } from "@/lib/contracts/events";
import { BUYER, PRODUCT, SELLER, contactById, ladderFor } from "./directory";
import { scenarioById, type ScriptStep } from "./scenarios";

export interface Run {
  order: Order;
  ladder: Contact[];
  emitted: SentinelEvent[];
  followUps: FollowUp[];
  finished: boolean;
  timers: ReturnType<typeof setTimeout>[];
  subscribers: Set<(event: SentinelEvent) => void>;
}

interface Store {
  runs: Map<string, Run>;
  killSwitch: boolean;
  seeded: boolean;
  counter: number;
}

declare global {
  var __sentinelOrderStore: Store | undefined;
}

const store: Store =
  globalThis.__sentinelOrderStore ??
  (globalThis.__sentinelOrderStore = {
    runs: new Map(),
    killSwitch: false,
    seeded: false,
    counter: 0,
  });

/** Statuses that end a request. `APPROVAL_REQUIRED` is not one: it waits on a person. */
const TERMINAL: ReadonlySet<OrderStatus> = new Set([
  "CONFIRMED",
  "PARTIALLY_CONFIRMED",
  "CALLBACK_SCHEDULED",
  "HUMAN_REVIEW",
  "UNRESOLVED",
  "SUPPRESSED",
]);

/* ─── Creating orders ───────────────────────────────────────────────────── */

export interface NewOrderInput {
  reference: string;
  description: string;
  unit: string;
  quantity: number;
  requiredBy: string;
  triggerType: TriggerType;
}

/** FR-2.2 — urgency from how soon the goods are needed. */
function urgencyFor(requiredBy: string, from: number): Urgency {
  const hours = (Date.parse(requiredBy) - from) / 3_600_000;
  if (hours <= 24) return "URGENT";
  if (hours <= 72) return "PRIORITY";
  return "ROUTINE";
}

function triggerSummary(input: NewOrderInput): string {
  const qty = `${input.quantity} ${input.unit}`;
  switch (input.triggerType) {
    case "INVENTORY":
      return `Stock of ${input.description.toLowerCase()} fell below the reorder point — ${qty} to replenish`;
    case "DELIVERY":
      return `Delivery for ${input.reference} is at risk — dispatch not yet confirmed`;
    case "EXCEPTION":
      return `Exception raised on ${input.reference} — supplier confirmation needed`;
    case "IOT":
      return `Storage sensor flagged a risk to ${input.description.toLowerCase()} — ${qty} to source`;
    default:
      return `Order ${input.reference} for ${qty} needs a confirmed dispatch`;
  }
}

function makeOrder(input: NewOrderInput, scenarioId: string, createdAt: number): Order {
  store.counter += 1;
  const id = `CR-${1000 + store.counter}`;
  const rand = Math.random().toString(36).slice(2, 8);

  return {
    id,
    reference: input.reference,
    traceId: `tr_${rand}${createdAt.toString(36).slice(-4)}`,
    buyer: BUYER,
    seller: SELLER,
    item: {
      sku: PRODUCT.sku,
      description: input.description,
      unit: input.unit,
      requestedQuantity: input.quantity,
      confirmedQuantity: null,
      remainingQuantity: null,
      unitPrice: PRODUCT.unitPrice,
      currency: PRODUCT.currency,
    },
    status: "AWAITING_CONFIRMATION",
    urgency: urgencyFor(input.requiredBy, createdAt),
    requiredBy: input.requiredBy,
    trigger: {
      type: input.triggerType,
      summary: triggerSummary(input),
      receivedAt: new Date(createdAt).toISOString(),
    },
    createdAt: new Date(createdAt).toISOString(),
    closedAt: null,
    currentRung: 1,
    maxRungs: 3,
    outcome: null,
    operatorMinutesSaved: null,
    scenarioId,
  };
}

/* ─── Projection: events → the order summary the list endpoint serves ──── */

function project(run: Run, event: SentinelEvent, at: number): void {
  const order = run.order;
  const closeAt = new Date(at).toISOString();

  switch (event.type) {
    case "order.opened":
      order.status = "AWAITING_CONFIRMATION";
      order.urgency = event.urgency;
      break;
    case "order.suppressed":
      order.status = "SUPPRESSED";
      order.outcome = event.reason;
      order.closedAt = closeAt;
      break;
    case "contact.selected":
      order.status = "CALLING";
      order.currentRung = event.rung;
      break;
    case "order.escalated":
      order.currentRung = event.toRung;
      break;
    case "approval.required":
      order.status = "APPROVAL_REQUIRED";
      break;
    case "followup.scheduled":
      run.followUps = [...run.followUps.filter((f) => f.id !== event.followUp.id), event.followUp];
      break;
    case "order.updated":
      order.status = event.status;
      order.item.confirmedQuantity = event.confirmedQuantity;
      order.item.remainingQuantity = event.remainingQuantity;
      if (event.unitPrice != null) order.item.unitPrice = event.unitPrice;
      order.outcome = event.summary;
      order.operatorMinutesSaved = event.operatorMinutesSaved;
      order.closedAt = TERMINAL.has(event.status) ? closeAt : null;
      break;
    case "order.unresolved":
      order.status = "UNRESOLVED";
      order.outcome = event.reason;
      order.closedAt = closeAt;
      break;
  }
}

function publish(run: Run, event: SentinelEvent): void {
  run.emitted.push(event);
  project(run, event, Date.now());
  run.subscribers.forEach((fn) => fn(event));
}

/* ─── Runs ──────────────────────────────────────────────────────────────── */

function createRun(scenarioId: string, input: NewOrderInput, startedAt: number): {
  run: Run;
  steps: ScriptStep[];
} {
  const scenario = scenarioById(scenarioId);
  if (!scenario) throw new Error(`Unknown scenario: ${scenarioId}`);

  const priorOrders = [...store.runs.values()].map((r) => r.order);
  const order = makeOrder(input, scenarioId, startedAt);
  const ladder = ladderFor(order.seller.id);
  const steps = scenario.build({ order, ladder, priorOrders, startedAt });

  const run: Run = {
    order,
    ladder,
    emitted: [],
    followUps: [],
    finished: false,
    timers: [],
    subscribers: new Set(),
  };
  store.runs.set(order.id, run);
  return { run, steps };
}

/** Start a live run: every step is emitted at its scripted offset from now. */
export function trigger(scenarioId: string, input: NewOrderInput): Run {
  seed();
  const { run, steps } = createRun(scenarioId, input, Date.now());

  const last = steps.reduce((max, s) => Math.max(max, s.at), 0);
  for (const step of steps) {
    run.timers.push(setTimeout(() => publish(run, step.event), step.at));
  }
  run.timers.push(setTimeout(() => (run.finished = true), last + 400));
  return run;
}

/* ─── Operator actions ──────────────────────────────────────────────────── */

/** "Metro Supply Co." → "Metro Supply Co", so a sentence can end on it once. */
function withoutFullStop(name: string): string {
  return name.replace(/\.$/, "");
}

export class StoreError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * FR-5.3 — a changed price is decided by a person, never by the agent.
 * Approve confirms the order at the new price; reject hands it to a person to
 * renegotiate.
 */
export function decideApproval(
  orderId: string,
  decision: "APPROVE" | "REJECT",
  note: string,
): void {
  const run = store.runs.get(orderId);
  if (!run) throw new StoreError(`No order ${orderId}`, 404);
  if (run.order.status !== "APPROVAL_REQUIRED") {
    throw new StoreError("This order is not waiting for an approval", 409);
  }

  const request = [...run.emitted]
    .reverse()
    .find((e): e is Extract<SentinelEvent, { type: "approval.required" }> => e.type === "approval.required");
  if (!request) throw new StoreError("No approval request recorded for this order", 409);

  const { order } = run;
  const money = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: request.currency,
    maximumFractionDigits: 0,
  });
  const per = order.item.unit.replace(/s$/, "");
  const suffix = note.trim() ? ` Note: ${note.trim()}` : "";

  if (decision === "APPROVE") {
    const primary = run.ladder[0];
    publish(run, {
      type: "followup.scheduled",
      orderId,
      followUp: {
        id: `${orderId}-verify`,
        orderId,
        kind: "VERIFICATION",
        dueAt: new Date(Date.now() + 2 * 3_600_000).toISOString(),
        contactId: primary.id,
        note: `Verify ${order.item.requestedQuantity} ${order.item.unit} dispatched at the approved price`,
        status: "SCHEDULED",
      },
    });
    publish(run, {
      type: "order.updated",
      orderId,
      status: "CONFIRMED",
      confirmedQuantity: order.item.requestedQuantity,
      remainingQuantity: 0,
      unitPrice: request.proposedUnitPrice,
      summary: `Operator approved ${money.format(request.proposedUnitPrice)} per ${per}. Order confirmed for dispatch today.${suffix}`,
      operatorMinutesSaved: 11,
    });
    return;
  }

  publish(run, {
    type: "order.updated",
    orderId,
    status: "HUMAN_REVIEW",
    confirmedQuantity: null,
    remainingQuantity: null,
    summary: `Operator rejected ${money.format(request.proposedUnitPrice)} per ${per} — a person needs to renegotiate with ${withoutFullStop(order.seller.name)}.${suffix}`,
    operatorMinutesSaved: null,
  });
}

/**
 * FR-6.4 — operator correction of an extracted field. Re-emits
 * `result.extracted` with the corrected values; confidence and evidence are
 * left untouched, because an edit does not change what was said on the call.
 */
export function overrideResult(orderId: string, patch: Record<string, unknown>): void {
  const run = store.runs.get(orderId);
  if (!run) throw new StoreError(`No order ${orderId}`, 404);

  const last = [...run.emitted]
    .reverse()
    .find((e): e is Extract<SentinelEvent, { type: "result.extracted" }> => e.type === "result.extracted");
  if (!last) throw new StoreError("No extracted result to correct", 404);

  publish(run, { ...last, structured: { ...last.structured, ...patch } });
}

/* ─── Kill switch (Rule 3: it always works) ────────────────────────────── */

export function isKillSwitchEngaged(): boolean {
  return store.killSwitch;
}

export function setKillSwitch(engaged: boolean): boolean {
  store.killSwitch = engaged;
  if (!engaged) return false;

  for (const run of store.runs.values()) {
    if (run.finished) continue;
    run.timers.forEach(clearTimeout);
    run.timers = [];
    run.finished = true;
    publish(run, {
      type: "order.unresolved",
      orderId: run.order.id,
      reason: "Halted by the kill switch — outbound calling stopped",
    });
  }
  return true;
}

/* ─── Queries ───────────────────────────────────────────────────────────── */

export function getRun(orderId: string): Run | undefined {
  seed();
  return store.runs.get(orderId);
}

export function listOrders(): Order[] {
  seed();
  return [...store.runs.values()]
    .map((r) => r.order)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export interface FollowUpView extends FollowUp {
  orderReference: string;
  contactName: string;
}

/** Every follow-up still to happen, soonest first. */
export function listFollowUps(): FollowUpView[] {
  seed();
  return [...store.runs.values()]
    .flatMap((run) =>
      run.followUps
        .filter((f) => f.status === "SCHEDULED")
        .map((f) => ({
          ...f,
          orderReference: run.order.reference,
          contactName: contactById(f.contactId)?.name ?? "Unknown contact",
        })),
    )
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export function subscribe(run: Run, fn: (event: SentinelEvent) => void): () => void {
  run.subscribers.add(fn);
  return () => run.subscribers.delete(fn);
}

/** Drop every run and return to the seeded history. */
export function resetToSeed(): void {
  for (const run of store.runs.values()) run.timers.forEach(clearTimeout);
  store.runs.clear();
  store.counter = 0;
  store.seeded = false;
  seed();
}

/* ─── Seeded history ─────────────────────────────────────────────────────
   An empty board reads as broken on camera. Seeds are built by running the
   real scenarios with a start time in the past and emitting every step at
   once, so opening a seeded order replays its complete story — nothing here
   is hand-written state that the live path could disagree with.
   ────────────────────────────────────────────────────────────────────────── */

const SEED: Array<{ scenarioId: string; reference: string; quantity: number; minutesAgo: number }> = [
  { scenarioId: "no-answer-escalation", reference: "ORD-477", quantity: 200, minutesAgo: 290 },
  { scenarioId: "vague-answer", reference: "ORD-471", quantity: 80, minutesAgo: 205 },
  { scenarioId: "partial-stock", reference: "ORD-479", quantity: 150, minutesAgo: 118 },
  { scenarioId: "callback", reference: "ORD-480", quantity: 120, minutesAgo: 42 },
  { scenarioId: "price-change", reference: "ORD-481", quantity: 60, minutesAgo: 21 },
];

function seed(): void {
  if (store.seeded) return;
  store.seeded = true;

  const now = Date.now();
  for (const s of SEED) {
    const startedAt = now - s.minutesAgo * 60_000;
    const { run, steps } = createRun(
      s.scenarioId,
      {
        reference: s.reference,
        description: PRODUCT.description,
        unit: PRODUCT.unit,
        quantity: s.quantity,
        requiredBy: new Date(startedAt + 8 * 3_600_000).toISOString(),
        triggerType: "INVENTORY",
      },
      startedAt,
    );

    for (const step of steps) {
      run.emitted.push(step.event);
      project(run, step.event, startedAt + step.at);
    }
    // A follow-up whose time has already passed happened; it is not overdue.
    run.followUps = run.followUps.map((f) =>
      Date.parse(f.dueAt) < now ? { ...f, status: "DONE" as const } : f,
    );
    run.finished = true;
  }
}
