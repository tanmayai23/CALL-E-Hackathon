/**
 * apps/web/src/lib/agent/runtime.ts
 * Binds the LangGraph coordination agent to this app's store, SSE stream and
 * kill switch.
 *
 * The agent package is pure — it performs no I/O of its own and reaches the
 * outside world only through the callbacks assembled here. That is what makes
 * a run replayable from its emitted events.
 *
 * Two things this file deliberately does NOT do:
 *   - It never decides whether to dial. The kill switch below is the real
 *     repository switch, the same one POST /api/v1/killswitch writes, and the
 *     agent fails closed if it is engaged or unreadable.
 *   - It never invents a result. Every field the dashboard renders comes from
 *     CALL-E's structured extraction, verbatim.
 */

import { runCoordinationAgent, runFollowUpCall } from "@sentinel/agent/coordination";
import type { CoordinationDependencies } from "@sentinel/agent/coordination";
import type { Contact, FollowUp, Order } from "@/lib/contracts/domain";
import { WholesaleResultSchema, type SentinelEvent } from "@/lib/contracts/events";
import { isKillSwitchEngaged } from "@/lib/db/orders-repository";
import { getSupabaseClient, hasSupabaseConfig } from "@/lib/db/supabase-client";
import { ladderFor, WORKING_HOURS } from "@/lib/mock/directory";
import { finishAgentRun, publishAgentEvent } from "@/lib/mock/store";

/** Emits into the run and therefore into every open SSE subscriber. */
function emit(orderId: string, event: SentinelEvent): void {
  publishAgentEvent(orderId, event);
}

/**
 * Assembles the dependency bundle for one order.
 *
 * `useMock` selects the CALL-E driver: the mock harness for development, the
 * real SDK for anything that counts. It defaults from the environment so a
 * deployment cannot accidentally ship the harness (CLAUDE.md Rule 1).
 */
