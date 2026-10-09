import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-xs font-medium [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "text-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        warning: "border-transparent bg-warning-soft text-warning",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/** Badge colorat după o culoare hex din setări (status lead, stadiu proiect). */
function ColorBadge({ color, children, className }: { color: string; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn("inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium", className)}
      style={{ backgroundColor: `${color}1f`, color }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {children}
    </span>
  );
}

export { Badge, ColorBadge, badgeVariants };
