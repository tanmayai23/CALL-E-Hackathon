/**
 * The argument, on ink: why a phone call at all (PRD v2.0 §4.3).
 * Beneath it, the kinds of coordination the same engine handles.
 */

const TASKS = [
  "Stock confirmation",
  "Partial fulfilment",
  "Dispatch dates",
  "Delivery follow-ups",
  "Price changes",
  "Callbacks",
  "Exceptions",
];

export function StatementBand() {
  return (
    <section className="bg-band text-on-band">
      <div className="container-page section grid gap-10 lg:grid-cols-12 lg:items-end">
        <h2 className="display text-display-m lg:col-span-7">
          The inventory record is not <em>the commitment.</em>
        </h2>
        <p className="max-w-[48ch] text-lg leading-relaxed text-on-band/75 lg:col-span-5">
          A system can say 200 cases are in stock. Only a person at the supplier can say 120 will leave today and 80
          tomorrow. Sentinel Ops gets that answer on the phone — and turns it into data an order can use.
        </p>
      </div>

      <div className="overflow-hidden border-t border-on-band/15 py-6" aria-hidden>
        <div className="animate-marquee flex w-max gap-10 whitespace-nowrap" style={{ ["--marquee-duration" as string]: "45s" }}>
          {[...TASKS, ...TASKS, ...TASKS, ...TASKS].map((task, i) => (
            <span key={i} className="flex items-center gap-10 text-on-band/60">
              <span className="display text-2xl italic">{task}</span>
              <span className="h-1.5 w-1.5 rounded-full bg-lilac" />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
