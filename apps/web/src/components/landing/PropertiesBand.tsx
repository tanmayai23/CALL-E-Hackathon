import { SectionHeading } from "./SectionHeading";

/**
 * Four figures on teal. Every one is a property the system enforces in code —
 * not an outcome we are claiming. A demo page is the last place to put a
 * number nobody measured.
 */
const PROPERTIES = [
  { figure: "90", unit: "sec", label: "Call ceiling", body: "Every call has a hard duration cap and a stop condition." },
  { figure: "3", unit: "rungs", label: "Contact ladder", body: "Primary, backup, supervisor — then a person, never a fourth call." },
  { figure: "0.70", unit: "", label: "Confidence floor", body: "Below it, a result is never applied to the order. A person decides." },
  { figure: "1", unit: "trace", label: "End to end", body: "One trace ID from the order event, through the call, to the update." },
];

export function PropertiesBand() {
  return (
    <section className="bg-teal text-on-band">
      <div className="container-page section">
        <SectionHeading eyebrow="Guardrails, in code" tone="band" measure="max-w-[18ch]">
          Built to be <em>trusted</em> on the phone.
        </SectionHeading>

        <dl className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PROPERTIES.map((p) => (
            <div key={p.label} className="flex flex-col rounded-xl border border-on-band/20 p-7">
              <dt className="text-sm text-on-band/70">{p.label}</dt>
              <dd className="mt-6">
                <span className="display-num text-display-m text-on-band">{p.figure}</span>
                {p.unit && <span className="ml-2 text-lg text-on-band/70">{p.unit}</span>}
              </dd>
              <dd className="mt-4 text-sm leading-relaxed text-on-band/75">{p.body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
