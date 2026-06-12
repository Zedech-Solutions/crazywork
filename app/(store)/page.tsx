import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CountdownTimer } from "@/components/site/countdown-timer";
import { HeroParallax } from "@/components/site/hero-parallax";
import { Marquee } from "@/components/site/marquee";
import { ProductCard } from "@/components/site/product-card";
import { Reveal } from "@/components/site/reveal";
import { RichText } from "@/components/site/rich-text";
import { activeProducts, toCardProduct } from "@/lib/catalog";
import { getHomeContent } from "@/lib/content";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [settings, content, currentDrop, communityPhotos] = await Promise.all([
    getSettings(),
    getHomeContent(),
    prisma.drop.findFirst({
      where: { status: "current" },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.communityPhoto.findMany({
      where: { published: true, imageUrl: { not: null } },
      orderBy: { sortOrder: "asc" },
      take: 5,
    }),
  ]);
  const featured = await activeProducts(
    currentDrop ? { dropId: currentDrop.id } : {},
  );

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
            className="headline mt-3 max-w-4xl text-6xl text-peach sm:text-8xl animate-rise"
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

      {/* FEATURED DROP */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-ember">{content.featuredEyebrow}</p>
            <h2 className="headline mt-1 text-5xl">
              {currentDrop?.name ?? "The Latest"}
            </h2>
          </div>
          {settings.dropCountdownUntil && (
            <CountdownTimer until={settings.dropCountdownUntil} label="Ends in" />
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3">
          {featured.slice(0, 6).map((product, i) => (
            <Reveal key={product.id} index={i}>
              <ProductCard product={toCardProduct(product)} />
            </Reveal>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Button asChild variant="outline">
            <Link href="/shop">View all</Link>
          </Button>
        </div>
      </section>

      {/* SPLIT EDITORIAL */}
      <section className="border-y border-warmgrey">
        <div className="grid md:grid-cols-2">
          <Link
            href={content.mindsetTile.href}
            className="group relative flex min-h-72 items-end overflow-hidden bg-ink p-8"
          >
            <Image
              src={content.mindsetTile.image}
              alt={content.mindsetTile.eyebrow}
              fill
              className="object-cover opacity-60 transition-transform duration-700 group-hover:scale-105"
            />
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
            className="group flex min-h-72 flex-col justify-end bg-sand p-8"
          >
            <p className="eyebrow text-ember">{content.storyTile.eyebrow}</p>
            <p className="headline mt-1 text-4xl">
              <RichText text={content.storyTile.title} />
            </p>
            <p className="mt-2 eyebrow text-brown group-hover:text-ember">
              {content.storyTile.linkLabel}
            </p>
          </Link>
        </div>
      </section>

      {/* COMMUNITY */}
      {communityPhotos.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <p className="eyebrow text-ember">{content.communityEyebrow}</p>
              <h2 className="headline mt-1 text-5xl">{content.communityTitle}</h2>
            </div>
            <Link href="/community" className="eyebrow text-brown hover:text-ember">
              See all →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {communityPhotos.map((photo, i) => (
              <Reveal
                key={photo.id}
                index={i}
                className="relative aspect-square overflow-hidden bg-ink"
              >
                <Image
                  src={photo.imageUrl ?? ""}
                  alt={photo.caption ?? "CRAZYWORK community"}
                  fill
                  sizes="(max-width: 640px) 50vw, 20vw"
                  className="object-cover transition-transform duration-500 hover:scale-105"
                />
              </Reveal>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
