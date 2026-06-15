import { config } from "dotenv";
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SETTING_DEFAULTS: Record<string, unknown> = {
  shippingWest: 800,
  shippingEast: 1500,
  freeShippingThreshold: 15000,
  socialInstagram: "https://instagram.com/crazywork.my",
  socialTiktok: "",
  socialEmail: "hello@crazywork.my",
  ssmNumber: "",
  ownerAlertChannel: "discord",
  ownerAlertEmail: "",
  popupDelaySeconds: 6,
  preCheckoutUpsellEnabled: true,
  preCheckoutUpsellTemplate:
    "Almost there! Add {n} more and save {percent}% on your cart",
  announcementBar: "FREE SHIPPING OVER RM150 · WEST & EAST MALAYSIA",
  dropCountdownUntil: "",
  sizeGuide: {
    note: "Measurements in cm. Our cut is athletic — size up for an oversized fit.",
    columns: ["Size", "Chest", "Length", "Fits chest"],
    rows: [
      ["S", "44–46", "66", "92–98"],
      ["M", "48–50", "68", "98–104"],
      ["L", "52–54", "70", "104–112"],
      ["XL", "56–58", "72", "112–120"],
    ],
  },
};

// Demo per-product override — shorts need waist/inseam, not chest/length.
const SHORTS_SIZE_GUIDE = {
  note: "Waist & inseam in inches. Relaxed fit through the thigh.",
  columns: ["Size", "Waist", "Inseam"],
  rows: [
    ["S", "28–30", "7"],
    ["M", "31–33", "7"],
    ["L", "34–36", "7.5"],
    ["XL", "37–39", "7.5"],
  ],
};

async function seedSuperadmin() {
  const email = process.env.SUPERADMIN_EMAIL;
  const password = process.env.SUPERADMIN_PASSWORD;
  if (!email || !password) {
    console.warn("⚠ SUPERADMIN_EMAIL/_PASSWORD not set — skipping superadmin seed");
    return;
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== "superadmin") {
      await prisma.user.update({ where: { email }, data: { role: "superadmin" } });
    }
    console.log(`✓ superadmin exists (${email})`);
    return;
  }
  // Better Auth handles credential hashing — sign up through its API, then promote.
  const { auth } = await import("../lib/auth");
  await auth.api.signUpEmail({
    body: { email, password, name: "CRAZYWORK Owner" },
  });
  await prisma.user.update({
    where: { email },
    data: { role: "superadmin", emailVerified: true },
  });
  console.log(`✓ superadmin created (${email})`);
}

async function seedSettings() {
  for (const [key, value] of Object.entries(SETTING_DEFAULTS)) {
    await prisma.siteSetting.upsert({
      where: { key },
      create: { key, value: value as object },
      update: {},
    });
  }
  console.log("✓ site settings");
}

async function seedCatalogue() {
  const drop = await prisma.drop.upsert({
    where: { slug: "drop-01-foundation" },
    create: {
      name: "Drop 01 — Foundation",
      slug: "drop-01-foundation",
      status: "current",
      featuredOnHome: true,
      sortOrder: 0,
    },
    update: {},
  });

  const sizes = ["S", "M", "L", "XL"];
  const products = [
    {
      slug: "heavyweight-training-tee",
      name: "Heavyweight Training Tee",
      description:
        "240gsm combed cotton that holds its shape through the wash and the work. Boxy athletic cut, reinforced collar, zero shrink drama.\n\nMade for volume days and everything after.",
      category: "Tees",
      basePrice: "89.00",
      isNew: true,
      isLimited: false,
      colours: [
        { colour: "Black", image: "/images/products/tee-1.svg", cost: "32.00" },
        { colour: "Bone", image: "/images/products/tee-2.svg", cost: "32.00" },
      ],
      stock: 12,
    },
    {
      slug: "crazywork-oversized-hoodie",
      name: "CRAZYWORK Oversized Hoodie",
      description:
        "450gsm brushed fleece. Drop shoulders, heavyweight drawcords, embroidered wordmark. Warm-up, cool-down, everything in between.\n\nLimited run — when it's gone, it's gone.",
      category: "Hoodies",
      basePrice: "159.00",
      isNew: true,
      isLimited: true,
      colours: [
        { colour: "Black", image: "/images/products/hoodie-1.svg", cost: "61.00" },
        { colour: "Washed Brown", image: "/images/products/hoodie-2.svg", cost: "61.00" },
      ],
      stock: 8,
    },
    {
      slug: "engine-mesh-shorts",
      name: "Engine Mesh Shorts",
      description:
        "Double-layer mesh, 7-inch inseam, deep zip pockets that actually hold a phone. Built for leg day, worn everywhere.\n\nSweat-wicking and quick-dry — Malaysian humidity tested.",
      category: "Shorts",
      basePrice: "79.00",
      isNew: false,
      isLimited: false,
      colours: [
        { colour: "Black", image: "/images/products/shorts-1.svg", cost: "28.00" },
        { colour: "Olive", image: "/images/products/shorts-2.svg", cost: "28.00" },
      ],
      stock: 10,
    },
  ];

  for (const item of products) {
    const existing = await prisma.product.findUnique({
      where: { slug: item.slug },
    });
    if (existing) continue;
    await prisma.product.create({
      data: {
        slug: item.slug,
        name: item.name,
        description: item.description,
        category: item.category,
        basePrice: item.basePrice,
        isNew: item.isNew,
        isLimited: item.isLimited,
        status: "active",
        dropId: drop.id,
        metaTitle: `${item.name} · CRAZYWORK`,
        metaDescription: item.description.split("\n")[0].slice(0, 155),
        sizeGuide: item.category === "Shorts" ? SHORTS_SIZE_GUIDE : undefined,
        variants: {
          create: item.colours.flatMap((c) =>
            sizes.map((size) => ({
              size,
              colour: c.colour,
              stock: item.stock,
              sku: `CW-${item.slug.split("-")[0].toUpperCase()}-${c.colour
                .split(" ")[0]
                .toUpperCase()}-${size}`,
              costPrice: c.cost,
            })),
          ),
        },
        images: {
          create: item.colours.map((c, i) => ({
            imageUrl: c.image,
            alt: `${item.name} — ${c.colour}`,
            sortOrder: i,
          })),
        },
      },
    });
  }
  console.log("✓ drop + 3 products with size×colour variants");
}

