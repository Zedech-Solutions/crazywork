"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border border-warmgrey bg-white transition-colors cursor-pointer",
        "data-[state=checked]:border-ember data-[state=checked]:bg-ember",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/40",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="text-peach">
        <Check size={12} strokeWidth={3.5} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

// Checkbox + clickable label as one control. Orange tick when checked.
export function CheckboxField({
  checked,
  onCheckedChange,
  label,
  className,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2 text-sm", className)}>
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
      />
      <button
        type="button"
        onClick={() => onCheckedChange(!checked)}
        className="cursor-pointer select-none text-left"
      >
        {label}
      </button>
    </div>
  );
}
