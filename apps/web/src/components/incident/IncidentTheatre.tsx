"use client";

/**
 * THE LIVE CALL THEATRE — FRONTEND_DESIGN_PLUGINS.md §4.
 *
 * 45% of the frontend effort budget and 60 seconds of the demo video. Its job
 * is to make an invisible thing visible: an agent thinking, deciding, and
 * talking to a human on the phone, live.
 *
 * This component is orchestration only — it resolves the stream into the five
 * required states (§8) and hands each region to a column that owns its own
 * layout. The regions map one-to-one onto the wireframe in §4.1:
 *
 *     ┌───────────────── IncidentHeader ─────────────────┐
 *     │ SignalColumn │ ReasoningColumn │ Conversation…   │
 *     ├──────────────── IncidentOutcome ─────────────────┤
 *     └──────────────── StructuredResult ────────────────┘
 */

import type { Incident } from "@/lib/contracts/domain";
import { useIncidentStream, type IncidentDetail, type IncidentView } from "@/hooks/useIncidentStream";
import { useCallCues } from "@/hooks/useCallCues";
import { Panel } from "@/components/ui/Panel";
import type { FacilityMarker } from "@/components/three/FacilityView";
import { ASSETS } from "@/lib/mock/facility";
import { ConversationColumn } from "./ConversationColumn";
import { IncidentHeader } from "./IncidentHeader";
import { IncidentLoadError, IncidentNotFound, IncidentSkeleton } from "./IncidentFallback";
import { IncidentOutcome } from "./IncidentOutcome";
import { ReasoningColumn } from "./ReasoningColumn";
import { SignalColumn } from "./SignalColumn";
import { StructuredResult } from "./StructuredResult";
import { SuppressionBanner } from "./SuppressionBanner";
import { THEATRE_GRID } from "./layout";

/**
 * Every asset on the floor, with the incident's asset carrying the live reading
 * and everyone else sitting at the midpoint of their safe band. The 3D view
 * needs the whole floor for the spatial claim in §5.1 to hold — one unit in
 * trouble only reads as a place if the other places are drawn too.
 */
function buildMarkers(incident: Incident, view: IncidentView): FacilityMarker[] {
  const latest = view.telemetry[view.telemetry.length - 1]?.value ?? incident.reading.value;

  return ASSETS.map((asset) => {
    const isIncidentAsset = asset.id === incident.asset.id;
    return {
      asset,
      severity: isIncidentAsset ? (view.severity ?? incident.severity) : ("NOMINAL" as const),
      value: isIncidentAsset ? latest : (asset.safeMin + asset.safeMax) / 2,
      unit: asset.unit,
    };
  });
}

export function IncidentTheatre({ incidentId }: { incidentId: string }) {
  const { view, detail, load, error, connected, live, retry } = useIncidentStream(incidentId);

  useCallCues({
    callState: view.callState,
    rung: view.rung,
    resolved: Boolean(view.resolved),
  });

  if (load === "not_found") return <IncidentNotFound incidentId={incidentId} />;
  if (load === "error") return <IncidentLoadError message={error} onRetry={retry} />;
  if (load === "loading" || !detail) return <IncidentSkeleton />;

  return <Theatre incidentId={incidentId} detail={detail} view={view} connected={connected} live={live} />;
}

/**
 * The success state. Split from the component above so that every value below
 * is non-null by construction rather than by assertion.
 */
function Theatre({
  incidentId,
  detail,
  view,
  connected,
  live,
}: {
  incidentId: string;
  detail: IncidentDetail;
  view: IncidentView;
  connected: boolean;
  live: boolean;
}) {
  const { incident, telemetry } = detail;
  const severity = view.severity ?? incident.severity;
  const closed = Boolean(view.resolved || view.unresolved || incident.closedAt);
  const suppression = view.suppression;
  const lastSpeaker = view.turns.at(-1)?.speaker ?? null;

  return (
    <div className="flex min-h-0 flex-col lg:h-full">
      <IncidentHeader
        incident={incident}
        severity={severity}
        safeWindowMinutes={view.safeWindowMinutes}
        closed={closed}
        connected={connected}
        dropped={view.dropped}
      />

      {suppression && <SuppressionBanner reason={suppression.reason} />}

      <div className={`grid gap-3 p-3 lg:min-h-0 lg:flex-1 lg:overflow-hidden ${THEATRE_GRID}`}>
        <SignalColumn
          markers={buildMarkers(incident, view)}
          focusAssetId={incident.asset.id}
          telemetry={telemetry}
          readings={view.telemetry}
          severity={severity}
          callState={view.callState}
          speaker={live ? lastSpeaker : null}
          showCallActivity={!suppression}
        />

        <ReasoningColumn
          responder={view.responder}
          rung={view.rung}
          maxRungs={incident.maxRungs}
          ladder={view.ladder}
          callState={view.callState}
          connectedAt={view.connectedAt}
          timeline={view.timeline}
          autoScrollTimeline={live}
          showCall={!suppression}
        />

        <ConversationColumn
          suppression={suppression}
          plan={view.plan}
          turns={view.turns}
          evidence={view.result?.evidence ?? []}
          live={live}
          hasCallState={view.callState !== null}
          hasResult={view.result !== null}
          readings={view.telemetry}
          threshold={telemetry.threshold}
          unit={telemetry.unit}
        />
      </div>

      <IncidentOutcome resolved={view.resolved} unresolved={view.unresolved} />

      {suppression ? (
        <p className="m-3 mt-0 shrink-0 rounded-md border border-line bg-panel px-4 py-3 text-xs text-ink-dim">
          <span className="text-ink">No structured result.</span> Extraction is a property of a
          call, and this incident never produced one — which is the correct outcome. The
          suppression itself is the record.
        </p>
      ) : (
        <Panel
          label="Structured result"
          brackets
          className="m-3 mt-0 shrink-0"
          bodyClassName="p-0"
          right={<span className="micro">CALL-E resultSchema · typed extraction</span>}
        >
          <StructuredResult
            incidentId={incidentId}
            result={view.result}
            extracting={view.callState === "extracting"}
          />
        </Panel>
      )}
    </div>
  );
}
