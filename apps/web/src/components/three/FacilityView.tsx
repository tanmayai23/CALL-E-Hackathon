"use client";

/**
 * 3D facility view — FRONTEND_DESIGN_PLUGINS.md §5.
 *
 * Justification test (§5.1): a unit failing in Zone A while the technician is
 * in Sector 7 is a spatial fact, and spatial facts read faster in 3D than in a
 * table. Scope is deliberately small — extruded boxes, severity-coloured pulse,
 * camera focus-fly. No PBR, no physics, no post-processing.
 *
 * Colours are read from the CSS custom properties at runtime, so the 3D layer
 * obeys the same token contract as the DOM and follows the light/dark switch.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Grid, Html } from "@react-three/drei";
import { useReducedMotion } from "framer-motion";
import type { Mesh, PerspectiveCamera } from "three";
import { Vector3 } from "three";
import type { Asset, Severity } from "@/lib/contracts/domain";

export interface FacilityMarker {
  asset: Asset;
  severity: Severity | "NOMINAL";
  value: number;
  unit: string;
}

function useTokens() {
  const [tokens, setTokens] = useState({
    base: "#0A0C10",
    panel: "#12151C",
    line: "#232935",
    lineStrong: "#333B4A",
    idle: "#5F6B7F",
    INFO: "#3B82F6",
    WARNING: "#F59E0B",
    CRITICAL: "#EF4444",
  });

  useEffect(() => {
    const read = () => {
      const s = getComputedStyle(document.documentElement);
      const v = (name: string, fallback: string) =>
        s.getPropertyValue(name).trim() || fallback;
      setTokens({
        base: v("--bg-base", "#0A0C10"),
        panel: v("--bg-panel", "#12151C"),
        line: v("--border-subtle", "#232935"),
        lineStrong: v("--border-strong", "#333B4A"),
        idle: v("--state-idle", "#5F6B7F"),
        INFO: v("--state-info", "#3B82F6"),
        WARNING: v("--state-warning", "#F59E0B"),
        CRITICAL: v("--state-critical", "#EF4444"),
      });
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return tokens;
}

function AssetMarker({
  marker,
  colour,
  focused,
  still,
}: {
  marker: FacilityMarker;
  colour: string;
  focused: boolean;
  still: boolean;
}) {
  const ref = useRef<Mesh>(null);
  const critical = marker.severity === "CRITICAL";

  /* Pulse rate encodes urgency — critical pulses faster. */
  useFrame(({ clock }) => {
    if (!ref.current || still) return;
    const rate = critical ? 4 : marker.severity === "WARNING" ? 2 : 0;
    ref.current.scale.setScalar(rate ? 1 + Math.sin(clock.elapsedTime * rate) * 0.09 : 1);
  });

  return (
    <mesh ref={ref} position={[marker.asset.position[0], 0.85, marker.asset.position[2]]}>
      <boxGeometry args={[1.15, 1.7, 1.15]} />
      <meshStandardMaterial
        color={colour}
        emissive={colour}
        emissiveIntensity={critical ? 0.75 : marker.severity === "WARNING" ? 0.35 : 0.08}
        roughness={0.55}
        metalness={0.1}
      />
      <Html center distanceFactor={9} position={[0, 1.55, 0]} zIndexRange={[10, 0]}>
        <div
          className="data-value pointer-events-none whitespace-nowrap rounded-sm border leading-none"
          style={{
            borderColor: focused ? colour : "var(--border-subtle)",
            background: "var(--bg-panel)",
            color: focused ? colour : "var(--text-muted)",
            padding: focused ? "3px 6px" : "2px 4px",
            fontSize: focused ? "11px" : "9px",
          }}
        >
          {/* Only the asset in play carries its reading — the rest are just
              located, which is all a nominal asset needs to communicate. */}
          {focused ? `${marker.asset.id} · ${marker.value.toFixed(1)}${marker.unit}` : marker.asset.id}
        </div>
      </Html>
    </mesh>
  );
}

