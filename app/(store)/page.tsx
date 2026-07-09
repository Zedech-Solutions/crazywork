import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CountdownTimer } from "@/components/site/countdown-timer";
import { HeroParallax } from "@/components/site/hero-parallax";
import { Marquee } from "@/components/site/marquee";
import { CategoryTiles } from "@/components/site/category-tiles";
import { CommunityCard } from "@/components/site/community-card";
import { DropTeaser } from "@/components/site/drop-teaser";
import { NotifyMe } from "@/components/site/notify-me";
import { Media } from "@/components/site/media";
import { Parallax } from "@/components/site/parallax";
import { ProductCard } from "@/components/site/product-card";
import { PromoSections } from "@/components/site/promo-sections";
import { Reveal } from "@/components/site/reveal";
import { RichText } from "@/components/site/rich-text";
import { activeProducts, toCardProduct } from "@/lib/catalog";
import { getHomeContent } from "@/lib/content";
import { prisma } from "@/lib/db";
import { getSetting } from "@/lib/settings";

export const revalidate = 60;

export default async function HomePage() {
  const [content, featuredDrops, communityPhotos, notifyEnabled] =
    await Promise.all([
      getHomeContent(),
    // Drops the admin chose to feature — any status (current / past / soldout) —
    // stacked in the saved drag order.
    prisma.drop.findMany({
      where: { featuredOnHome: true },
      orderBy: { sortOrder: "asc" },
      include: {
        products: {
          where: { status: "active" },
          include: { variants: true, images: true, drop: true },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.communityPhoto.findMany({
      where: {
        published: true,
        OR: [{ imageUrl: { not: null } }, { postUrl: { not: null } }],
      },
      orderBy: { sortOrder: "asc" },
      take: 6,
    }),
    getSetting("emailDropLaunch"),
  ]);

  // One section per featured drop. When the admin hasn't featured anything, fall
  // back to a single "The Latest" section of all active products so the home
  // page is never empty.
  const dropSections = featuredDrops.length
    ? featuredDrops.map((d) => ({
        id: d.id,
        name: d.name,
        status: d.status,
        countdownUntil: d.countdownUntil ? d.countdownUntil.toISOString() : null,
        products: d.products,
      }))
    : [
        {
          id: "latest",
          name: "The Latest",
          status: "current" as const,
          countdownUntil: null,
          products: await activeProducts(),
        },
      ];

  const dropEyebrow = (status: string, isFirst: boolean) =>
    status === "upcoming"
      ? "Upcoming"
      : status === "soldout"
        ? "Sold out"
        : status === "past"
          ? "Past drop"
          : isFirst
            ? content.featuredEyebrow
            : "Featured drop";

  return (
    <>
      {/* HERO */}
      {/* fills the viewport below the announcement bar (~32px) + navbar (56px) */}
      <section className="relative flex min-h-[calc(100svh-88px)] items-end overflow-hidden bg-ink">
        <HeroParallax
          src={content.heroImage}
          alt="CRAZYWORK hero"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6">
          <p className="eyebrow animate-rise text-ember">{content.heroEyebrow}</p>
          <h1
            className="headline mt-3 max-w-4xl text-5xl text-peach animate-rise sm:text-7xl lg:text-8xl"
            style={{ animationDelay: "0.1s" }}
          >
            <RichText text={content.heroHeadline} />
          </h1>
          <p
            className="mt-5 max-w-md text-base text-peach/80 animate-rise"
            style={{ animationDelay: "0.15s" }}
          >
            {content.heroSub}
          </p>
          <div
            className="mt-8 flex flex-wrap gap-3 animate-rise"
            style={{ animationDelay: "0.2s" }}
          >
            <Button asChild variant="accent" size="lg">
              <Link href={content.heroCtaPrimary.href}>
                {content.heroCtaPrimary.label}
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="border border-ember bg-transparent text-ember hover:bg-ember hover:text-peach"
            >
              <Link href={content.heroCtaSecondary.href}>
                {content.heroCtaSecondary.label}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <Marquee items={content.marquee} />

      <PromoSections sections={content.sections} slot="afterHero" />

      {/* SHOP BY CATEGORY — renders nothing if no categories configured */}
      <CategoryTiles categories={content.categories} />

      {/* FEATURED DROPS — one stacked section per drop the admin featured */}
      {dropSections.map((section, si) => (
        <section
          key={section.id}
          className="mx-auto max-w-7xl px-4 pt-16 sm:px-6"
        >
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow text-ember">
                {dropEyebrow(section.status, si === 0)}
              </p>
              <h2 className="headline mt-1 text-5xl">{section.name}</h2>
            </div>
            {section.countdownUntil &&
              new Date(section.countdownUntil).getTime() > Date.now() && (
                <CountdownTimer until={section.countdownUntil} label="Starts in" />
              )}
          </div>
          {section.status === "upcoming" && notifyEnabled && (
            <div className="mb-8">
              <NotifyMe dropId={section.id} dropName={section.name} />
            </div>
          )}
          {section.products.length === 0 ? (
            section.status === "upcoming" ? (
              <DropTeaser />
            ) : (
              <p className="py-6 text-sm text-warmgrey">
                Pieces from this drop are no longer listed.
              </p>
            )
          ) : (
            // Centered cards so a sparse drop (1–2 items) isn't stuck in the
            // left corner; a full row still lays out 2-up / 3-up.
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-10">
              {section.products.slice(0, 6).map((product, i) => {
                const card = toCardProduct(product);
                return (
                  <Reveal
                    key={product.id}
                    index={i}
                    className="w-[calc(50%-0.625rem)] md:w-[calc(33.333%-0.834rem)]"
                  >
                    <ProductCard
                      product={
                        section.status === "soldout"
                          ? { ...card, soldOut: true }
                          : card
                      }
                    />
                  </Reveal>
                );
              })}
            </div>
          )}
        </section>
      ))}
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-10 text-center sm:px-6">
        <Button asChild variant="outline">
          <Link href="/shop">View all</Link>
        </Button>
      </div>

      {/* PROMO SECTIONS — admin-managed bands / carousel, per slot */}
      <PromoSections sections={content.sections} slot="afterFeatured" />

      {/* SPLIT EDITORIAL */}
      <section className="border-y border-warmgrey">
        <div className="grid md:grid-cols-2">
          <Link
            href={content.mindsetTile.href}
            className="group relative flex min-h-72 items-end overflow-hidden bg-ink p-8"
          >
            <Parallax amount={45}>
              <Media
                src={content.mindsetTile.image}
                alt={content.mindsetTile.eyebrow}
                sizes="(max-width: 768px) 100vw, 50vw"
                className="absolute inset-0 h-full w-full object-cover opacity-60"
              />
            </Parallax>
            <div className="relative z-10">
              <p className="eyebrow text-ember">{content.mindsetTile.eyebrow}</p>
              <p className="headline mt-1 text-4xl text-peach">
                <RichText text={content.mindsetTile.title} />
              </p>
              <p className="mt-2 eyebrow text-peach/70 group-hover:text-ember">
                {content.mindsetTile.linkLabel}
              </p>
            </div>
          </Link>
          <Link
            href={content.storyTile.href}
            className={`group relative flex min-h-72 flex-col justify-end overflow-hidden p-8 ${
              content.storyTile.image ? "bg-ink" : "bg-sand"
            }`}
          >
            {content.storyTile.image && (
              <Parallax amount={45}>
                <Media
                  src={content.storyTile.image}
                  alt={content.storyTile.eyebrow}
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="absolute inset-0 h-full w-full object-cover opacity-60"
                />
              </Parallax>
            )}
            <div className="relative z-10">
              <p className="eyebrow text-ember">{content.storyTile.eyebrow}</p>
              <p
                className={`headline mt-1 text-4xl ${
                  content.storyTile.image ? "text-peach" : ""
                }`}
              >
                <RichText text={content.storyTile.title} />
              </p>
              <p
                className={`mt-2 eyebrow group-hover:text-ember ${
                  content.storyTile.image ? "text-peach/70" : "text-brown"
                }`}
              >
                {content.storyTile.linkLabel}
              </p>
            </div>
          </Link>
        </div>
      </section>

      <PromoSections sections={content.sections} slot="afterTiles" />

      {/* COMMUNITY */}
      {communityPhotos.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow text-ember">{content.communityEyebrow}</p>
              <h2 className="headline mt-1 text-4xl sm:text-5xl">
                {content.communityTitle}
              </h2>
            </div>
            <Link
              href="/community"
              className="eyebrow shrink-0 text-brown hover:text-ember"
            >
              See all →
            </Link>
          </div>
          {/* Equal-height cards — same treatment as the /community page. */}
          <div className="flex flex-wrap items-start justify-center gap-5">
            {communityPhotos.map((photo, i) => (
              <Reveal
                key={photo.id}
                as="article"
                index={i}
                className="w-full max-w-[340px]"
              >
                <CommunityCard item={photo} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      <PromoSections sections={content.sections} slot="afterCommunity" />
    </>
  );
}
