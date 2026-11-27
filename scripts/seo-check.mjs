#!/usr/bin/env node
// SEO smoke check, no dependencies (Node 18+ fetch).
//   node scripts/seo-check.mjs <baseUrl>     e.g. http://localhost:3107
//   node scripts/seo-check.mjs --self-test
// Reads <baseUrl>/sitemap.xml plus a few fixed URLs, prints what each page
// declares, then a pass/fail summary. Exit code 1 on any failure.
// shortcut: regex HTML parsing, fine for Next's server-rendered HTML; swap for
// a real parser if pages start emitting tags these patterns can't read.
import assert from "node:assert/strict";

const EXTRA_PATHS = [
  "/shop?sort=price-asc",
  "/shop?category=Tank+Top",
  "/auth/sign-in",
  "/orders/lookup",
  "/product/seo-check-no-such-product-zz9",
];
const PARAM_PATHS = EXTRA_PATHS.slice(0, 2);
const PRIVATE_PATHS = ["/auth/sign-in", "/orders/lookup"];
const FAKE_PATH = EXTRA_PATHS[4];
const TITLE_MIN = 30;
const TITLE_MAX = 65;

const decode = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const text = (html) => decode(html.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();

function attrs(tag) {
  const out = {};
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))
    out[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4]);
  return out;
}

// Walks JSON-LD (objects, arrays, @graph, nested offers/hasVariant) into a flat node list.
function nodes(value, out = []) {
  if (Array.isArray(value)) value.forEach((v) => nodes(v, out));
  else if (value && typeof value === "object") {
    if (value["@type"]) out.push(value);
    Object.values(value).forEach((v) => nodes(v, out));
  }
  return out;
}
const types = (n) => [].concat(n["@type"]);

function parsePage(html) {
  // Whole document, not just <head>: Next 15 can stream metadata into <body>.
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => attrs(m[0]));
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => attrs(m[0]));
  const meta = (key) => metas.find((a) => a.name === key || a.property === key)?.content ?? null;
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => text(m[1]));
  const jsonld = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => {
      try {
        return { ok: true, data: JSON.parse(m[1]) };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    });
  // The PDP prints the product's own price right after its H1 (pdp-client.tsx);
  // the short window keeps a related-product card price from counting.
  const h1End = html.search(/<\/h1>/i);
  const afterH1 = h1End < 0 ? "" : html.slice(h1End, h1End + 300);
  const price = afterH1.match(/RM(?:\s|&nbsp;)*([\d,]+\.\d{2})/);
  return {
    title: title ? text(title[1]) : null,
    description: meta("description"),
    canonical: links.find((a) => (a.rel ?? "").split(/\s+/).includes("canonical"))?.href ?? null,
    robots: meta("robots"),
    ogUrl: meta("og:url"),
    twitterImage: meta("twitter:image"),
    h1s,
    jsonld,
    ldNodes: jsonld.filter((b) => b.ok).flatMap((b) => nodes(b.data)),
    shownPrice: price ? Number(price[1].replace(/,/g, "")) : null,
    hasRm0: /RM(?:\s|&nbsp;| )*0\.00\b/.test(html),
  };
}

// Same URL ignoring a trailing slash; root stays "/".
const norm = (u) => {
  const x = new URL(u);
  x.hash = "";
  if (x.pathname.length > 1) x.pathname = x.pathname.replace(/\/+$/, "");
  return x.href;
};

function productOfferProblem(page) {
  const all = page.ldNodes;
  const offers = all.filter((n) => types(n).some((t) => t === "Offer" || t === "AggregateOffer"));
  const zero = offers.find((o) => !(Number(o.price ?? o.lowPrice) > 0));
  if (zero) return `JSON-LD offer with price ${zero.price ?? zero.lowPrice ?? "missing"}`;
  if (!(page.shownPrice > 0)) return null;
  if (!all.some((n) => types(n).some((t) => t === "Product" || t === "ProductGroup")))
    return "no Product JSON-LD";
  if (!offers.length) return "no Offer in JSON-LD";
  if (!offers.every((o) => o.priceCurrency === "MYR")) return "Offer priceCurrency is not MYR";
  return null;
}