async function seedCampaigns() {
  if ((await prisma.campaign.count()) > 0) {
    console.log("✓ campaigns exist — skipped");
    return;
  }
  await prisma.campaign.create({
    data: {
      name: "Bundle & Save",
      type: "quantity_tier",
      rules: {
        tiers: [
          { minQty: 2, percent: 5 },
          { minQty: 3, percent: 10 },
        ],
      },
      active: true,
      priority: 1,
    },
  });
  await prisma.campaign.create({
    data: {
      name: "Free Shipping over RM150",
      type: "free_shipping_over",
      rules: { minSubtotal: 15000 },
      active: true,
      priority: 0,
    },
  });
  console.log("✓ campaigns (quantity tiers 2→5%/3→10% + free ship RM150)");
}

async function seedContent() {
  const posts = [
    {
      slug: "crazywork-x-forge-gym",
      title: "CRAZYWORK × Forge Gym",
      type: "collab" as const,
      coverImageUrl: "/images/blog/collab.svg",
      excerpt:
        "Our first collaboration — a limited capsule with the gym where the brand was born.",
      blocks: [
        {
          type: "heading" as const,
          data: { text: "Where it started, who it's with", level: 2 },
        },
        {
          type: "paragraph" as const,
          data: {
            text: "Forge Gym gave us a key before we could afford the rent. This capsule is the thank-you: two pieces, one colourway, built with the people who spotted our first sets — **made to be trained in, not saved for later**.",
          },
        },
        { type: "image" as const, data: { url: "/images/blog/collab.svg", alt: "CRAZYWORK × Forge Gym" } },
        {
          type: "quote" as const,
          data: {
            text: "They trained here before anyone knew the name. That's the only endorsement we need.",
            attribution: "Coach Mael, Forge Gym KL",
          },
        },
        {
          type: "image_grid" as const,
          data: {
            images: [
              { url: "/images/community/c1.svg", alt: "Capsule fit 1" },
              { url: "/images/community/c2.svg", alt: "Capsule fit 2" },
              { url: "/images/community/c3.svg", alt: "Capsule fit 3" },
            ],
            columns: 3,
          },
        },
        { type: "button" as const, data: { label: "Shop the drop", href: "/shop" } },
      ],
    },
    {
      slug: "the-iron-doesnt-care",
      title: "The Iron Doesn't Care",
      type: "blog" as const,
      coverImageUrl: "/images/blog/iron.svg",
      excerpt:
        "The barbell has no opinion about your week, your excuses, or your feed. That's exactly why we love it.",
      blocks: [
        {
          type: "paragraph" as const,
          data: {
            text: "The iron doesn't care that you slept badly. It doesn't care about your promotion, your breakup, or your follower count. 100kg is 100kg at 6am and at midnight — and there's a strange comfort in that honesty.",
          },
        },
        { type: "heading" as const, data: { text: "Honest weight", level: 2 } },
        {
          type: "paragraph" as const,
          data: {
            text: "Everything else negotiates. The bar doesn't. You either moved it or you didn't, and *both outcomes teach you something true about today*.",
          },
        },
        {
          type: "quote" as const,
          data: { text: "The bar is the most honest conversation you'll have all day.", attribution: "" },
        },
        { type: "button" as const, data: { label: "Wear what you train for", href: "/shop" } },
      ],
    },
    {
      slug: "5-47am-club",
      title: "The 5:47AM Club",
      type: "blog" as const,
      coverImageUrl: "/images/blog/discipline.svg",
      excerpt:
        "Nobody claps at 5:47am. No likes, no playlist drops, no spotters. Just you and the decision you made last night.",
      blocks: [
        {
          type: "paragraph" as const,
          data: {
            text: "The 5:47AM Club has no membership card. You join it the night before — when you fill the bottle, pack the bag, and put the alarm across the room. The morning is just the receipt.",
          },
        },
        { type: "heading" as const, data: { text: "Reps nobody watched", level: 2 } },
        {
          type: "paragraph" as const,
          data: {
            text: "Progress is built in the sessions nobody sees. We made our gear for those hours — **the ones that don't make the highlight reel** but make the highlight reel possible.",
          },
        },
        { type: "image" as const, data: { url: "/images/blog/discipline.svg", alt: "Training before sunrise" } },
        { type: "button" as const, data: { label: "Join the club", href: "/shop" } },
      ],
    },
  ];

  for (const post of posts) {
    const existing = await prisma.contentPost.findUnique({
      where: { slug: post.slug },
    });
    if (existing) continue;
    await prisma.contentPost.create({
      data: {
        slug: post.slug,
        title: post.title,
        type: post.type,
        coverImageUrl: post.coverImageUrl,
        excerpt: post.excerpt,
        published: true,
        publishedAt: new Date(),
        metaTitle: `${post.title} · CRAZYWORK`,
        metaDescription: post.excerpt,
        blocks: {
          create: post.blocks.map((b, i) => ({
            type: b.type,
            data: b.data,
            sortOrder: i,
          })),
        },
      },
    });
  }
  console.log("✓ content (1 collab + 2 blog posts with blocks)");
}

