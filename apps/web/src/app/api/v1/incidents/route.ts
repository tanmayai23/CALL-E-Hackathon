import { NextResponse } from "next/server";
import { listIncidents } from "@/lib/mock/store";

export const dynamic = "force-dynamic";

/** CLAUDE.md §8.2 — GET /api/v1/incidents (filter: status, severity, asset) */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const status = params.get("status");
  const severity = params.get("severity");
  const asset = params.get("asset");

  let incidents = listIncidents();
  if (status) incidents = incidents.filter((i) => i.status === status);
  if (severity) incidents = incidents.filter((i) => i.severity === severity);
  if (asset) incidents = incidents.filter((i) => i.asset.id === asset);

  return NextResponse.json({ incidents, source: "mock" });
}
