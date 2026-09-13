"use client";

/**
 * Column C of the order screen — the conversation, and what produced it.
 *
 * The call plan sits above the transcript because that is the order they
 * happen in: the plan is composed, then dialled, then spoken. It folds away on
 * its own once turns arrive, so the transcript owns the column when it is the
 * thing worth reading. A suppressed request shows why no call happened instead.
 */

import type { TranscriptTurn } from "@/lib/contracts/domain";
import type { CallPlan } from "@/hooks/useOrderStream";
import { Panel } from "@/components/ui/Panel";
import { CallPlanPanel } from "./CallPlan";
import { SuppressionCase } from "./SuppressionCase";
import { Transcript } from "./Transcript";
import { THEATRE_WIDE } from "./layout";

export function ConversationColumn({
  suppression,
  seller,
  plan,
  turns,
  evidence,
  live,
  hasCallState,
  hasResult,
}: {
  suppression: { reason: string; duplicateOf?: string } | null;
  seller: string;
  plan: CallPlan | null;
  turns: TranscriptTurn[];
  evidence: string[];
  live: boolean;
  hasCallState: boolean;
  hasResult: boolean;
}) {
  if (suppression) {
    return (
      <div className={`flex flex-col gap-3 xl:min-h-0 ${THEATRE_WIDE}`}>
        <Panel
          label="Why no call"
          className="min-h-[320px] xl:min-h-0 xl:flex-1"
          bodyClassName="p-0"
          right={<span className="micro">assessment</span>}
        >
          <SuppressionCase reason={suppression.reason} duplicateOf={suppression.duplicateOf} seller={seller} />
        </Panel>
      </div>
    );
  }

  const transcriptState = hasResult ? "evidence highlighted" : live ? "streaming" : "ended";

  return (
    <div className={`flex flex-col gap-3 xl:min-h-0 ${THEATRE_WIDE}`}>
      <CallPlanPanel plan={plan} collapseWhen={turns.length > 0} />

      <Panel
        label="Live transcript"
        className="min-h-[420px] xl:min-h-0 xl:flex-1"
        bodyClassName="p-0"
        right={hasCallState ? <span className="micro">{transcriptState}</span> : null}
      >
        <Transcript turns={turns} evidence={evidence} live={live} />
      </Panel>
    </div>
  );
}
