import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const button = cva(
  "inline-flex items-center justify-center gap-2 rounded-sm border font-medium " +
    "transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45",
  {
    variants: {
      variant: {
        primary:
          "border-state-active/50 bg-state-active/15 text-state-active " +
          "hover:not-disabled:bg-state-active/25 hover:not-disabled:border-state-active",
        neutral:
          "border-line-strong bg-elevated text-ink hover:not-disabled:border-ink-faint",
        ghost: "border-transparent text-ink-dim hover:not-disabled:text-ink hover:not-disabled:bg-elevated",
        danger:
          "border-state-critical/50 bg-state-critical/12 text-state-critical " +
          "hover:not-disabled:bg-state-critical/22 hover:not-disabled:border-state-critical",
      },
      size: {
        sm: "h-7 px-2.5 text-xs",
        md: "h-9 px-3.5 text-sm",
        lg: "h-11 px-5 text-sm",
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
