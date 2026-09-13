import { NextResponse } from "next/server";
import { z } from "zod";
import { isKillSwitchEngaged, resetToSeed, trigger } from "@/lib/mock/store";
import { SCENARIOS } from "@/lib/mock/scenarios";

export const dynamic = "force-dynamic";

/** GET — the supplier behaviours the simulator can play, and the kill-switch state. */
export async function GET() {
  return NextResponse.json({
    scenarios: SCENARIOS.map(({ id, name, tagline, description, expectedOutcome }) => ({
      id,
      name,
      tagline,
      description,
      expectedOutcome,
    })),
    killSwitch: isKillSwitchEngaged(),
  });
}

/** The order the operator entered. Validated here — the boundary — never trusted. */
const OrderInput = z.object({
  reference: z
    .string()
    .trim()
    .min(3)
    .max(24)
    .regex(/^[A-Za-z0-9][A-Za-z0-9-]*$/, "Letters, digits and hyphens only"),
  description: z.string().trim().min(3).max(80),
  unit: z.string().trim().min(1).max(16),
  quantity: z.number().int().min(1).max(100_000),
  requiredBy: z.iso.datetime(),
  triggerType: z.enum(["ORDER", "INVENTORY", "DELIVERY", "EXCEPTION", "IOT"]),
});

const Body = z.union([
  z.object({ action: z.literal("reset") }),
  z.object({ scenarioId: z.string(), order: OrderInput }),
]);

/** POST — start a scenario for an order, or reset to the seeded history. */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: "bad_request",
        message: issue ? `${issue.path.join(".") || "body"}: ${issue.message}` : "Invalid request",
      },
      { status: 400 },
    );
  }

  if ("action" in parsed.data) {
    resetToSeed();
    return NextResponse.json({ ok: true, action: "reset" });
  }

  if (isKillSwitchEngaged()) {
    return NextResponse.json(
      {
        error: "kill_switch_engaged",
        message: "Outbound calling is halted. Release the kill switch before placing a call.",
      },
      { status: 423 },
    );
  }

  const { scenarioId, order } = parsed.data;
  if (!SCENARIOS.some((s) => s.id === scenarioId)) {
    return NextResponse.json(
      { error: "unknown_scenario", message: `No scenario “${scenarioId}”` },
      { status: 400 },
    );
  }

  const run = trigger(scenarioId, { ...order, reference: order.reference.toUpperCase() });
  return NextResponse.json({ orderId: run.order.id, traceId: run.order.traceId });
}
