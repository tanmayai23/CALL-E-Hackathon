"use client";

/**
 * Column C of §4.1 — the conversation, and what produced it.
 *
 * The call plan sits above the transcript because that is the order the two
 * happened in: the plan is composed, then dialled, then spoken. It folds away
 * on its own once turns start arriving so the transcript owns the column when
 * the transcript is the thing worth reading.
 *
 * A suppressed incident replaces both with the reasoning that produced silence.
 */

import type { TranscriptTurn } from "@/lib/contracts/domain";
import type { CallPlan, TelemetryPoint } from "@/hooks/useIncidentStream";
import { Panel } from "@/components/ui/Panel";
import { CallPlanPanel } from "./CallPlan";
import { SuppressionCase } from "./SuppressionCase";
import { Transcript } from "./Transcript";

export function ConversationColumn({
  suppression,
  plan,
  turns,
  evidence,
  live,
  hasCallState,
  hasResult,
  readings,
  threshold,
  unit,
}: {
  suppression: { assetId: string; reason: string } | null;
  plan: CallPlan | null;
  turns: TranscriptTurn[];
  evidence: string[];
  live: boolean;
  hasCallState: boolean;
  hasResult: boolean;
  readings: TelemetryPoint[];
  threshold: number;
  unit: string;
}) {
  if (suppression) {
    return (
      <div className="flex flex-col gap-3 lg:min-h-0">
        <Panel
          label="Why no call"
          brackets
          className="min-h-[320px] lg:min-h-0 lg:flex-1"
          bodyClassName="p-0"
          right={<span className="micro">correlation layer</span>}
        >
          <SuppressionCase
            reason={suppression.reason}
            readings={readings}
            threshold={threshold}
            unit={unit}
          />
        </Panel>
      </div>
    );
  }

  const transcriptState = hasResult ? "evidence highlighted" : live ? "streaming" : "ended";

  return (
    <div className="flex flex-col gap-3 lg:min-h-0">
      <CallPlanPanel plan={plan} collapseWhen={turns.length > 0} />

      <Panel
        label="Live transcript"
        brackets
        className="min-h-[420px] lg:min-h-0 lg:flex-1"
        bodyClassName="p-0"
        right={hasCallState ? <span className="micro">{transcriptState}</span> : null}
      >
        <Transcript turns={turns} evidence={evidence} live={live} />
      </Panel>
    </div>
  );
}
