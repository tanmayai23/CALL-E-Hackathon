import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonStyles } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/** The hero conversation, PRD v2.0 §4.1 — illustrative, and labelled as such. */
const CONVERSATION = [
  { who: "Agent", text: "This is the automated operations line for Northgate Distributors, calling about order 482." },
  { who: "Metro Supply", text: "We only have 120 cases ready today." },
  { who: "Agent", text: "Can you dispatch the 120 today and confirm when the remaining 80 will be available?" },
  { who: "Metro Supply", text: "Yes, 120 today and the remaining 80 tomorrow morning." },
  { who: "Agent", text: "Confirmed. I'll update order 482 and schedule a follow-up for the 80." },
];

/** Bar heights for the pill's waveform, as a fraction of its height. */
const BARS = [0.35, 0.6, 0.9, 0.55, 1, 0.7, 0.4, 0.8, 0.95, 0.5, 0.65, 0.3, 0.75, 0.45];

function CallRibbon() {
  return (
    <div className="relative mt-20 sm:mt-24">
      <p className="sr-only">
        An example call from the hero scenario: the wholesaler has 120 of 200 cases ready today, and the agent secures
        the 120 for today and the remaining 80 for tomorrow morning.
      </p>

      {/* Ribbon and waveform together read as a call in progress. */}
      <div className="-mx-8 -rotate-2 overflow-hidden bg-band py-5" aria-hidden>
        <div className="animate-marquee flex w-max gap-14 whitespace-nowrap" style={{ ["--marquee-duration" as string]: "70s" }}>
          {[...CONVERSATION, ...CONVERSATION].map((line, i) => (
            <span key={i} className="flex items-baseline gap-3 text-lg text-on-band">
              <span className={cn("text-xs font-semibold uppercase tracking-[0.12em]", line.who === "Agent" ? "text-lilac" : "text-on-band/60")}>
                {line.who}
              </span>
              <span className="display text-2xl italic">{line.text}</span>
            </span>
          ))}
        </div>
      </div>

      <div
        className="absolute left-[18%] top-1/2 flex h-16 -translate-y-1/2 items-center gap-[3px] rounded-full border-2 border-on-lilac bg-canvas px-5 shadow-[var(--shadow-float)]"
        aria-hidden
      >
        {BARS.map((h, i) => (
          <span
            key={i}
            className="animate-bar w-[3px] rounded-full bg-ink"
            style={{ height: `${h * 30}px`, animationDelay: `${(i % 7) * 0.12}s` }}
          />
        ))}
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-24 pt-20 sm:pt-28">
      <div className="container-page text-center">
        <p className="eyebrow">Sentinel Ops · Wholesale coordination</p>

        <h1 className="display mx-auto mt-7 max-w-[14ch] text-display-l text-ink">
          Wholesale calls.
          <br />
          <em>Closed loops.</em>
        </h1>

        <p className="mx-auto mt-8 max-w-[46ch] text-lg leading-relaxed text-ink-dim">
          When a distributor needs a real answer, Sentinel Ops calls the wholesaler, negotiates stock and dispatch,
          then writes the commitment back to the order.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link href="/ops" className={cn(buttonStyles({ variant: "primary", size: "lg" }), "group")}>
            Open operations
            <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
          </Link>
          <Link href="/ops/simulator" className={buttonStyles({ variant: "neutral", size: "lg" })}>
            Place an order
          </Link>
        </div>

        <p className="mt-5 text-sm text-ink-faint">Built on CALL-E · consented business contacts only</p>
      </div>

      <CallRibbon />
    </section>
  );
}
