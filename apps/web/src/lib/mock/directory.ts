/**
 * Reference directory for the mock driver: the two businesses in the hero
 * scenario, the consented contacts at the wholesaler, and the product.
 *
 * Deliberately realistic — `John Doe` / `+1 555-0100` read as fake on camera.
 * Phone numbers are always rendered masked (`maskPhone`), which is what a real
 * operations console does with contact PII and what keeps a recording safe.
 */

import type { Contact, Organization, WorkingHours } from "@/lib/contracts/domain";
import { TIMEZONE } from "@/lib/time";

export const WORKING_HOURS: WorkingHours = { start: "09:00", end: "19:00", timezone: TIMEZONE };

export const BUYER: Organization = {
  id: "org-northgate",
  name: "Northgate Distributors",
  role: "DISTRIBUTOR",
};

export const SELLER: Organization = {
  id: "org-metro-supply",
  name: "Metro Supply Co.",
  role: "WHOLESALER",
};

export const ORGANIZATIONS: Organization[] = [BUYER, SELLER];

/** The hero product (PRD v2.0 §4.1). */
export const PRODUCT = {
  sku: "MED-TS-CASE",
  description: "Temperature-sensitive medical supplies",
  unit: "cases",
  unitPrice: 1850,
  currency: "INR",
};

/** Metro Supply's escalation ladder: primary → backup → supervisor (FR-3.3). */
export const CONTACTS: Contact[] = [
  {
    id: "ct-rajesh-iyer",
    organizationId: SELLER.id,
    name: "Rajesh Iyer",
    role: "Dispatch Lead",
    phoneE164: "+919820441207",
    productCategories: ["medical", "cold-chain"],
    region: "Mumbai West",
    workingHours: WORKING_HOURS,
    escalationPriority: 1,
    preferredLanguage: "en-IN",
    consentAt: "2026-09-10T09:20:00Z",
    cooldownUntil: null,
  },
  {
    id: "ct-neha-kulkarni",
    organizationId: SELLER.id,
    name: "Neha Kulkarni",
    role: "Sales Executive",
    phoneE164: "+919987230514",
    productCategories: ["medical", "cold-chain", "pharma"],
    region: "Mumbai West",
    workingHours: WORKING_HOURS,
    escalationPriority: 2,
    preferredLanguage: "en-IN",
    consentAt: "2026-09-10T09:24:00Z",
    cooldownUntil: null,
  },
  {
    id: "ct-farhan-siddiqui",
    organizationId: SELLER.id,
    name: "Farhan Siddiqui",
    role: "Sales Manager",
    phoneE164: "+919833077462",
    productCategories: ["medical", "cold-chain", "pharma"],
    region: "Mumbai",
    workingHours: WORKING_HOURS,
    escalationPriority: 3,
    preferredLanguage: "hi-IN",
    consentAt: "2026-09-10T09:31:00Z",
    cooldownUntil: null,
  },
];

export function ladderFor(organizationId: string): Contact[] {
  return CONTACTS.filter((c) => c.organizationId === organizationId).sort(
    (a, b) => a.escalationPriority - b.escalationPriority,
  );
}

export function contactById(id: string): Contact | undefined {
  return CONTACTS.find((c) => c.id === id);
}

export function organizationById(id: string): Organization | undefined {
  return ORGANIZATIONS.find((o) => o.id === id);
}

/** `+919820441207` → `+91 98204 ••207`. Contact PII stays partly redacted. */
export function maskPhone(e164: string): string {
  const digits = e164.replace(/[^\d+]/g, "");
  if (digits.length < 8) return digits;
  const head = digits.slice(0, 8);
  const tail = digits.slice(-3);
  return `${head.slice(0, 3)} ${head.slice(3)} ••${tail}`;
}
