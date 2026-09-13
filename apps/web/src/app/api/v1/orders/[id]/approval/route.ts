import { NextResponse } from "next/server";
import { z } from "zod";
import { StoreError, decideApproval } from "@/lib/mock/store";

export const dynamic = "force-dynamic";

const Body = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().max(280).default(""),
});

/**
 * POST /api/v1/orders/:id/approval — an operator's decision on a commercial
 * change the agent was not allowed to accept (FR-5.3). Responds 409 if the
 * order is not waiting for one.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad_request", message: "Expected { decision: \"APPROVE\" | \"REJECT\", note? }" },
      { status: 400 },
    );
  }

  try {
    decideApproval(id, parsed.data.decision, parsed.data.note);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof StoreError) {
      return NextResponse.json({ error: "rejected", message: err.message }, { status: err.status });
    }
    throw err;
  }
}
