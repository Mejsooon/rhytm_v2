import * as React from "react";

import { cn } from "@/lib/utils";
import { FIELD } from "@/components/controls/field";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // FIELD ma już na telefonie font 16 px (iOS nie powiększa strony) i wysokość 44 px
        FIELD,
        className,
      )}
      {...props}
    />
  );
}

export { Input };
