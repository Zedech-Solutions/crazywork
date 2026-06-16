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
  heroImage: "/images/hero.svg",
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
    image: "/images/mindset.svg",
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

// One titled block of an article's body (renders as a heading + paragraphs on
// the detail page). Paragraphs are split on blank lines in the body string.
export interface MindsetSection {
  heading: string;
  body: string;
}

// Background theme for an article's detail page. Each maps to a brand colour
// with a matching (dark/light) text treatment — see the detail page's theme map.
export type MindsetBg = "ink" | "brown" | "peach" | "sand";

export const MINDSET_BG_OPTIONS: { label: string; value: MindsetBg }[] = [
  { label: "Dark (ink)", value: "ink" },
  { label: "Brown", value: "brown" },
  { label: "Light (peach)", value: "peach" },
  { label: "Sand", value: "sand" },
];

export interface MindsetArticle {
  slug: string; // URL for the detail page; blank → derived from the title
  tag: string;
  title: string;
  excerpt: string;
  readTime: string;
  image: string;
  featured: boolean;
  bgColor: MindsetBg; // detail-page background theme
  sections: MindsetSection[];
}

export interface MindsetContent {
  headerEyebrow: string;
  headerTitle: string; // supports \n and *accent*
  headerSub: string;
  headerImage: string;
  articles: MindsetArticle[];
}

// URL-safe slug from arbitrary text.
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// The slug an article is reachable at — its explicit slug, or one derived from
// the title for legacy/blank entries.
export function mindsetArticleSlug(a: MindsetArticle): string {
  return a.slug?.trim() ? slugify(a.slug) : slugify(a.title);
}

