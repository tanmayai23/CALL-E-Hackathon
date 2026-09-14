"use client";

/**
 * Wholesaler Dashboard — Connected Vendors & CALL-E Call Dispatch
 *
 * Displays a table of all vendors connected to the wholesaler with:
 *  1. Name & Shop Name
 *  2. Mobile Number
 *  3. CALL-E Agent Call Button (triggers automated call)
 *  4. Latest CALL-E Call Output
 *  5. "Show More Details" action button leading to vendor detail view.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  PhoneOutgoing,
  PhoneCall,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  Search,
  UserPlus,
  RotateCw,
  Sparkles,
  MapPin,
  Store,
} from "lucide-react";
import type { Contact } from "@/lib/contracts/domain";
import { Panel } from "@/components/ui/Panel";
import { StateChip } from "@/components/ui/StateChip";
import { Button, buttonStyles } from "@/components/ui/Button";
import { apiGet, apiPost } from "@/lib/api";
import { maskPhone } from "@/lib/mock/directory";

type CallStatus = "idle" | "dialling" | "connected" | "extracting" | "completed";

interface VendorCallState {
  status: CallStatus;
  output?: string;
  outputState?: "success" | "warning" | "critical" | "info";
  timestamp?: string;
}

/** The result CALL-E extracted, rendered for the vendor row. */
interface CallOutcome {
  outcome: string | null;
  callPlaced: boolean;
  blockedReason: string | null;
  /** "calle" = a real phone call; "mock" = the dev harness. */
  driver?: "calle" | "mock";
  completionConfidence: { score: number; label: string } | null;
  structuredResult: {
    confirmed_quantity?: number;
    remaining_quantity?: number;
    dispatch_date?: string;
    unit_price?: number;
    callback_requested_at?: string;
    next_action?: string;
  } | null;
}

/**
 * Turns a real call result into the line shown in "Latest Call Output".
 *
 * Every branch below is derived from what CALL-E returned. There is no sample
 * or placeholder text: a call that produced nothing usable says exactly that,
 * because a fabricated commitment on this screen is indistinguishable from a
 * real one (Rule 8).
 */
function describeOutcome(result: CallOutcome): {
  output: string;
  state: "success" | "warning" | "critical" | "info";
} {
  if (result.blockedReason) {
    return { output: result.blockedReason, state: "critical" };
  }

  if (!result.callPlaced) {
    return { output: "No call was placed.", state: "critical" };
  }

  const s = result.structuredResult;
  const confidence = result.completionConfidence;
  const suffix = confidence ? ` · ${Math.round(confidence.score * 100)}% confidence` : "";

  switch (result.outcome) {
    case "CONFIRMED":
      return {
        output:
          `✓ Confirmed${s?.confirmed_quantity ? ` (${s.confirmed_quantity} cases)` : ""}` +
          `${s?.dispatch_date ? ` — dispatch ${s.dispatch_date}` : ""}${suffix}`,
        state: "success",
      };

    case "PARTIALLY_CONFIRMED":
      return {
        output:
          `⏳ Partial — ${s?.confirmed_quantity ?? "some"} now, ` +
          `${s?.remaining_quantity ?? "balance"} outstanding${suffix}`,
        state: "warning",
      };

    case "APPROVAL_REQUIRED":
      return {
        output: `⚠️ Price change${s?.unit_price ? ` (₹${s.unit_price})` : ""} — needs your approval`,
        state: "critical",
      };

    case "CALLBACK_SCHEDULED":
      return {
        output: `📞 Callback scheduled${s?.callback_requested_at ? ` for ${s.callback_requested_at}` : ""}`,
        state: "info",
      };

    case "HUMAN_REVIEW":
      return { output: `Needs review — no clear commitment${suffix}`, state: "warning" };

    case "UNRESOLVED":
      return { output: "Unresolved — nobody committed", state: "critical" };

    default:
      return { output: "Call ended without a usable result.", state: "warning" };
  }
}

