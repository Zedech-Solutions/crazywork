import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getPost(slug: string) {
  return prisma.contentPost.findFirst({
    where: { slug, type: "blog", published: true },
    include: { blocks: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Not found" };
  return {
    title: post.metaTitle ? { absolute: post.metaTitle } : post.title,
    description: post.metaDescription ?? post.excerpt ?? undefined,
    openGraph: {
      images: post.coverImageUrl ? [{ url: post.coverImageUrl }] : [],
      type: "article",
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const dateLabel = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString("en-MY", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Journal";

  return (
    <article className="pb-20">
      {post.coverImageUrl ? (
        <div className="relative flex min-h-[50vh] items-end overflow-hidden bg-ink py-12">
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
            <p className="eyebrow text-ember">{dateLabel}</p>
            <h1 className="headline mt-2 text-5xl text-peach sm:text-6xl">
              {post.title}
            </h1>
          </header>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl px-4 pt-14 sm:px-6">
          <p className="eyebrow text-ember">{dateLabel}</p>
          <h1 className="headline mt-2 text-5xl sm:text-6xl">{post.title}</h1>
        </div>
      )}
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="mt-12">
          <BlockRenderer blocks={post.blocks} />
        </div>
        <p className="mt-16 border-t border-warmgrey pt-6">
          <Link href="/blog" className="eyebrow text-brown hover:text-ember">
            ← All stories
          </Link>
        </p>
      </div>
    </article>
  );
}
