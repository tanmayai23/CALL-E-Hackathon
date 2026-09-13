import { Plus } from "lucide-react";
import { SectionHeading } from "./SectionHeading";

/**
 * The questions a judge or a buyer actually asks. Native <details> — keyboard
 * and screen-reader behaviour come from the browser, not from script.
 */
const QUESTIONS = [
  {
    q: "Why a phone call, and not a message?",
    a: "Because the inventory record is not the commitment. A supplier may have part of the order, a new price or a later date — and small suppliers answer the phone faster than they answer email. A call gets a negotiated, confirmed answer; a message gets read later, if at all.",
  },
  {
    q: "What happens when the supplier says no?",
    a: "It captures the reason and moves down the ladder: primary contact, then backup, then supervisor. After three, it stops calling and hands the order to a person, loudly.",
  },
  {
    q: "Will it ever agree to a new price?",
    a: "No. It records the price the supplier quoted and holds the order for an operator to approve or reject. The same goes for credit and legal terms.",
  },
  {
    q: "What if the answer is vague?",
    a: "It asks once more for a specific date or number. If the answer is still unclear, the call's confidence falls below 0.70 and the order goes to a person — it is never applied on a guess.",
  },
  {
    q: "Is this a real phone call?",
    a: "In production, yes — CALL-E places a real call to a consented contact. The public demo's order simulator runs a clearly labelled mock, so anyone can try the flow without a phone ringing.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-28 border-t border-line">
      <div className="container-page section grid gap-12 lg:grid-cols-12">
        <SectionHeading eyebrow="FAQ" measure="max-w-[10ch]" className="lg:col-span-4">
          Good <em>questions.</em>
        </SectionHeading>

        <div className="divide-y divide-line-strong border-y border-line-strong lg:col-span-8">
          {QUESTIONS.map((item) => (
            <details key={item.q} className="group py-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-left">
                <span className="text-lg font-medium tracking-tight text-ink">{item.q}</span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line-strong transition-transform duration-200 group-open:rotate-45">
                  <Plus className="h-4 w-4 text-ink" aria-hidden />
                </span>
              </summary>
              <p className="mt-4 max-w-[64ch] text-base leading-relaxed text-ink-dim">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
