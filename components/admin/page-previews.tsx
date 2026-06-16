"use client";

import Image from "next/image";
import { RichText } from "@/components/site/rich-text";
import {
  Hotspot,
  PreviewChrome,
  Region,
} from "@/components/admin/preview-ui";
import type {
  CheckoutSuccessContent,
  DropsContent,
  FooterContent,
  MindsetContent,
  OurStoryContent,
} from "@/lib/content";

type PreviewProps<T> = {
  content: T;
  editable?: boolean;
  onEdit?: (region: string) => void;
};

export function MindsetPreview({
  content,
  editable,
  onEdit,
}: PreviewProps<MindsetContent>) {
  return (
    <div className="bg-peach font-body text-ink">
      <PreviewChrome />
      <Region editable={editable}>
        <Hotspot label="Header" region="header" onEdit={onEdit} />
        <header className="relative overflow-hidden bg-ink py-20">
          {content.headerImage && (
            <Image
              src={content.headerImage}
              alt=""
              fill
              sizes="100vw"
              className="object-cover opacity-30"
            />
          )}
          <div className="relative z-10 px-6">
            <p className="eyebrow text-ember">{content.headerEyebrow}</p>
            <h1 className="headline mt-2 text-6xl text-peach">
              <RichText text={content.headerTitle} />
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-peach/70">
              {content.headerSub}
            </p>
          </div>
        </header>
      </Region>
      <Region editable={editable}>
        <Hotspot label="Stories" region="stories" onEdit={onEdit} />
        <div className="px-6 py-8">
          <div className="grid grid-cols-3 gap-4">
            {(content.articles ?? []).slice(0, 6).map((a, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-lg border border-warmgrey bg-sand/40"
              >
                <div className="relative aspect-video bg-ink">
                  {a.image && (
                    <Image
                      src={a.image}
                      alt=""
                      fill
                      sizes="33vw"
                      className="object-contain"
                    />
                  )}
                  {a.featured && (
                    <span className="absolute left-1.5 top-1.5 rounded bg-ember px-1.5 py-0.5 text-[8px] font-bold text-peach">
                      FEATURED
                    </span>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-brown">
                    {a.tag} · {a.readTime}
                  </p>
                  <p className="mt-1 text-xs font-bold leading-tight">
                    {a.title}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Region>
    </div>
  );
}

export function OurStoryPreview({
  content,
  editable,
  onEdit,
}: PreviewProps<OurStoryContent>) {
  const paragraphs = (content.body ?? "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <div className="bg-peach font-body text-ink">
      <PreviewChrome />
      <Region editable={editable}>
        <Hotspot label="Story" region="story" onEdit={onEdit} />
        <div className="relative flex h-56 items-end overflow-hidden bg-ink">
          {content.headerImage && (
            <Image
              src={content.headerImage}
              alt=""
              fill
              sizes="100vw"
              className="object-cover opacity-70"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink/80 to-transparent" />
          <div className="relative z-10 px-6 pb-5">
            <p className="eyebrow text-ember">{content.eyebrow}</p>
            <h1 className="headline mt-1 text-4xl text-peach">
              <RichText text={content.title} />
            </h1>
          </div>
        </div>
        <div className="space-y-3 px-6 py-6 text-sm leading-relaxed text-ink/80">
          {paragraphs.slice(0, 3).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          {content.quote && (
            <blockquote className="my-4 border-l-4 border-ember pl-4">
              <p className="headline text-xl leading-tight">
                &ldquo;{content.quote}&rdquo;
              </p>
            </blockquote>
          )}
          {content.ctaLabel && (
            <span className="inline-block rounded bg-ember px-3 py-1.5 text-xs font-bold text-peach">
              {content.ctaLabel}
            </span>
          )}
        </div>
      </Region>
    </div>
  );
}

export function DropsPreview({
  content,
  editable,
  onEdit,
}: PreviewProps<DropsContent>) {
  return (
    <div className="bg-peach font-body text-ink">
      <PreviewChrome />
      <div className="px-6 py-10">
        <Region editable={editable}>
          <Hotspot label="Intro" region="intro" onEdit={onEdit} />
          <h1 className="headline text-6xl">{content.title}</h1>
          <p className="mt-2 max-w-md text-sm text-brown">
            {content.description}
          </p>
        </Region>
        <div className="mt-10">
          <div className="flex items-center gap-3 border-b border-warmgrey pb-3">
            <span className="headline text-3xl">Drop 01 — Foundation</span>
            <span className="rounded bg-ember px-2 py-0.5 text-[10px] font-bold text-peach">
              LIVE NOW
            </span>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded bg-warmgrey/40" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CheckoutSuccessPreview({
  content,
  editable,
  onEdit,
}: PreviewProps<CheckoutSuccessContent>) {
  const hasImage = Boolean(content.backgroundImage);
  return (
    <div className="bg-peach font-body text-ink">
      <PreviewChrome />
      <Region editable={editable}>
        <Hotspot label="Success" region="success" onEdit={onEdit} />
        <div className="relative flex min-h-[440px] items-center justify-center overflow-hidden p-8">
          {hasImage ? (
            <Image
              src={content.backgroundImage}
              alt=""
              fill
              sizes="600px"
              className="scale-110 object-cover blur-2xl brightness-95"
            />
          ) : (
            <div className="absolute inset-0 bg-white">
              <div className="absolute left-1/2 top-1/3 h-52 w-52 -translate-x-1/2 rounded-full bg-ember/25 blur-3xl" />
              <div className="absolute bottom-0 right-1/4 h-40 w-40 rounded-full bg-sand/60 blur-3xl" />
            </div>
          )}
          <div className="relative w-full max-w-sm rounded-2xl border border-ink/10 bg-white/60 px-6 py-9 text-center shadow-xl backdrop-blur-md">
            <p className="eyebrow text-[10px] text-ember">Order confirmed</p>
            <p className="headline mt-1 text-4xl text-ink">
              {content.heading || "Earned."}
            </p>
            <p className="mt-2 text-xs text-brown">
              Order <span className="font-bold text-ink">CW-260614-XXXX</span> is
              in. {content.subheading}
            </p>
          </div>
        </div>
      </Region>
    </div>
  );
}

export function FooterPreview({
  content,
  editable,
  onEdit,
}: PreviewProps<FooterContent>) {
  return (
    <div className="flex min-h-full flex-col bg-peach font-body text-ink">
      <PreviewChrome />
      <div className="flex flex-1 items-center justify-center px-6 py-16 text-center text-sm text-warmgrey">
        The footer shows at the bottom of every page. Edit it below.
      </div>
      <Region editable={editable}>
        <Hotspot label="Footer" region="footer" onEdit={onEdit} />
        <footer className="bg-ink px-6 py-10 text-peach">
          <div className="grid gap-8 md:grid-cols-[2fr_1fr_1fr_1fr]">
            <div>
              <p className="headline text-3xl tracking-[0.15em]">CRAZYWORK</p>
              <p className="mt-1 eyebrow text-ember">{content.tagline}</p>
              <p className="mt-3 max-w-xs text-xs text-peach/60">
                {content.blurb}
              </p>
            </div>
            {["Shop", "Help", "Brand"].map((col) => (
              <div key={col}>
                <p className="eyebrow mb-3 text-ember">{col}</p>
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-2 w-16 rounded bg-peach/20" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </footer>
      </Region>
    </div>
  );
}
