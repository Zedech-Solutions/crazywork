import { createElement } from "react";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

const CONTEXT = "https://schema.org";
const abs = (url: string) => new URL(url, SITE_URL).href;

// "<" is escaped so admin text can never close the <script> tag early.
export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function JsonLd({ data }: { data: unknown }) {
  return createElement("script", {
    type: "application/ld+json",
    dangerouslySetInnerHTML: { __html: jsonLdHtml(data) },
  });
}

const brandOrg = () => ({ "@type": "Organization", name: SITE_NAME, url: SITE_URL });

export function organizationJsonLd(s: {
  socialInstagram: string;
  socialTiktok: string;
  socialEmail: string;
}) {
  const sameAs = [s.socialInstagram, s.socialTiktok].filter(Boolean);
  return {
    "@context": CONTEXT,
    ...brandOrg(),
    logo: abs("/icon.png"),
    ...(sameAs.length ? { sameAs } : {}),
    ...(s.socialEmail ? { email: s.socialEmail } : {}),
  };
}

export function websiteJsonLd() {
  return { "@context": CONTEXT, "@type": "WebSite", name: SITE_NAME, url: SITE_URL };
}

// Google rejects merchant listings priced at 0 (upcoming products are saved at
// RM 0 until priced), so those get no Product markup at all.
export function productJsonLd(p: {
  name: string;
  path: string;
  description: string | null;
  images: string[];
  sku?: string | null;
  priceSen: number;
  inStock: boolean;
}) {
  if (p.priceSen <= 0) return null;
  return {
    "@context": CONTEXT,
    "@type": "Product",
    name: p.name,
    image: p.images.map(abs),
    description: p.description?.replace(/\s+/g, " ").trim() || undefined,
    sku: p.sku || undefined,
    brand: { "@type": "Brand", name: SITE_NAME },
    offers: {
      "@type": "Offer",
      price: (p.priceSen / 100).toFixed(2),
      priceCurrency: "MYR",
      availability: `${CONTEXT}/${p.inStock ? "InStock" : "OutOfStock"}`,
      itemCondition: `${CONTEXT}/NewCondition`,
      url: abs(p.path),
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: abs(item.path),
    })),
  };
}

export function faqJsonLd(faqs: { question: string; answer: string }[]) {
  return {
    "@context": CONTEXT,
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

export function blogPostingJsonLd(p: {
  headline: string;
  path: string;
  image?: string | null;
  datePublished?: Date | null;
  dateModified?: Date | null;
}) {
  return {
    "@context": CONTEXT,
    "@type": "BlogPosting",
    headline: p.headline,
    url: abs(p.path),
    mainEntityOfPage: abs(p.path),
    image: p.image ? [abs(p.image)] : undefined,
    datePublished: p.datePublished?.toISOString(),
    dateModified: p.dateModified?.toISOString(),
    author: brandOrg(),
    publisher: { ...brandOrg(), logo: abs("/icon.png") },
  };
}
