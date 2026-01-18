"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { CheckIcon } from "lucide-react";

type CheckboxProps = React.ComponentProps<typeof CheckboxPrimitive.Root>;

function Checkbox({ className = "", ...props }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={[
        // base styles
        "peer size-4 shrink-0 rounded-[4px] border shadow-xs outline-none transition-shadow",
        "bg-white dark:bg-input/30",

        // checked state
        "data-[state=checked]:bg-[#00B948]",
        "data-[state=checked]:border-[#00B948]",
        "data-[state=checked]:text-white",

        // focus + invalid
        "focus-visible:ring-[3px] focus-visible:ring-[#00B948]/50",
        "aria-invalid:border-red-500 aria-invalid:ring-red-500/20",

        // disabled
        "disabled:cursor-not-allowed disabled:opacity-50",

        // allow overrides
        className,
      ].join(" ")}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current"
      >
        <CheckIcon className="h-3.5 w-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
