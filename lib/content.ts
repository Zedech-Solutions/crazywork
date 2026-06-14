import { prisma } from "@/lib/db";

// Per-page editable content, stored as JSON in SiteSetting under "content.<page>".
// Each page has a typed shape with defaults matching the original hardcoded
// design; stored values are deep-merged over defaults so a missing field always
// falls back instead of rendering blank.

export interface Cta {
  label: string;
  href: string;
}

// A "shop by category" tile on the home page (image + label + link).
export interface CategoryTile {
  id: string;
  label: string;
  image: string;
  href: string;
}

// Insertion points for promo sections — one of the gaps between the fixed home
// sections. Multiple promo sections sharing a slot render as a carousel there.
export type HomeSlot =
  | "afterHero"
  | "afterFeatured"
  | "afterTiles"
  | "afterCommunity";

export const HOME_SLOTS: { value: HomeSlot; label: string }[] = [
  { value: "afterHero", label: "After the top banner" },
  { value: "afterFeatured", label: "After featured products" },
  { value: "afterTiles", label: "After the Mindset / Story tiles" },
  { value: "afterCommunity", label: "After the community grid" },
];

// A free-form promo band the admin can insert on the home page. Multiple
// sections sharing a slot render as an auto-advancing carousel.
export interface HomeSection {
  id: string;
  position: HomeSlot;
  eyebrow: string;
  heading: string; // supports "\n" + *accent* words
  body: string;
  image: string;
  buttonLabel: string;
  buttonHref: string;
}

// Sections placed in a given slot (legacy rows without a position fall into the
// original "after featured" gap).
export function sectionsInSlot(
  sections: HomeSection[] | undefined,
  slot: HomeSlot,
): HomeSection[] {
  return (sections ?? []).filter(
    (s) => (s.position ?? "afterFeatured") === slot,
  );
}

export interface HomeContent {
  heroEyebrow: string;
  heroHeadline: string; // supports "\n" line breaks and *accent* words
  heroSub: string;
  heroImage: string;
  heroCtaPrimary: Cta;
  heroCtaSecondary: Cta;
  marquee: string[];
  featuredEyebrow: string;
  mindsetTile: {
    eyebrow: string;
    title: string;
    linkLabel: string;
    href: string;
    image: string;
  };
  storyTile: {
    eyebrow: string;
    title: string; // supports "\n"
    linkLabel: string;
    href: string;
    image: string; // optional background; sand panel when empty
  };
  communityEyebrow: string;
  communityTitle: string;
  categories: CategoryTile[];
  sections: HomeSection[];
}

export const DEFAULT_HOME_CONTENT: HomeContent = {
  heroEyebrow: "Premium Gym & Lifestyle Clothing",
  heroHeadline: "We Put In\nThe *Crazy* Work",
  heroSub:
    "Premium gym and lifestyle clothing for those who give their absolute best. Identity. Mindset. Lifestyle.",
  heroImage: "/images/manus/hero.png",
  heroCtaPrimary: { label: "Shop Now →", href: "/shop" },
  heroCtaSecondary: { label: "● Latest Drop", href: "/drops" },
  marquee: [
    "We put in the crazywork",
    "Wear what you train for",
    "Premium gym clothing",
    "Built for the iron game",
    "Limited drops",
    "Identity + Mindset + Lifestyle",
  ],
  featuredEyebrow: "Featured drop",
  mindsetTile: {
    eyebrow: "The Mindset",
    title: "We don't wait to be ready.",
    linkLabel: "Read it →",
    href: "/mindset",
    image: "/images/manus/mindset-bg.webp",
  },
  storyTile: {
    eyebrow: "Our Story",
    title: "Built in Malaysia.\nRep by rep.",
    linkLabel: "Where it started →",
    href: "/our-story",
    image: "",
  },
  communityEyebrow: "Our people",
  communityTitle: "The Community",
  categories: [],
  sections: [],
};

// Recursively merge a stored partial over defaults. Arrays and primitives from
// the override replace the default; nested plain objects merge key-by-key.
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function deepMerge<T>(base: T, override: unknown): T {
  if (override === undefined || override === null) return base;
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override as T; // primitive or array override wins
  }
  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(base)) {
    if (key in override) {
      result[key] = deepMerge(
        (base as Record<string, unknown>)[key],
        override[key],
      );
    }
  }
  return result as T;
}

// ───────────────────────── other editable pages ─────────────────────────

export interface MindsetArticle {
  tag: string;
  title: string;
  excerpt: string;
  readTime: string;
  image: string;
  featured: boolean;
}

export interface MindsetContent {
  headerEyebrow: string;
  headerTitle: string; // supports \n and *accent*
  headerSub: string;
  headerImage: string;
  articles: MindsetArticle[];
}