export const DEFAULT_MINDSET_CONTENT: MindsetContent = {
  headerEyebrow: "Content & Community",
  headerTitle: "The Mindset",
  headerSub:
    "Fitness tips, motivation, transformation stories. Content that fuels your grind and builds the identity behind the clothing.",
  headerImage: "/images/mindset.svg",
  articles: [
    {
      slug: "5-principles-elite-athletes",
      tag: "Training",
      title: "5 Principles That Separate Elite Athletes From Everyone Else",
      excerpt:
        "It's not talent. It's not genetics. It's the habits you build in the dark, when no one is watching, when the motivation is gone.",
      readTime: "4 min read",
      image: "/images/story.svg",
      featured: true,
      bgColor: "ink",
      sections: [
        {
          heading: "Talent is overrated",
          body: "Everyone wants to believe the people at the top were born different. It's comforting — it lets you off the hook. The truth is harder: elite athletes are built, not born, and the blueprint is available to anyone willing to follow it.",
        },
        {
          heading: "The principles",
          body: "Show up when you don't feel like it. Train the boring fundamentals longer than anyone else. Recover like it's part of the work, because it is. Measure honestly. And never confuse motion with progress.",
        },
      ],
    },
    {
      slug: "identity-over-motivation",
      tag: "Mindset",
      title: "Why Your Identity Matters More Than Your Motivation",
      excerpt:
        "Motivation fades. Identity is permanent. Build the version of yourself that never quits — and everything else follows.",
      readTime: "6 min read",
      image: "/images/hero.svg",
      featured: false,
      bgColor: "ink",
      sections: [
        {
          heading: "The problem with motivation",
          body: "We've been sold a lie. The fitness industry profits from selling you motivation — pre-workout, inspirational content, hype. But motivation is a feeling, and feelings are temporary. The moment life gets hard, motivation disappears. And then what?",
        },
        {
          heading: "Identity-based change",
          body: "The most powerful shift you can make is from 'I want to get fit' to 'I am someone who trains.' When your behavior becomes part of your identity, you don't need motivation. You just do it, because that's who you are.",
        },
        {
          heading: "How to build an athletic identity",
          body: "Start small. Every time you complete a workout — even a 20-minute walk — you cast a vote for the identity of 'person who trains.' Over time, these votes accumulate into an unshakeable self-image. You don't rise to the level of your goals. You fall to the level of your identity.",
        },
        {
          heading: "The CRAZYWORK identity",
          body: "When you wear CRAZYWORK, you're not just wearing clothing. You're making a statement about who you are. You're someone who puts in the work. Someone who shows up. Someone who earns their rest. That's the identity we're building — one rep, one session, one day at a time.",
        },
      ],
    },
    {
      slug: "zero-to-consistent-90-days",
      tag: "Transformation",
      title: "From Zero to Consistent: A 90-Day Framework",
      excerpt:
        "The most important transformation isn't physical. It's the decision to never stop showing up, no matter what.",
      readTime: "8 min read",
      image: "/images/mindset.svg",
      featured: false,
      bgColor: "ink",
      sections: [
        {
          heading: "Days 1–30: Just show up",
          body: "Forget intensity. Forget your max. The only goal for the first month is to not miss. Lower the bar until showing up is impossible to fail. Consistency is the skill you're training, not strength.",
        },
        {
          heading: "Days 31–60: Build the engine",
          body: "Now that the habit holds, add structure. Pick a plan and follow it. Progress the weight, the reps, the distance. Small, boring increments compound into results you can see.",
        },
        {
          heading: "Days 61–90: Make it yours",
          body: "By now, training isn't something you do — it's part of who you are. Adjust the plan to your life, not the other way around. This is the version of you that keeps going long after the 90 days end.",
        },
      ],
    },
    {
      slug: "eating-for-performance",
      tag: "Nutrition",
      title: "Eating for Performance: What Actually Works",
      excerpt:
        "Cut through the noise. Here's what the science actually says about fueling your training for maximum results.",
      readTime: "2 min read",
      image: "/images/story.svg",
      featured: false,
      bgColor: "ink",
      sections: [
        {
          heading: "Protein and the basics",
          body: "Most of the magic comes from a handful of unsexy fundamentals: enough protein, enough total calories for your goal, and enough sleep. Hit those before you worry about anything else.",
        },
        {
          heading: "Ignore the noise",
          body: "Supplements, timing windows, and trendy diets are rounding errors next to consistency. Eat whole foods most of the time, stay hydrated, and let the fundamentals do the heavy lifting.",
        },
      ],
    },
    {
      slug: "recovery-protocol",
      tag: "Recovery",
      title: "The Recovery Protocol That Elite Athletes Swear By",
      excerpt:
        "You don't grow in the gym. You grow when you recover. Here's how to maximize every hour outside of training.",
      readTime: "7 min read",
      image: "/images/story.svg",
      featured: false,
      bgColor: "ink",
      sections: [
        {
          heading: "Sleep is the foundation",
          body: "No supplement, ice bath, or massage gun comes close to the recovery you get from sleep. Protect it like it's part of your program — because it is the program.",
        },
        {
          heading: "Active recovery",
          body: "Rest days aren't off days. Easy movement — walking, mobility, light cardio — keeps blood flowing and speeds the rebuild without adding stress.",
        },
      ],
    },
    {
      slug: "5am-club",
      tag: "Mindset",
      title: "The 5 AM Club: Why Training Before Dawn Changes Everything",
      excerpt:
        "There's something different about the 5 AM crowd. They've made a decision that most people never will.",
      readTime: "4 min read",
      image: "/images/hero.svg",
      featured: false,
      bgColor: "ink",
      sections: [
        {
          heading: "The decision before the workout",
          body: "Getting up at 5 AM isn't about the extra hours. It's about winning the first battle of the day before most people are awake. That single decision sets the tone for everything that follows.",
        },
        {
          heading: "Owning your morning",
          body: "When you train before the world wakes up, nothing can take that session from you. No meeting, no excuse, no emergency. You've already done the hard thing.",
        },
      ],
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

// The Our Story page — fully editable via the admin Pages builder.
export interface OurStoryContent {
  headerImage: string;
  eyebrow: string;
  title: string; // supports \n and *accent*
  body: string; // paragraphs split on blank lines
  quote: string;
  ctaLabel: string;
  ctaHref: string;
}

export const DEFAULT_OUR_STORY_CONTENT: OurStoryContent = {
  headerImage: "/images/story.svg",
  eyebrow: "Our Story",
  title: "Built in Malaysia. Rep by rep.",
  body: `CRAZYWORK didn't start in a boardroom. It started at 5:47am in a half-lit gym in the Klang Valley, between sets, with a simple observation: the people doing the real work were wearing gear made for people who don't.

So we made our own. Heavyweight fabric that survives the wash. Cuts that move with a body that trains. No slogans we haven't lived. Small runs, made properly, released when they're ready — that's why we do drops, not seasons.

The name says it plainly. Crazy work — the kind people call crazy until they see the results. If you know that feeling, you're already one of us.

We're still small. Still Malaysian. Still packing orders ourselves and reading every message. That's not a limitation — that's the point.`,
  quote:
    "We don't celebrate where you're going. We celebrate that you showed up.",
  ctaLabel: "Wear what you train for →",
  ctaHref: "/shop",
};

export const CONTENT_PAGES = {
  home: DEFAULT_HOME_CONTENT,
  mindset: DEFAULT_MINDSET_CONTENT,
  drops: DEFAULT_DROPS_CONTENT,
  footer: DEFAULT_FOOTER_CONTENT,
  checkoutSuccess: DEFAULT_CHECKOUT_SUCCESS_CONTENT,
  ourStory: DEFAULT_OUR_STORY_CONTENT,
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

// Look up a single mindset article by its (resolved) slug.
export async function getMindsetArticle(
  slug: string,
): Promise<MindsetArticle | null> {
  const { articles } = await getMindsetContent();
  return (
    (articles ?? []).find((a) => mindsetArticleSlug(a) === slug) ?? null
  );
}
export const getDropsContent = () => getPageContent("drops");
export const getFooterContent = () => getPageContent("footer");
export const getCheckoutSuccessContent = () => getPageContent("checkoutSuccess");
export const getOurStoryContent = () => getPageContent("ourStory");
