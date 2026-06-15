"use client";

import Image from "next/image";
import { Pencil, ShoppingBag, User } from "lucide-react";
import { RichText } from "@/components/site/rich-text";
import { sectionsInSlot, type HomeContent, type HomeSlot } from "@/lib/content";
import { cn } from "@/lib/utils";

export type PreviewRegion =
  | "announcement"
  | "hero"
  | "marquee"
  | "categories"
  | "featured"
  | "sections"
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
      className="absolute right-2 top-2 z-20 inline-flex items-center gap-1 rounded-full bg-ink/85 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-peach shadow-lg ring-1 ring-white/20 transition-transform hover:scale-105"
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

// Promo bands for one slot. Always renders a hotspot so the admin can open the
// sections editor from any insertion point; shows a placeholder at the entry
// slot when nothing has been added yet.
function PromoSlotPreview({
  content,
  slot,
  editable,
  onEdit,
  showPlaceholder,
}: {
  content: PreviewModel;
  slot: HomeSlot;
  editable?: boolean;
  onEdit?: (r: PreviewRegion) => void;
  showPlaceholder?: boolean;
}) {
  const items = sectionsInSlot(content.sections, slot);
  if (items.length === 0 && !showPlaceholder) return null;
  return (
    <Region editable={editable}>
      <Hotspot label="Promo sections" region="sections" onEdit={onEdit} />
      {items.length > 0 ? (
        <div className="relative flex min-h-44 items-center justify-center overflow-hidden bg-ink">
          {items[0].image && (
            <Image
              src={items[0].image}
              alt=""
              fill
              sizes="100vw"
              className="object-cover opacity-70"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
          <div className="relative z-10 px-6 text-center">
            <p className="eyebrow text-ember">{items[0].eyebrow}</p>
            <p className="headline mt-1 text-3xl text-peach">
              <RichText text={items[0].heading} />
            </p>
            {items[0].body && (
              <p className="mx-auto mt-2 max-w-md text-xs text-peach/80">
                {items[0].body}
              </p>
            )}
            {items[0].buttonLabel && (
              <span className="mt-3 inline-block bg-ember px-4 py-1.5 subhead text-xs text-peach">
                {items[0].buttonLabel}
              </span>
            )}
          </div>
          {items.length > 1 && (
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
              {items.map((s, i) => (
                <span
                  key={s.id}
                  className={`h-1.5 rounded-full ${i === 0 ? "w-4 bg-ember" : "w-1.5 bg-peach/50"}`}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex min-h-28 items-center justify-center border-y border-dashed border-warmgrey bg-sand/50 text-center text-xs text-brown">
          + Add a promo section (image / video, words, button)
        </div>
      )}
    </Region>
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

      <PromoSlotPreview
        content={content}
        slot="afterHero"
        editable={editable}
        onEdit={onEdit}
      />

      {/* SHOP BY CATEGORY */}
      {((content.categories?.length ?? 0) > 0 || editable) && (
        <Region editable={editable}>
          <Hotspot label="Shop by category" region="categories" onEdit={onEdit} />
          {content.categories && content.categories.length > 0 ? (
            <div className="grid grid-cols-3 gap-1">
              {content.categories.slice(0, 3).map((cat) => (
                <div
                  key={cat.id}
                  className="relative flex aspect-[3/4] items-end overflow-hidden bg-ink p-3"
                >
                  {cat.image && (
                    <Image
                      src={cat.image}
                      alt=""
                      fill
                      sizes="33vw"
                      className="object-cover opacity-80"
                    />
                  )}
                  <span className="relative z-10 subhead text-xs uppercase tracking-[0.1em] text-peach">
                    {cat.label}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-24 items-center justify-center border-y border-dashed border-warmgrey bg-sand/50 text-center text-xs text-brown">
              + Add shop-by-category tiles
            </div>
          )}
        </Region>
      )}

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

      {/* PROMO SLOT — after featured (also the entry point) */}
      <PromoSlotPreview
        content={content}
        slot="afterFeatured"
        editable={editable}
        onEdit={onEdit}
        showPlaceholder
      />

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
          <div
            className={`relative flex min-h-56 flex-col justify-end overflow-hidden p-6 ${
              content.storyTile.image ? "bg-ink" : "bg-sand"
            }`}
          >
            {content.storyTile.image && (
              <Image
                src={content.storyTile.image}
                alt=""
                fill
                sizes="50vw"
                className="object-cover opacity-60"
              />
            )}
            <div className="relative z-10">
              <p className="eyebrow text-ember">{content.storyTile.eyebrow}</p>
              <p
                className={`headline mt-1 text-3xl ${
                  content.storyTile.image ? "text-peach" : ""
                }`}
              >
                <RichText text={content.storyTile.title} />
              </p>
              <p
                className={`mt-1 eyebrow ${
                  content.storyTile.image ? "text-peach/70" : "text-brown"
                }`}
              >
                {content.storyTile.linkLabel}
              </p>
            </div>
          </div>
        </Region>
      </section>

      <PromoSlotPreview
        content={content}
        slot="afterTiles"
        editable={editable}
        onEdit={onEdit}
      />

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

      <PromoSlotPreview
        content={content}
        slot="afterCommunity"
        editable={editable}
        onEdit={onEdit}
      />

      {/* footer skeleton */}
      <footer className="bg-ink px-6 py-10 text-peach">
        <p className="headline text-3xl tracking-[0.15em]">CRAZYWORK</p>
        <p className="mt-1 eyebrow text-ember">Wear What You Train For</p>
      </footer>
    </div>
  );
}
