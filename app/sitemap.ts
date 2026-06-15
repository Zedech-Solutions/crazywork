import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { getMindsetContent, mindsetArticleSlug } from "@/lib/content";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

  const [products, posts, mindset] = await Promise.all([
    prisma.product.findMany({
      where: { status: "active" },
      select: { slug: true, updatedAt: true },
    }),
    prisma.contentPost.findMany({
      where: { published: true, type: "blog" },
      select: { slug: true, updatedAt: true },
    }),
    getMindsetContent(),
  ]);

  const staticPages = [
    "",
    "/shop",
    "/drops",
    "/blog",
    "/collab",
    "/community",
    "/faq",
    "/our-story",
    "/mindset",
  ].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.7,
  }));

  return [
    ...staticPages,
    ...products.map((p) => ({
      url: `${base}/product/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    ...posts.map((p) => ({
      url: `${base}/blog/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...(mindset.articles ?? []).map((a) => ({
      url: `${base}/mindset/${mindsetArticleSlug(a)}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
