"use client";

/**
 * Vendor Detail View — Wholesaler Operations
 *
 * Displays detailed information for a specific vendor:
 * 1. Top: Minimal Header (Vendor Name, Shop Name, Location, Back link)
 * 2. Middle:
 *    a) Items Needed & Quantities Table (Products purchased by the vendor from Northgate Wholesale)
 *    b) Full Call Transcripts log featuring the complete 6-step CALL-E prompt sequence:
 *        - Greeting & Account ID
 *        - Stock Check & New Order Inquiry
 *        - Item & Quantity Capture (with quantity follow-up if unspecified)
 *        - Delivery Timeline & Urgency Check (Urgent vs Standard)
 *        - Additional Items Check
 *        - Vendor Queries & Information Assistance
 *        - Final Order Summary & Dispatch Confirmation
 * 3. Bottom: Full Vendor Details Card (Location, Mobile, Working Hours, Consent)
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Phone,
  MapPin,
  Store,
  Home,
  Clock,
  PhoneOutgoing,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Package,
  Sparkles,
  User,
  Trash2,
} from "lucide-react";
import type { Contact } from "@/lib/contracts/domain";
import { Panel } from "@/components/ui/Panel";
import { StateChip } from "@/components/ui/StateChip";
import { Button } from "@/components/ui/Button";
import { apiGet, apiPost, apiDelete } from "@/lib/api";

interface Turn {
  speaker: "AGENT" | "HUMAN";
  name: string;
  text: string;
  time: string;
}

interface CallRecord {
  id: string;
  orderRef: string;
  date: string;
  status: "Completed" | "Partial Stock" | "Callback Scheduled" | "Dispute";
  state: "success" | "warning" | "info" | "critical";
  summary: string;
  transcript: Turn[];
}

interface ItemNeeded {
  id: string;
  orderRef: string;
  sku: string;
  description: string;
  requestedQty: number;
  confirmedQty: number;
  unitPrice: number;
  currency: string;
  status: string;
  deliveryEta: string;
}

interface VendorDetailViewProps {
  vendorId: string;
}

function buildCallHistory(vendorName: string, shopName?: string): CallRecord[] {
  const storeName = shopName || `${vendorName}'s Store`;
  return [
    {
      id: "call-latest",
      orderRef: "ORD-482",
      date: "Today at 10:15 AM (Latest Call)",
      status: "Completed",
      state: "success",
      summary: `Urgent order confirmed: 200 cases Medical Supplies & 50 boxes Gloves for ${storeName}. Delivery today 16:00 IST. Sanitizer pricing query answered.`,
      transcript: [
        {
          speaker: "AGENT",
          name: "CALL-E AI Agent",
          text: `Hello ${vendorName}, this is the automated operations line from Northgate Wholesale calling regarding your account at ${storeName}.`,
          time: "10:15:02",
        },
        {
          speaker: "AGENT",
          name: "CALL-E AI Agent",
          text: `We are conducting our daily inventory check. Could you share your current stock status, and let us know if you require any new items today?`,
          time: "10:15:08",
        },
        {
          speaker: "HUMAN",
          name: `${vendorName} (Client)`,
          text: `Hi! Yes, our current stock of medical supplies is running low. We need to place a buy order today.`,
          time: "10:15:18",
        },
        {
          speaker: "AGENT",
          name: "CALL-E AI Agent",
          text: `Sure! What items would you like to buy? If you know the exact quantity needed, please specify.`,
          time: "10:15:25",
        },
        {
          speaker: "HUMAN",
          name: `${vendorName} (Client)`,
          text: `We need Temperature-Sensitive Medical Supplies.`,
          time: "10:15:32",
        },
        {
          speaker: "AGENT",
          name: "CALL-E AI Agent",
          text: `Got it. How many cases or units of Temperature-Sensitive Medical Supplies do you need delivered to ${storeName}?`,
          time: "10:15:38",
        },
        {
          speaker: "HUMAN",
          name: `${vendorName} (Client)`,
          text: `We need 200 cases delivered.`,
          time: "10:15:45",
        },
        {
          speaker: "AGENT",
          name: "CALL-E AI Agent",
          text: `Understood—200 cases of Temperature-Sensitive Medical Supplies. When should these items be delivered? Is this an urgent order or can it take normal delivery time?`,
          time: "10:15:52",
        },
        {
          speaker: "HUMAN",
          name: `${vendorName} (Client)`,
          text: `This is an URGENT order! We need it delivered to our store today by 4 PM IST.`,
          time: "10:16:01",
        },
        {
          speaker: "AGENT",
          name: "CALL-E AI Agent",
          text: `Noted—urgent delivery requested for today by 4 PM IST. Are there any other items or SKUs to add to the delivery list?`,
          time: "10:16:09",
        },
        {
          speaker: "HUMAN",
          name: `${vendorName} (Client)`,
          text: `Yes, please also add 50 boxes of Sterile Nitrile Surgical Gloves.`,
          time: "10:16:17",
        },
        {
          speaker: "AGENT",
          name: "CALL-E AI Agent",
          text: `Got it—added 50 boxes of Surgical Gloves. Before we confirm this dispatch, do you have any further queries? For example, details about existing orders, available items in our warehouse, or pricing?`,
          time: "10:16:26",
        },
        {
          speaker: "HUMAN",
          name: `${vendorName} (Client)`,
          text: `Could you check if you have Industrial Sanitizer Concentrate in stock for next week and what the price is?`,
          time: "10:16:36",
        },
        {
          speaker: "AGENT",
          name: "CALL-E AI Agent",
          text: `Yes! We currently have Industrial Sanitizer Concentrate in stock at ₹950 per 5L container. I can queue that for your next delivery order.`,
          time: "10:16:45",
        },
        {
          speaker: "AGENT",
          name: "CALL-E AI Agent",
          text: `Thank you ${vendorName}! I have recorded your urgent order: 200 cases of Medical Supplies and 50 boxes of Surgical Gloves for delivery today by 4 PM IST to ${storeName}. Order reference ORD-482 has been confirmed in Northgate Wholesale system. Have a great day!`,
          time: "10:16:58",
        },
      ],
    },
    {
      id: "call-prev-1",
      orderRef: "ORD-479",
      date: "Yesterday at 03:45 PM",
      status: "Completed",
      state: "success",
      summary: `Stock check & delivery verified. 30 containers of Industrial Sanitizer delivered to ${storeName}.`,
      transcript: [
        {
          speaker: "AGENT",
          name: "CALL-E AI Agent",
          text: `Good afternoon ${vendorName}, calling from Northgate Wholesale for daily stock check & delivery verification.`,
          time: "15:45:01",
        },
        {
          speaker: "HUMAN",
          name: `${vendorName} (Client)`,
          text: `Hi! Yes, delivery truck MH-04-8921 just unloaded all 30 containers at ${storeName}. Everything is verified and stock is replenished.`,
          time: "15:45:12",
        },
        {
          speaker: "AGENT",
          name: "CALL-E AI Agent",
          text: `Excellent! I have logged full receipt of ORD-479. Thank you for your coordination, ${vendorName}!`,
          time: "15:45:20",
        },
      ],
    },
  ];
}

export function VendorDetailView({ vendorId }: VendorDetailViewProps) {
  const router = useRouter();
  const [vendor, setVendor] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [calling, setCalling] = useState(false);
  const [expandedCallId, setExpandedCallId] = useState<string>("call-latest");

  // Danger Zone / Delete Customer state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteCustomer = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await apiDelete<{ success: boolean }>("/api/v1/contacts", { id: vendorId });

      try {
        const localStr = typeof window !== "undefined" ? localStorage.getItem("sentinel_added_contacts") : null;
        if (localStr) {
          const localAdded: Contact[] = JSON.parse(localStr);
          const filtered = localAdded.filter((c) => c.id !== vendorId);
          localStorage.setItem("sentinel_added_contacts", JSON.stringify(filtered));
        }
      } catch {}

      router.push("/ops");
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete customer");
      setIsDeleting(false);
    }
  };

  // Sample items requested by this vendor from Northgate Wholesale
  const [itemsNeeded, setItemsNeeded] = useState<ItemNeeded[]>([
    {
      id: "item-1",
      orderRef: "ORD-482",
      sku: "MED-TS-CASE",
      description: "Temperature-Sensitive Medical Supplies",
      requestedQty: 200,
      confirmedQty: 200,
      unitPrice: 1850,
      currency: "INR",
      status: "Fully Confirmed",
      deliveryEta: "Today 16:00 IST (Urgent)",
    },
    {
      id: "item-2",
      orderRef: "ORD-482",
      sku: "GLV-NIT-BOX",
      description: "Sterile Nitrile Surgical Gloves (Box of 100)",
      requestedQty: 50,
      confirmedQty: 50,
      unitPrice: 420,
      currency: "INR",
      status: "Fully Confirmed",
      deliveryEta: "Today 16:00 IST (Urgent)",
    },
    {
      id: "item-3",
      orderRef: "ORD-479",
      sku: "SAN-CON-LIT",
      description: "Industrial Sanitizer Concentrate (5L Container)",
      requestedQty: 30,
      confirmedQty: 30,
      unitPrice: 950,
      currency: "INR",
      status: "Fully Confirmed",
      deliveryEta: "Delivered (Yesterday)",
    },
  ]);

  const [callHistory, setCallHistory] = useState<CallRecord[]>([]);

  useEffect(() => {
    apiGet<{ contacts: Contact[] }>("/api/v1/contacts")
      .then((res) => {
        let allContacts = res.contacts;
        try {
          const localStr = typeof window !== "undefined" ? localStorage.getItem("sentinel_added_contacts") : null;
          if (localStr) {
            const localAdded: Contact[] = JSON.parse(localStr);
            const apiIds = new Set(res.contacts.map((c) => c.id));
            const uniqueLocal = localAdded.filter((c) => !apiIds.has(c.id));
            allContacts = [...uniqueLocal, ...res.contacts];
          }
        } catch {}
        const found = allContacts.find((c) => c.id === vendorId);
        const targetVendor = found || {
          id: vendorId,
          organizationId: "org-metro-supply",
          name: "Sunita Sharma",
          role: "Vendor",
          phoneE164: "+919820441207",
          productCategories: ["wholesale", "retail"],
          region: "Mumbai West",
          workplaceLocation: "MIDC Industrial Estate, Phase II, Zone 2",
          livingLocation: "Flat 402, Green Acres Apartments, Andheri West",
          shopName: "Sunita Enterprises & Retailers",
          workingHours: { start: "09:00", end: "18:00", timezone: "Asia/Kolkata" },
          escalationPriority: 1,
          preferredLanguage: "en-IN",
          consentAt: new Date().toISOString(),
          cooldownUntil: null,
        };

        setVendor(targetVendor);

        // Load saved call history for this vendor from localStorage or fallback to default
        let loadedHistory: CallRecord[] = [];
        try {
          const saved = localStorage.getItem(`call_history_${vendorId}`);
          if (saved) loadedHistory = JSON.parse(saved);
        } catch {}

        if (loadedHistory.length > 0) {
          setCallHistory(loadedHistory);
        } else {
          setCallHistory(buildCallHistory(targetVendor.name, targetVendor.shopName));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [vendorId]);

  const triggerCall = async () => {
    if (!vendor) return;
    setCalling(true);

    try {
      const res = await apiPost<any>("/api/v1/contacts/call", {
        contactId: vendor.id,
        contact: vendor,
        orderReference: `ORD-${vendor.id.slice(-4).toUpperCase()}`,
      });

      const extractedTranscript: Turn[] =
        res.transcript && res.transcript.length > 0
          ? res.transcript.map((t: any) => ({
              speaker: t.speaker === "AGENT" ? "AGENT" : "HUMAN",
              name: t.speaker === "AGENT" ? "CALL-E AI Agent" : `${vendor.name} (Client)`,
              text: t.text,
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            }))
          : [
              {
                speaker: "AGENT",
                name: "CALL-E AI Agent",
                text: `Live CALL-E call completed with ${vendor.name}.`,
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              },
            ];

      const newCall: CallRecord = {
        id: `call-${Date.now()}`,
        orderRef: res.orderId || `ORD-${Date.now().toString().slice(-4)}`,
        date: `${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} (Live Call)`,
        status: res.blockedReason ? "Dispute" : "Completed",
        state: res.blockedReason ? "warning" : "success",
        summary: res.blockedReason
          ? `Call ended: ${res.blockedReason}`
          : res.structuredResult?.verbatim_commitment ||
            `Live CALL-E call completed with ${vendor.name}. Stock check and inventory requirements extracted.`,
        transcript: extractedTranscript,
      };

      setCallHistory((prev) => {
        const updated = [newCall, ...prev];
        try {
          localStorage.setItem(`call_history_${vendorId}`, JSON.stringify(updated));
        } catch {}
        return updated;
      });

      setExpandedCallId(newCall.id);
    } catch (err: any) {
      console.error("Live call failed:", err);
    } finally {
      setCalling(false);
    }
  };

  const toggleCallExpand = (id: string) => {
    setExpandedCallId((current) => (current === id ? "" : id));
  };

  if (loading) {
    return <div className="p-8 text-center text-ink-dim text-sm">Loading vendor details...</div>;
  }

  if (!vendor) {
    return (
      <div className="p-8 flex flex-col items-center gap-4">
        <p className="text-ink-dim text-sm">Vendor not found.</p>
        <Link href="/ops" className="text-lilac underline text-sm">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-5 sm:p-8 max-w-5xl mx-auto w-full">
      {/* ── 1. TOP HEADER (Minimalist: Name, Shop Name, Location) ───────── */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
        <div className="flex flex-col gap-1.5">
          <Link
            href="/ops"
            className="flex items-center gap-1.5 text-xs font-semibold text-ink-dim hover:text-ink transition-colors w-fit mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </Link>

          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="display text-display-s text-ink">{vendor.name}</h1>
            {vendor.shopName && (
              <span className="text-sm font-semibold text-lilac flex items-center gap-1">
                <Store className="h-3.5 w-3.5 shrink-0 text-lilac" />
                {vendor.shopName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-ink-dim">
            <MapPin className="h-3.5 w-3.5 text-lilac shrink-0" />
            <span>{vendor.region}</span>
            {vendor.workplaceLocation && (
              <>
                <span className="text-ink-faint">•</span>
                <span className="text-ink-faint truncate max-w-[320px]">{vendor.workplaceLocation}</span>
              </>
            )}
          </div>
        </div>

        <Button variant="primary" size="md" onClick={triggerCall} disabled={calling}>
          <PhoneOutgoing className={`h-4 w-4 ${calling ? "animate-spin" : ""}`} />
          {calling ? "Dialling CALL-E Agent..." : "Trigger CALL-E Call"}
        </Button>
      </header>

      {/* ── 2. MIDDLE CONTENT SECTION ─────────────────────────────────── */}
      <div className="flex flex-col gap-6">
        {/* A) Items & Quantities Needed by Vendor */}
        <Panel
          label="Items & Quantities Needed by Vendor"
          bodyClassName="p-0 overflow-x-auto"
          right={<span className="micro">{itemsNeeded.length} items requested</span>}
        >
          <table className="w-full text-left text-xs text-ink border-collapse">
            <thead>
              <tr className="border-b border-line bg-stone/40 micro text-ink-dim">
                <th className="py-3 px-4 font-semibold">Order Ref</th>
                <th className="py-3 px-4 font-semibold">Item & SKU</th>
                <th className="py-3 px-4 font-semibold text-center">Requested Qty</th>
                <th className="py-3 px-4 font-semibold text-center">Confirmed Qty</th>
                <th className="py-3 px-4 font-semibold">Unit Price</th>
                <th className="py-3 px-4 font-semibold">Total Value</th>
                <th className="py-3 px-4 font-semibold">Delivery ETA / Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {itemsNeeded.map((item) => (
                <tr key={item.id} className="hover:bg-stone/30 transition-colors">
                  <td className="py-3 px-4 font-mono text-xs font-semibold text-ink-dim">
                    {item.orderRef}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-ink flex items-center gap-1.5">
                        <Package className="h-3.5 w-3.5 text-lilac shrink-0" />
                        {item.description}
                      </span>
                      <span className="font-mono text-[10px] text-ink-faint">SKU: {item.sku}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center font-semibold text-ink">
                    {item.requestedQty}
                  </td>
                  <td className="py-3 px-4 text-center font-semibold text-state-success">
                    {item.confirmedQty}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-ink-dim">
                    ₹{item.unitPrice.toLocaleString("en-IN")}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs font-bold text-ink">
                    ₹{(item.confirmedQty * item.unitPrice).toLocaleString("en-IN")}
                  </td>
                  <td className="py-3 px-4">
                    <StateChip
                      state={item.confirmedQty === item.requestedQty ? "success" : "warning"}
                      size="sm"
                      className="text-[11px]"
                    >
                      {item.deliveryEta}
                    </StateChip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        {/* B) Entire Call Transcripts Log (Latest Call Expanded by Default) */}
        <Panel
          label="CALL-E Voice Agent Call Transcripts"
          bodyClassName="p-4 flex flex-col gap-4"
          right={<span className="micro">{callHistory.length} total call sessions</span>}
        >
          <div className="flex flex-col gap-3">
            {callHistory.map((record) => {
              const isExpanded = expandedCallId === record.id;

              return (
                <div
                  key={record.id}
                  className="rounded-lg border border-line bg-stone/20 overflow-hidden transition-all"
                >
                  {/* Accordion Header */}
                  <button
                    onClick={() => toggleCallExpand(record.id)}
                    className="w-full px-4 py-3 flex flex-wrap items-center justify-between gap-3 bg-stone/40 hover:bg-stone/60 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-ink flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-lilac shrink-0" />
                        {record.date}
                      </span>
                      <span className="text-xs text-ink-dim font-mono">[{record.orderRef}]</span>
                      <StateChip state={record.state} size="sm">
                        {record.status}
                      </StateChip>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-ink-dim">
                      <span>{isExpanded ? "Collapse Transcript" : "View Entire Transcript"}</span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-ink-dim" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-ink-dim" />
                      )}
                    </div>
                  </button>

                  {/* Summary Bar */}
                  <div className="px-4 py-2 bg-panel border-t border-line text-xs text-ink-dim flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-lilac shrink-0" />
                    <span>
                      <strong className="text-ink font-medium">Extraction Summary:</strong> {record.summary}
                    </span>
                  </div>

                  {/* Turn-by-Turn Transcript Body (Expanded) */}
                  {isExpanded && (
                    <div className="p-4 bg-canvas border-t border-line flex flex-col gap-3">
                      <p className="micro text-ink-faint mb-1">Verbatim Voice Transcript Log</p>
                      {record.transcript.map((turn, idx) => (
                        <div
                          key={idx}
                          className={`flex items-start gap-3 rounded-lg p-3 ${
                            turn.speaker === "AGENT"
                              ? "bg-lilac/10 border border-lilac/20 ml-0 mr-6 sm:mr-12"
                              : "bg-panel border border-line ml-6 sm:ml-12 mr-0"
                          }`}
                        >
                          <div
                            className={`rounded-full p-1.5 shrink-0 mt-0.5 ${
                              turn.speaker === "AGENT" ? "bg-lilac text-on-lilac" : "bg-stone text-ink"
                            }`}
                          >
                            {turn.speaker === "AGENT" ? (
                              <Sparkles className="h-3.5 w-3.5" />
                            ) : (
                              <User className="h-3.5 w-3.5" />
                            )}
                          </div>

                          <div className="flex flex-col gap-1 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-ink">{turn.name}</span>
                              <span className="font-mono text-[10px] text-ink-faint">{turn.time}</span>
                            </div>
                            <p className="text-ink-dim leading-relaxed whitespace-pre-line">{turn.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* ── 3. BOTTOM SECTION (Complete Vendor Details Card) ─────────────── */}
      <Panel label="Complete Vendor Information" bodyClassName="p-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Vendor Name & Role */}
          <div className="flex flex-col gap-1">
            <span className="micro text-ink-faint">Full Name & Role</span>
            <span className="text-sm font-semibold text-ink">{vendor.name}</span>
            <span className="text-xs text-lilac font-medium">{vendor.role}</span>
          </div>

          {/* Shop / Business Name */}
          <div className="flex flex-col gap-1">
            <span className="micro text-ink-faint">Shop / Business Name</span>
            <span className="text-sm font-semibold text-ink flex items-center gap-1.5">
              <Store className="h-4 w-4 text-lilac shrink-0" />
              {vendor.shopName || "Not specified"}
            </span>
          </div>

          {/* Mobile Number */}
          <div className="flex flex-col gap-1">
            <span className="micro text-ink-faint">Mobile Number (E.164)</span>
            <span className="data-value text-sm font-mono font-semibold text-ink flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-ink-faint" />
              {vendor.phoneE164}
            </span>
          </div>

          {/* Region / Territory */}
          <div className="flex flex-col gap-1 pt-3 border-t border-line">
            <span className="micro text-ink-faint">Region / Territory</span>
            <span className="text-sm font-medium text-ink flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-lilac shrink-0" />
              {vendor.region}
            </span>
          </div>

          {/* Workplace Location */}
          <div className="flex flex-col gap-1 pt-3 border-t border-line">
            <span className="micro text-ink-faint">Workplace Location</span>
            <span className="text-sm font-medium text-ink flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-ink-faint shrink-0" />
              {vendor.workplaceLocation || "Not specified"}
            </span>
          </div>

          {/* Living Location */}
          <div className="flex flex-col gap-1 pt-3 border-t border-line">
            <span className="micro text-ink-faint">Living Location (Residential)</span>
            <span className="text-sm font-medium text-ink flex items-center gap-1.5">
              <Home className="h-4 w-4 text-ink-faint shrink-0" />
              {vendor.livingLocation || "Not specified"}
            </span>
          </div>

          {/* Working Hours */}
          <div className="flex flex-col gap-1 pt-3 border-t border-line">
            <span className="micro text-ink-faint">Working Hours & Timezone</span>
            <span className="text-sm font-medium text-ink flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-state-info shrink-0" />
              {vendor.workingHours.start} – {vendor.workingHours.end} ({vendor.workingHours.timezone})
            </span>
          </div>

          {/* Preferred Language */}
          <div className="flex flex-col gap-1 pt-3 border-t border-line">
            <span className="micro text-ink-faint">Preferred Language</span>
            <span className="text-sm font-medium text-ink">
              {vendor.preferredLanguage === "hi-IN" ? "Hindi (hi-IN)" : "English / Indian (en-IN)"}
            </span>
          </div>

          {/* Consent Verification */}
          <div className="flex flex-col gap-1 pt-3 border-t border-line">
            <span className="micro text-ink-faint">Consent Status</span>
            <span className="text-sm font-medium text-state-success flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              Verified Implicit Consent
            </span>
          </div>
        </div>
      </Panel>

      {/* ── 4. DANGER ZONE (Remove Customer / Vendor from Database) ────── */}
      <div className="rounded-lg border border-state-critical/30 bg-state-critical/5 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-2">
        <div className="flex items-start gap-3.5">
          <div className="rounded-full bg-state-critical/20 p-2.5 text-state-critical shrink-0 mt-0.5 sm:mt-0">
            <Trash2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink">Remove Customer from Database</h3>
            <p className="text-xs text-ink-dim mt-0.5 max-w-[58ch]">
              Permanently delete &quot;{vendor.name}&quot; from your wholesaler network directory. This will remove their record from Supabase database and local storage.
            </p>
            {deleteError && (
              <p className="text-xs text-state-critical mt-2 font-medium">{deleteError}</p>
            )}
          </div>
        </div>

        {!showDeleteConfirm ? (
          <Button
            variant="ghost"
            size="md"
            onClick={() => setShowDeleteConfirm(true)}
            className="border border-state-critical/40 text-state-critical hover:bg-state-critical/15 hover:border-state-critical shrink-0"
          >
            <Trash2 className="h-4 w-4" />
            Delete Customer
          </Button>
        ) : (
          <div className="flex items-center gap-2 shrink-0 bg-elevated p-2 rounded-lg border border-state-critical/50">
            <span className="text-xs font-semibold text-state-critical px-2">Confirm deletion?</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleDeleteCustomer}
              disabled={isDeleting}
              className="bg-state-critical text-white hover:bg-state-critical/90 border-0"
            >
              {isDeleting ? "Deleting..." : "Yes, Delete Permanently"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
