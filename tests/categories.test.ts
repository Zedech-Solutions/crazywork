import { describe, expect, test } from "vitest";
import {
  CATEGORIES,
  categoryBySlug,
  categoryFor,
  categoryLinks,
} from "@/lib/categories";

describe("categoryFor (admin free-text category → landing page)", () => {
  test("maps every live admin value to its slug", () => {
    const live: Record<string, string> = {
      "Tank Top": "tank-tops",
      "Muscle Tee": "muscle-tees",
      "Boxy Tee": "boxy-tees",
      "Oversized Tee": "oversized-tees",
      Shorts: "shorts",
      Socks: "socks",
    };
    for (const [value, slug] of Object.entries(live)) {
      expect(categoryFor(value)?.slug).toBe(slug);
    }
  });

  test('maps the live typo "Bagyy Pants" to baggy-pants with the right label', () => {
    expect(categoryFor("Bagyy Pants")).toMatchObject({
      slug: "baggy-pants",
      label: "Baggy Pants",
    });
    expect(categoryFor("Baggy Pants")?.slug).toBe("baggy-pants");
  });

  test("ignores case, whitespace and a plural s", () => {
    expect(categoryFor("  tank tops ")?.slug).toBe("tank-tops");
  });

  test("returns null for unknown or empty values", () => {
    expect(categoryFor("Hoodies")).toBeNull();
    expect(categoryFor(null)).toBeNull();
    expect(categoryFor("")).toBeNull();
  });
});

describe("categoryBySlug", () => {
  test("finds known slugs and rejects unknown ones (→ 404)", () => {
    expect(categoryBySlug("baggy-pants")?.heading).toBe("Baggy Gym Pants");
    expect(categoryBySlug("zz-not-real")).toBeNull();
  });

  test("slugs are unique and URL-safe", () => {
    const slugs = CATEGORIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9-]+$/);
  });
});

describe("categoryLinks (shop filter chips)", () => {
  test("known values link to the landing page, unknown keep the filter", () => {
    expect(categoryLinks(["Bagyy Pants", "Hoodies & Jackets"])).toEqual([
      { href: "/shop/baggy-pants", label: "Baggy Pants" },
      { href: "/shop?category=Hoodies%20%26%20Jackets", label: "Hoodies & Jackets" },
    ]);
  });

  test("values that map to the same page show once", () => {
    expect(categoryLinks(["Baggy Pants", "Bagyy Pants"])).toHaveLength(1);
  });
});
