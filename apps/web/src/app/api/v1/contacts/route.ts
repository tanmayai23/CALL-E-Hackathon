import { NextResponse } from "next/server";
import { CONTACTS, ORGANIZATIONS } from "@/lib/mock/directory";

export const dynamic = "force-dynamic";

/** GET /api/v1/contacts — the consented business contacts, by escalation priority. */
export async function GET() {
  return NextResponse.json({
    organizations: ORGANIZATIONS,
    contacts: [...CONTACTS].sort((a, b) => a.escalationPriority - b.escalationPriority),
    source: "mock",
  });
}
