import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "pending", label: "Pending" },
  { key: "paid", label: "Paid" },
  { key: "processing", label: "Processing" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
] as const;

// Horizontal stepper showing where an order is in the fulfilment flow.
export function OrderProgress({ status }: { status: string }) {
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
        <X size={15} /> Order cancelled
      </div>
    );
  }

  const current = STEPS.findIndex((s) => s.key === status);
  return (
    <div className="flex items-start">
      {STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        const last = i === STEPS.length - 1;
        return (
          <div
            key={step.key}
            className="relative flex flex-1 flex-col items-center"
          >
            {!last && (
              <span
                className={cn(
                  "absolute left-1/2 top-3.5 -z-0 h-0.5 w-full -translate-y-1/2",
                  done ? "bg-ember" : "bg-warmgrey/40",
                )}
              />
            )}
            <span
              className={cn(
                "relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold",
                done
                  ? "border-ember bg-ember text-peach"
                  : active
                    ? "border-ember bg-peach text-ember"
                    : "border-warmgrey bg-peach text-warmgrey",
              )}
            >
              {done ? <Check size={14} /> : i + 1}
            </span>
            <span
              className={cn(
                "mt-1.5 whitespace-nowrap text-[10px] uppercase tracking-[0.1em]",
                active
                  ? "font-bold text-ember"
                  : done
                    ? "text-ink"
                    : "text-warmgrey",
              )}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
