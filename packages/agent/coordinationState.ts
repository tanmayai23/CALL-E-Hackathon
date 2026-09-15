/**
 * packages/agent/coordinationState.ts
 * LangGraph state for the wholesale coordination agent.
 * Owner: Aryan
 *
 * The v2 counterpart of `./state.ts`. Same shape of problem — work a ladder of
 * humans until one of them commits — but the domain is an ORDER and the people
 * are CONTACTS, not an incident and its responders.
 *
 * Field names are taken from `packages/types/wholesale.ts`, which is frozen.
 * Nothing here redefines a domain shape; it only composes them.
 */

import type {
  Order,
  Contact,
  Confidence,
  WholesaleResult,
  Urgency,
} from "../types/wholesale";

/** One completed call, kept so the graph can reason over the whole ladder. */
export interface CoordinationCallRecord {
  callId: string;
  contactId: string;
  rung: number;
  status: string;
  startedAt: string;
  endedAt: string;
}

export interface CoordinationState {
  // ── Core identifiers ──────────────────────────────────────────────────────
  /** The coordination request id, e.g. CR-1007. */
  orderId: string;
  /** Rule 7 — propagates into every event, row and CALL-E call. */
  traceId: string;

  // ── Order facts (set once at entry, never mutated) ────────────────────────
  order: Order;
  urgency: Urgency;

  // ── Ladder progress ───────────────────────────────────────────────────────
  /** 1-indexed: 1 = primary contact, 2 = backup, 3 = supervisor. */
  rung: number;
  maxRungs: number;
  /** Contact ids already dialled — never dial the same person twice. */
  attemptedContacts: string[];
  currentContact: Contact | null;

  // ── Call history ──────────────────────────────────────────────────────────
  callHistory: CoordinationCallRecord[];
  structuredResults: WholesaleResult[];
  confidenceHistory: Confidence[];
  transcript?: { speaker: string; text: string }[];

  // ── Outcome ───────────────────────────────────────────────────────────────
  /** Set by confirm / partial / unresolved. Null until the graph terminates. */
  finalOutcome: string | null;
  requiresHumanReview: boolean;
  /** FR-5.3 — set when the agent hit a commercial change it may not accept. */
  approvalRequired: boolean;

  // ── Internal flags ────────────────────────────────────────────────────────
  suppressReason: string | null;
  callError: string | null;
  ladderExhausted: boolean;
  /** The branch a node chose; read by its conditional edge. */
  route: string | null;
}

/**
 * Creates the initial state when an order enters the agent.
 *
 * `maxRungs` defaults to the order's own cap so a caller cannot quietly widen
 * the ladder past what the order was created with.
 */
export function createInitialCoordinationState(
  order: Order,
  maxRungs = order.maxRungs
): CoordinationState {
  return {
    orderId: order.id,
    traceId: order.traceId,
    order,
    urgency: order.urgency,
    rung: 1,
    maxRungs,
    attemptedContacts: [],
    currentContact: null,
    callHistory: [],
    structuredResults: [],
    confidenceHistory: [],
    finalOutcome: null,
    requiresHumanReview: false,
    approvalRequired: false,
    suppressReason: null,
    callError: null,
    ladderExhausted: false,
    route: null,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function lastWholesaleResult(state: CoordinationState): WholesaleResult | null {
  return state.structuredResults[state.structuredResults.length - 1] ?? null;
}

export function lastCoordinationConfidence(state: CoordinationState): Confidence | null {
  return state.confidenceHistory[state.confidenceHistory.length - 1] ?? null;
}
