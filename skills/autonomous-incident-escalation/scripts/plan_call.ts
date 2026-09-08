/**
 * skills/autonomous-incident-escalation/scripts/plan_call.ts
 *
 * FREE pre-flight validation of a composed task prompt. Spends no call budget.
 *
 * CALL-E's MCP server exposes `plan_call`, a dry run that validates a task +
 * resultSchema without dialling. Use it for every prompt change — a new
 * account has 20 free calls, and burning one to discover a typo is the most
 * expensive way to find a typo.
 *
 * Local checks run first, before the MCP round trip:
 *   - unrendered template holes ("undefined", "[object Object]") that would
 *     otherwise be read aloud to a technician
 *   - a missing "automated operations line" self-identification (see SAFETY.md)
 *   - a prompt long enough to push the call past its 90-second ceiling
 *
 * An MCP outage degrades to a warning. Prompt validation must never be the
 * reason a real escalation does not happen.
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *
 *   const report = await planEscalationCall(ctx, mcpTransport);
 *   if (!report.ok) throw new Error(JSON.stringify(report.issues, null, 2));
 *
 * `mcpTransport` adapts whatever MCP client you already have:
 *
 *   const mcpTransport = (tool, args) => myMcpClient.callTool(tool, args);
 *
 * Omit it entirely to run local lint only.
 *
 * MCP server: https://seleven-mcp-sg.airudder.com/mcp/openagent_oauth
 * Tools: plan_call (dry run, free) · run_call (live) · get_call_run (status)
 */

export {
  planEscalationCall,
  lintTaskPrompt,
  type PlanCallTransport,
  type PlanCallReport,
  type PlanCallIssue,
} from "./lib/planCall";
