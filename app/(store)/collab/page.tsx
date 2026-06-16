import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/field";
import { Reveal } from "@/components/site/reveal";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Collabs",
  description:
    "CRAZYWORK collaborations — built with the gyms and athletes who do the work.",
};

async function getCollabs() {
  return prisma.contentPost.findMany({
    where: { type: "collab", published: true },
    orderBy: [{ featured: "desc" }, { publishedAt: "desc" }],
  });
}

export default async function CollabPage() {
  const collabs = await getCollabs();
  const featured = collabs.find((c) => c.featured) ?? collabs[0];
  const rest = featured ? collabs.filter((c) => c.id !== featured.id) : collabs;

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <p className="eyebrow text-ember">Collaborations</p>
      <h1 className="headline mt-1 text-7xl">Collabs</h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-brown">
        Built with the gyms, athletes and creators who put in the work. Limited
        runs, made together.
      </p>

      {collabs.length === 0 ? (
        <div className="mt-16 text-center">
          <h2 className="headline text-5xl text-warmgrey">
            Something&apos;s cooking.
          </h2>
          <p className="mt-4 text-sm text-brown">
            The next collaboration drops here. Watch this space.
          </p>
        </div>
      ) : (
        <>
          {/* FEATURED */}
          {featured && (
            <Reveal as="div" className="mt-10">
              <Link
                href={`/collab/${featured.slug}`}
                className="group grid border border-warmgrey transition-colors hover:border-ember md:grid-cols-2"
              >
                <div className="relative aspect-video bg-ink">
                  {featured.coverImageUrl && (
                    <Image
                      src={featured.coverImageUrl}
                      alt={featured.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="flex flex-col justify-center bg-sand/60 p-8 md:p-12">
                  <div className="flex items-center gap-3">
                    <Badge tone="outline">Collaboration</Badge>
                    <Badge tone="ember">Featured</Badge>
                  </div>
                  <h2 className="headline mt-4 text-4xl group-hover:text-ember">
                    {featured.title}
                  </h2>
                  {featured.excerpt && (
                    <p className="mt-4 text-sm leading-relaxed text-brown">
                      {featured.excerpt}
                    </p>
                  )}
                  <p className="mt-5 eyebrow text-ember">View collab →</p>
                </div>
              </Link>
            </Reveal>
          )}

          {/* GRID */}
          {rest.length > 0 && (
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {rest.map((collab, i) => (
                <Reveal key={collab.id} as="article" index={i}>
                  <Link
                    href={`/collab/${collab.slug}`}
                    className="group flex h-full flex-col border border-warmgrey bg-sand/40 transition-colors hover:border-ember"
                  >
                    <div className="relative aspect-video overflow-hidden bg-ink">
                      {collab.coverImageUrl && (
                        <Image
                          src={collab.coverImageUrl}
                          alt={collab.title}
                          fill
                          sizes="(max-width: 768px) 100vw, 33vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      )}
                    </div>
                    <div className="p-6">
                      <Badge tone="outline">Collaboration</Badge>
                      <h3 className="headline mt-3 text-2xl leading-tight group-hover:text-ember">
                        {collab.title}
                      </h3>
                      {collab.excerpt && (
                        <p className="mt-3 text-sm leading-relaxed text-brown">
                          {collab.excerpt}
                        </p>
                      )}
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
