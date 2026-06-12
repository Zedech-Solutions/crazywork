import { cn } from "@/lib/utils";

export function Marquee({
  items,
  className,
}: {
  items: string[];
  className?: string;
}) {
  const sequence = [...items, ...items];
  return (
    <div
      className={cn(
        "overflow-hidden border-y border-ink bg-ink py-2.5 text-peach",
        className,
      )}
    >
      <div className="flex w-max animate-marquee gap-10 whitespace-nowrap">
        {sequence.map((item, i) => (
          <span key={i} className="subhead text-sm tracking-[0.25em]">
            {item} <span className="ml-8 text-ember">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}
