import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * One primary action per view, in lilac with an ink border. Everything else is
 * neutral or ghost. The primary lifts onto an ink offset on hover — a small,
 * tactile confirmation that it is the thing to press.
 */
const button = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium " +
    "transition-[transform,box-shadow,background-color,border-color,color] duration-150 " +
    "disabled:cursor-not-allowed disabled:opacity-45",
  {
    variants: {
      variant: {
        primary:
          "border-2 border-on-lilac bg-lilac font-semibold text-on-lilac " +
          "hover:not-disabled:-translate-x-px hover:not-disabled:-translate-y-px " +
          "hover:not-disabled:shadow-[3px_3px_0_0_var(--on-lilac)]",
        neutral:
          "border border-line-strong bg-panel text-ink " +
          "hover:not-disabled:border-ink-faint hover:not-disabled:bg-elevated",
        ghost:
          "border border-transparent text-ink-dim " +
          "hover:not-disabled:bg-stone/60 hover:not-disabled:text-ink",
        danger:
          "border border-state-critical/45 bg-state-critical/10 text-state-critical " +
          "hover:not-disabled:border-state-critical hover:not-disabled:bg-state-critical/15",
        success:
          "border border-state-success/45 bg-state-success/10 text-state-success " +
          "hover:not-disabled:border-state-success hover:not-disabled:bg-state-success/15",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: { variant: "neutral", size: "md" },
  },
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof button>;

export function Button({ variant, size, className, ...props }: ButtonProps) {
  return <button className={cn(button({ variant, size }), className)} {...props} />;
}

export { button as buttonStyles };
