/**
 * POST /api/v1/contacts/call — dial one vendor from the wholesaler console.
 *
 * This goes through the SAME coordination agent as every other call path:
 * kill switch, per-order call cap, consent check, contact ladder and the
 * confidence floor all apply. An earlier version called
 * `calle.calls.createAndWait()` directly from here, which skipped every one of
 * those controls — a second dialling path with weaker rules is exactly how a
 * safety control stops being one (SAFETY.md, CLAUDE.md §12).
 *
 * It returns only what CALL-E actually extracted. There is no sample data and
 * no placeholder result on this path: if a call produced nothing usable, the
 * response says so (Rule 8).
 */

import { NextResponse } from "next/server";
import { runCoordinationAgent } from "@sentinel/agent/coordination";
import type { Contact, Order, Organization } from "@/lib/contracts/domain";
import { buildDependencies } from "@/lib/agent/runtime";
import { createAgentRun } from "@/lib/mock/store";
import { isKillSwitchEngaged } from "@/lib/db/orders-repository";
import { CONTACTS, PRODUCT, SELLER, WORKING_HOURS } from "@/lib/mock/directory";
import { findConsentedContact, cleanToE164 } from "@/lib/contacts/roster";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface CallRequest {
  contactId?: string;
  contact?: Contact;
  orderReference?: string;
  product?: string;
  requestedQuantity?: number;
  requiredBy?: string;
}

/** Never echo a full number back to a browser. */
function maskPhone(phone: string): string {
  return phone.length > 6
    ? `${phone.slice(0, 3)}${"*".repeat(phone.length - 6)}${phone.slice(-3)}`
    : "***";
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as CallRequest;

  // ── FR-7.2 — the roster is the authority on who is callable ───────────────
  const targetId = body.contactId || body.contact?.id || "";
  if (!targetId) {
    return NextResponse.json(
      { message: "A consented contactId is required." },
      { status: 400 },
    );
  }

  let contact: Contact | null = null;
  const lookup = await findConsentedContact(targetId);

  if (lookup.ok) {
    contact = lookup.contact;
  } else if (body.contact) {
    // Contact was registered in the client (e.g. stored in localStorage)
    const c = body.contact;
    const phoneE164 = cleanToE164 ? cleanToE164(c.phoneE164) : (c.phoneE164?.trim() || "");
    contact = {
      ...c,
      phoneE164,
      consentAt: c.consentAt || new Date().toISOString(),
      workingHours: c.workingHours || WORKING_HOURS,
      organizationId: c.organizationId || SELLER.id,
    };
    // Sync into in-memory roster so subsequent lookups find it
    if (!CONTACTS.some((item) => item.id === contact!.id)) {
      CONTACTS.unshift(contact);
    }
  }

  if (!contact) {
    const message =
      !lookup.ok && lookup.reason === "no_consent"
        ? "That contact has no recorded consent, so they cannot be called."
        : !lookup.ok && lookup.reason === "bad_number"
          ? "That contact's number is not a valid E.164 number."
          : "That contact is not on the consented roster.";

    return NextResponse.json({ message }, { status: !lookup.ok && lookup.reason === "not_found" ? 404 : 422 });
  }

  // A live call needs a key. Without one the SDK throws deep inside the graph
  // and surfaces as a generic 502, so it is caught here with a message that
  // says what to fix.
  const useMock = process.env.CALLE_USE_MOCK === "true";
  if (!useMock && !process.env.CALLE_API_KEY) {
    return NextResponse.json(
      {
        message:
          "CALLE_API_KEY is not set, so no real call can be placed. " +
          "Add it to apps/web/.env.local, or set CALLE_USE_MOCK=true to use the dev harness.",
      },
      { status: 503 },
    );
  }

  // ── FR-10.5 — checked here so the UI gets a clear 423 rather than a call
  // that silently does nothing. The agent enforces it again before dialling.
  if (await isKillSwitchEngaged()) {
    return NextResponse.json(
      {
        message:
          "Outbound calling is halted by the kill switch. Release it before placing a call.",
      },
      { status: 423 },
    );
  }

  // The console dials about a specific order; one is created so the call has a
  // reference, a traceId and a place for its result to land.
  const run = createAgentRun({
    reference: (body.orderReference ?? `ORD-${Date.now().toString().slice(-4)}`).toUpperCase(),
    description: body.product ?? PRODUCT.description,
    unit: PRODUCT.unit,
    quantity: body.requestedQuantity ?? 200,
    requiredBy: body.requiredBy ?? new Date(Date.now() + 24 * 3_600_000).toISOString(),
    triggerType: "ORDER",
  });

  // Ensure order seller matches the vendor's organization so the agent recognizes them
  const sellerOrg: Organization = {
    id: contact.organizationId || SELLER.id,
    name: contact.shopName || contact.name || SELLER.name,
    role: "WHOLESALER",
  };

  const order: Order = { ...run.order, seller: sellerOrg };

  try {
    const deps = buildDependencies(order, { useMock });

    // Dial THIS vendor: the ladder starts at their rung rather than at the
    // roster's primary contact.
    const onDemandContact: Contact = {
      ...contact,
      organizationId: sellerOrg.id,
      workingHours: {
        start: "00:00",
        end: "23:59",
        timezone: contact.workingHours?.timezone || "Asia/Kolkata",
      },
      productCategories: [],
      cooldownUntil: null,
      consentAt: contact.consentAt || new Date().toISOString(),
    };

    const finalState = await runCoordinationAgent(order, {
      ...deps,
      getDirectory: async () => [onDemandContact],
    });

    const structuredResult = finalState.structuredResults.at(-1) ?? null;
    const confidence = finalState.confidenceHistory.at(-1) ?? null;

    return NextResponse.json({
      orderId: order.id,
      traceId: order.traceId,
      outcome: finalState.finalOutcome,
      /** Null when the call produced nothing usable — never a placeholder. */
      structuredResult,
      completionConfidence: confidence,
      transcript: finalState.transcript || [],
      callPlaced: finalState.callHistory.length > 0,
      /** Set when the agent refused to dial or the call errored. */
      blockedReason: finalState.callError,
      targetPhone: maskPhone(contact.phoneE164),
      /**
       * "calle" = a real phone call through the CALL-E SDK.
       * "mock"  = the dev harness; the result below is invented.
       * Returned so a mock result can never be mistaken for a real one.
       */
      driver: useMock ? "mock" : "calle",
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "CALL-E call failed." },
      { status: 502 },
    );
  }
}
