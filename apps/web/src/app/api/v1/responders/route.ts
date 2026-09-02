import { NextResponse } from "next/server";
import { RESPONDERS } from "@/lib/mock/facility";

export const dynamic = "force-dynamic";

/** CLAUDE.md §8.2 — GET /api/v1/responders */
export async function GET() {
  return NextResponse.json({
    responders: [...RESPONDERS].sort((a, b) => a.ladderPriority - b.ladderPriority),
    source: "mock",
  });
}
