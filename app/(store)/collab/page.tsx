import type { Metadata } from "next";
import Image from "next/image";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getCollab() {
  return prisma.contentPost.findFirst({
    where: { type: "collab", published: true },
    include: { blocks: { orderBy: { sortOrder: "asc" } } },
    orderBy: { publishedAt: "desc" },
  });
}

export async function generateMetadata(): Promise<Metadata> {
  const post = await getCollab();
  return {
    title: post?.metaTitle ?? post?.title ?? "Collabs",
    description:
      post?.metaDescription ??
      post?.excerpt ??
      "CRAZYWORK collaborations — built with the gyms and athletes who do the work.",
  };
}

export default async function CollabPage() {
  const post = await getCollab();

  if (!post) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <p className="eyebrow text-ember">Collabs</p>
        <h1 className="headline mt-2 text-6xl text-warmgrey">
          Something&apos;s cooking.
        </h1>
        <p className="mt-4 text-sm text-brown">
          The next collaboration drops here. Watch this space.
        </p>
      </div>
    );
  }

  return (
    <article className="pb-20">
      {post.coverImageUrl ? (
        <div className="relative flex min-h-[55vh] items-end overflow-hidden bg-ink py-12">
          <Image
            src={post.coverImageUrl}
            alt={post.title}
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-85"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-transparent" />
          <header className="relative z-10 mx-auto w-full max-w-3xl px-4 sm:px-6">
            <p className="eyebrow text-ember">Collaboration</p>
            <h1 className="headline mt-2 text-5xl text-peach sm:text-6xl">
              {post.title}
            </h1>
          </header>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl px-4 pt-14 sm:px-6">
          <p className="eyebrow text-ember">Collaboration</p>
          <h1 className="headline mt-2 text-5xl sm:text-6xl">{post.title}</h1>
        </div>
      )}
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="mt-12">
          <BlockRenderer blocks={post.blocks} />
        </div>
      </div>
    </article>
  );
}
