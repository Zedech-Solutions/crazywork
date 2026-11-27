import { trimAtWord } from "@/lib/seo";

// Product.category is free text typed in the admin. This map gives each known
// value a stable landing page (/shop/<slug>), a clean label and a short intro.
// Intros only restate facts from the live product pages. A value missing here
// still works as a /shop?category= filter, it just gets no landing page.
export interface Category {
  slug: string;
  label: string; // singular, as typed in the admin (product titles, filter chips)
  heading: string; // landing page H1 and title
  intro: string;
  description?: string; // meta description, when the intro is too short for one
  aliases?: string[];
}

export const CATEGORIES: Category[] = [
  {
    slug: "tank-tops",
    label: "Tank Top",
    heading: "Gym Tank Tops",
    intro:
      "CRAZYWORK tank tops are cut from premium ribbed cotton with a physique-enhancing fit and a structured feel that holds its shape. Made for training and everyday wear.",
  },
  {
    slug: "muscle-tees",
    label: "Muscle Tee",
    heading: "Muscle Tees",
    intro:
      "The CRAZYWORK Muscle Tee is made from 230 GSM performance fabric, with extended shoulder sleeves for a visually wider upper body and generous arm openings. Made for training and everyday wear.",
  },
  {
    slug: "boxy-tees",
    label: "Boxy Tee",
    heading: "Boxy Tees",
    intro:
      "CRAZYWORK boxy tees have a structured oversized fit with a slightly cropped length, in 100% premium cotton. Made for training and everyday wear.",
  },
  {
    slug: "oversized-tees",
    label: "Oversized Tee",
    heading: "Oversized Gym Tees",
    intro:
      "CRAZYWORK oversized tees are cut in a relaxed, oversized fit. Check the size guide on each piece to pick your size.",
    // shortcut: names the 4 oversized tees listed on 28 Nov 2026, update it when the range changes.
    description:
      "CRAZYWORK oversized tees in a relaxed, oversized fit: the Vision Tee, Leg Day Tee, Lifting Club Tee and Timeless Tee. Check the size guide on each piece.",
  },
  {
    slug: "baggy-pants",
    label: "Baggy Pants",
    heading: "Baggy Gym Pants",
    intro:
      "Part of the CRAZYWORK Training Dept., the ASCEND Barrel Baggy Pants have a relaxed barrel-leg fit, a stretchable elastic waistband and a wide, gradually flared leg opening. 310 GSM, 50% cotton and 50% polyester.",
    // shortcut: alias for the live admin typo "Bagyy Pants", remove once the admin value is fixed.
    aliases: ["Bagyy Pants"],
  },
  {
    slug: "shorts",
    label: "Shorts",
    heading: "Gym Shorts",
    intro:
      "The CRAZYWORK Essential Shorts have a versatile 5-inch-inspired cut and embroidered CRAZYWORK branding. They pair with oversized tees, muscle tees and tanks, for training and casual wear.",
  },
  {
    slug: "socks",
    label: "Socks",
    heading: "Gym Socks",
    intro:
      "The CRAZYWORK Foundation Crew Sock is built for all-day wear and heavy training sessions. Cushioned where it counts, and understated enough to go with everything.",
  },
];

// Case- and plural-insensitive, so "tank tops" and "Tank Top" match.
const norm = (s: string) => s.trim().toLowerCase().replace(/s$/, "");

export function categoryFor(value: string | null | undefined): Category | null {
  if (!value) return null;
  const v = norm(value);
  return (
    CATEGORIES.find((c) => [c.label, ...(c.aliases ?? [])].some((n) => norm(n) === v)) ??
    null
  );
}

export function categoryDescription(c: Category): string {
  return c.description ?? trimAtWord(c.intro);
}

export function categoryBySlug(slug: string): Category | null {
  return CATEGORIES.find((c) => c.slug === slug) ?? null;
}

// Shop filter links: a known category goes to its landing page, an unknown one
// keeps the query-string filter. Values that map to the same page show once.
export function categoryLinks(values: string[]): { href: string; label: string }[] {
  const links = values.map((v) => {
    const c = categoryFor(v);
    return c
      ? { href: `/shop/${c.slug}`, label: c.label }
      : { href: `/shop?category=${encodeURIComponent(v)}`, label: v };
  });
  return links.filter((l, i) => links.findIndex((x) => x.href === l.href) === i);
}
