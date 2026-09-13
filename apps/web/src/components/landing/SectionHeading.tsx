import { cn } from "@/lib/utils";

/**
 * Every landing section opens the same way: a small eyebrow, then a serif
 * headline whose last phrase is set in italic. One pattern, so the page reads
 * as one voice from top to bottom.
 */
export function SectionHeading({
  eyebrow,
  children,
  align = "left",
  tone = "ink",
  measure,
  className,
}: {
  eyebrow: string;
  children: React.ReactNode;
  align?: "left" | "center";
  /** `band` for headings on the ink or teal bands. */
  tone?: "ink" | "band";
  /**
   * Line length of the headline, e.g. `max-w-[16ch]`. Applied to the `h2`
   * itself so `ch` is measured in the display face, not the 14px body.
   */
  measure?: string;
  /** Placement of the whole block — grid spans and the like. */
  className?: string;
}) {
  return (
    <div className={cn(align === "center" && "mx-auto text-center", className)}>
      <p className={cn("eyebrow", tone === "band" && "text-on-band/70")}>{eyebrow}</p>
      <h2
        className={cn(
          "display mt-4 text-display-m",
          tone === "band" ? "text-on-band" : "text-ink",
          measure,
          align === "center" && "mx-auto",
        )}
      >
        {children}
      </h2>
    </div>
  );
}
