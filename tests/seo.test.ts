import { afterEach, describe, expect, test, vi } from "vitest";
import {
  brandTitle,
  metaDescription,
  pageMeta,
  productTitle,
  seoTitle,
  trimAtWord,
  withProductName,
} from "@/lib/seo";

describe("SITE_URL", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  test("falls back to the www host in production, never localhost", async () => {
    vi.stubEnv("BETTER_AUTH_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const { SITE_URL } = await import("@/lib/seo");
    expect(SITE_URL).toBe("https://www.crazywork.store");
  });

  test("uses BETTER_AUTH_URL when set", async () => {
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3107");
    vi.resetModules();
    const { SITE_URL } = await import("@/lib/seo");
    expect(SITE_URL).toBe("http://localhost:3107");
  });
});

describe("brandTitle", () => {
  test("adds the full brand suffix when it fits in 60 chars", () => {
    expect(brandTitle("Eating for Performance")).toBe(
      "Eating for Performance | CRAZYWORK Malaysia",
    );
  });

  test("falls back to a shorter suffix, then to the bare title", () => {
    expect(brandTitle("From Zero to Consistent: A 90-Day Framework")).toBe(
      "From Zero to Consistent: A 90-Day Framework | CRAZYWORK",
    );
    const long = "5 Principles That Separate Elite Athletes From Everyone Else";
    expect(brandTitle(long)).toBe(long);
  });

  test("doesn't repeat the brand when the title already names it", () => {
    expect(brandTitle("CRAZYWORK × Strength Nexus")).toBe(
      "CRAZYWORK × Strength Nexus | Malaysia",
    );
  });
});

describe("productTitle", () => {
  test("name · category | brand, without the leading brand word", () => {
    expect(productTitle("Crazywork Vision Tee", "Oversized Tee")).toBe(
      "Vision Tee · Oversized Tee | CRAZYWORK Malaysia",
    );
  });

  test("drops a category the name already says (plural-insensitive)", () => {
    expect(productTitle("Crazywork Muscle Tee", "Muscle Tee")).toBe(
      "Muscle Tee | CRAZYWORK Malaysia",
    );
    expect(productTitle("Crazywork Foundation Crew Sock", "Socks")).toBe(
      "Foundation Crew Sock | CRAZYWORK Malaysia",
    );
  });

  test("drops the category when the title would pass 60 chars", () => {
    const title = productTitle("Ascend Form Tank - Army Khaki", "Tank Top");
    expect(title).toBe("Ascend Form Tank - Army Khaki | CRAZYWORK Malaysia");
    expect(title.length).toBeLessThanOrEqual(60);
  });

  test("works without a category", () => {
    expect(productTitle("Crazywork Essential Shorts", null)).toBe(
      "Essential Shorts | CRAZYWORK Malaysia",
    );
  });
});

describe("seoTitle (admin metaTitle guard)", () => {
  test("ignores admin titles under 30 chars", () => {
    expect(seoTitle("Ribbed Tank Top", "Built title")).toBe("Built title");
    expect(seoTitle(null, "Built title")).toBe("Built title");
  });

  test("keeps an admin title of 30+ chars", () => {
    const admin = "Form Tank Midnight Black | CRAZYWORK";
    expect(seoTitle(admin, "Built title")).toBe(admin);
  });
});

describe("metaDescription (admin metaDescription guard)", () => {
  const text =
    "Built for training, shaped for presence. The CRAZYWORK Muscle Tee features lightweight, smooth performance fabric with a cool feel and a structured athletic cut.";

  test("ignores admin descriptions under 70 chars and uses the page text", () => {
    const out = metaDescription("pants", text, "fallback");
    expect(out.startsWith("Built for training")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(155);
  });

  test("keeps an admin description of 70+ chars", () => {
    const admin = "x".repeat(70);
    expect(metaDescription(admin, text, "fallback")).toBe(admin);
  });

  test("uses the fallback when there is no text", () => {
    expect(metaDescription(null, "  ", "fallback")).toBe("fallback");
  });

  test("tops up a short excerpt with the body, without emphasis markers", () => {
    const out = metaDescription(
      null,
      "Our first collaboration & physical appearance!",
      "fallback",
      "Experience Crazywork in person at our first physical booth inside Strength Nexus. Feel the *fabric*, try on every fit, and see firsthand what it is meant to feel like.",
    );
    expect(out.startsWith("Our first collaboration & physical appearance! Experience")).toBe(true);
    expect(out).not.toContain("*");
    expect(out.length).toBeGreaterThanOrEqual(120);
    expect(out.length).toBeLessThanOrEqual(155);
  });

  test("ends an unpunctuated excerpt before the body, and leaves a long one alone", () => {
    expect(metaDescription(null, "Short excerpt", "fallback", "Body.")).toBe(
      "Short excerpt. Body.",
    );
    expect(metaDescription(null, text, "fallback", "Body.")).not.toContain("Body.");
  });
});

describe("withProductName", () => {
  const shared = "Bring back aesthetics. Inspired by the 2012–2016 aesthetic gym era.";

  test("names the product when the snippet doesn't, so colourways differ", () => {
    expect(withProductName("Crazywork Form Tank - Midnight Black", shared)).toBe(
      `Crazywork Form Tank - Midnight Black. ${shared}`,
    );
  });

  test("leaves text that already names it (case, brand word and punctuation aside)", () => {
    const own = "ASCEND — BARREL BAGGY PANTS Finding a pair of baggy pants…";
    expect(withProductName("Ascend Barrel Baggy Pants", own)).toBe(own);
    expect(withProductName("Crazywork Leg Day Tee", "The Leg Day Tee. Because.")).toBe(
      "The Leg Day Tee. Because.",
    );
    expect(withProductName("Crazywork Muscle Tee", null)).toBeNull();
  });
});

describe("trimAtWord", () => {
  test("leaves short text alone but collapses whitespace", () => {
    expect(trimAtWord("Fabric\n\n  Weight: 230 GSM")).toBe("Fabric Weight: 230 GSM");
  });

  test("cuts at a word boundary within the limit", () => {
    const out = trimAtWord("one two three four five", 12);
    expect(out).toBe("one two…");
    expect(out.length).toBeLessThanOrEqual(12);
  });
});

describe("pageMeta", () => {
  test("sets the canonical, og:url and the default share image", () => {
    const meta = pageMeta("/shop");
    expect(meta.alternates).toEqual({ canonical: "/shop" });
    expect(meta.openGraph).toMatchObject({ url: "/shop", images: ["/opengraph-image.png"] });
    expect(meta).not.toHaveProperty("twitter");
  });

  test("uses the page's own image for og:image and twitter:image", () => {
    const img = "https://pub-x.r2.dev/uploads/a.webp";
    const meta = pageMeta("/product/muscle-tee", img);
    expect(meta.openGraph).toMatchObject({ images: [img] });
    expect(meta.twitter).toMatchObject({ images: [img] });
  });
});
