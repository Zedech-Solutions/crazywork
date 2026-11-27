import Link from "next/link";
import { categoryLinks } from "@/lib/categories";
import { cn } from "@/lib/utils";

const CHIP = "eyebrow px-3 py-1.5 border transition-colors";
const ON = "border-ink bg-ink text-peach";
const OFF = "border-warmgrey text-brown hover:border-ink";

// "All" + one chip per product category, shared by /shop and the category pages.
export function CategoryChips({
  values,
  active,
  allHref = "/shop",
}: {
  values: string[];
  active: string | null; // href of the current chip; null = "All"
  allHref?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link href={allHref} className={cn(CHIP, active ? OFF : ON)}>
        All
      </Link>
      {categoryLinks(values).map((c) => (
        <Link
          key={c.href}
          href={c.href}
          className={cn(CHIP, active === c.href ? ON : OFF)}
        >
          {c.label}
        </Link>
      ))}
    </div>
  );
}
