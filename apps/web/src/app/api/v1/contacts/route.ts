import { NextResponse } from "next/server";
import { CONTACTS, ORGANIZATIONS, SELLER, WORKING_HOURS } from "@/lib/mock/directory";
import { getSupabaseClient, hasSupabaseConfig } from "@/lib/db/supabase-client";
import type { Contact } from "@/lib/contracts/domain";

import { cleanToE164 } from "@/lib/contacts/roster";

export const dynamic = "force-dynamic";

/** GET /api/v1/contacts — the consented business contacts, merged from Supabase & memory. */
export async function GET() {
  let dbContacts: Contact[] = [];

  if (hasSupabaseConfig()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("contacts")
          .select("*")
          .order("created_at", { ascending: false });

        if (!error && data && data.length > 0) {
          dbContacts = data.map((row) => ({
            id: row.id,
            organizationId: row.organization_id,
            name: row.name,
            role: row.role || "Vendor",
            phoneE164: row.phone_e164,
            productCategories: row.product_categories || ["wholesale"],
            region: row.region,
            workplaceLocation: row.workplace_location || undefined,
            livingLocation: row.living_location || undefined,
            shopName: row.shop_name || undefined,
            workingHours: row.working_hours || WORKING_HOURS,
            escalationPriority: row.escalation_priority || 1,
            preferredLanguage: row.preferred_language || "en-IN",
            consentAt: row.consent_at || new Date().toISOString(),
            cooldownUntil: row.cooldown_until || null,
          }));
        }
      } catch (err) {
        console.warn("Could not query Supabase contacts:", err);
      }
    }
  }

  // Combine DB contacts and in-memory CONTACTS array, deduplicating by ID
  const map = new Map<string, Contact>();
  // 1. Memory array first (newest unshifted contacts)
  CONTACTS.forEach((c) => map.set(c.id, c));
  // 2. DB contacts
  dbContacts.forEach((c) => map.set(c.id, c));

  const allContacts = Array.from(map.values());

  return NextResponse.json({
    organizations: ORGANIZATIONS,
    contacts: allContacts,
    source: hasSupabaseConfig() ? "supabase+mock" : "mock",
  });
}

/** POST /api/v1/contacts — Register a new customer/vendor contact */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, mobileNo, role, region, workplaceLocation, livingLocation, shopName, organizationId } = body;

    if (!name || !mobileNo || !region || !workplaceLocation) {
      return NextResponse.json(
        { error: "Name, Mobile No., Region, and Workplace Location are required" },
        { status: 400 }
      );
    }

    const phoneE164 = cleanToE164(mobileNo);

    const contactId = `ct-${Date.now().toString(36)}`;
    const newContact: Contact = {
      id: contactId,
      organizationId: organizationId || SELLER.id,
      name: name.trim(),
      role: role || "Vendor",
      phoneE164,
      productCategories: ["wholesale", "retail"],
      region: region.trim(),
      workplaceLocation: workplaceLocation.trim(),
      livingLocation: livingLocation?.trim() || undefined,
      shopName: shopName?.trim() || undefined,
      workingHours: WORKING_HOURS,
      escalationPriority: CONTACTS.length + 1,
      preferredLanguage: "en-IN",
      consentAt: new Date().toISOString(),
      cooldownUntil: null,
    };

    // Save to Supabase if configured
    if (hasSupabaseConfig()) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase.from("contacts").insert({
            id: newContact.id,
            organization_id: newContact.organizationId,
            name: newContact.name,
            role: newContact.role,
            phone_e164: newContact.phoneE164,
            product_categories: newContact.productCategories,
            region: newContact.region,
            workplace_location: newContact.workplaceLocation,
            living_location: newContact.livingLocation,
            shop_name: newContact.shopName,
            working_hours: newContact.workingHours,
            escalation_priority: newContact.escalationPriority,
            preferred_language: newContact.preferredLanguage,
            consent_at: newContact.consentAt,
          });
        } catch (err) {
          console.warn("Could not insert contact into Supabase:", err);
        }
      }
    }

    // Always unshift into in-memory array so GET immediately reflects it
    CONTACTS.unshift(newContact);

    return NextResponse.json({ success: true, contact: newContact });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Could not add customer";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** DELETE /api/v1/contacts — Delete a customer/vendor contact */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get("id");
    if (!id) {
      try {
        const body = await req.json();
        id = body.id;
      } catch {}
    }

    if (!id) {
      return NextResponse.json({ error: "Contact ID is required" }, { status: 400 });
    }

    // 1. Delete from Supabase if configured
    if (hasSupabaseConfig()) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase.from("contacts").delete().eq("id", id);
        } catch (err) {
          console.warn("Could not delete contact from Supabase:", err);
        }
      }
    }

    // 2. Delete from in-memory CONTACTS array
    const idx = CONTACTS.findIndex((c) => c.id === id);
    if (idx !== -1) {
      CONTACTS.splice(idx, 1);
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Could not delete customer";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