/**
 * §5.2 — camera focus-fly to the incident asset.
 *
 * The distance is solved from the facility bounds and the panel's actual
 * aspect rather than hard-coded, so the same component frames correctly in the
 * wide overview panel and the narrow column in the Live Call Theatre.
 */
function CameraRig({
  target,
  radius,
  centre,
}: {
  target: [number, number, number] | null;
  radius: number;
  centre: [number, number];
}) {
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const size = useThree((state) => state.size);

  const goal = useMemo(() => {
    const aspect = size.width / Math.max(1, size.height);
    const vFov = ((camera.fov ?? 34) * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    // Fit the tighter of the two fields, with headroom for the floating labels.
    const fit = Math.min(vFov, hFov);
    // The 2.35 is tuned, not derived: the floor is seen at a pitch, so the
    // projected footprint is wider than the bounding sphere alone predicts,
    // and the floating labels need headroom past the geometry.
    const distance = (radius * 2.35) / Math.sin(fit / 2);

    // Focused shots sit lower and closer; the overview looks down from further back.
    const pitch = target ? 0.44 : 0.58;
    const cx = target ? (target[0] + centre[0]) / 2 : centre[0];
    const cz = target ? (target[2] + centre[1]) / 2 : centre[1];

    return new Vector3(
      cx,
      Math.sin(pitch) * distance,
      cz + Math.cos(pitch) * distance,
    );
  }, [target, radius, centre, size.width, size.height, camera.fov]);

  const look = useMemo(
    () =>
      target
        ? new Vector3(target[0], 0.9, target[2])
        : new Vector3(centre[0], 0.5, centre[1]),
    [target, centre],
  );

  useFrame(() => {
    camera.position.lerp(goal, 0.055);
    camera.lookAt(look);
  });

  return null;
}

export default function FacilityView({
  markers,
  focusAssetId,
}: {
  markers: FacilityMarker[];
  focusAssetId?: string;
}) {
  const tokens = useTokens();
  const reduced = useReducedMotion() ?? false;
  const focus = markers.find((m) => m.asset.id === focusAssetId)?.asset.position ?? null;

  /* Centroid and bounding radius of the floor, so the rig can frame it. */
  const { centre, radius } = useMemo(() => {
    if (markers.length === 0) return { centre: [0, 0] as [number, number], radius: 6 };
    const xs = markers.map((m) => m.asset.position[0]);
    const zs = markers.map((m) => m.asset.position[2]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    const reach = markers.reduce(
      (max, m) => Math.max(max, Math.hypot(m.asset.position[0] - cx, m.asset.position[2] - cz)),
      0,
    );
    return { centre: [cx, cz] as [number, number], radius: Math.max(3.5, reach + 1.2) };
  }, [markers]);

  return (
    <Canvas
      dpr={[1, 2]}
      frameloop={reduced ? "demand" : "always"}
      camera={{ position: [0, 12, 18], fov: 34 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <color attach="background" args={[tokens.panel]} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[6, 11, 5]} intensity={0.8} />
      <directionalLight position={[-7, 5, -4]} intensity={0.25} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[22, 15]} />
        <meshStandardMaterial color={tokens.base} roughness={1} />
      </mesh>

      <Grid
        args={[22, 15]}
        cellSize={1}
        cellThickness={0.6}
        sectionSize={4}
        sectionThickness={1.1}
        cellColor={tokens.line}
        sectionColor={tokens.lineStrong}
        fadeDistance={38}
        fadeStrength={1}
        infiniteGrid={false}
        position={[0, 0.001, 0]}
      />

      {markers.map((marker) => (
        <AssetMarker
          key={marker.asset.id}
          marker={marker}
          colour={marker.severity === "NOMINAL" ? tokens.idle : tokens[marker.severity]}
          focused={marker.asset.id === focusAssetId}
          still={reduced}
        />
      ))}

      <CameraRig target={focus} radius={radius} centre={centre} />
    </Canvas>
  );
}
