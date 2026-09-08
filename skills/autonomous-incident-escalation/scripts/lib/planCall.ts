/**
 * VENDORED — do not edit.
 *
 * Generated from packages/calle/planCall.ts by packages/agent/scripts/vendor-skill.mjs.
 * Edit the source file and re-run the generator; edits here are overwritten.
 */

/**
 * packages/calle/planCall.ts
 * FR-4.4 — pre-flight validation of a composed task prompt.
 * Owner: Aryan
 *
 * CALL-E's MCP server exposes `plan_call`, a DRY RUN that validates a task +
 * resultSchema without dialling anyone. That matters twice over:
 *
 *   1. Rule 2 — it is how we iterate on the prompt without spending any of the
 *      20 free calls. Every prompt change should go through here first.
 *   2. FR-4.4 — the agent can validate a plan before committing a live call.
 *
 * `plan_call` is reached over MCP (Streamable HTTP + OAuth), which is a
 * transport the agent process does not speak natively. Rather than embed an
 * OAuth client here, this module takes an injected `PlanCallTransport` — the
 * MCP client the host already has (Claude Code, or Sameer's backend) passes
 * one in. That keeps this package free of transport concerns and testable.
 *
 * MCP server: https://seleven-mcp-sg.airudder.com/mcp/openagent_oauth
 * Tools: plan_call (dry run, free) · run_call (live) · get_call_run (status)
 */

import { ESCALATION_RESULT_SCHEMA } from "./schema";
import { buildTaskPrompt } from "./prompt";
import type { EscalationContext } from "./types";

// ─── Transport ───────────────────────────────────────────────────────────────

/**
 * Minimal shape of an MCP tool invocation. Whatever MCP client the host uses,
 * it can be adapted to this in a few lines.
 */
export type PlanCallTransport = (
  toolName: "plan_call",
  args: { task: string; resultSchema: Record<string, unknown> }
) => Promise<unknown>;

// ─── Result ──────────────────────────────────────────────────────────────────

export interface PlanCallIssue {
  severity: "error" | "warning";
  message: string;
}

export interface PlanCallReport {
  ok: boolean;
  issues: PlanCallIssue[];
  /** Raw MCP response, kept verbatim for the audit trail. */
  raw: unknown;
}

// ─── Local pre-checks ────────────────────────────────────────────────────────
// These run before we bother the MCP server. They catch the mistakes that
// actually happened during development — an empty responder name leaking
// "undefined" into the opening line, a prompt so long the call runs past 90s.

/** PRD §13.2 — the call must stay under 90 seconds. */
const MAX_PROMPT_CHARS = 6_000;

export function lintTaskPrompt(task: string): PlanCallIssue[] {
  const issues: PlanCallIssue[] = [];

  if (!task.trim()) {
    issues.push({ severity: "error", message: "Task prompt is empty." });
    return issues;
  }

  // A template hole that rendered as a literal — this reaches the technician.
  for (const hole of ["undefined", "null", "NaN", "[object Object]"]) {
    if (task.includes(hole)) {
      issues.push({
        severity: "error",
        message: `Task prompt contains the literal "${hole}" — a context field did not render.`,
      });
    }
  }

  // FR-10.1 / Rule 3 — the agent must always self-identify.
  if (!/automated operations line/i.test(task)) {
    issues.push({
      severity: "error",
      message:
        "Task prompt does not identify the caller as an automated operations line (FR-10.1).",
    });
  }

  if (task.length > MAX_PROMPT_CHARS) {
    issues.push({
      severity: "warning",
      message:
        `Task prompt is ${task.length} chars (soft limit ${MAX_PROMPT_CHARS}). ` +
        "Long briefings push the call past the 90-second ceiling.",
    });
  }

  return issues;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Validates the plan for an escalation call WITHOUT placing it.
 *
 * Spends zero call budget. Safe to run on every incident, and safe to run in a
 * loop while tuning the prompt.
 *
 * If no transport is supplied, the local lint still runs and the report says
 * so — an MCP outage must never block a real escalation.
 */
export async function planEscalationCall(
  ctx: EscalationContext,
  transport?: PlanCallTransport
): Promise<PlanCallReport> {
  const task = buildTaskPrompt(ctx);
  const issues = lintTaskPrompt(task);

  if (!transport) {
    issues.push({
      severity: "warning",
      message: "No MCP transport supplied — ran local lint only, skipped plan_call.",
    });
    return { ok: !issues.some((i) => i.severity === "error"), issues, raw: null };
  }

  let raw: unknown = null;
  try {
    raw = await transport("plan_call", {
      task,
      resultSchema: ESCALATION_RESULT_SCHEMA as unknown as Record<string, unknown>,
    });
  } catch (err) {
    issues.push({
      severity: "warning",
      message: `plan_call failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  return { ok: !issues.some((i) => i.severity === "error"), issues, raw };
}
