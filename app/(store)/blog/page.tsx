import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Training, mindset and behind-the-drop stories from CRAZYWORK. Raw and direct — no motivational poster clichés.",
};

export default async function BlogIndexPage() {
  const posts = await prisma.contentPost.findMany({
    where: { type: "blog", published: true },
    orderBy: { publishedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <p className="eyebrow text-ember">Journal</p>
      <h1 className="headline mt-1 text-7xl">The Blog</h1>

      {posts.length === 0 ? (
        <p className="mt-12 text-sm text-brown">Stories loading — check back.</p>
      ) : (
        <div className="mt-12 space-y-14">
          {posts.map((post, index) => (
            <article key={post.id}>
              <Link
                href={`/blog/${post.slug}`}
                className={`group grid gap-6 md:grid-cols-2 ${
                  index % 2 === 1 ? "md:[direction:rtl]" : ""
                }`}
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-ink [direction:ltr]">
                  {post.coverImageUrl && (
                    <Image
                      src={post.coverImageUrl}
                      alt={post.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                    />
                  )}
                </div>
                <div className="flex flex-col justify-center [direction:ltr]">
                  {post.publishedAt && (
                    <p className="eyebrow text-warmgrey">
                      {new Date(post.publishedAt).toLocaleDateString("en-MY", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  )}
                  <h2 className="headline mt-2 text-4xl group-hover:text-ember">
                    {post.title}
                  </h2>
                  {post.excerpt && (
                    <p className="mt-3 text-sm leading-relaxed text-brown">
                      {post.excerpt}
                    </p>
                  )}
                  <p className="mt-4 eyebrow text-ember">Read →</p>
                </div>
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
