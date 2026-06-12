import type { Metadata } from "next";
import { ProductCard } from "@/components/site/product-card";
import { Reveal } from "@/components/site/reveal";
import { Badge } from "@/components/ui/field";
import { toCardProduct } from "@/lib/catalog";
import { getDropsContent } from "@/lib/content";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Drops",
  description:
    "CRAZYWORK drops — limited runs, released when they're ready. Browse the current drop and the archive.",
};

const STATUS_BADGE: Record<string, { label: string; tone: "ember" | "sand" | "ink" }> =
  {
    current: { label: "Live now", tone: "ember" },
    past: { label: "Past drop", tone: "sand" },
    soldout: { label: "Sold out", tone: "ink" },
  };

export default async function DropsPage() {
  const drops = await prisma.drop.findMany({
    include: {
      products: {
        where: { status: "active" },
        include: { variants: true, images: true, drop: true },
      },
    },
    orderBy: [{ status: "asc" }, { sortOrder: "asc" }],
  });
  const ordered = [
    ...drops.filter((d) => d.status === "current"),
    ...drops.filter((d) => d.status !== "current"),
  ];
  const content = await getDropsContent();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="headline text-6xl">{content.title}</h1>
      <p className="mt-2 max-w-md text-sm text-brown">{content.description}</p>

      {ordered.map((drop) => {
        const badge = STATUS_BADGE[drop.status];
        const archived = drop.status !== "current";
        return (
          <section key={drop.id} className="mt-14">
            <div className="flex items-center gap-3 border-b border-warmgrey pb-3">
              <h2 className="headline text-4xl">{drop.name}</h2>
              <Badge tone={badge.tone}>{badge.label}</Badge>
            </div>
            {drop.products.length === 0 ? (
              <p className="py-10 text-sm text-warmgrey">
                Pieces from this drop are no longer listed.
              </p>
            ) : (
              <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
                {drop.products.map((product, i) => {
                  const card = toCardProduct(product);
                  return (
                    <Reveal key={product.id} index={i % 6}>
                      <ProductCard
                        size="large"
                        product={
                          archived && drop.status === "soldout"
                            ? { ...card, soldOut: true }
                            : card
                        }
                      />
                    </Reveal>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
