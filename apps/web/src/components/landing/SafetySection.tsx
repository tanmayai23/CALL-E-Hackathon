import { BadgeCheck, Octagon, Shield, UserCheck } from "lucide-react";
import { SectionHeading } from "./SectionHeading";

/** PRD v2.0 §17. Each line is a control enforced in code, not a promise in a prompt. */
const RULES = [
  {
    icon: BadgeCheck,
    title: "It says it is automated",
    body: "Every call opens by naming itself as an automated operations line. It never implies it is a person.",
  },
  {
    icon: UserCheck,
    title: "Only consented contacts",
    body: "It calls pre-registered business contacts, within their working hours, and withholds order details from anyone else.",
  },
  {
    icon: Shield,
    title: "It never agrees to terms",
    body: "It can negotiate logistics. It cannot accept a changed price, credit or legal terms — those go to a person.",
  },
  {
    icon: Octagon,
    title: "One switch stops everything",
    body: "The kill switch halts every call in progress and blocks new ones, from any screen.",
  },
];

export function SafetySection() {
  return (
    <section id="safety" className="scroll-mt-28 border-t border-line">
      <div className="container-page section grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <SectionHeading eyebrow="Safety" measure="max-w-[12ch]">
            Every call is <em>consented.</em>
          </SectionHeading>
          <p className="mt-6 max-w-[40ch] text-lg leading-relaxed text-ink-dim">
            These are real calls to real people. The limits are in the code, where a prompt cannot talk its way
            around them.
          </p>
        </div>

        <ul className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:col-span-7">
          {RULES.map((rule) => {
            const Icon = rule.icon;
            return (
              <li key={rule.title}>
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-stone">
                  <Icon className="h-4 w-4 text-ink" aria-hidden />
                </span>
                <h3 className="mt-5 text-lg font-semibold tracking-tight text-ink">{rule.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-dim">{rule.body}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
