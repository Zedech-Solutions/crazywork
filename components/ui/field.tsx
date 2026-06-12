import { cn } from "@/lib/utils";

const base =
  "w-full border border-warmgrey bg-white/60 px-3 py-2.5 text-sm text-ink placeholder:text-brown/60 focus:outline-none focus:border-ink transition-colors";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(base, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(base, "min-h-24", className)} {...props} />;
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(base, "appearance-none", className)} {...props}>
      {children}
    </select>
  );
}

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("eyebrow text-brown block mb-1.5", className)}
      {...props}
    />
  );
}

export function Badge({
  className,
  tone = "ink",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "ink" | "ember" | "sand" | "outline";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em]",
        tone === "ink" && "bg-ink text-peach",
        tone === "ember" && "bg-ember text-peach",
        tone === "sand" && "bg-sand text-brown",
        tone === "outline" && "border border-warmgrey text-brown",
        className,
      )}
      {...props}
    />
  );
}
