/**
 * The scenario catalogue — what the supplier does on the call.
 *
 * Each entry is one reproducible run through the whole pipeline: event,
 * assessment, contact selection, call plan, the call, typed extraction and the
 * order update. Together they cover the hero path, the escalation shown in the
 * demo, and the failure modes from PRD v2.0 §9 that change what the operator
 * sees: partial stock, no answer, a changed price, a callback, a vague answer,
 * and a duplicate request.
 */

import { callback } from "./callback";
import { duplicateOrder } from "./duplicate-order";
import { noAnswerEscalation } from "./no-answer-escalation";
import { partialStock } from "./partial-stock";
import { priceChange } from "./price-change";
import type { Scenario, ScenarioId } from "./script";
import { vagueAnswer } from "./vague-answer";

export type { Scenario, ScenarioContext, ScenarioId, ScriptStep } from "./script";

/** Hero first — it is the default the simulator selects. */
export const SCENARIOS: Scenario[] = [
  partialStock,
  noAnswerEscalation,
  priceChange,
  callback,
  vagueAnswer,
  duplicateOrder,
];

export function scenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === (id as ScenarioId));
}
