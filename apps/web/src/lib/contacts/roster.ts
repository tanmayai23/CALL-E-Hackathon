/**
 * apps/web/src/lib/contacts/roster.ts
 * The consented-contact roster — the single authority on who may be dialled.
 *
 * A wholesaler adding a vendor through the console registers that vendor WITH
 * consent (`consentAt`, stated on the form), so a number they enter becomes a
 * roster number and is callable. What stays forbidden is dialling a number that
 * arrives in a request body without ever having been registered: that is an
 * unregistered number under Rule 3, regardless of who typed it.
 *
 * So callers name a contact by id, and this module resolves the number. The
 * lookup spans Supabase and the in-memory array for the same reason the
 * dashboard's GET does — a vendor added before a server restart lives only in
 * the database, and must still be reachable.
 */

import type { Contact } from "@/lib/contracts/domain";
import { CONTACTS, WORKING_HOURS } from "@/lib/mock/directory";
import { getSupabaseClient, hasSupabaseConfig } from "@/lib/db/supabase-client";

/** Maps a Supabase row onto the domain shape, matching GET /api/v1/contacts. */
function rowToContact(row: Record<string, unknown>): Contact {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name),
    role: (row.role as string) || "Vendor",
    phoneE164: String(row.phone_e164),
    productCategories: (row.product_categories as string[]) || ["wholesale"],
    region: String(row.region),
    workplaceLocation: (row.workplace_location as string) || undefined,
    livingLocation: (row.living_location as string) || undefined,
    shopName: (row.shop_name as string) || undefined,
    workingHours: (row.working_hours as Contact["workingHours"]) || WORKING_HOURS,
    escalationPriority: (row.escalation_priority as number) || 1,
    preferredLanguage: (row.preferred_language as string) || "en-IN",
    consentAt: (row.consent_at as string) || "",
    cooldownUntil: (row.cooldown_until as string) || null,
  };
}

export function cleanToE164(rawPhone: string): string {
  if (!rawPhone) return "";
  const trimmed = rawPhone.trim();
  const digitsOnly = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) {
    return `+${digitsOnly}`;
  }
  if (digitsOnly.length === 10) {
    return `+91${digitsOnly}`;
  }
  return `+${digitsOnly}`;
}

export type RosterLookup =
  | { ok: true; contact: Contact }
  | { ok: false; reason: "not_found" | "no_consent" | "bad_number" };

/**
 * Resolves a contact id to a callable contact, or explains the refusal.
 *
 * Consent and number validity are checked HERE as well as in the agent's dial
 * guard. That duplication is deliberate: this gives the operator a clear
 * message before a call is attempted, while the agent's check is the one that
 * cannot be bypassed by any caller.
 */
export async function findConsentedContact(contactId: string): Promise<RosterLookup> {
  let contact: Contact | undefined = CONTACTS.find((c) => c.id === contactId);

  // Fall back to the database — a vendor added before a restart lives there.
  if (!contact && hasSupabaseConfig()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("contacts")
          .select("*")
          .eq("id", contactId)
          .single();

        if (!error && data) contact = rowToContact(data);
      } catch (err) {
        // Never swallow — a lookup failure must not read as "no such contact".
        console.error(`[roster] Supabase lookup failed for ${contactId}:`, err);
      }
    }
  }

  if (!contact) return { ok: false, reason: "not_found" };
  if (!contact.consentAt) return { ok: false, reason: "no_consent" };

  // Sanitize phone number to standard E.164
  const normalizedPhone = cleanToE164(contact.phoneE164);
  contact = { ...contact, phoneE164: normalizedPhone };

  if (!/^\+[1-9]\d{7,14}$/.test(contact.phoneE164)) {
    return { ok: false, reason: "bad_number" };
  }

  return { ok: true, contact };
}
