"use client";

import Image from "next/image";
import { Pencil, ShoppingBag, User } from "lucide-react";
import { RichText } from "@/components/site/rich-text";
import type { HomeContent } from "@/lib/content";
import { cn } from "@/lib/utils";

export type PreviewRegion =
  | "announcement"
  | "hero"
  | "marquee"
  | "featured"
  | "mindsetTile"
  | "storyTile"
  | "community";

// The model the preview renders: home content plus the site-wide announcement
// bar (a SiteSetting), so both are editable from the same builder.
export interface PreviewModel extends HomeContent {
  announcementBar: string;
}

// A faithful-enough skeleton of the home page, driven by HomeContent. When
// `editable`, each editable region shows a pencil hotspot that calls onEdit.
function Hotspot({
  label,
  region,
  onEdit,
}: {
  label: string;
  region: PreviewRegion;
  onEdit?: (r: PreviewRegion) => void;
}) {
  if (!onEdit) return null;
  return (
    <button
      type="button"
      onClick={() => onEdit(region)}
      className="absolute right-2 top-2 z-20 inline-flex items-center gap-1 rounded-full bg-ember px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-peach shadow-lg transition-transform hover:scale-105"
    >
      <Pencil size={11} /> {label}
    </button>
  );
}

function Region({
  children,
  className,
  editable,
}: {
  children: React.ReactNode;
  className?: string;
  editable?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative",
        editable &&
          "outline-2 outline-transparent transition-[outline-color] hover:outline-dashed hover:outline-ember/70",
        className,
      )}
    >
      {children}
    </div>
  );
}

const NAV = ["Shop", "Drops", "Collab", "Mindset", "Our Story", "Community", "Blog"];

export function HomePreview({
  content,
  editable = false,
  onEdit,
}: {
  content: PreviewModel;
  editable?: boolean;
  onEdit?: (region: PreviewRegion) => void;
}) {
  return (
    <div className="bg-peach font-body text-ink">
      {/* announcement bar (editable) */}
      <Region editable={editable}>
        <Hotspot label="Announcement" region="announcement" onEdit={onEdit} />
        <div className="bg-ember px-4 py-1.5 text-center text-[10px] font-bold uppercase tracking-[0.25em] text-peach">
          {content.announcementBar || "Free shipping over RM150"}
        </div>
      </Region>
      <header className="flex h-12 items-center justify-between border-b border-warmgrey px-4">
        <span className="headline text-lg tracking-[0.15em]">CRAZYWORK</span>
        <nav className="hidden gap-4 md:flex">
          {NAV.map((n) => (
            <span key={n} className="eyebrow text-[9px] text-ink">
              {n}
            </span>
          ))}
        </nav>
        <div className="flex gap-3 text-ink">
          <User size={15} />
          <ShoppingBag size={15} />
        </div>
      </header>

      {/* HERO */}
      <Region editable={editable}>
        <Hotspot label="Top banner" region="hero" onEdit={onEdit} />
        <section className="relative flex min-h-[60vh] items-end overflow-hidden bg-ink">
          {content.heroImage && (
            <Image
              src={content.heroImage}
              alt=""
              fill
              sizes="100vw"
              className="object-cover opacity-90"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
          <div className="relative z-10 w-full px-6 pb-10">
            <p className="eyebrow text-ember">{content.heroEyebrow}</p>
            <h1 className="headline mt-2 max-w-3xl text-5xl text-peach">
              <RichText text={content.heroHeadline} />
            </h1>
            <p className="mt-3 max-w-md text-sm text-peach/80">{content.heroSub}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="bg-ember px-5 py-2 subhead text-xs text-peach">
                {content.heroCtaPrimary.label}
              </span>
              <span className="border border-ember px-5 py-2 subhead text-xs text-ember">
                {content.heroCtaSecondary.label}
              </span>
            </div>
          </div>
        </section>
      </Region>

      {/* MARQUEE */}
      <Region editable={editable}>
        <Hotspot label="Scrolling banner" region="marquee" onEdit={onEdit} />
        <div className="flex gap-8 overflow-hidden border-y border-ink bg-ink py-2 text-peach">
          {content.marquee.map((m, i) => (
            <span key={i} className="subhead whitespace-nowrap text-xs tracking-[0.2em]">
              {m} <span className="ml-6 text-ember">·</span>
            </span>
          ))}
        </div>
      </Region>

      {/* FEATURED */}
      <Region editable={editable}>
        <Hotspot label="Section label" region="featured" onEdit={onEdit} />
        <section className="px-6 py-10">
          <p className="eyebrow text-ember">{content.featuredEyebrow}</p>
          <h2 className="headline mt-1 text-4xl">The Latest</h2>
          <div className="mt-5 grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-[4/5] rounded bg-warmgrey/40" />
            ))}
          </div>
        </section>
      </Region>

      {/* TILES */}
      <section className="grid border-y border-warmgrey md:grid-cols-2">
        <Region editable={editable}>
          <Hotspot label="Mindset tile" region="mindsetTile" onEdit={onEdit} />
          <div className="relative flex min-h-56 items-end overflow-hidden bg-ink p-6">
            {content.mindsetTile.image && (
              <Image
                src={content.mindsetTile.image}
                alt=""
                fill
                sizes="50vw"
                className="object-cover opacity-60"
              />
            )}
            <div className="relative z-10">
              <p className="eyebrow text-ember">{content.mindsetTile.eyebrow}</p>
              <p className="headline mt-1 text-3xl text-peach">
                <RichText text={content.mindsetTile.title} />
              </p>
              <p className="mt-1 eyebrow text-peach/70">
                {content.mindsetTile.linkLabel}
              </p>
            </div>
          </div>
        </Region>
        <Region editable={editable}>
          <Hotspot label="Our Story tile" region="storyTile" onEdit={onEdit} />
          <div className="flex min-h-56 flex-col justify-end bg-sand p-6">
            <p className="eyebrow text-ember">{content.storyTile.eyebrow}</p>
            <p className="headline mt-1 text-3xl">
              <RichText text={content.storyTile.title} />
            </p>
            <p className="mt-1 eyebrow text-brown">{content.storyTile.linkLabel}</p>
          </div>
        </Region>
      </section>

      {/* COMMUNITY */}
      <Region editable={editable}>
        <Hotspot label="Section label" region="community" onEdit={onEdit} />
        <section className="px-6 py-10">
          <p className="eyebrow text-ember">{content.communityEyebrow}</p>
          <h2 className="headline mt-1 text-4xl">{content.communityTitle}</h2>
          <div className="mt-5 grid grid-cols-5 gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="aspect-square rounded bg-warmgrey/40" />
            ))}
          </div>
        </section>
      </Region>

      {/* footer skeleton */}
      <footer className="bg-ink px-6 py-10 text-peach">
        <p className="headline text-3xl tracking-[0.15em]">CRAZYWORK</p>
        <p className="mt-1 eyebrow text-ember">Wear What You Train For</p>
      </footer>
    </div>
  );
}
