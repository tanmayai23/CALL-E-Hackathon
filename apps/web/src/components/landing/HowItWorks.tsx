import { CheckCircle2, PackageOpen, PhoneCall, UserRound, Zap } from "lucide-react";
import { SectionHeading } from "./SectionHeading";

/**
 * The pipeline as five flat stone cards on the 12-column grid: three across,
 * then two wider — so the eye lands on the call and the update last.
 */
const STEPS = [
  {
    icon: Zap,
    title: "An order needs an answer",
    body: "An order, a low-stock alert or a delivery exception arrives. It is validated, de-duplicated and given a trace ID.",
    span: "lg:col-span-4",
  },
  {
    icon: UserRound,
    title: "The right person",
    body: "The consented contact for that supplier, product and region — primary first, within their working hours.",
    span: "lg:col-span-4",
  },
  {
    icon: PhoneCall,
    title: "A real phone call",
    body: "CALL-E places the call with a prompt written for this order: the reference, the quantity, the date, the questions.",
    span: "lg:col-span-4",
  },
  {
    icon: PackageOpen,
    title: "It negotiates what is possible",
    body: "Partial stock, a new price, “call me at four” — each has a planned response. A refusal moves to the next contact; a new price goes to a person.",
    span: "lg:col-span-6",
  },
  {
    icon: CheckCircle2,
    title: "The order updates itself",
    body: "Confirmed and remaining quantity, dispatch date and next action come back as typed data, with the confidence and the exact words behind them.",
    span: "lg:col-span-6",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-28">
      <div className="container-page section">
        <SectionHeading eyebrow="How it works" measure="max-w-[20ch]">
          From an order to <em>a commitment.</em>
        </SectionHeading>

        <ol className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-12">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className={`flex flex-col rounded-lg bg-stone p-7 ${step.span}`}>
                <div className="flex items-center justify-between">
                  <span className="display-num text-3xl text-ink-faint">{String(i + 1).padStart(2, "0")}</span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-canvas">
                    <Icon className="h-4 w-4 text-ink" aria-hidden />
                  </span>
                </div>
                <h3 className="mt-10 text-xl font-semibold tracking-tight text-ink">{step.title}</h3>
                <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-ink-dim">{step.body}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