export function WholesalerDashboard() {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [callStates, setCallStates] = useState<Record<string, VendorCallState>>({});

  const fetchContacts = useCallback(() => {
    setLoading(true);
    setError(null);
    apiGet<{ contacts: Contact[] }>("/api/v1/contacts")
      .then((res) => {
        let merged = res.contacts;
        try {
          const localAddedStr = typeof window !== "undefined" ? localStorage.getItem("sentinel_added_contacts") : null;
          if (localAddedStr) {
            const localAdded: Contact[] = JSON.parse(localAddedStr);
            const existingIds = new Set(res.contacts.map((c) => c.id));
            const uniqueLocal = localAdded.filter((c) => !existingIds.has(c.id));
            merged = [...uniqueLocal, ...res.contacts];
          }
        } catch {}
        setContacts(merged);
        // Vendors start with no call history. Previously this seeded invented
        // outcomes ("Stock Confirmed — Dispatch Today") onto the first vendor,
        // which read on screen exactly like a real CALL-E result.
        setCallStates((prev) => {
          const updated = { ...prev };
          merged.forEach((c) => {
            if (!updated[c.id]) updated[c.id] = { status: "idle" };
          });
          return updated;
        });
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load vendors");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const triggerCall = async (vendor: Contact) => {
    setCallStates((prev) => ({
      ...prev,
      [vendor.id]: { status: "dialling", output: "Dialling CALL-E Agent..." },
    }));

    try {
      // The request blocks for the length of the real call. The row stays on
      // "dialling" until it returns — the old code stepped through
      // connected → extracting on local timers, which showed call progress
      // that nothing had reported.
      const result = await apiPost<CallOutcome>("/api/v1/contacts/call", {
        contactId: vendor.id,
        contact: vendor,
        orderReference: `ORD-${vendor.id.slice(-4).toUpperCase()}`,
      });

      const { output, state } = describeOutcome(result);

      // A mock result is labelled on screen so it can never be read — or
      // recorded on camera — as something a real supplier actually said.
      const labelled = result.driver === "mock" ? `${output} [MOCK]` : output;

      setCallStates((prev) => ({
        ...prev,
        [vendor.id]: {
          status: "completed",
          output: labelled,
          outputState: state,
          timestamp: "Just now",
        },
      }));
    } catch (error) {
      setCallStates((prev) => ({
        ...prev,
        [vendor.id]: {
          status: "completed",
          output: error instanceof Error ? error.message : "CALL-E call failed",
          outputState: "critical",
          timestamp: "Just now",
        },
      }));
    }
  };

  const filteredContacts = (contacts ?? []).filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.region.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.shopName && c.shopName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      c.phoneE164.includes(searchQuery)
  );

  return (
    <div className="flex flex-col gap-6 p-5 sm:p-8">
      {/* ── Header Section ───────────────────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow flex items-center gap-1.5 text-lilac">
            <Building2 className="h-3.5 w-3.5" />
            Wholesaler Operations Console
          </p>
          <h1 className="display mt-2 text-display-s text-ink">
            Vendor <em>Dashboard</em>
          </h1>
          <p className="mt-2 max-w-[60ch] text-sm text-ink-dim">
            Manage your network of vendors, trigger automated CALL-E voice agent calls, and monitor dispatch commitments in real time.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="md" onClick={fetchContacts} disabled={loading}>
            <RotateCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Link href="/ops/simulator" className={buttonStyles({ variant: "primary", size: "md" })}>
            <UserPlus className="h-4 w-4" />
            Add Vendor
          </Link>
        </div>
      </header>

      {/* ── Metrics Bar ─────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-panel p-4 flex items-center gap-4">
          <div className="rounded-full bg-lilac/20 p-3 text-lilac">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <p className="micro">Connected Vendors</p>
            <p className="text-2xl font-bold text-ink mt-0.5">{contacts ? contacts.length : "—"}</p>
          </div>
        </div>

        <div className="rounded-lg border border-line bg-panel p-4 flex items-center gap-4">
          <div className="rounded-full bg-state-success/20 p-3 text-state-success">
            <PhoneCall className="h-5 w-5" />
          </div>
          <div>
            <p className="micro">CALL-E Agent Calls Active</p>
            <p className="text-2xl font-bold text-ink mt-0.5">
              {Object.values(callStates).filter((s) => s.status === "completed" || s.status === "dialling").length}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-line bg-panel p-4 flex items-center gap-4">
          <div className="rounded-full bg-state-info/20 p-3 text-state-info">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="micro">Automated Rate</p>
            <p className="text-2xl font-bold text-ink mt-0.5">100%</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-state-critical/40 bg-state-critical/8 px-5 py-3 text-sm text-state-critical">
          {error}
        </div>
      )}

      {/* ── Vendor Table Panel ───────────────────────────────────── */}
      <Panel
        label="Vendors & Customers Directory"
        bodyClassName="p-0 overflow-x-auto"
        right={
          <div className="relative min-w-[240px]">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-ink-faint" />
            <input
              type="text"
              placeholder="Search vendor name, phone, shop..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-full rounded-md border border-line-strong bg-elevated pl-8 pr-3 text-xs text-ink placeholder:text-ink-faint focus:border-lilac focus:outline-none"
            />
          </div>
        }
      >
        <table className="w-full text-left text-xs text-ink border-collapse">
          <thead>
            <tr className="border-b border-line bg-stone/40 micro text-ink-dim">
              <th className="py-3.5 px-5 font-semibold">Vendor Name</th>
              <th className="py-3.5 px-4 font-semibold">Mobile Number</th>
              <th className="py-3.5 px-4 font-semibold">Region & Location</th>
              <th className="py-3.5 px-4 font-semibold">CALL-E Agent</th>
              <th className="py-3.5 px-5 font-semibold">Latest Call Output</th>
              <th className="py-3.5 px-5 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-ink-dim text-xs">
                  Loading vendors directory...
                </td>
              </tr>
            )}

            {!loading && filteredContacts.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-ink-dim text-xs">
                  No vendors found. Add your first vendor using the button above.
                </td>
              </tr>
            )}

            {!loading &&
              filteredContacts.map((vendor) => {
                const callState = callStates[vendor.id] || { status: "idle" };
                const isCalling = callState.status !== "idle" && callState.status !== "completed";

                return (
                  <tr key={vendor.id} className="hover:bg-stone/50 transition-colors group">
                    {/* 1. Name & Shop */}
                    <td className="py-4 px-5 align-middle">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-sm text-ink group-hover:text-ink transition-colors">
                          {vendor.name}
                        </span>
                        {vendor.shopName && (
                          <span className="text-[11px] text-ink-dim flex items-center gap-1">
                            <Store className="h-3 w-3 text-ink-faint shrink-0" />
                            {vendor.shopName}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 2. Mobile Number */}
                    <td className="py-4 px-4 align-middle">
                      <span className="data-value font-mono text-xs text-ink-dim bg-stone/50 px-2 py-1 rounded border border-line-strong/60">
                        {vendor.phoneE164}
                      </span>
                    </td>

                    {/* 3. Region & Location */}
                    <td className="py-4 px-4 align-middle">
                      <div className="flex flex-col gap-0.5 text-xs text-ink-dim">
                        <span className="flex items-center gap-1 font-medium text-ink">
                          <MapPin className="h-3 w-3 text-lilac shrink-0" />
                          {vendor.region}
                        </span>
                        {vendor.workplaceLocation && (
                          <span className="text-[11px] text-ink-faint truncate max-w-[180px]">
                            {vendor.workplaceLocation}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 4. CALL-E Agent Call Button */}
                    <td className="py-4 px-4 align-middle">
                      <Button
                        variant={isCalling ? "ghost" : callState.status === "completed" ? "neutral" : "primary"}
                        size="sm"
                        onClick={() => void triggerCall(vendor)}
                        disabled={isCalling}
                        className="whitespace-nowrap shadow-sm"
                      >
                        <PhoneOutgoing className={`h-3.5 w-3.5 ${isCalling ? "animate-pulse text-lilac" : ""}`} />
                        {callState.status === "dialling" && "Dialling..."}
                        {callState.status === "connected" && "In Call..."}
                        {callState.status === "extracting" && "Extracting..."}
                        {callState.status === "completed" && "Re-Call Vendor"}
                        {callState.status === "idle" && "Call Vendor"}
                      </Button>
                    </td>

                    {/* 5. Latest CALL-E Call Output */}
                    <td className="py-4 px-5 align-middle">
                      {callState.output ? (
                        <div className="flex flex-col gap-1 max-w-[280px]">
                          <StateChip
                            state={callState.outputState || "info"}
                            size="sm"
                            className="whitespace-normal leading-normal text-[11px] font-medium"
                          >
                            {callState.output}
                          </StateChip>
                          {callState.timestamp && (
                            <span className="text-[10px] text-ink-faint flex items-center gap-1 ml-1">
                              <Clock className="h-2.5 w-2.5" />
                              {callState.timestamp}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-ink-faint italic flex items-center gap-1">
                          <Clock className="h-3 w-3 text-ink-faint" />
                          No call placed yet
                        </span>
                      )}
                    </td>

                    {/* 6. Show More Details Button */}
                    <td className="py-4 px-5 align-middle text-right">
                      <Link
                        href={`/ops/vendors/${vendor.id}`}
                        className={buttonStyles({ variant: "ghost", size: "sm" })}
                      >
                        Show More Details
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
