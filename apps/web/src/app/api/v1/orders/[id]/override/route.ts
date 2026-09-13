import { NextResponse } from "next/server";
import { z } from "zod";
import { StoreError, overrideResult } from "@/lib/mock/store";

export const dynamic = "force-dynamic";

const Body = z.object({ structured: z.record(z.string(), z.unknown()) });

/** POST /api/v1/orders/:id/override — operator correction of extracted fields (FR-6.4). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad_request", message: "Expected { structured: { …fields } }" },
      { status: 400 },
    );
  }

  try {
    overrideResult(id, parsed.data.structured);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof StoreError) {
      return NextResponse.json({ error: "rejected", message: err.message }, { status: err.status });
    }
    throw err;
  }
}
