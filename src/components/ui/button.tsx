import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-transparent text-sm leading-none font-medium whitespace-nowrap transition-[box-shadow,background-color,color] duration-150 outline-none focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-[.64] disabled:shadow-none aria-disabled:cursor-not-allowed aria-disabled:opacity-[.64] aria-disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-primary bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,.16),0_1px_2px_rgba(38,38,38,.24)] hover:bg-primary-hover",
        destructive:
          "border-destructive bg-destructive text-white shadow-[inset_0_1px_0_rgba(255,255,255,.16),0_1px_2px_rgba(239,68,68,.24)] hover:bg-destructive-hover",
        outline:
          "border-input bg-white shadow-btn hover:bg-panel",
        secondary: "bg-muted text-foreground hover:bg-black/[.07]",
        ghost: "hover:bg-accent aria-expanded:bg-accent",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 px-[11px] max-[799px]:h-11",
        sm: "h-7 gap-1.5 px-[9px] max-[799px]:h-10",
        lg: "h-9 px-[13px] max-[799px]:h-11",
        icon: "size-8 max-[799px]:size-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
