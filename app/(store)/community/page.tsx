import type { Metadata } from "next";
import { CommunityCard } from "@/components/site/community-card";
import { Reveal } from "@/components/site/reveal";
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
        <div className="mt-10 flex flex-wrap items-start justify-center gap-5 sm:justify-start">
          {photos.map((photo, i) => (
            <Reveal
              key={photo.id}
              as="article"
              index={i}
              className="w-full max-w-[340px]"
            >
              <CommunityCard item={photo} showCaption />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
