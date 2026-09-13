"use client";

/**
 * Column B of the order screen — the agent's reasoning.
 *
 * Who it is calling, where it is on the ladder, and every node the graph has
 * run. A suppressed request has no contact and no ladder, so those panels are
 * absent rather than showing an empty state that implies a call is coming.
 */

import type { AgentEvent, CallState, Contact, LadderRung } from "@/lib/contracts/domain";
import { Panel } from "@/components/ui/Panel";
import { AgentTimeline } from "./AgentTimeline";
import { ContactCall } from "./ContactCall";
import { ContactLadder, LadderCap } from "./ContactLadder";

export function ReasoningColumn({
  contact,
  company,
  rung,
  maxRungs,
  ladder,
  callState,
  connectedAt,
  endedAt,
  timeline,
  autoScrollTimeline,
  showCall,
}: {
  contact: Contact | null;
  company: string;
  rung: number;
  maxRungs: number;
  ladder: LadderRung[];
  callState: CallState | null;
  connectedAt: number | null;
  endedAt: number | null;
  timeline: AgentEvent[];
  autoScrollTimeline: boolean;
  showCall: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 xl:min-h-0">
      {showCall && (
        <>
          <Panel label="Contact" className="shrink-0" bodyClassName="p-0">
            <ContactCall
              contact={contact}
              company={company}
              rung={rung}
              callState={callState}
              connectedAt={connectedAt}
              endedAt={endedAt}
            />
          </Panel>

          <Panel
            label="Contact ladder"
            className="shrink-0"
            bodyClassName="p-0"
            right={<LadderCap currentRung={rung} maxRungs={maxRungs} />}
          >
            <ContactLadder ladder={ladder} currentRung={rung} />
          </Panel>
        </>
      )}

      <Panel
        label="Agent timeline"
        className="max-h-[480px] min-h-[200px] xl:max-h-none xl:min-h-0 xl:flex-1"
        bodyClassName="overflow-y-auto p-0"
      >
        <AgentTimeline events={timeline} autoScroll={autoScrollTimeline} />
      </Panel>
    </div>
  );
}
