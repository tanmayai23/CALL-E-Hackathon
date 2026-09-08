/**
 * packages/agent/index.ts
 * Public entry point for the Sentinel Ops LangGraph agent.
 * Owner: Aryan
 *
 * Sameer's backend calls `runEscalationAgent()` when an incident is opened.
 * Everything else is internal to this package.
 */

export { buildEscalationGraph, type AgentDependencies } from "./graph";
export { createInitialState, type EscalationState } from "./state";
export type { AssessResult } from "./nodes/assessIncident";
export type { DecideResult } from "./nodes/decide";
export type { EscalateResult } from "./nodes/escalate";

import { buildEscalationGraph, type AgentDependencies } from "./graph";
import { createInitialState, type EscalationState } from "./state";
import type { EscalationContext } from "../types";

/**
 * Top-level function Sameer's backend calls to start the agent.
 *
 * @param ctx - The EscalationContext built by the correlation engine
 * @param deps - All backend callbacks (DB, SSE, roster)
 * @returns Final EscalationState after the graph terminates
 */
export async function runEscalationAgent(
  ctx: EscalationContext,
  deps: AgentDependencies
): Promise<EscalationState> {
  const initialState = createInitialState(
    ctx.incidentId,
    ctx.traceId,
    ctx.severity,
    ctx.safeWindowMinutes,
    ctx.consequence,
    ctx.asset,
    ctx.reading,
    ctx.facility
  );

  const graph = buildEscalationGraph(deps);

  return await graph.invoke(initialState);
}
