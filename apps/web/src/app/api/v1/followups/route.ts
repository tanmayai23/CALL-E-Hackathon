import { NextResponse } from "next/server";
import { listFollowUps } from "@/lib/mock/store";

export const dynamic = "force-dynamic";

/** GET /api/v1/followups — every scheduled callback and verification call, soonest first. */
export async function GET() {
  return NextResponse.json({ followUps: listFollowUps(), source: "mock" });
}
