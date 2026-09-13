import { NextResponse } from "next/server";
import { getRun } from "@/lib/mock/store";

export const dynamic = "force-dynamic";

/** GET /api/v1/orders/:id — the order, its contact ladder, and whether the run has ended. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const run = getRun(id);

  if (!run) {
    return NextResponse.json({ error: "not_found", message: `No order ${id}` }, { status: 404 });
  }

  return NextResponse.json({
    order: run.order,
    ladder: run.ladder,
    finished: run.finished,
    source: "mock",
  });
}
