import { NextResponse } from "next/server";
import { isKillSwitchEngaged, resetToSeed, trigger } from "@/lib/mock/store";
import { SCENARIOS } from "@/lib/mock/scenarios";

export const dynamic = "force-dynamic";

/** CLAUDE.md §8.2 — GET the scenario catalogue for the simulator screen. */
export async function GET() {
  return NextResponse.json({
    scenarios: SCENARIOS.map((s) => ({
      id: s.id,
      name: s.name,
      tagline: s.tagline,
      description: s.description,
      assetId: s.assetId,
      severity: s.severity,
      expectedOutcome: s.expectedOutcome,
    })),
    killSwitch: isKillSwitchEngaged(),
  });
}

/** CLAUDE.md §8.2 — POST /api/v1/simulator/trigger */
export async function POST(request: Request) {
  let body: { scenarioId?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "bad_request", message: "Expected a JSON body" },
      { status: 400 },
    );
  }

  if (body.action === "reset") {
    resetToSeed();
    return NextResponse.json({ ok: true, action: "reset" });
  }

  if (isKillSwitchEngaged()) {
    return NextResponse.json(
      {
        error: "kill_switch_engaged",
        message:
          "Outbound calling is halted. Release the kill switch before triggering a scenario.",
      },
      { status: 423 },
    );
  }

  const scenarioId = body.scenarioId;
  if (!scenarioId || !SCENARIOS.some((s) => s.id === scenarioId)) {
    return NextResponse.json(
      { error: "unknown_scenario", message: `No scenario “${scenarioId ?? ""}”` },
      { status: 400 },
    );
  }

  const run = trigger(scenarioId);
  return NextResponse.json({
    incidentId: run.incident.id,
    traceId: run.incident.traceId,
  });
}
