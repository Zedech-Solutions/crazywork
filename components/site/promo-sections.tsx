"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Media } from "@/components/site/media";
import { Parallax } from "@/components/site/parallax";
import { Reveal } from "@/components/site/reveal";
import { RichText } from "@/components/site/rich-text";
import { sectionsInSlot, type HomeSection, type HomeSlot } from "@/lib/content";

function Slide({ section, active }: { section: HomeSection; active: boolean }) {
  return (
    <div
      aria-hidden={!active}
      className={`absolute inset-0 flex items-center justify-center transition-opacity duration-700 ${
        active ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      {section.image && (
        <Parallax>
          <Media
            src={section.image}
            alt=""
            sizes="100vw"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </Parallax>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/50 to-ink/20" />
      <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
        {section.eyebrow && (
          <p className="eyebrow text-ember">{section.eyebrow}</p>
        )}
        {section.heading && (
          <h2 className="headline mt-3 text-5xl text-peach sm:text-7xl">
            <RichText text={section.heading} />
          </h2>
        )}
        {section.body && (
          <p className="mx-auto mt-4 max-w-xl text-base text-peach/80">
            {section.body}
          </p>
        )}
        {section.buttonLabel && (
          <div className="mt-8">
            <Button asChild variant="accent" size="lg">
              <Link href={section.buttonHref || "/"}>{section.buttonLabel}</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function PromoSections({
  sections,
  slot,
}: {
  sections: HomeSection[];
  slot?: HomeSlot;
}) {
  const scoped = slot ? sectionsInSlot(sections, slot) : (sections ?? []);
  const slides = scoped.filter(
    (s) => s.image || s.heading || s.body || s.buttonLabel,
  );
  const [index, setIndex] = useState(0);
  const count = slides.length;

  useEffect(() => {
    if (count <= 1) return;
    const t = setInterval(() => setIndex((p) => (p + 1) % count), 6500);
    return () => clearInterval(t);
  }, [count]);

  if (count === 0) return null;
  const active = Math.min(index, count - 1);

  return (
    <Reveal
      as="section"
      y={40}
      className="relative h-[78vh] min-h-[420px] overflow-hidden bg-ink"
    >
      {slides.map((s, i) => (
        <Slide key={s.id} section={s} active={i === active} />
      ))}

      {count > 1 && (
        <>
          <button
            aria-label="Previous"
            onClick={() => setIndex((p) => (p - 1 + count) % count)}
            className="absolute left-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-ink/50 p-2 text-peach backdrop-blur transition-colors hover:bg-ember"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            aria-label="Next"
            onClick={() => setIndex((p) => (p + 1) % count)}
            className="absolute right-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-ink/50 p-2 text-peach backdrop-blur transition-colors hover:bg-ember"
          >
            <ChevronRight size={20} />
          </button>
          <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-2 rounded-full transition-all ${
                  i === active ? "w-6 bg-ember" : "w-2 bg-peach/50 hover:bg-peach"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </Reveal>
  );
}
