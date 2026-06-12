import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 subhead text-sm transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40 cursor-pointer whitespace-nowrap",
  {
    variants: {
      variant: {
        primary: "bg-ink text-peach hover:bg-ember",
        accent: "bg-ember text-peach hover:bg-ink",
        outline:
          "border border-ink text-ink hover:bg-ink hover:text-peach bg-transparent",
        ghost: "text-ink hover:text-ember bg-transparent",
        danger: "border border-red-700 text-red-700 hover:bg-red-700 hover:text-peach",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-11 px-6",
        lg: "h-14 px-10 text-base",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
