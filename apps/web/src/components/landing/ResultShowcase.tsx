import { ArrowRight, Check, Clock3, PackageCheck, PhoneCall, Quote } from "lucide-react";
import { StateChip } from "@/components/ui/StateChip";
import { SectionHeading } from "./SectionHeading";

/**
 * The payoff, on the page: the call becomes fields, not a transcript.
 *
 * The lilac card is the ORD-482 coordination card from the previous landing,
 * kept as the featured block. Every value here is from the hero scenario and is labelled as an
 * example — it is not presented as a live result. The card keeps its colours in
 * both themes, so its inner surfaces are tinted from its own ink, never the page.
 */

const FIELDS: Array<[string, string]> = [
  ["stock_status", "partial"],
  ["confirmed_quantity", "120"],
  ["remaining_quantity", "80"],
  ["dispatch_date", "today"],
  ["delivery_eta", "tomorrow morning"],
  ["next_action", "PARTIAL_CONFIRMATION"],
];

function CoordinationCard() {
  return (
    <div className="flex h-full flex-col rounded-xl border-2 border-on-lilac bg-lilac p-7 text-on-lilac">
      <div className="flex items-start justify-between gap-4 border-b border-on-lilac/15 pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-70">Live coordination</p>
          <p className="display mt-2 whitespace-nowrap text-2xl">Order ORD-482</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-on-lilac/30 bg-on-lilac/[0.06] px-3 py-1 text-xs font-semibold">
          <PhoneCall className="h-3 w-3" aria-hidden />
          Calling
        </span>
      </div>

      <div className="flex items-center gap-3 py-6 text-sm">
        <span className="font-semibold">Northgate Distributors</span>
        <ArrowRight className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
        <span className="font-semibold">Metro Supply Co.</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-on-lilac/[0.06] p-4">
          <PackageCheck className="h-4 w-4" aria-hidden />
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] opacity-70">Confirmed</p>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="display-num text-3xl">120</span>
            <span className="text-sm font-medium">cases</span>
          </p>
        </div>
        <div className="rounded-lg bg-on-lilac/[0.06] p-4">
          <Clock3 className="h-4 w-4" aria-hidden />
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] opacity-70">Remaining</p>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="display-num text-3xl">80</span>
            <span className="text-sm font-medium">tomorrow</span>
          </p>
        </div>
      </div>

      <ol className="mt-auto space-y-3 pt-7">
        {["Contact selected", "Stock negotiated", "Order update ready"].map((step) => (
          <li key={step} className="flex items-center gap-2.5 text-sm">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-on-lilac text-lilac">
              <Check className="h-3 w-3" aria-hidden />
            </span>
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ResultShowcase() {
  return (
    <section id="result" className="scroll-mt-28 border-t border-line">
      <div className="container-page section grid gap-12 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-5">
          <CoordinationCard />
        </div>

        <div className="lg:col-span-7">
          <SectionHeading eyebrow="What comes back" measure="max-w-[16ch]">
            Not a transcript. <em>A commitment.</em>
          </SectionHeading>
          <p className="mt-6 max-w-[54ch] text-lg leading-relaxed text-ink-dim">
            CALL-E returns typed fields against a fixed schema, a confidence score, and the exact words each answer
            came from. The order updates from the fields — nobody transcribes a call.
          </p>

          <div className="mt-10 rounded-lg bg-stone p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="micro">Example · hero scenario</p>
              <StateChip state="success" size="sm">
                Confidence 0.92
              </StateChip>
            </div>
            <dl className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {FIELDS.map(([key, value]) => (
                <div key={key} className="flex items-baseline justify-between gap-4 border-b border-line-strong/50 pb-2">
                  <dt className="data-value text-xs text-ink-faint">{key}</dt>
                  <dd className="data-value text-sm text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 flex items-start gap-2 text-sm text-state-success">
              <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>&ldquo;Yes, 120 today and the remaining 80 tomorrow morning.&rdquo;</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
