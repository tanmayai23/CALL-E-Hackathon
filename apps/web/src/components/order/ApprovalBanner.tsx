"use client";

/**
 * A commercial change waiting on a person (FR-5.3, PRD §17).
 *
 * The agent may negotiate logistics, but it is never allowed to accept a changed
 * price. When a supplier quotes one, the order stops here — in persistent UI,
 * never a toast — until an operator approves or rejects it. The outcome arrives
 * back through the stream like any other order update.
 */

import { useState } from "react";
import { ArrowRight, Check, ShieldQuestion, X } from "lucide-react";
import type { ApprovalRequest } from "@/lib/contracts/domain";
import { Button } from "@/components/ui/Button";
import { apiPost } from "@/lib/api";

export function ApprovalBanner({ orderId, approval }: { orderId: string; approval: ApprovalRequest }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"APPROVE" | "REJECT" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const money = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: approval.currency,
    maximumFractionDigits: 0,
  });
  const change = ((approval.proposedUnitPrice - approval.previousUnitPrice) / approval.previousUnitPrice) * 100;

  const decide = (decision: "APPROVE" | "REJECT") => {
    setBusy(decision);
    setError(null);
    apiPost(`/api/v1/orders/${orderId}/approval`, { decision, note })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not record the decision"))
      .finally(() => setBusy(null));
  };

  return (
    <section
      aria-label="Approval required"
      className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-3 border-b border-state-info/30 bg-state-info/8 px-5 py-3.5"
    >
      <div className="flex min-w-0 items-start gap-3">
        <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0 text-state-info" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">
            Approval required — the agent cannot accept a changed price
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-dim">
            <span className="data-value line-through decoration-ink-faint">
              {money.format(approval.previousUnitPrice)}
            </span>
            <ArrowRight className="h-3 w-3 text-ink-faint" aria-hidden />
            <span className="data-value font-semibold text-ink">{money.format(approval.proposedUnitPrice)}</span>
            <span className="data-value text-state-warning">
              {change >= 0 ? "+" : ""}
              {change.toFixed(1)}%
            </span>
            <span>per unit, quoted on the call</span>
          </p>
        </div>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="approval-note">
          Note for the audit trail
        </label>
        <input
          id="approval-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={280}
          placeholder="Note (optional)"
          className="h-8 w-48 rounded-md border border-line-strong bg-elevated px-3 text-xs text-ink placeholder:text-ink-faint"
        />
        <Button variant="success" size="sm" onClick={() => decide("APPROVE")} disabled={busy !== null}>
          <Check className="h-3.5 w-3.5" aria-hidden />
          {busy === "APPROVE" ? "Approving…" : "Approve new price"}
        </Button>
        <Button variant="danger" size="sm" onClick={() => decide("REJECT")} disabled={busy !== null}>
          <X className="h-3.5 w-3.5" aria-hidden />
          {busy === "REJECT" ? "Rejecting…" : "Reject"}
        </Button>
      </div>

      {error && <p className="w-full text-xs text-state-critical">{error}</p>}
    </section>
  );
}
