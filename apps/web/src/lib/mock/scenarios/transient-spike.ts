/**
 * THE RESTRAINT CASE — failure mode F13.
 *
 * CS-02 briefly touches 9.6°C during a scheduled defrost, then recovers on its
 * own. Correlation sees the reversal inside the rolling window and suppresses
 * it, so nobody's phone rings at 2 AM. Choosing not to call is a feature, and
 * §12 #6 says it has to be visible to count.
 */

import { readings, type ScriptStep } from "./script";

export function buildTransientSpike(incidentId: string): ScriptStep[] {
  const steps: ScriptStep[] = [];
  const VALUES = [7.8, 8.4, 9.1, 9.6, 9.2, 8.5, 7.9, 7.4, 7.1];
  const EVERY_MS = 620;

  steps.push(...readings(incidentId, VALUES, EVERY_MS));

  steps.push({
    at: VALUES.length * EVERY_MS + 900,
    event: {
      type: "incident.suppressed",
      assetId: "CS-02",
      reason:
        "4 of the last 15 readings crossed the 8.0°C ceiling, peak 9.6°C, but the trend reversed within 4 minutes and returned inside band. Matches the scheduled defrost signature for this unit. No sustained excursion — no call placed.",
    },
  });

  return steps;
}
