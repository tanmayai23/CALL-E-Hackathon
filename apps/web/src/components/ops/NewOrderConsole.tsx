"use client";

/**
 * New order — the business-event simulator (PRD v2.0 FR-1.3, demo 0:15–0:30).
 *
 * The order is entered the way it would arrive from a distributor's system.
 * Submitting it runs the whole pipeline — assessment, contact selection, the
 * call plan, the call, typed extraction and the order update — and opens the
 * order screen to watch it happen. With the mock driver the operator also
 * chooses what the supplier does on the call; with a real backend they cannot,
 * because a real person answers.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Info, Octagon, PhoneOutgoing, RotateCcw, ShieldOff } from "lucide-react";
import type { Contact, TriggerType } from "@/lib/contracts/domain";
import { Panel } from "@/components/ui/Panel";
import { StateChip } from "@/components/ui/StateChip";
import { Button } from "@/components/ui/Button";
import { ChoicePills, type Choice } from "@/components/ui/ChoicePills";
import { useNow } from "@/hooks/useClientValue";
import { apiGet, apiPost, IS_MOCK } from "@/lib/api";
import { PRODUCT, SELLER, maskPhone } from "@/lib/mock/directory";
import { TRIGGER_LABEL } from "@/lib/state-map";
import { formatters, istAt } from "@/lib/time";
import { SupplierBehaviour, type ScenarioOption } from "./SupplierBehaviour";

type Due = "today" | "tomorrow" | "three-days";

/** When each "required by" choice falls, relative to now. "Today" is never in the past. */
function requiredByFor(due: Due, now: number): string {
  if (due === "tomorrow") return istAt(now, 1, 12);
  if (due === "three-days") return istAt(now, 3, 12);
  const endOfDay = Date.parse(istAt(now, 0, 18));
  return new Date(Math.max(endOfDay, now + 3 * 3_600_000)).toISOString();
}

const TRIGGERS: Choice<TriggerType>[] = (["INVENTORY", "ORDER", "DELIVERY", "EXCEPTION"] as const).map((t) => ({
  value: t,
  label: TRIGGER_LABEL[t],
}));

/** Mirrors the server's validation, so mistakes are caught before the round trip. */
const OrderForm = z.object({
  reference: z
    .string()
    .trim()
    .min(3, "At least 3 characters")
    .max(24, "At most 24 characters")
    .regex(/^[A-Za-z0-9][A-Za-z0-9-]*$/, "Letters, digits and hyphens only"),
  description: z.string().trim().min(3, "Describe the product").max(80, "At most 80 characters"),
  quantity: z.coerce.number().int("Whole units only").min(1, "At least 1").max(100_000, "At most 100,000"),
  unit: z.string().trim().min(1, "Required").max(16, "At most 16 characters"),
});

type FormState = { reference: string; description: string; quantity: string; unit: string };
type FieldErrors = Partial<Record<keyof FormState, string>>;

const INITIAL: FormState = {
  reference: "ORD-482",
  description: PRODUCT.description,
  quantity: "200",
  unit: PRODUCT.unit,
};

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="micro">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-xs text-state-critical">
          {error}
        </p>
      )}
    </div>
  );
}

const INPUT =
  "h-11 w-full rounded-md border border-line-strong bg-elevated px-3.5 text-sm text-ink " +
  "placeholder:text-ink-faint aria-[invalid=true]:border-state-critical";

