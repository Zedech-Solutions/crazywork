import type { Metadata } from "next";
import Image from "next/image";
import { InstagramEmbed } from "@/components/site/instagram-embed";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Community",
  description:
    "Real customers, real work. The CRAZYWORK community — tag us to get featured.",
};

export default async function CommunityPage() {
  const [photos, settings] = await Promise.all([
    prisma.communityPhoto.findMany({
      where: { published: true },
      orderBy: { sortOrder: "asc" },
    }),
    getSettings(),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <p className="eyebrow text-ember">Our people</p>
      <h1 className="headline mt-1 text-7xl">The Community</h1>
      <p className="mt-3 max-w-md text-sm text-brown">
        No paid models. These are the people doing the work — in CRAZYWORK.
        {settings.socialInstagram ? " Tag us to get featured." : ""}
      </p>

      {photos.length === 0 ? (
        <p className="mt-12 text-sm text-brown">Photos coming — the work continues.</p>
      ) : (
        <div className="-mx-4 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
          {photos.map((photo) => (
            <figure
              key={photo.id}
              className="w-[88vw] shrink-0 snap-start sm:w-[360px]"
            >
              {photo.postUrl ? (
                // real Instagram post frame, caption collapsed
                <InstagramEmbed url={photo.postUrl} caption={photo.caption} />
              ) : (
                <>
                  <div className="relative aspect-[4/5] overflow-hidden bg-ink">
                    <Image
                      src={photo.imageUrl ?? ""}
                      alt={photo.caption ?? "CRAZYWORK community"}
                      fill
                      sizes="360px"
                      className="object-cover"
                    />
                  </div>
                  {photo.caption && (
                    <figcaption className="mt-1.5 text-xs text-brown">
                      {photo.caption}
                    </figcaption>
                  )}
                </>
              )}
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
