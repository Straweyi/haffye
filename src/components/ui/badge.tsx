import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
  {
    variants: {
      variant: {
        default: "bg-espresso text-cream",
        active: "bg-emerald-100 text-emerald-800",
        busy: "bg-amber-100 text-amber-800",
        offline: "bg-stone-200 text-stone-700",
        caramel: "bg-caramel/20 text-espresso",
        outline: "border border-coffee/25 bg-warm text-coffee",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}