async function check(base) {
  const origin = new URL(base).origin;
  const sm = await fetch(`${origin}/sitemap.xml`);
  const xml = sm.ok ? await sm.text() : "";
  const locs = [...xml.matchAll(/<loc>\s*([\s\S]*?)\s*<\/loc>/g)].map((m) => decode(m[1]));
  // The sitemap declares the site's canonical host; fetch each path from <baseUrl>
  // so a preview or local build can be checked against the same rules.
  const site = locs[0] ? new URL(locs[0]).origin : origin;
  const targets = [
    ...locs.map((loc) => ({ path: new URL(loc).pathname + new URL(loc).search, loc, kind: "sitemap" })),
    ...EXTRA_PATHS.map((path) => ({ path, loc: null, kind: "extra" })),
  ];

  const pages = [];
  for (const t of targets) {
    const res = await fetch(origin + t.path, { redirect: "follow", headers: { "user-agent": "crazywork-seo-check" } });
    const html = await res.text();
    const p = { ...t, status: res.status, finalUrl: res.url, xRobots: res.headers.get("x-robots-tag"), ...parsePage(html) };
    p.noindex = /noindex/i.test(`${p.robots ?? ""} ${p.xRobots ?? ""}`);
    pages.push(p);
  }

  for (const p of pages) {
    console.log(`\n${p.path}  [${p.status}]${p.finalUrl !== origin + p.path ? ` -> ${p.finalUrl}` : ""}`);
    console.log(`  title (${p.title?.length ?? 0}): ${p.title}`);
    console.log(`  description (${p.description?.length ?? 0}): ${p.description}`);
    console.log(`  canonical: ${p.canonical}`);
    console.log(`  robots: ${p.robots}${p.xRobots ? `  x-robots-tag: ${p.xRobots}` : ""}`);
    console.log(`  og:url: ${p.ogUrl}`);
    console.log(`  twitter:image: ${p.twitterImage}`);
    console.log(`  h1 (${p.h1s.length}): ${p.h1s.map((h) => JSON.stringify(h)).join(", ")}`);
    const ld = p.jsonld.map((b, i) => (b.ok ? `#${i} ok [${nodes(b.data).flatMap(types).join(", ")}]` : `#${i} PARSE ERROR ${b.error}`));
    console.log(`  json-ld (${p.jsonld.length}): ${ld.join("; ") || "none"}`);
  }

  const fails = {};
  const fail = (rule, msg) => (fails[rule] ??= []).push(msg);
  const RULES = [
    "sitemap.xml lists URLs",
    "every indexable page has a self canonical",
    "parameter URLs canonicalise to the clean URL",
    "private pages are noindex",
    `titles are unique, ${TITLE_MIN}-${TITLE_MAX} chars`,
    "every JSON-LD block parses",
    "product pages with a price > 0 have Product+Offer (MYR)",
    'no "RM 0.00" in the HTML',
    "the fake slug returns 404",
  ];
  if (!locs.length) fail(RULES[0], `${origin}/sitemap.xml -> ${sm.status}, 0 <loc>`);

  const indexable = pages.filter((p) => p.kind === "sitemap");
  for (const p of indexable) {
    // A sitemap entry claims the page is indexable, so a non-200 or noindex fails here too.
    if (p.status !== 200) fail(RULES[1], `${p.path}: status ${p.status}`);
    else if (p.noindex) fail(RULES[1], `${p.path}: in sitemap but noindex`);
    else if (!p.canonical) fail(RULES[1], `${p.path}: no canonical`);
    else if (norm(new URL(p.canonical, site).href) !== norm(p.loc) || !/^https?:\/\//.test(p.canonical))
      fail(RULES[1], `${p.path}: canonical ${p.canonical} != ${p.loc}`);
  }
  for (const p of pages.filter((p) => PARAM_PATHS.includes(p.path))) {
    if (p.noindex) continue;
    if (!p.canonical) fail(RULES[2], `${p.path}: no canonical and not noindex`);
    else if (new URL(p.canonical, site).search || new URL(p.canonical, site).origin !== site)
      fail(RULES[2], `${p.path}: canonical ${p.canonical} is not a clean ${site} URL`);
  }
  for (const p of pages.filter((p) => PRIVATE_PATHS.includes(p.path)))
    if (!p.noindex) fail(RULES[3], `${p.path}: not noindex`);

  const seen = new Map();
  for (const p of indexable.filter((p) => p.status === 200 && !p.noindex)) {
    const n = p.title?.length ?? 0;
    if (n < TITLE_MIN || n > TITLE_MAX) fail(RULES[4], `${p.path}: ${n} chars "${p.title}"`);
    if (seen.has(p.title)) fail(RULES[4], `${p.path}: same title as ${seen.get(p.title)} "${p.title}"`);
    else seen.set(p.title, p.path);
  }
  for (const p of pages)
    p.jsonld.forEach((b, i) => !b.ok && fail(RULES[5], `${p.path}: block #${i} ${b.error}`));
  for (const p of pages.filter((p) => p.status === 200 && p.path.startsWith("/product/"))) {
    const problem = productOfferProblem(p);
    if (problem) fail(RULES[6], `${p.path}: ${problem} (shown price ${p.shownPrice})`);
  }
  for (const p of pages) if (p.hasRm0) fail(RULES[7], `${p.path}`);
  const fake = pages.find((p) => p.path === FAKE_PATH);
  if (fake.status !== 404) fail(RULES[8], `${FAKE_PATH}: status ${fake.status}`);

  console.log(`\n=== Summary: ${pages.length} URLs (${locs.length} from sitemap), site ${site}`);
  for (const r of RULES) {
    console.log(`${fails[r] ? "FAIL" : "PASS"}  ${r}${fails[r] ? ` (${fails[r].length})` : ""}`);
    for (const m of fails[r] ?? []) console.log(`        - ${m}`);
  }
  return Object.keys(fails).length === 0;
}

function selfTest() {
  const html = `<html><head><title>Muscle Tee &amp; More | CRAZYWORK</title>
    <meta name="description" content="Desc"/><meta name="robots" content="noindex, follow"/>
    <link rel="canonical" href="https://www.crazywork.store/product/muscle-tee"/>
    <meta property="og:url" content="https://www.crazywork.store/product/muscle-tee"/></head><body>
    <h1 class="x">Crazywork <span>Muscle</span> Tee</h1><p>RM 99.00</p><p>RM&nbsp;0.00</p>
    <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Product",
      "offers":{"@type":"Offer","price":"99.00","priceCurrency":"MYR"}}]}</script>
    <script type="application/ld+json">{bad json</script></body></html>`;
  const p = parsePage(html);
  assert.equal(p.title, "Muscle Tee & More | CRAZYWORK");
  assert.equal(p.canonical, "https://www.crazywork.store/product/muscle-tee");
  assert.equal(p.robots, "noindex, follow");
  assert.deepEqual(p.h1s, ["Crazywork Muscle Tee"]);
  assert.equal(p.shownPrice, 99);
  assert.equal(p.hasRm0, true);
  assert.deepEqual(p.jsonld.map((b) => b.ok), [true, false]);
  assert.equal(productOfferProblem(p), null);
  assert.equal(productOfferProblem({ ...p, ldNodes: [] }), "no Product JSON-LD");
  assert.equal(productOfferProblem({ ...p, shownPrice: 0, ldNodes: [{ "@type": "Offer", price: "0" }] }), "JSON-LD offer with price 0");
  assert.equal(norm("https://a.test"), norm("https://a.test/"));
  console.log("self-test ok");
}

const arg = process.argv[2];
if (arg === "--self-test") selfTest();
else if (!arg) {
  console.error("usage: node scripts/seo-check.mjs <baseUrl> | --self-test");
  process.exit(2);
} else process.exit((await check(arg)) ? 0 : 1);
