import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Our Story",
  description:
    "CRAZYWORK started in a Malaysian gym with a simple idea: wear what you train for. This is where it began.",
};

export default function OurStoryPage() {
  return (
    <article className="pb-20">
      <div className="relative flex h-[55vh] min-h-80 items-end bg-ink">
        <Image
          src="/images/story.svg"
          alt="An empty gym before sunrise"
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 to-transparent" />
        <header className="relative z-10 mx-auto w-full max-w-3xl px-4 pb-12 sm:px-6">
          <p className="eyebrow text-ember">Our Story</p>
          <h1 className="headline mt-2 text-7xl text-peach">
            Built in Malaysia. Rep by rep.
          </h1>
        </header>
      </div>

      <div className="mx-auto max-w-3xl space-y-6 px-4 pt-12 text-[15px] leading-[1.8] text-ink/85 sm:px-6">
        <p>
          CRAZYWORK didn&apos;t start in a boardroom. It started at 5:47am in a
          half-lit gym in the Klang Valley, between sets, with a simple
          observation: the people doing the real work were wearing gear made for
          people who don&apos;t.
        </p>
        <p>
          So we made our own. Heavyweight fabric that survives the wash. Cuts
          that move with a body that trains. No slogans we haven&apos;t lived.
          Small runs, made properly, released when they&apos;re ready — that&apos;s
          why we do drops, not seasons.
        </p>
        <blockquote className="my-10 border-l-4 border-ember pl-6">
          <p className="headline text-3xl leading-tight">
            &ldquo;We don&apos;t celebrate where you&apos;re going. We celebrate
            that you showed up.&rdquo;
          </p>
        </blockquote>
        <p>
          The name says it plainly. Crazy work — the kind people call crazy
          until they see the results. If you know that feeling, you&apos;re
          already one of us.
        </p>
        <p>
          We&apos;re still small. Still Malaysian. Still packing orders ourselves
          and reading every message. That&apos;s not a limitation — that&apos;s
          the point.
        </p>
        <div className="pt-6">
          <Button asChild variant="accent" size="lg">
            <Link href="/shop">Wear what you train for →</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
