import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/field";
import { Media } from "@/components/site/media";
import { Parallax } from "@/components/site/parallax";
import { Reveal } from "@/components/site/reveal";
import { RichText } from "@/components/site/rich-text";
import { getMindsetContent, mindsetArticleSlug } from "@/lib/content";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Mindset",
  description:
    "Fitness tips, motivation, transformation stories. Content that fuels your grind and builds the identity behind the clothing.",
};

const TAGS = ["All", "Training", "Mindset", "Transformation", "Nutrition", "Recovery"];

export default async function MindsetPage() {
  const content = await getMindsetContent();
  const articles = content.articles ?? [];
  const featured = articles.find((a) => a.featured) ?? articles[0];
  const rest = featured
    ? articles.filter((a) => a !== featured)
    : articles;

  return (
    <article className="pb-20">
      {/* HEADER — editable via admin Pages */}
      <header className="relative overflow-hidden bg-ink py-24">
        {content.headerImage && (
          <Parallax>
            <Media
              src={content.headerImage}
              alt=""
              priority
              sizes="100vw"
              className="absolute inset-0 h-full w-full object-cover opacity-30"
            />
          </Parallax>
        )}
        <Reveal className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6">
          <p className="eyebrow text-ember">{content.headerEyebrow}</p>
          <h1 className="headline mt-3 text-7xl text-peach sm:text-8xl">
            <RichText text={content.headerTitle} />
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-peach/70">
            {content.headerSub}
          </p>
        </Reveal>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* TAGS */}
        <div className="flex gap-2 overflow-x-auto py-8">
          {TAGS.map((tag) => (
            <span
              key={tag}
              className={`eyebrow whitespace-nowrap border px-4 py-2 ${
                tag === "All"
                  ? "border-ember bg-ember text-peach"
                  : "border-warmgrey text-brown"
              }`}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* FEATURED */}
        {featured && (
          <Reveal as="div">
            <Link
              href={`/mindset/${mindsetArticleSlug(featured)}`}
              className="group grid border border-warmgrey transition-colors hover:border-ember md:grid-cols-2"
            >
              <div className="relative aspect-video bg-ink">
                <Image
                  src={featured.image}
                  alt={featured.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-contain"
                />
              </div>
              <div className="flex flex-col justify-center bg-sand/60 p-8 md:p-12">
                <div className="flex items-center gap-3">
                  <Badge tone="outline">{featured.tag}</Badge>
                  <Badge tone="ember">Featured</Badge>
                  <span className="text-xs text-brown">{featured.readTime}</span>
                </div>
                <h2 className="headline mt-4 text-4xl group-hover:text-ember">
                  {featured.title}
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-brown">
                  {featured.excerpt}
                </p>
                <p className="mt-5 eyebrow text-ember">Read →</p>
              </div>
            </Link>
          </Reveal>
        )}

        {/* GRID */}
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {rest.map((article, i) => (
            <Reveal key={i} as="article" index={i}>
              <Link
                href={`/mindset/${mindsetArticleSlug(article)}`}
                className="group flex h-full flex-col border border-warmgrey bg-sand/40 transition-colors hover:border-ember"
              >
                <div className="relative aspect-video overflow-hidden bg-ink">
                  <Image
                    src={article.image}
                    alt={article.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-contain transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-3">
                    <Badge tone="outline">{article.tag}</Badge>
                    <span className="text-xs text-brown">{article.readTime}</span>
                  </div>
                  <h3 className="headline mt-3 text-2xl leading-tight group-hover:text-ember">
                    {article.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-brown">
                    {article.excerpt}
                  </p>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </article>
  );
}
