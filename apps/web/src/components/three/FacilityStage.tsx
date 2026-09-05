"use client";

/**
 * Lazy boundary around the 3D layer (§5.4). The R3F bundle never blocks first
 * paint, and the view degrades to a 2D floor plan on demand — which is also the
 * documented fallback if the recording machine drops below 60fps.
 */

import { useState } from "react";
import dynamic from "next/dynamic";
import { Box, Grid2x2 } from "lucide-react";
import { Skeleton } from "@/components/ui/Panel";
import { useClientValue } from "@/hooks/useClientValue";
import { Button } from "@/components/ui/Button";
import type { FacilityMarker } from "./FacilityView";
import { SEVERITY_HEX } from "@/lib/state-map";

const FacilityView = dynamic(() => import("./FacilityView"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

const STORAGE_KEY = "sentinel.floorplan";

/** Module scope keeps the reader stable across renders for useSyncExternalStore. */
function readStoredMode(): "2d" | "3d" {
  try {
    return localStorage.getItem(STORAGE_KEY) === "2d" ? "2d" : "3d";
  } catch {
    return "3d";
  }
}

function Floorplan2D({
  markers,
  focusAssetId,
}: {
  markers: FacilityMarker[];
  focusAssetId?: string;
}) {
  return (
    <svg viewBox="-8 -6 16 12" className="h-full w-full" role="img" aria-label="Facility floor plan">
      <defs>
        <pattern id="fp-grid" width="1" height="1" patternUnits="userSpaceOnUse">
          <path d="M 1 0 L 0 0 0 1" fill="none" stroke="var(--border-subtle)" strokeWidth="0.02" />
        </pattern>
      </defs>
      <rect x="-8" y="-6" width="16" height="12" fill="url(#fp-grid)" />

      {markers.map((m) => {
        const colour =
          m.severity === "NOMINAL" ? "var(--state-idle)" : SEVERITY_HEX[m.severity];
        const focused = m.asset.id === focusAssetId;
        return (
          <g key={m.asset.id} transform={`translate(${m.asset.position[0]} ${m.asset.position[2]})`}>
            <rect
              x="-0.6"
              y="-0.6"
              width="1.2"
              height="1.2"
              rx="0.1"
              fill={colour}
              fillOpacity={m.severity === "NOMINAL" ? 0.15 : 0.28}
              stroke={colour}
              strokeWidth={focused ? 0.09 : 0.05}
            />
            <text
              x="0"
              y="1.3"
              textAnchor="middle"
              fill={focused ? colour : "var(--text-secondary)"}
              style={{ fontSize: "0.42px", fontFamily: "var(--font-geist-mono), monospace" }}
            >
              {m.asset.id} · {m.value.toFixed(1)}
              {m.unit}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function FacilityStage({
  markers,
  focusAssetId,
}: {
  markers: FacilityMarker[];
  focusAssetId?: string;
}) {
  const stored = useClientValue(readStoredMode, "3d");
  const [chosen, setChosen] = useState<"3d" | "2d" | null>(null);
  const mode = chosen ?? stored;

  const toggle = () => {
    const next = mode === "3d" ? "2d" : "3d";
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode — the choice still holds for this session */
    }
    setChosen(next);
  };

  return (
    <div className="relative h-full w-full">
      {mode === "3d" ? (
        <FacilityView markers={markers} focusAssetId={focusAssetId} />
      ) : (
        <Floorplan2D markers={markers} focusAssetId={focusAssetId} />
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={toggle}
        className="absolute bottom-2 right-2 bg-panel/85 backdrop-blur-sm"
        title={mode === "3d" ? "Switch to 2D floor plan" : "Switch to 3D view"}
      >
        {mode === "3d" ? <Grid2x2 className="h-3.5 w-3.5" /> : <Box className="h-3.5 w-3.5" />}
        {mode === "3d" ? "2D" : "3D"}
      </Button>
    </div>
  );
}
