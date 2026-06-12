"use client";

import Image from "next/image";
import { RichText } from "@/components/site/rich-text";
import {
  Hotspot,
  PreviewChrome,
  Region,
} from "@/components/admin/preview-ui";
import type {
  DropsContent,
  FooterContent,
  MindsetContent,
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
