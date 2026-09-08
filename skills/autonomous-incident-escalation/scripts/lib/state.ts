/**
 * VENDORED — do not edit.
 *
 * Generated from packages/agent/state.ts by packages/agent/scripts/vendor-skill.mjs.
 * Edit the source file and re-run the generator; edits here are overwritten.
 */

/**
 * packages/agent/state.ts
 * LangGraph agent state definition.
 * Owner: Aryan
 *
 * This is the single source of truth for what data flows through
 * every node in the escalation graph.
 */

import type {
  Severity,
  Asset,
  Reading,
  Facility,
  Responder,
  CallRecord,
  EscalationStructuredResult,
  Outcome,
} from "./types";

export interface EscalationState {
  // ── Core incident identifiers ──────────────────────────────────────────────
  incidentId: string;
  traceId: string;

  // ── Incident facts (set once at entry, never mutated) ─────────────────────
  severity: Severity;
  safeWindowMinutes: number;
  consequence: string;
  asset: Asset;
  reading: Reading;
  facility: Facility;

  // ── Escalation progress ───────────────────────────────────────────────────
  escalationRung: number;           // 1-indexed, starts at 1
  maxRungs: number;                 // default 3
  attemptedResponders: string[];    // responder IDs already tried
  currentResponder: Responder | null;

  // ── Call history ──────────────────────────────────────────────────────────
  callHistory: CallRecord[];
  structuredResults: EscalationStructuredResult[];
  confidenceHistory: { score: number; label: string }[];

  // ── Outcome ───────────────────────────────────────────────────────────────
  finalOutcome: Outcome | null;
  requiresHumanReview: boolean;

  // ── Internal flags ────────────────────────────────────────────────────────
  suppressReason: string | null;    // set if assess_incident suppresses
  callError: string | null;         // set if execute_call fails
  ladderExhausted: boolean;         // set by escalate when the rung cap is hit
  route: string | null;             // the branch a node chose; read by its edge
}

/**
 * Creates the initial state when an incident enters the agent.
 * Called by the backend (Sameer) when invoking the graph.
 */
export function createInitialState(
  incidentId: string,
  traceId: string,
  severity: Severity,
  safeWindowMinutes: number,
  consequence: string,
  asset: Asset,
  reading: Reading,
  facility: Facility,
  maxRungs = 3
): EscalationState {
  return {
    incidentId,
    traceId,
    severity,
    safeWindowMinutes,
    consequence,
    asset,
    reading,
    facility,
    escalationRung: 1,
    maxRungs,
    attemptedResponders: [],
    currentResponder: null,
    callHistory: [],
    structuredResults: [],
    confidenceHistory: [],
    finalOutcome: null,
    requiresHumanReview: false,
    suppressReason: null,
    callError: null,
    ladderExhausted: false,
    route: null,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function lastStructuredResult(
  state: EscalationState
): EscalationStructuredResult | null {
  return state.structuredResults[state.structuredResults.length - 1] ?? null;
}

export function lastConfidence(
  state: EscalationState
): { score: number; label: string } | null {
  return state.confidenceHistory[state.confidenceHistory.length - 1] ?? null;
}
