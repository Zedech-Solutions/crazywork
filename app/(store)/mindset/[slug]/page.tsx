import type { Metadata } from "next";
import Link from "next/link";
import { Clock } from "lucide-react";
import { notFound } from "next/navigation";
import { getMindsetArticle, type MindsetBg } from "@/lib/content";

export const dynamic = "force-dynamic";

// Per-background text treatment. Classes are written out in full (no string
// interpolation) so Tailwind keeps them in the build.
const THEME: Record<MindsetBg, {
  page: string;
  muted: string;
  heading: string;
  quote: string;
  body: string;
  divider: string;
  back: string;
}> = {
  ink: {
    page: "bg-ink",
    muted: "text-peach/50",
    heading: "text-peach",
    quote: "text-peach/70",
    body: "text-peach/65",
    divider: "border-peach/15",
    back: "text-peach/50 hover:text-ember",
  },
  brown: {
    page: "bg-brown",
    muted: "text-peach/60",
    heading: "text-peach",
    quote: "text-peach/85",
    body: "text-peach/80",
    divider: "border-peach/20",
    back: "text-peach/60 hover:text-peach",
  },
  peach: {
    page: "bg-peach",
    muted: "text-brown",
    heading: "text-ink",
    quote: "text-brown",
    body: "text-brown",
    divider: "border-ink/15",
    back: "text-brown hover:text-ember",
  },
  sand: {
    page: "bg-sand",
    muted: "text-brown",
    heading: "text-ink",
    quote: "text-brown",
    body: "text-brown",
    divider: "border-ink/15",
    back: "text-brown hover:text-ember",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getMindsetArticle(slug);
  if (!article) return { title: "Not found" };
  return {
    title: article.title,
    description: article.excerpt,
    openGraph: {
      images: article.image ? [{ url: article.image }] : [],
      type: "article",
    },
  };
}

export default async function MindsetArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getMindsetArticle(slug);
  if (!article) notFound();

  const theme = THEME[article.bgColor] ?? THEME.ink;

  return (
    <article className={`${theme.page} ${theme.heading} py-16 sm:py-24`}>
      <div className="mx-auto w-full max-w-3xl px-5 sm:px-6">
        <div className="flex items-center gap-3 eyebrow">
          <span className="text-ember">{article.tag}</span>
          <span className={`flex items-center gap-1.5 ${theme.muted}`}>
            <Clock size={13} />
            {article.readTime}
          </span>
        </div>

        <h1 className={`headline mt-5 text-5xl leading-[0.95] sm:text-7xl ${theme.heading}`}>
          {article.title}
        </h1>

        <div className="mt-6 h-px w-16 bg-ember/60" />

        {article.excerpt && (
          <blockquote
            className={`mt-8 border-l-2 border-ember pl-5 text-lg leading-relaxed ${theme.quote}`}
          >
            {article.excerpt}
          </blockquote>
        )}

        <div className="mt-12 space-y-10">
          {(article.sections ?? []).map((section, i) => (
            <section key={i}>
              {section.heading && (
                <h2 className={`subhead text-2xl uppercase ${theme.heading}`}>
                  {section.heading}
                </h2>
              )}
              <div
                className={`mt-3 space-y-4 text-base leading-relaxed ${theme.body}`}
              >
                {section.body
                  .split(/\n{2,}/)
                  .map((para) => para.trim())
                  .filter(Boolean)
                  .map((para, j) => (
                    <p key={j}>{para}</p>
                  ))}
              </div>
            </section>
          ))}
        </div>

        <p className={`mt-16 border-t ${theme.divider} pt-6`}>
          <Link href="/mindset" className={`eyebrow ${theme.back}`}>
            ← All articles
          </Link>
        </p>
      </div>
    </article>
  );
}
