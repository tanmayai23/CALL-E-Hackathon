import { NextResponse } from "next/server";
import { overrideResult } from "@/lib/mock/store";

export const dynamic = "force-dynamic";

/** CLAUDE.md §8.2 — POST /api/v1/incidents/:id/override (FR-6.6) */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: { structured?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "bad_request", message: "Expected a JSON body" },
      { status: 400 },
    );
  }

  const event = overrideResult(id, body.structured ?? {});
  if (!event) {
    return NextResponse.json(
      { error: "not_found", message: "No extracted result to override" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
