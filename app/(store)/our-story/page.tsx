import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Media } from "@/components/site/media";
import { Parallax } from "@/components/site/parallax";
import { RichText } from "@/components/site/rich-text";
import { getOurStoryContent } from "@/lib/content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Our Story",
  description:
    "CRAZYWORK started in a Malaysian gym with a simple idea: wear what you train for. This is where it began.",
};

export default async function OurStoryPage() {
  const content = await getOurStoryContent();
  const paragraphs = content.body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <article className="pb-20">
      <div className="relative flex h-[55vh] min-h-80 items-end overflow-hidden bg-ink">
        {content.headerImage && (
          <Parallax>
            <Media
              src={content.headerImage}
              alt=""
              priority
              sizes="100vw"
              className="absolute inset-0 h-full w-full object-cover opacity-70"
            />
          </Parallax>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 to-transparent" />
        <header className="relative z-10 mx-auto w-full max-w-3xl px-4 pb-12 sm:px-6">
          <p className="eyebrow text-ember">{content.eyebrow}</p>
          <h1 className="headline mt-2 text-7xl text-peach">
            <RichText text={content.title} />
          </h1>
        </header>
      </div>

      <div className="mx-auto max-w-3xl space-y-6 px-4 pt-12 text-[15px] leading-[1.8] text-ink/85 sm:px-6">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        {content.quote && (
          <blockquote className="my-10 border-l-4 border-ember pl-6">
            <p className="headline text-3xl leading-tight">
              &ldquo;{content.quote}&rdquo;
            </p>
          </blockquote>
        )}
        {content.ctaLabel && (
          <div className="pt-6">
            <Button asChild variant="accent" size="lg">
              <Link href={content.ctaHref || "/shop"}>{content.ctaLabel}</Link>
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}
