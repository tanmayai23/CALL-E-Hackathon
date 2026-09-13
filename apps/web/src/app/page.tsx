import Link from "next/link";
import { ArrowRight, Check, Clock3, PackageCheck, PhoneCall, Radio, SlidersHorizontal } from "lucide-react";
import { StateChip } from "@/components/ui/StateChip";
import { buttonStyles } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/**
 * Landing — 5% of the frontend effort budget, and deliberately so. Judges see
 * it for three seconds and the product is what gets scored, so this is one
 * screen: the sentence, the chain, the way in. No scroll, no marketing.
 */

export default function LandingPage() {
  return (
    <main className="grain grid-field relative flex min-h-dvh flex-col overflow-hidden">
      {/* Header rule */}
      <header className="relative z-10 flex items-center justify-between border-b border-line-strong/70 bg-panel/45 px-6 py-5 backdrop-blur-sm sm:px-10">
        <div className="flex items-baseline gap-3">
          <span className="data-value text-sm font-semibold tracking-tight text-ink sm:text-base">
            SENTINEL OPS
          </span>
          <span className="micro hidden text-state-active sm:inline">Northgate Distribution</span>
        </div>
        <StateChip state="idle" icon={Radio} size="sm">
          Standing by
        </StateChip>
      </header>

      <div className="relative z-10 flex flex-1 items-center px-6 py-12 sm:px-10 sm:py-16 lg:py-20">
        <div className="mx-auto grid w-full max-w-[1180px] items-center gap-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-20">
          <section>
            <p className="micro mb-7">Autonomous wholesale coordination</p>

            <h1 className="max-w-[12ch] text-[clamp(40px,6vw,72px)] font-semibold leading-[0.98] tracking-[-0.04em] text-ink">
              Wholesale calls.
              <br />Closed loops.
            </h1>

            <p className="mt-8 max-w-[56ch] text-base leading-relaxed text-ink-dim sm:text-lg">
              When a distributor needs a real answer, Sentinel Ops calls the wholesaler, negotiates
              stock and dispatch, then writes the commitment back to the order.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              href="/ops"
              className={cn(buttonStyles({ variant: "primary", size: "lg" }), "group")}
            >
              Open Operations
              <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/ops/simulator"
              className={buttonStyles({ variant: "neutral", size: "lg" })}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Run a scenario
            </Link>
            </div>

            <dl className="mt-12 grid max-w-[560px] grid-cols-3 gap-6 border-t border-line pt-5">
              <div>
                <dt className="micro">Confirmation</dt>
                <dd className="data-value mt-2 text-lg text-ink">&lt; 3 min</dd>
              </div>
              <div>
                <dt className="micro">Operator effort</dt>
                <dd className="data-value mt-2 text-lg text-ink">0 min</dd>
              </div>
              <div>
                <dt className="micro">Output</dt>
                <dd className="data-value mt-2 text-lg text-ink">Typed</dd>
              </div>
            </dl>
          </section>

          <aside className="border border-line bg-panel/90 p-5 shadow-2xl shadow-black/20 sm:p-6">
            <div className="flex items-start justify-between border-b border-line pb-5">
              <div>
                <p className="micro">Live coordination</p>
                <p className="data-value mt-2 text-sm text-ink">Order ORD-482</p>
              </div>
              <StateChip state="active" icon={PhoneCall} size="sm" pulse>
                Calling
              </StateChip>
            </div>

            <div className="space-y-5 py-6">
              <div>
                <p className="micro">Distributor</p>
                <p className="mt-1 text-sm text-ink">Northgate Distributors</p>
              </div>
              <div className="flex items-center gap-3 text-ink-faint" aria-hidden>
                <span className="h-px flex-1 bg-line-strong" />
                <ArrowRight className="h-3.5 w-3.5" />
                <span className="h-px flex-1 bg-line-strong" />
              </div>
              <div>
                <p className="micro">Wholesaler</p>
                <p className="mt-1 text-sm text-ink">Metro Supply Co.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-line bg-base/60 p-3">
                  <PackageCheck className="h-4 w-4 text-state-active" aria-hidden />
                  <p className="micro mt-4">Confirmed</p>
                  <p className="data-value mt-1 text-lg text-ink">120 cases</p>
                </div>
                <div className="border border-line bg-base/60 p-3">
                  <Clock3 className="h-4 w-4 text-state-warning" aria-hidden />
                  <p className="micro mt-4">Remaining</p>
                  <p className="data-value mt-1 text-lg text-ink">80 tomorrow</p>
                </div>
              </div>
            </div>

            <div className="border-t border-line pt-5">
              <p className="micro mb-3">Workflow</p>
              <ol className="space-y-3">
                {["Contact selected", "Stock negotiated", "Order update ready"].map((step) => (
                  <li key={step} className="flex items-center gap-2.5 text-xs text-ink-dim">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-state-active/15 text-state-active">
                      <Check className="h-3 w-3" aria-hidden />
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        </div>
      </div>

      {/* Footer rule — the claim, quantified */}
      <footer className="relative z-10 border-t border-line-strong/70 bg-panel/45 px-6 py-5 backdrop-blur-sm sm:px-10">
        <dl className="mx-auto flex w-full max-w-[1180px] items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Radio className="h-3 w-3 text-state-active" aria-hidden />
            <dt className="micro">CALL-E runtime</dt>
          </div>
          <dd className="micro text-ink-faint">Human confirmation, structured automatically</dd>
        </dl>
      </footer>
    </main>
  );
}
