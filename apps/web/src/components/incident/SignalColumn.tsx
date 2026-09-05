"use client";

/**
 * Column A of §4.1 — the physical facts.
 *
 * Where the asset is, what it is reading, and whether a call is currently
 * carrying audio. Everything here is measured rather than inferred.
 */

import type { CallState, Severity, Speaker } from "@/lib/contracts/domain";
import type { TelemetryPoint } from "@/hooks/useIncidentStream";
import type { FacilityMarker } from "@/components/three/FacilityView";
import { Panel } from "@/components/ui/Panel";
import { FacilityStage } from "@/components/three/FacilityStage";
import { TelemetryCurve } from "./TelemetryCurve";
import { Waveform } from "./Waveform";

export interface TelemetryMeta {
  baseline: number[];
  threshold: number;
  unit: string;
  metricLabel: string;
}

export function SignalColumn({
  markers,
  focusAssetId,
  telemetry,
  readings,
  severity,
  callState,
  speaker,
  showCallActivity,
}: {
  markers: FacilityMarker[];
  focusAssetId: string;
  telemetry: TelemetryMeta;
  readings: TelemetryPoint[];
  severity: Severity;
  callState: CallState | null;
  speaker: Speaker | null;
  /** A suppressed incident never places a call, so it has no activity to show. */
  showCallActivity: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 lg:min-h-0 lg:overflow-y-auto">
      <Panel label="Facility" brackets className="shrink-0" bodyClassName="h-48 flex-none p-0">
        <FacilityStage markers={markers} focusAssetId={focusAssetId} />
      </Panel>

      <Panel label="Telemetry" className="shrink-0" bodyClassName="h-40 flex-none px-4 py-3">
        <TelemetryCurve
          baseline={telemetry.baseline}
          live={readings}
          threshold={telemetry.threshold}
          unit={telemetry.unit}
          severity={severity}
        />
      </Panel>

      {showCallActivity && (
        <Panel label="Call" className="shrink-0" bodyClassName="h-[104px] flex-none px-4 py-3">
          <Waveform callState={callState} speaker={speaker} />
        </Panel>
      )}
    </div>
  );
}
