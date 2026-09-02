"use client";

/**
 * Column B of §4.1 — the agent's reasoning.
 *
 * Who it chose, where it is on the ladder, and every node the graph has
 * executed. A suppressed incident has no responder and no ladder, so those
 * panels are absent rather than showing an empty state that implies a call is
 * still coming.
 */

import type { CallState, LadderRung, Responder, AgentEvent } from "@/lib/contracts/domain";
import { Panel } from "@/components/ui/Panel";
import { AgentTimeline } from "./AgentTimeline";
import { EscalationLadder, LadderCap } from "./EscalationLadder";
import { ResponderCall } from "./ResponderCall";

export function ReasoningColumn({
  responder,
  rung,
  maxRungs,
  ladder,
  callState,
  connectedAt,
  timeline,
  autoScrollTimeline,
  showCall,
}: {
  responder: Responder | null;
  rung: number;
  maxRungs: number;
  ladder: LadderRung[];
  callState: CallState | null;
  connectedAt: number | null;
  timeline: AgentEvent[];
  autoScrollTimeline: boolean;
  showCall: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 lg:min-h-0">
      {showCall && (
        <>
          <Panel label="Responder" className="shrink-0" bodyClassName="p-0">
            <ResponderCall
              responder={responder}
              rung={rung}
              callState={callState}
              connectedAt={connectedAt}
            />
          </Panel>

          <Panel
            label="Escalation"
            className="shrink-0"
            bodyClassName="p-0"
            right={<LadderCap currentRung={rung} maxRungs={maxRungs} />}
          >
            <EscalationLadder ladder={ladder} currentRung={rung} />
          </Panel>
        </>
      )}

      <Panel
        label="Agent timeline"
        className="min-h-[200px] lg:min-h-0 lg:flex-1"
        bodyClassName="overflow-y-auto p-0"
      >
        <AgentTimeline events={timeline} autoScroll={autoScrollTimeline} />
      </Panel>
    </div>
  );
}