export function NewOrderConsole() {
  const router = useRouter();
  const now = useNow(60_000);

  const [form, setForm] = useState<FormState>(INITIAL);
  const [due, setDue] = useState<Due>("today");
  const [triggerType, setTriggerType] = useState<TriggerType>("INVENTORY");
  const [scenarioId, setScenarioId] = useState("partial-stock");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [scenarios, setScenarios] = useState<ScenarioOption[] | null>(null);
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [killSwitch, setKillSwitch] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [cleared, setCleared] = useState(false);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  /* setState lands in promise callbacks only — the effect body itself does not
     cascade a render before first paint. */
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiGet<{ scenarios: ScenarioOption[]; killSwitch: boolean }>("/api/v1/simulator/trigger"),
      apiGet<{ contacts: Contact[] }>("/api/v1/contacts"),
    ])
      .then(([catalogue, directory]) => {
        if (cancelled) return;
        setScenarios(catalogue.scenarios);
        setKillSwitch(catalogue.killSwitch);
        setContacts(directory.contacts.filter((c) => c.organizationId === SELLER.id));
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Could not load the simulator");
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const update = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setFieldErrors((errs) => ({ ...errs, [key]: undefined }));
  };

  const dueChoices: Choice<Due>[] = [
    {
      value: "today",
      label: "Today",
      hint: now ? formatters.time.format(new Date(requiredByFor("today", now))) : undefined,
    },
    { value: "tomorrow", label: "Tomorrow", hint: "12:00" },
    { value: "three-days", label: "In 3 days", hint: "12:00" },
  ];

  const place = () => {
    const parsed = OrderForm.safeParse(form);
    if (!parsed.success) {
      const errs: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormState;
        errs[key] ??= issue.message;
      }
      setFieldErrors(errs);
      return;
    }

    setPlacing(true);
    setError(null);
    apiPost<{ orderId: string }>("/api/v1/simulator/trigger", {
      scenarioId,
      order: {
        ...parsed.data,
        requiredBy: requiredByFor(due, Date.now()),
        triggerType,
      },
    })
      .then((result) => router.push(`/ops/orders/${result.orderId}`))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not place the order");
        setPlacing(false);
        reload();
      });
  };

  const reset = () => {
    setResetting(true);
    setCleared(false);
    setError(null);
    apiPost("/api/v1/simulator/trigger", { action: "reset" })
      .then(() => setCleared(true))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not clear the runs"))
      .finally(() => setResetting(false));
  };

  return (
    <div className="flex flex-col gap-6 p-5 sm:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Business-event simulator</p>
          <h1 className="display mt-2 text-display-s text-ink">
            Place an <em>order</em>
          </h1>
          <p className="mt-2 max-w-[60ch] text-sm text-ink-dim">
            Enter it the way it arrives from your system. Sentinel Ops decides whether it needs a call, picks the
            contact, calls, and writes the answer back to the order.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {cleared && (
            <StateChip state="success" size="sm">
              Live runs cleared
            </StateChip>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={reset}
            disabled={resetting}
            title="Drop every order placed here and return to the seeded history"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            {resetting ? "Clearing…" : "Clear live runs"}
          </Button>
        </div>
      </header>

      {killSwitch && (
        <div className="flex items-center gap-2.5 rounded-lg border border-state-critical/40 bg-state-critical/8 px-5 py-3">
          <Octagon className="h-4 w-4 shrink-0 text-state-critical" aria-hidden />
          <p className="text-sm text-state-critical">
            The kill switch is engaged. No order can be placed until calling is released from the top bar.
          </p>
        </div>
      )}

      {(error || loadError) && (
        <div className="flex items-center gap-2.5 rounded-lg border border-state-critical/40 bg-state-critical/8 px-5 py-3">
          <ShieldOff className="h-4 w-4 shrink-0 text-state-critical" aria-hidden />
          <p className="text-sm text-state-critical">{error ?? loadError}</p>
          {loadError && (
            <Button variant="ghost" size="sm" onClick={reload} className="ml-auto">
              Retry
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* ── The order ──────────────────────────────────────────── */}
        <Panel label="The order" className="lg:col-span-7" bodyClassName="flex flex-col gap-6 p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="reference" label="Order reference" error={fieldErrors.reference}>
              <input
                id="reference"
                value={form.reference}
                onChange={update("reference")}
                aria-invalid={Boolean(fieldErrors.reference)}
                aria-describedby={fieldErrors.reference ? "reference-error" : undefined}
                className={`${INPUT} data-value`}
                autoComplete="off"
              />
            </Field>
            <div className="grid grid-cols-[1fr_7rem] gap-3">
              <Field id="quantity" label="Quantity" error={fieldErrors.quantity}>
                <input
                  id="quantity"
                  inputMode="numeric"
                  value={form.quantity}
                  onChange={update("quantity")}
                  aria-invalid={Boolean(fieldErrors.quantity)}
                  aria-describedby={fieldErrors.quantity ? "quantity-error" : undefined}
                  className={`${INPUT} data-value`}
                />
              </Field>
              <Field id="unit" label="Unit" error={fieldErrors.unit}>
                <input
                  id="unit"
                  value={form.unit}
                  onChange={update("unit")}
                  aria-invalid={Boolean(fieldErrors.unit)}
                  className={INPUT}
                />
              </Field>
            </div>
          </div>

          <Field id="description" label="Product" error={fieldErrors.description}>
            <input
              id="description"
              value={form.description}
              onChange={update("description")}
              aria-invalid={Boolean(fieldErrors.description)}
              aria-describedby={fieldErrors.description ? "description-error" : undefined}
              className={INPUT}
            />
          </Field>

          <ChoicePills name="due" legend="Required by" choices={dueChoices} value={due} onChange={setDue} />
          <ChoicePills
            name="trigger"
            legend="What raised it"
            choices={TRIGGERS}
            value={triggerType}
            onChange={setTriggerType}
          />

          <div className="rounded-lg bg-stone/45 p-4">
            <p className="micro">Supplier · {SELLER.name}</p>
            <p className="mt-1 text-xs text-ink-dim">
              Only consented contacts are called, primary first, within working hours.
            </p>
            <ol className="mt-3 grid gap-2 sm:grid-cols-3">
              {(contacts ?? []).map((c) => (
                <li key={c.id} className="rounded-md bg-panel px-3 py-2">
                  <span className="flex items-baseline gap-1.5">
                    <span className="data-value text-[11px] text-ink-faint">{c.escalationPriority}</span>
                    <span className="truncate text-xs font-semibold text-ink">{c.name}</span>
                  </span>
                  <span className="block truncate text-[11px] text-ink-dim">{c.role}</span>
                  <span className="data-value block text-[10px] text-ink-faint">{maskPhone(c.phoneE164)}</span>
                </li>
              ))}
            </ol>
          </div>
        </Panel>

        {/* ── What the supplier does ─────────────────────────────── */}
        <Panel
          label="What the supplier does"
          className="lg:col-span-5"
          bodyClassName="p-0"
          right={IS_MOCK ? <span className="micro">mock driver</span> : null}
        >
          <SupplierBehaviour scenarios={scenarios} value={scenarioId} onChange={setScenarioId} mock={IS_MOCK} />
        </Panel>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-panel px-6 py-4">
        <Button variant="primary" size="lg" onClick={place} disabled={placing || killSwitch || !scenarios}>
          <PhoneOutgoing className="h-4 w-4" aria-hidden />
          {placing ? "Placing…" : "Place coordination call"}
        </Button>
        {IS_MOCK && (
          <p className="flex max-w-[64ch] items-start gap-2 text-xs leading-relaxed text-ink-dim">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-state-info" aria-hidden />
            <span>
              Mock driver: the call is a scripted fixture over the real event contract. No phone rings and no CALL-E
              credit is spent. Set <code className="data-value text-ink">NEXT_PUBLIC_API_BASE</code> to run the
              real path.
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
