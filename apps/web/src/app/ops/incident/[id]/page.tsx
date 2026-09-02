import type { Metadata } from "next";
import { IncidentTheatre } from "@/components/incident/IncidentTheatre";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `${id} — Live Call Theatre · Sentinel Ops` };
}

export default async function IncidentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <IncidentTheatre incidentId={id} />;
}
