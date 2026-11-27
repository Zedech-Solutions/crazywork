import { describe, expect, test } from "vitest";
import {
  blogPostingJsonLd,
  breadcrumbJsonLd,
  faqJsonLd,
  jsonLdHtml,
  organizationJsonLd,
  productJsonLd,
} from "@/lib/jsonld";
import { SITE_URL } from "@/lib/seo";

const product = {
  name: "Crazywork Muscle Tee",
  path: "/product/muscle-tee",
  description: "Built for training,\n\nshaped for presence.",
  images: ["https://pub-x.r2.dev/uploads/a.webp", "/images/products/tee-1.svg"],
  priceSen: 9900,
  inStock: true,
};

describe("jsonLdHtml", () => {
  test('escapes "<" so admin text cannot close the script tag', () => {
    const html = jsonLdHtml({ name: "</script><script>alert(1)</script>" });
    expect(html).not.toContain("<");
    expect(html).toContain("\\u003c/script>");
    expect(JSON.parse(html).name).toBe("</script><script>alert(1)</script>");
  });
});

describe("productJsonLd", () => {
  test("builds Product + Offer in MYR with absolute URLs", () => {
    const ld = productJsonLd({ ...product, sku: "CW-MT-01" })!;
    expect(ld["@type"]).toBe("Product");
    expect(ld.brand).toEqual({ "@type": "Brand", name: "CRAZYWORK" });
    expect(ld.sku).toBe("CW-MT-01");
    expect(ld.description).toBe("Built for training, shaped for presence.");
    expect(ld.image).toEqual([
      "https://pub-x.r2.dev/uploads/a.webp",
      `${SITE_URL}/images/products/tee-1.svg`,
    ]);
    expect(ld.offers).toEqual({
      "@type": "Offer",
      price: "99.00",
      priceCurrency: "MYR",
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      url: `${SITE_URL}/product/muscle-tee`,
    });
  });

  test("marks out-of-stock products OutOfStock", () => {
    const ld = productJsonLd({ ...product, inStock: false })!;
    expect(ld.offers.availability).toBe("https://schema.org/OutOfStock");
  });

  test("skips the markup entirely when the price is 0 or less", () => {
    expect(productJsonLd({ ...product, priceSen: 0 })).toBeNull();
    expect(productJsonLd({ ...product, priceSen: -100 })).toBeNull();
  });

  test("leaves out an empty sku and description", () => {
    const ld = JSON.parse(jsonLdHtml(productJsonLd({ ...product, description: null })));
    expect(ld).not.toHaveProperty("sku");
    expect(ld).not.toHaveProperty("description");
  });
});

describe("organizationJsonLd", () => {
  test("lists only the social links that are set", () => {
    const ld = organizationJsonLd({
      socialInstagram: "https://instagram.com/crazywork.my",
      socialTiktok: "",
      socialEmail: "contact@crazywork.store",
    });
    expect(ld).toMatchObject({
      "@type": "Organization",
      name: "CRAZYWORK",
      url: SITE_URL,
      logo: `${SITE_URL}/icon.png`,
      sameAs: ["https://instagram.com/crazywork.my"],
      email: "contact@crazywork.store",
    });
  });

  test("omits sameAs and email when none are set", () => {
    const ld = organizationJsonLd({ socialInstagram: "", socialTiktok: "", socialEmail: "" });
    expect(ld).not.toHaveProperty("sameAs");
    expect(ld).not.toHaveProperty("email");
  });
});

describe("breadcrumbJsonLd", () => {
  test("numbers the items from 1 with absolute URLs", () => {
    const ld = breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Gym Tank Tops", path: "/shop/tank-tops" },
    ]);
    expect(ld.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Gym Tank Tops", item: `${SITE_URL}/shop/tank-tops` },
    ]);
  });
});

describe("faqJsonLd", () => {
  test("maps each FAQ row to a Question with an accepted Answer", () => {
    const ld = faqJsonLd([{ question: "How much is shipping?", answer: "Flat RM8 (West)." }]);
    expect(ld.mainEntity).toEqual([
      {
        "@type": "Question",
        name: "How much is shipping?",
        acceptedAnswer: { "@type": "Answer", text: "Flat RM8 (West)." },
      },
    ]);
  });
});

describe("blogPostingJsonLd", () => {
  test("includes dates only when they exist", () => {
    const dated = blogPostingJsonLd({
      headline: "CRAZYWORK × Forge Gym",
      path: "/collab/crazywork-x-forge-gym",
      datePublished: new Date("2026-01-02T00:00:00Z"),
      dateModified: new Date("2026-02-03T00:00:00Z"),
    });
    expect(dated.datePublished).toBe("2026-01-02T00:00:00.000Z");
    expect(dated.author).toMatchObject({ "@type": "Organization", name: "CRAZYWORK" });

    const undated = JSON.parse(
      jsonLdHtml(blogPostingJsonLd({ headline: "5 AM Club", path: "/mindset/5am-club" })),
    );
    expect(undated).not.toHaveProperty("datePublished");
    expect(undated).not.toHaveProperty("image");
  });
});