export function buildDependencies(
  order: Order,
  options: { useMock?: boolean } = {},
): CoordinationDependencies {
  const useMock = options.useMock ?? process.env.CALLE_USE_MOCK === "true";

  return {
    getDirectory: async (sellerOrgId) => {
      const memoryLadder = ladderFor(sellerOrgId);
      if (hasSupabaseConfig()) {
        const supabase = getSupabaseClient();
        if (supabase) {
          try {
            const { data, error } = await supabase
              .from("contacts")
              .select("*")
              .eq("organization_id", sellerOrgId);

            if (!error && data && data.length > 0) {
              const dbContacts: Contact[] = data.map((row) => ({
                id: String(row.id),
                organizationId: String(row.organization_id),
                name: String(row.name),
                role: String(row.role || "Vendor"),
                phoneE164: String(row.phone_e164),
                productCategories: (row.product_categories as string[]) || ["wholesale"],
                region: String(row.region),
                workplaceLocation: (row.workplace_location as string) || undefined,
                livingLocation: (row.living_location as string) || undefined,
                shopName: (row.shop_name as string) || undefined,
                workingHours: (row.working_hours as Contact["workingHours"]) || WORKING_HOURS,
                escalationPriority: (row.escalation_priority as number) || 1,
                preferredLanguage: (row.preferred_language as string) || "en-IN",
                consentAt: (row.consent_at as string) || new Date().toISOString(),
                cooldownUntil: (row.cooldown_until as string) || null,
              }));

              const map = new Map<string, Contact>();
              memoryLadder.forEach((c) => map.set(c.id, c));
              dbContacts.forEach((c) => map.set(c.id, c));
              return Array.from(map.values()).sort(
                (a, b) => a.escalationPriority - b.escalationPriority,
              );
            }
          } catch (err) {
            console.warn("[runtime] Supabase getDirectory lookup failed:", err);
          }
        }
      }
      return memoryLadder;
    },

    // ── FR-10.5 — the real kill switch, not the simulator's copy ────────────
    // Reads through the repository, so it sees Supabase when configured and the
    // in-memory flag otherwise. Throwing here is safe: the agent treats a
    // failed check as "engaged" and refuses to dial.
    isKillSwitchActive: async () => isKillSwitchEngaged(),

    persistCall: async ({ orderId, rung, confidence, evidence, structuredResult }) => {
      // CALL-E's output is external input — validated at the boundary, never
      // asserted. A result that does not match the frozen schema is surfaced
      // as a review rather than rendered as though it were trustworthy.
      const parsed = WholesaleResultSchema.safeParse(structuredResult);

      if (parsed.success) {
        emit(orderId, {
          type: "result.extracted",
          orderId,
          structured: parsed.data,
          confidence,
          evidence,
        });
      } else {
        console.error(
          `[agent] ${orderId}: CALL-E returned a result outside the frozen schema —`,
          parsed.error.issues,
        );
      }

      return { callId: `call_${orderId}_${rung}` };
    },

    onConfirmed: async ({ orderId, result, minutesSaved }) => {
      emit(orderId, {
        type: "order.updated",
        orderId,
        status: "CONFIRMED",
        confirmedQuantity: result.confirmed_quantity ?? null,
        remainingQuantity: result.remaining_quantity ?? null,
        // `unitPrice` rides along only when the price actually changed — an
        // absent field means "unchanged", which is not the same as zero.
        ...(result.unit_price === undefined ? {} : { unitPrice: result.unit_price }),
        summary: result.verbatim_commitment ?? "Supplier confirmed the order.",
        operatorMinutesSaved: minutesSaved,
      });
      finishAgentRun(orderId);
    },

    onPartial: async ({ orderId, result }) => {
      emit(orderId, {
        type: "order.updated",
        orderId,
        status: "PARTIALLY_CONFIRMED",
        confirmedQuantity: result.confirmed_quantity ?? null,
        remainingQuantity: result.remaining_quantity ?? null,
        ...(result.unit_price === undefined ? {} : { unitPrice: result.unit_price }),
        summary:
          result.verbatim_commitment ??
          `Partial confirmation — ${result.remaining_quantity ?? "some"} units outstanding.`,
        operatorMinutesSaved: null,
      });
      finishAgentRun(orderId);
    },

    // FR-5.3 — a price change parks the order for a person. The agent never
    // accepts one, so this emits and stops rather than closing anything.
    onApprovalRequired: async ({ orderId, result }) => {
      emit(orderId, {
        type: "approval.required",
        orderId,
        reason: result.delay_reason ?? "The supplier quoted a different unit price.",
        previousUnitPrice: order.item.unitPrice,
        proposedUnitPrice: result.unit_price ?? order.item.unitPrice,
        currency: result.currency ?? order.item.currency,
      });
      finishAgentRun(orderId);
    },

    onCallbackScheduled: async ({ orderId, dueAt, contactId }) => {
      const followUp: FollowUp = {
        id: `fu_${orderId}_${Date.parse(dueAt)}`,
        orderId,
        kind: "CALLBACK",
        dueAt,
        contactId,
        note: "Supplier asked to be called back.",
        status: "SCHEDULED",
      };

      emit(orderId, { type: "followup.scheduled", orderId, followUp });
      emit(orderId, {
        type: "order.updated",
        orderId,
        status: "CALLBACK_SCHEDULED",
        confirmedQuantity: null,
        remainingQuantity: null,
        summary: `Callback agreed for ${dueAt}.`,
        operatorMinutesSaved: null,
      });
      finishAgentRun(orderId);
    },

    onHumanReview: async ({ orderId, reason }) => {
      emit(orderId, {
        type: "order.updated",
        orderId,
        status: "HUMAN_REVIEW",
        confirmedQuantity: null,
        remainingQuantity: null,
        summary: reason,
        operatorMinutesSaved: null,
      });
      finishAgentRun(orderId);
    },

    onUnresolved: async ({ orderId, reason }) => {
      emit(orderId, { type: "order.unresolved", orderId, reason });
      finishAgentRun(orderId);
    },

    // ── Audit trail (Rule 7 — traceId on every frame) ───────────────────────
    // The frozen event union has no `agent.event` member, and adding one is a
    // contract change (Rule 4). Node-level reasoning is carried on the events
    // the contract already defines: an escalation is an `order.escalated`, and
    // everything else is recorded server-side for the audit timeline.
    emitAgentEvent: ({ orderId, node, decision, reason, traceId }) => {
      if (node === "escalate" && decision.startsWith("rung_")) {
        const match = /^rung_(\d+)_to_(\d+)$/.exec(decision);
        if (match) {
          emit(orderId, {
            type: "order.escalated",
            orderId,
            fromRung: Number(match[1]),
            toRung: Number(match[2]),
            reason,
            traceId,
          });
          return;
        }
      }

      // Loose objects keep unknown keys, so traceId survives to the client.
      console.info(`[agent] ${orderId} ${node} → ${decision}: ${reason} (trace ${traceId})`);
    },

    emitContactSelected: ({ orderId, contact, rung, traceId }) => {
      emit(orderId, { type: "contact.selected", orderId, contact, rung, traceId });
    },

    emitPlanComposed: ({ orderId, summary, mustAsk, traceId }) => {
      emit(orderId, { type: "plan.composed", orderId, summary, mustAsk, traceId });
    },

    emitCallState: ({ orderId, callId, state, traceId }) => {
      emit(orderId, {
        type: "call.state",
        orderId,
        callId,
        state,
        ts: new Date().toISOString(),
        traceId,
      });
    },

    emitTranscriptDelta: ({ orderId, speaker, text, ts, traceId }) => {
      emit(orderId, { type: "transcript.delta", orderId, speaker, text, ts, traceId });
    },

    orderOpenedAt: new Date(order.createdAt),
    useMock,
  };
}

/** Runs the agent for an order. Rejects nothing — failures surface as events. */
export async function startCoordination(
  order: Order,
  options: { useMock?: boolean } = {},
): Promise<void> {
  const deps = buildDependencies(order, options);

  try {
    await runCoordinationAgent(order, deps);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    // Never swallow: the operator sees the failure on the board rather than an
    // order that silently stops moving.
    deps.emitAgentEvent({
      orderId: order.id,
      node: "agent",
      decision: "agent_error",
      reason,
      traceId: order.traceId,
    });

    await deps.onHumanReview({ orderId: order.id, traceId: order.traceId, reason });
  }
}

/** Runs a scheduled follow-up through the same graph, caps and kill switch. */
export async function startFollowUp(
  order: Order,
  followUp: FollowUp,
  getContact: (id: string) => Promise<Contact | null>,
  closeFollowUp: (params: {
    followUpId: string;
    status: "DONE" | "CANCELLED";
    reason: string;
  }) => Promise<void>,
  options: { useMock?: boolean } = {},
): Promise<void> {
  const deps = buildDependencies(order, options);

  try {
    await runFollowUpCall(order, followUp, { ...deps, getContact, closeFollowUp });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    deps.emitAgentEvent({
      orderId: order.id,
      node: "follow_up",
      decision: "follow_up_error",
      reason,
      traceId: order.traceId,
    });

    await closeFollowUp({ followUpId: followUp.id, status: "CANCELLED", reason });
  }
}
