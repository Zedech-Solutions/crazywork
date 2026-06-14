import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Media } from "@/components/site/media";
import { Reveal } from "@/components/site/reveal";
import type { CategoryTile } from "@/lib/content";

// "Shop by category" row — full-bleed image tiles with a label + arrow. Renders
// nothing when no categories are configured.
export function CategoryTiles({ categories }: { categories: CategoryTile[] }) {
  const tiles = (categories ?? []).filter((c) => c.label || c.image);
  if (tiles.length === 0) return null;

  return (
    <section className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
      {tiles.map((tile, i) => (
        <Reveal
          key={tile.id}
          as="div"
          index={i}
          className="group relative aspect-[3/4] overflow-hidden bg-ink"
        >
          <Link href={tile.href || "/shop"} className="block h-full w-full">
            {tile.image && (
              <Media
                src={tile.image}
                alt={tile.label}
                sizes="(max-width: 640px) 100vw, 33vw"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-6">
              <span className="subhead text-lg uppercase tracking-[0.12em] text-peach">
                {tile.label}
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-peach/70 text-peach transition-colors group-hover:border-ember group-hover:bg-ember">
                <ArrowRight size={16} />
              </span>
            </div>
          </Link>
        </Reveal>
      ))}
    </section>
  );
}
