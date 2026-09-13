import Link from "next/link";
import { BrandMark } from "@/components/ui/BrandMark";
import { buttonStyles } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/** The close: one line, set large, and the two ways in. Then a quiet footer. */
export function ClosingCta() {
  return (
    <>
      <section className="bg-teal text-on-band">
        <div className="container-page section flex flex-col items-center text-center">
          <p className="eyebrow text-on-band/70">It calls the business that knows the answer</p>
          <h2 className="display mt-6 text-display-xl">
            Start <em>coordinating.</em>
          </h2>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
            <Link href="/ops" className={buttonStyles({ variant: "primary", size: "lg" })}>
              Open operations
            </Link>
            <Link
              href="/ops/simulator"
              className={cn(
                buttonStyles({ variant: "ghost", size: "lg" }),
                "border-on-band/30 text-on-band hover:not-disabled:bg-on-band/10 hover:not-disabled:text-on-band",
              )}
            >
              Place an order
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="container-page flex flex-wrap items-center gap-x-8 gap-y-4 py-8">
          <BrandMark />
          <p className="text-sm text-ink-dim">Built on CALL-E for the CALL-E hackathon, 2026.</p>
          <nav aria-label="Footer" className="ml-auto flex items-center gap-6 text-sm">
            <Link href="/ops" className="text-ink-dim transition-colors hover:text-ink">
              Orders
            </Link>
            <Link href="/ops/simulator" className="text-ink-dim transition-colors hover:text-ink">
              New order
            </Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
