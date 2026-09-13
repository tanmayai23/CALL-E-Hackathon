import Link from "next/link";
import { BrandMark } from "@/components/ui/BrandMark";
import { buttonStyles } from "@/components/ui/Button";

const SECTIONS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#result", label: "Result" },
  { href: "#safety", label: "Safety" },
  { href: "#faq", label: "FAQ" },
];

/** A floating pill: brand, the page's sections, and the one way in. */
export function LandingNav() {
  return (
    <div className="sticky top-4 z-40 px-4">
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-[1040px] items-center gap-3 rounded-2xl border border-line bg-canvas/85 py-2 pl-5 pr-2 shadow-[var(--shadow-float)] backdrop-blur-md"
      >
        <Link href="/" aria-label="Sentinel Ops home">
          <BrandMark />
        </Link>

        <ul className="ml-4 hidden items-center gap-1 rounded-full bg-stone/60 p-1 md:flex">
          {SECTIONS.map((s) => (
            <li key={s.href}>
              <a
                href={s.href}
                className="block rounded-full px-3.5 py-1.5 text-sm text-ink-dim transition-colors hover:bg-panel hover:text-ink"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/ops/simulator"
            className="hidden rounded-md px-3 py-2 text-sm text-ink-dim transition-colors hover:text-ink sm:block"
          >
            Try a call
          </Link>
          <Link href="/ops" className={buttonStyles({ variant: "primary", size: "md" })}>
            Open operations
          </Link>
        </div>
      </nav>
    </div>
  );
}
