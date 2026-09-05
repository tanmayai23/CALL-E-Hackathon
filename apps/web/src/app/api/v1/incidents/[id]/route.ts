import { NextResponse } from "next/server";
import { getRun } from "@/lib/mock/store";
import { scenarioById } from "@/lib/mock/scenarios";
import { RESPONDERS } from "@/lib/mock/facility";

export const dynamic = "force-dynamic";

/** CLAUDE.md §8.2 — GET /api/v1/incidents/:id (detail + full timeline) */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const run = getRun(id);

  if (!run) {
    return NextResponse.json(
      { error: "not_found", message: `No incident ${id}` },
      { status: 404 },
    );
  }

  const scenario = scenarioById(run.incident.scenarioId);

  return NextResponse.json({
    incident: run.incident,
    /** Events already emitted — lets a mid-run page load catch up before subscribing. */
    replay: run.emitted,
    finished: run.finished,
    telemetry: {
      baseline: scenario?.baseline ?? [],
      threshold: scenario?.threshold ?? 0,
      unit: scenario?.unit ?? "",
      metricLabel: scenario?.metricLabel ?? "",
    },
    ladder: RESPONDERS.filter((r) => r.ladderPriority <= 3).sort(
      (a, b) => a.ladderPriority - b.ladderPriority,
    ),
    scenario: scenario
      ? { id: scenario.id, name: scenario.name, expectedOutcome: scenario.expectedOutcome }
      : null,
    source: "mock",
  });
}
