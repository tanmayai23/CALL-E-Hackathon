"use client";

/**
 * Telemetry curve.
 *
 * Hand-drawn SVG rather than a charting library: the instrument look wanted
 * here — a shaded safe band, a dashed ceiling, ticks on the right rail, a
 * breathing head marker — is fighting a chart library's defaults the whole way,
 * and this costs ~90 lines and no bundle. Noted as a deviation from the stack
 * list in §1 (recharts), taken deliberately.
 */

import { useMemo } from "react";
import type { Severity } from "@/lib/contracts/domain";
import type { TelemetryPoint } from "@/hooks/useIncidentStream";
import { SEVERITY_HEX } from "@/lib/state-map";

const W = 320;
const H = 132;
const PAD_R = 34;
const PAD_B = 14;
const PAD_T = 10;

export function TelemetryCurve({
  baseline,
  live,
  threshold,
  unit,
  severity,
}: {
  baseline: number[];
  live: TelemetryPoint[];
  threshold: number;
  unit: string;
  severity: Severity | null;
}) {
  const values = useMemo(
    () => [...baseline, ...live.map((p) => p.value)],
    [baseline, live],
  );

  const geometry = useMemo(() => {
    if (values.length < 2) return null;

    const min = Math.min(...values, threshold);
    const max = Math.max(...values, threshold);
    const span = Math.max(max - min, 1);
    const lo = min - span * 0.18;
    const hi = max + span * 0.18;

    const plotW = W - PAD_R;
    const plotH = H - PAD_B - PAD_T;

    const x = (i: number) => (i / (values.length - 1)) * plotW;
    const y = (v: number) => PAD_T + plotH - ((v - lo) / (hi - lo)) * plotH;

    const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
    const area = `${line} L${x(values.length - 1).toFixed(2)},${H - PAD_B} L0,${H - PAD_B} Z`;

    return {
      line,
      area,
      thresholdY: y(threshold),
      head: { x: x(values.length - 1), y: y(values[values.length - 1]) },
      liveStartX: baseline.length > 0 ? x(baseline.length - 1) : 0,
      lo,
      hi,
      plotW,
    };
  }, [values, threshold, baseline.length]);

  const colour = severity ? SEVERITY_HEX[severity] : "var(--state-idle)";
  const latest = values[values.length - 1];

  if (!geometry) {
    return (
      <div className="hatch flex h-full items-center justify-center rounded-sm border border-line">
        <p className="micro">Awaiting telemetry</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="micro">
          {unit === "°C" ? "temperature" : "reading"} · ceiling {threshold}
          {unit}
        </span>
        <span className="data-value text-lg leading-none" style={{ color: colour }}>
          {latest?.toFixed(1)}
          <span className="ml-0.5 text-xs text-ink-faint">{unit}</span>
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full flex-1" preserveAspectRatio="none" role="img"
        aria-label={`Telemetry: latest ${latest?.toFixed(1)}${unit} against a ${threshold}${unit} ceiling`}>
        <defs>
          <linearGradient id="tc-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colour} stopOpacity="0.22" />
            <stop offset="100%" stopColor={colour} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Safe band — everything under the ceiling */}
        <rect
          x="0"
          y={geometry.thresholdY}
          width={geometry.plotW}
          height={Math.max(0, H - PAD_B - geometry.thresholdY)}
          fill="var(--state-success)"
          fillOpacity="0.045"
        />

        {/* Right rail ticks */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const yy = PAD_T + (H - PAD_B - PAD_T) * f;
          return (
            <g key={f}>
              <line x1="0" y1={yy} x2={geometry.plotW} y2={yy} stroke="var(--border-subtle)" strokeWidth="0.5" strokeOpacity="0.6" />
              <text x={geometry.plotW + 5} y={yy + 3} fill="var(--text-muted)" style={{ fontSize: "8px", fontFamily: "var(--font-geist-mono), monospace" }}>
                {(geometry.hi - (geometry.hi - geometry.lo) * f).toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* The ceiling */}
        <line
          x1="0"
          y1={geometry.thresholdY}
          x2={geometry.plotW}
          y2={geometry.thresholdY}
          stroke="var(--state-warning)"
          strokeWidth="1"
          strokeDasharray="3 3"
          strokeOpacity="0.8"
        />

        {/* Where live data begins */}
        {live.length > 0 && (
          <line
            x1={geometry.liveStartX}
            y1={PAD_T}
            x2={geometry.liveStartX}
            y2={H - PAD_B}
            stroke="var(--border-strong)"
            strokeWidth="0.75"
            strokeDasharray="2 4"
          />
        )}

        <path d={geometry.area} fill="url(#tc-fill)" />
        <path d={geometry.line} fill="none" stroke={colour} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />

        <circle cx={geometry.head.x} cy={geometry.head.y} r="6" fill={colour} fillOpacity="0.18" className="animate-beacon" />
        <circle cx={geometry.head.x} cy={geometry.head.y} r="2.4" fill={colour} />
      </svg>
    </div>
  );
}
