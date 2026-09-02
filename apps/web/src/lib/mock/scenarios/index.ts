/**
 * The scenario catalogue.
 *
 * Each entry is one reproducible run through the whole pipeline — ingest,
 * correlation, severity, responder selection, call planning, the call, and
 * typed extraction. Together they cover the hero path, the differentiator, and
 * two failure modes from §9 (F12 sensor offline, F13 flapping signal).
 *
 * §3.1: the simulator that fires these is a real screen, not a demo hack. It
 * makes the flow reproducible and lets a judge run it themselves.
 */

import { buildColdChainCritical } from "./cold-chain-critical";
import { buildRefusalEscalation } from "./refusal-escalation";
import { buildSensorOffline } from "./sensor-offline";
import { buildTransientSpike } from "./transient-spike";
import type { Scenario } from "./script";

export type { Scenario, ScriptStep } from "./script";

export const SCENARIOS: Scenario[] = [
  {
    id: "cold-chain-critical",
    name: "Cold-chain critical",
    tagline: "The technician is busy. The agent negotiates anyway.",
    description:
      "CS-04 crosses its 8°C ceiling and keeps climbing. The agent correlates 15 readings, rules out a defrost cycle, classifies CRITICAL with a 90-minute safe window, and calls the on-shift refrigeration technician. He is on another job — the agent does not accept that as a final answer.",
    assetId: "CS-04",
    severity: "CRITICAL",
    expectedOutcome: "Commitment secured · ETA 40 min · verification scheduled",
    baseline: [4.1, 4.0, 4.2, 4.4, 4.3, 4.6, 5.1, 5.9, 6.8, 7.6, 8.3],
    threshold: 8,
    unit: "°C",
    metricLabel: "temperature",
    build: buildColdChainCritical,
  },
  {
    id: "refusal-escalation",
    name: "Refusal → ladder escalation",
    tagline: "Nobody answers. Then somebody says no. It keeps going.",
    description:
      "CS-01 crosses threshold with a 60-minute window. Rung 1 does not pick up. Rung 2 is out of zone and refuses. The agent raises urgency at each rung and reaches the night supervisor, who commits — three calls, no human in the loop.",
    assetId: "CS-01",
    severity: "CRITICAL",
    expectedOutcome: "3 rungs · supervisor committed · ETA 25 min",
    baseline: [4.4, 4.3, 4.5, 4.8, 5.0, 4.9, 5.1, 5.4, 5.9, 6.6, 7.4],
    threshold: 8,
    unit: "°C",
    metricLabel: "temperature",
    build: buildRefusalEscalation,
  },
  {
    id: "transient-spike",
    name: "Transient spike",
    tagline: "The one where it decides not to call.",
    description:
      "CS-02 briefly touches 9.6°C during a scheduled defrost, then recovers on its own. The correlation layer sees the reversal inside the rolling window and suppresses it. Nobody's phone rings at 2 AM. Restraint is a feature.",
    assetId: "CS-02",
    severity: "INFO",
    expectedOutcome: "Suppressed · no call placed",
    baseline: [6.2, 6.4, 6.1, 6.5, 6.8, 6.6, 7.0, 7.2, 7.1, 7.4, 7.6],
    threshold: 8,
    unit: "°C",
    metricLabel: "temperature",
    build: buildTransientSpike,
  },
  {
    id: "sensor-offline",
    name: "Sensor offline",
    tagline: "The asset stops answering. That is its own incident.",
    description:
      "DK-07 misses its heartbeat window. This is a monitoring failure, not a confirmed thermal excursion — so it opens as a distinct WARNING incident with its own call plan, asking for a physical check rather than a repair.",
    assetId: "DK-07",
    severity: "WARNING",
    expectedOutcome: "Physical check committed · ETA 5 min",
    baseline: [-19.1, -19.0, -18.8, -18.9, -18.7, -18.6, -18.5, -18.6, -18.4, -18.4, -18.4],
    threshold: -16,
    unit: "°C",
    metricLabel: "temperature",
    build: buildSensorOffline,
  },
];

export function scenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
