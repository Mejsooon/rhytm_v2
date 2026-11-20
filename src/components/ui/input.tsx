import * as React from "react";

import { cn } from "@/lib/utils";
import { FIELD } from "@/components/controls/field";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        FIELD,
        className,
      )}
      {...props}
    />
  );
}

export { Input };