export const DEFAULT_MINDSET_CONTENT: MindsetContent = {
  headerEyebrow: "Content & Community",
  headerTitle: "The Mindset",
  headerSub:
    "Fitness tips, motivation, transformation stories. Content that fuels your grind and builds the identity behind the clothing.",
  headerImage: "/images/manus/mindset-bg.webp",
  articles: [
    {
      tag: "Training",
      title: "5 Principles That Separate Elite Athletes From Everyone Else",
      excerpt:
        "It's not talent. It's not genetics. It's the habits you build in the dark, when no one is watching, when the motivation is gone.",
      readTime: "4 min read",
      image: "/images/manus/lifestyle-1.webp",
      featured: true,
    },
    {
      tag: "Mindset",
      title: "Why Your Identity Matters More Than Your Motivation",
      excerpt:
        "Motivation fades. Identity is permanent. Build the version of yourself that never quits — and everything else follows.",
      readTime: "6 min read",
      image: "/images/manus/hero-main.webp",
      featured: false,
    },
    {
      tag: "Transformation",
      title: "From Zero to Consistent: A 90-Day Framework",
      excerpt:
        "The most important transformation isn't physical. It's the decision to never stop showing up, no matter what.",
      readTime: "8 min read",
      image: "/images/manus/mindset-bg.webp",
      featured: false,
    },
    {
      tag: "Nutrition",
      title: "Eating for Performance: What Actually Works",
      excerpt:
        "Cut through the noise. Here's what the science actually says about fueling your training for maximum results.",
      readTime: "2 min read",
      image: "/images/manus/cw-3.jpg",
      featured: false,
    },
    {
      tag: "Recovery",
      title: "The Recovery Protocol That Elite Athletes Swear By",
      excerpt:
        "You don't grow in the gym. You grow when you recover. Here's how to maximize every hour outside of training.",
      readTime: "7 min read",
      image: "/images/manus/lifestyle-1.webp",
      featured: false,
    },
    {
      tag: "Mindset",
      title: "The 5 AM Club: Why Training Before Dawn Changes Everything",
      excerpt:
        "There's something different about the 5 AM crowd. They've made a decision that most people never will.",
      readTime: "4 min read",
      image: "/images/manus/hero-main.webp",
      featured: false,
    },
  ],
};

export interface DropsContent {
  title: string;
  description: string;
}

export const DEFAULT_DROPS_CONTENT: DropsContent = {
  title: "Drops",
  description:
    "Limited runs. When a drop sells out, it stays sold out — the archive is the receipt.",
};

export interface FooterContent {
  tagline: string;
  blurb: string;
}

export const DEFAULT_FOOTER_CONTENT: FooterContent = {
  tagline: "Wear What You Train For",
  blurb:
    "We don't wait to be ready. Starting is the whole point. Rep by rep, you become someone worth respecting.",
};

// Order-confirmation page shown after a successful Stripe checkout. The
// background image is admin-uploadable; empty = the default soft white wash.
// Both states render blurred behind a frosted card.
export interface CheckoutSuccessContent {
  heading: string;
  subheading: string;
  backgroundImage: string;
}

export const DEFAULT_CHECKOUT_SUCCESS_CONTENT: CheckoutSuccessContent = {
  heading: "Earned.",
  subheading: "A confirmation email is on the way. We pack, you train.",
  backgroundImage: "",
};

export const CONTENT_PAGES = {
  home: DEFAULT_HOME_CONTENT,
  mindset: DEFAULT_MINDSET_CONTENT,
  drops: DEFAULT_DROPS_CONTENT,
  footer: DEFAULT_FOOTER_CONTENT,
  checkoutSuccess: DEFAULT_CHECKOUT_SUCCESS_CONTENT,
} as const;

export type ContentPageKey = keyof typeof CONTENT_PAGES;

export async function getPageContent<K extends ContentPageKey>(
  page: K,
): Promise<(typeof CONTENT_PAGES)[K]> {
  const row = await prisma.siteSetting.findUnique({
    where: { key: `content.${page}` },
  });
  return deepMerge(CONTENT_PAGES[page], row?.value);
}

export async function setPageContent<K extends ContentPageKey>(
  page: K,
  value: (typeof CONTENT_PAGES)[K],
): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key: `content.${page}` },
    create: { key: `content.${page}`, value: value as object },
    update: { value: value as object },
  });
}

export const getHomeContent = () => getPageContent("home");
export const getMindsetContent = () => getPageContent("mindset");
export const getDropsContent = () => getPageContent("drops");
export const getFooterContent = () => getPageContent("footer");
export const getCheckoutSuccessContent = () => getPageContent("checkoutSuccess");