async function seedFaqsAndCommunity() {
  if ((await prisma.faq.count()) === 0) {
    const faqs = [
      {
        category: "Shipping",
        question: "How long does delivery take?",
        answer:
          "West Malaysia: 2–4 working days. East Malaysia: 4–7 working days. Every order ships with tracking — you'll get the number by email once it's on the way.",
      },
      {
        category: "Shipping",
        question: "How much is shipping?",
        answer:
          "Flat RM8 (West) / RM15 (East). Free shipping on orders over RM150 — automatically applied at checkout.",
      },
      {
        category: "Sizing",
        question: "How does the fit run?",
        answer:
          "Our cut is athletic with room in the shoulders. If you're between sizes or want the oversized look, size up. Every product page has a size guide with measurements in cm.",
      },
      {
        category: "Returns",
        question: "Can I exchange or return?",
        answer:
          "Unworn items with tags can be exchanged within 14 days of delivery. Email hello@crazywork.my with your order number and we'll sort it.",
      },
      {
        category: "Drops",
        question: "Will sold-out pieces restock?",
        answer:
          "Usually no — drops are limited runs by design. Join the email list and we'll tell you before the next drop goes live.",
      },
      {
        category: "Payments",
        question: "What payment methods do you accept?",
        answer:
          "Cards, FPX online banking and GrabPay (via Stripe). All prices are in Malaysian Ringgit and include tax.",
      },
    ];
    await prisma.faq.createMany({
      data: faqs.map((f, i) => ({ ...f, sortOrder: i, published: true })),
    });
    console.log("✓ FAQs");
  }

  if ((await prisma.communityPhoto.count()) === 0) {
    await prisma.communityPhoto.createMany({
      data: [
        { imageUrl: "/images/community/c1.svg", caption: "@aina.lifts — deadlift PR day", sortOrder: 0 },
        { imageUrl: "/images/community/c2.svg", caption: "@hafiz.grinds — pull day", sortOrder: 1 },
        { imageUrl: "/images/community/c3.svg", caption: "@jtan.strong — 140kg squat", sortOrder: 2 },
        { imageUrl: "/images/community/c4.svg", caption: "@team.cw — 5:47am club", sortOrder: 3 },
        { imageUrl: "/images/blog/discipline.svg", caption: "before sunrise, after excuses", sortOrder: 4 },
      ],
    });
    console.log("✓ community photos");
  }
}

async function main() {
  await seedSettings();
  await seedCatalogue();
  await seedCampaigns();
  await seedContent();
  await seedFaqsAndCommunity();
  await seedSuperadmin();
  console.log("\nSeed complete. The work begins.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
