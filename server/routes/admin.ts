import { Hono } from "hono";
import { Prisma } from "@prisma/client";
import { getSuperadminSession } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/integrations/storage";
import {
  ordersToCsv,
  updateOrderStatus,
  type OrderStatus,
} from "@/lib/orders";
import { toSen } from "@/lib/money";
import {
  RUNTIME_SECRET_KEYS,
  bootSecretStatuses,
  deleteSecret,
  secretStatuses,
  setSecret,
  type RuntimeSecretKey,
} from "@/lib/secrets";
import {
  CONTENT_PAGES,
  getPageContent,
  setPageContent,
  type ContentPageKey,
} from "@/lib/content";
import { fetchInstagramThumbnail } from "@/lib/instagram";
import {
  getDefaultSizeGuide,
  isValidSizeGuide,
  setDefaultSizeGuide,
} from "@/lib/size-guide";
import {
  SETTING_DEFAULTS,
  getSettings,
  setSetting,
  type SettingKey,
} from "@/lib/settings";

export const admin = new Hono();

// Every /api/admin/* request is server-guarded: superadmin or 403.
admin.use("*", async (c, next) => {
  const session = await getSuperadminSession(c.req.raw.headers);
  if (!session) return c.json({ ok: false, message: "Forbidden" }, 403);
  await next();
});

// ───────── dashboard ─────────
const PAID_STATUSES = ["paid", "processing", "shipped", "delivered"] as const;

admin.get("/stats", async (c) => {
  const [orders, paidOrders, productCount, customers, subscribers] =
    await Promise.all([
      prisma.order.count(),
      prisma.order.findMany({
        where: { status: { in: [...PAID_STATUSES] } },
        select: { total: true, subtotal: true, discountAmount: true, items: true },
      }),
      prisma.product.count(),
      prisma.user.count({ where: { role: "customer" } }),
      prisma.emailSubscriber.count(),
    ]);

  // Estimated profit = net revenue (subtotal − discount) − COGS (cost × qty).
  // Items without a snapshot cost contribute 0 cost (profit slightly overstated).
  let revenueSen = 0;
  let netRevenueSen = 0;
  let cogsSen = 0;
  for (const order of paidOrders) {
    revenueSen += toSen(order.total);
    netRevenueSen += toSen(order.subtotal) - toSen(order.discountAmount);
    for (const item of order.items) {
      if (item.costPrice != null) cogsSen += toSen(item.costPrice) * item.quantity;
    }
  }

  const lowStock = await prisma.productVariant.findMany({
    where: { stock: { lte: 3 } },
    include: { product: { select: { name: true } } },
    orderBy: { stock: "asc" },
    take: 8,
  });

  // Active products with total stock for the dashboard strip.
  const active = await prisma.product.findMany({
    where: { status: "active" },
    include: {
      variants: { select: { stock: true } },
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  return c.json({
    orders,
    revenueSen,
    profitSen: netRevenueSen - cogsSen,
    products: productCount,
    customers,
    subscribers,
    lowStock: lowStock.map((v) => ({
      product: v.product.name,
      size: v.size,
      colour: v.colour,
      stock: v.stock,
    })),
    activeProducts: active.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      image: p.images[0]?.imageUrl ?? null,
      basePriceSen: toSen(p.basePrice),
      stock: p.variants.reduce((s, v) => s + v.stock, 0),
    })),
  });
});

// ───────── customers (CRM) ─────────
admin.get("/customers", async (c) => {
  const pageSize = 20;
  const page = Math.max(1, Number(c.req.query("page") ?? 1));
  const q = (c.req.query("q") ?? "").trim();
  const where = {
    role: "customer" as const,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, name: true, email: true, phone: true, createdAt: true },
    }),
  ]);

  const emails = users.map((u) => u.email.toLowerCase());
  const [orderCounts, paidSums] = await Promise.all([
    prisma.order.groupBy({
      by: ["customerEmail"],
      where: { customerEmail: { in: emails } },
      _count: { _all: true },
    }),
    prisma.order.groupBy({
      by: ["customerEmail"],
      where: { customerEmail: { in: emails }, status: { in: [...PAID_STATUSES] } },
      _sum: { total: true },
    }),
  ]);
  const countBy = new Map(
    orderCounts.map((o) => [o.customerEmail.toLowerCase(), o._count._all]),
  );
  const spentBy = new Map(
    paidSums.map((o) => [
      o.customerEmail.toLowerCase(),
      o._sum.total ? toSen(o._sum.total) : 0,
    ]),
  );

  return c.json({
    page,
    pageSize,
    total,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    customers: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      joinedAt: u.createdAt,
      orders: countBy.get(u.email.toLowerCase()) ?? 0,
      spentSen: spentBy.get(u.email.toLowerCase()) ?? 0,
    })),
  });
});

// ───────── uploads (Storage stub → /public/uploads) ─────────
admin.post("/upload", async (c) => {
  const form = await c.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return c.json({ ok: false, message: "No file" }, 400);
  }
  const uploaded = await storage.upload({
    name: file.name,
    contentType: file.type,
    bytes: Buffer.from(await file.arrayBuffer()),
  });
  return c.json({ ok: true, url: uploaded.url });
});

// ───────── products ─────────
admin.get("/products", async (c) => {
  const products = await prisma.product.findMany({
    include: { variants: true, images: { orderBy: { sortOrder: "asc" } }, drop: true },
    orderBy: { createdAt: "desc" },
  });
  return c.json({ products });
});

function productData(body: Record<string, unknown>) {
  return {
    slug: String(body.slug ?? "").trim(),
    name: String(body.name ?? "").trim(),
    description: (body.description as string) ?? null,
    category: (body.category as string) ?? null,
    basePrice: Number(body.basePrice ?? 0).toFixed(2),
    isNew: Boolean(body.isNew),
    isLimited: Boolean(body.isLimited),
    status: body.status === "active" ? ("active" as const) : ("draft" as const),
    externalUrl: (body.externalUrl as string) || null,
    dropId: (body.dropId as string) || null,
    metaTitle: (body.metaTitle as string) || null,
    metaDescription: (body.metaDescription as string) || null,
    // per-product override; DbNull → use the store default size guide
    sizeGuide:
      isValidSizeGuide(body.sizeGuide) && body.sizeGuide.rows.length > 0
        ? (body.sizeGuide as unknown as Prisma.InputJsonValue)
        : Prisma.DbNull,
  };
}

type VariantBody = {
  size?: unknown;
  colour?: unknown;
  stock?: unknown;
  sku?: unknown;
  costPrice?: unknown;
};

function variantData(v: VariantBody) {
  return {
    size: String(v.size ?? "").trim(),
    colour: String(v.colour ?? "").trim(),
    stock: Math.max(0, Math.floor(Number(v.stock ?? 0))),
    sku: v.sku ? String(v.sku) : null,
    costPrice:
      v.costPrice !== null && v.costPrice !== undefined && v.costPrice !== ""
        ? Number(v.costPrice).toFixed(2)
        : null,
  };
}

admin.post("/products", async (c) => {
  const body = await c.req.json();
  const data = productData(body);
  if (!data.slug || !data.name) {
    return c.json({ ok: false, message: "Slug and name are required." }, 400);
  }
  const product = await prisma.product.create({
    data: {
      ...data,
      variants: {
        create: ((body.variants as VariantBody[]) ?? []).map(variantData),
      },
      images: {
        create: ((body.images as { imageUrl: string; alt?: string }[]) ?? []).map(
          (img, i) => ({ imageUrl: img.imageUrl, alt: img.alt ?? null, sortOrder: i }),
        ),
      },
    },
  });
  return c.json({ ok: true, id: product.id });
});

admin.patch("/products/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  await prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id }, data: productData(body) });
    if (Array.isArray(body.variants)) {
      const incoming = (body.variants as (VariantBody & { id?: string })[]).map(
        (v) => ({ id: v.id, ...variantData(v) }),
      );
      const keepIds = incoming.filter((v) => v.id).map((v) => v.id as string);
      await tx.productVariant.deleteMany({
        where: { productId: id, id: { notIn: keepIds } },
      });
      for (const v of incoming) {
        if (v.id) {
          const { id: variantId, ...data } = v;
          await tx.productVariant.update({ where: { id: variantId }, data });
        } else {
          const { id: _ignored, ...data } = v;
          await tx.productVariant.create({ data: { ...data, productId: id } });
        }
      }
    }
    if (Array.isArray(body.images)) {
      await tx.productImage.deleteMany({ where: { productId: id } });
      await tx.productImage.createMany({
        data: (body.images as { imageUrl: string; alt?: string }[]).map(
          (img, i) => ({
            productId: id,
            imageUrl: img.imageUrl,
            alt: img.alt ?? null,
            sortOrder: i,
          }),
        ),
      });
    }
  });
  return c.json({ ok: true });
});

admin.delete("/products/:id", async (c) => {
  await prisma.product.delete({ where: { id: c.req.param("id") } });
  return c.json({ ok: true });
});

// ───────── drops ─────────
admin.get("/drops", async (c) => {
  const drops = await prisma.drop.findMany({
    include: { products: { select: { id: true, name: true } } },
    orderBy: { sortOrder: "asc" },
  });
  return c.json({ drops });
});

admin.post("/drops", async (c) => {
  const body = await c.req.json();
  const drop = await prisma.drop.create({
    data: {
      name: String(body.name ?? "").trim(),
      slug: String(body.slug ?? "").trim(),
      status: ["current", "past", "soldout"].includes(body.status)
        ? body.status
        : "current",
      sortOrder: Number(body.sortOrder ?? 0),
    },
  });
  return c.json({ ok: true, id: drop.id });
});

admin.patch("/drops/:id", async (c) => {
  const body = await c.req.json();
  await prisma.drop.update({
    where: { id: c.req.param("id") },
    data: {
      ...(body.name !== undefined ? { name: String(body.name) } : {}),
      ...(body.slug !== undefined ? { slug: String(body.slug) } : {}),
      ...(["current", "past", "soldout"].includes(body.status)
        ? { status: body.status }
        : {}),
      ...(body.sortOrder !== undefined
        ? { sortOrder: Number(body.sortOrder) }
        : {}),
    },
  });
  return c.json({ ok: true });
});

admin.delete("/drops/:id", async (c) => {
  await prisma.drop.delete({ where: { id: c.req.param("id") } });
  return c.json({ ok: true });
});

// ───────── orders ─────────
admin.get("/orders", async (c) => {
  const status = c.req.query("status");
  const orders = await prisma.order.findMany({
    where: status ? { status: status as OrderStatus } : undefined,
    include: { items: true },
    orderBy: { placedAt: "desc" },
  });
  return c.json({ orders });
});

admin.get("/orders/export.csv", async (c) => {
  const orders = await prisma.order.findMany({
    include: { items: true },
    orderBy: { placedAt: "desc" },
  });
  const csv = ordersToCsv(
    orders.map((o) => ({
      orderNumber: o.orderNumber,
      placedAt: o.placedAt,
      customerName: o.customerName,
      customerEmail: o.customerEmail,
      status: o.status,
      shippingZone: o.shippingZone,
      subtotalSen: toSen(o.subtotal),
      discountAmountSen: toSen(o.discountAmount),
      shippingFeeSen: toSen(o.shippingFee),
      totalSen: toSen(o.total),
      appliedDiscountLabel: o.appliedDiscountLabel,
      trackingNumber: o.trackingNumber,
      itemSummary: o.items
        .map((i) => `${i.quantity}x ${i.productName} (${i.size}/${i.colour})`)
        .join("; "),
    })),
  );
  return c.body(csv, 200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": "attachment; filename=crazywork-orders.csv",
  });
});

admin.patch("/orders/:id/status", async (c) => {
  const body = await c.req.json();
  const result = await updateOrderStatus(
    c.req.param("id"),
    body.status as OrderStatus,
    {
      courierName:
        body.courierName !== undefined ? String(body.courierName) : undefined,
      trackingNumber:
        body.trackingNumber !== undefined
          ? String(body.trackingNumber)
          : undefined,
    },
  );
  return c.json(result, result.ok ? 200 : 422);
});

// ───────── campaigns ─────────
admin.get("/campaigns", async (c) => {
  const campaigns = await prisma.campaign.findMany({
    orderBy: [{ active: "desc" }, { priority: "desc" }],
  });
  return c.json({ campaigns });
});

function campaignData(body: Record<string, unknown>) {
  return {
    name: String(body.name ?? "").trim(),
    type: body.type as
      | "quantity_tier"
      | "cart_total_tier"
      | "buy_x_get_y"
      | "free_shipping_over",
    rules: (body.rules ?? {}) as object,
    active: Boolean(body.active),
    startAt: body.startAt ? new Date(String(body.startAt)) : null,
    endAt: body.endAt ? new Date(String(body.endAt)) : null,
    priority: Number(body.priority ?? 0),
    stacksWithCodes: Boolean(body.stacksWithCodes),
  };
}

const CAMPAIGN_TYPES = [
  "quantity_tier",
  "cart_total_tier",
  "buy_x_get_y",
  "free_shipping_over",
];

admin.post("/campaigns", async (c) => {
  const body = await c.req.json();
  const data = campaignData(body);
  if (!data.name || !CAMPAIGN_TYPES.includes(data.type)) {
    return c.json({ ok: false, message: "Name and a valid type are required." }, 400);
  }
  const campaign = await prisma.campaign.create({ data });
  return c.json({ ok: true, id: campaign.id });
});

admin.patch("/campaigns/:id", async (c) => {
  const body = await c.req.json();
  await prisma.campaign.update({
    where: { id: c.req.param("id") },
    data: campaignData(body),
  });
  return c.json({ ok: true });
});

admin.delete("/campaigns/:id", async (c) => {
  await prisma.campaign.delete({ where: { id: c.req.param("id") } });
  return c.json({ ok: true });
});

// ───────── content (block builder) ─────────
admin.get("/content", async (c) => {
  const posts = await prisma.contentPost.findMany({
    include: { blocks: { orderBy: { sortOrder: "asc" } } },
    orderBy: { updatedAt: "desc" },
  });
  return c.json({ posts });
});

function postData(body: Record<string, unknown>) {
  return {
    slug: String(body.slug ?? "").trim(),
    title: String(body.title ?? "").trim(),
    coverImageUrl: (body.coverImageUrl as string) || null,
    type: body.type === "collab" ? ("collab" as const) : ("blog" as const),
    excerpt: (body.excerpt as string) || null,
    published: Boolean(body.published),
    publishedAt: body.published ? new Date() : null,
    metaTitle: (body.metaTitle as string) || null,
    metaDescription: (body.metaDescription as string) || null,
  };
}

const BLOCK_TYPES = ["heading", "paragraph", "image", "image_grid", "quote", "button"];

function blockCreates(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((b) => BLOCK_TYPES.includes(b?.type))
    .map((b, i) => ({
      type: b.type as "heading",
      data: (b.data ?? {}) as object,
      sortOrder: i,
    }));
}

admin.post("/content", async (c) => {
  const body = await c.req.json();
  const data = postData(body);
  if (!data.slug || !data.title) {
    return c.json({ ok: false, message: "Slug and title are required." }, 400);
  }
  const post = await prisma.contentPost.create({
    data: { ...data, blocks: { create: blockCreates(body.blocks) } },
  });
  return c.json({ ok: true, id: post.id });
});

admin.patch("/content/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const existing = await prisma.contentPost.findUnique({ where: { id } });
  if (!existing) return c.json({ ok: false }, 404);
  const data = postData(body);
  await prisma.$transaction([
    prisma.contentPost.update({
      where: { id },
      data: {
        ...data,
        publishedAt: data.published
          ? (existing.publishedAt ?? new Date())
          : null,
      },
    }),
    prisma.contentBlock.deleteMany({ where: { postId: id } }),
    prisma.contentBlock.createMany({
      data: blockCreates(body.blocks).map((b) => ({ ...b, postId: id })),
    }),
  ]);
  return c.json({ ok: true });
});

admin.delete("/content/:id", async (c) => {
  await prisma.contentPost.delete({ where: { id: c.req.param("id") } });
  return c.json({ ok: true });
});

// ───────── community photos ─────────
admin.get("/community", async (c) => {
  const photos = await prisma.communityPhoto.findMany({
    orderBy: { sortOrder: "asc" },
  });
  return c.json({ photos });
});

admin.post("/community", async (c) => {
  const body = await c.req.json();
  const postUrl = (body.postUrl as string) || null;
  let imageUrl = (body.imageUrl as string) || null;

  // a community item needs either an uploaded image or a post link
  if (!imageUrl && !postUrl) {
    return c.json({ ok: false, message: "Add an image or a post link." }, 400);
  }
  // link-only item → best-effort pull the post's thumbnail so the real photo shows
  if (!imageUrl && postUrl) {
    imageUrl = await fetchInstagramThumbnail(postUrl);
  }

  const photo = await prisma.communityPhoto.create({
    data: {
      imageUrl,
      caption: (body.caption as string) || null,
      postUrl,
      sortOrder: Number(body.sortOrder ?? 0),
      published: body.published === undefined ? true : Boolean(body.published),
    },
  });
  return c.json({ ok: true, id: photo.id, imageUrl });
});

admin.patch("/community/:id", async (c) => {
  const body = await c.req.json();
  await prisma.communityPhoto.update({
    where: { id: c.req.param("id") },
    data: {
      ...(body.caption !== undefined ? { caption: String(body.caption) } : {}),
      ...(body.postUrl !== undefined
        ? { postUrl: String(body.postUrl) || null }
        : {}),
      ...(body.sortOrder !== undefined
        ? { sortOrder: Number(body.sortOrder) }
        : {}),
      ...(body.published !== undefined
        ? { published: Boolean(body.published) }
        : {}),
    },
  });
  return c.json({ ok: true });
});

admin.delete("/community/:id", async (c) => {
  await prisma.communityPhoto.delete({ where: { id: c.req.param("id") } });
  return c.json({ ok: true });
});

// ───────── FAQs ─────────
admin.get("/faqs", async (c) => {
  const faqs = await prisma.faq.findMany({ orderBy: { sortOrder: "asc" } });
  return c.json({ faqs });
});

admin.post("/faqs", async (c) => {
  const body = await c.req.json();
  if (!body.question || !body.answer) {
    return c.json({ ok: false, message: "Question and answer required." }, 400);
  }
  const faq = await prisma.faq.create({
    data: {
      question: String(body.question),
      answer: String(body.answer),
      category: (body.category as string) || null,
      sortOrder: Number(body.sortOrder ?? 0),
      published: body.published === undefined ? true : Boolean(body.published),
    },
  });
  return c.json({ ok: true, id: faq.id });
});

admin.patch("/faqs/:id", async (c) => {
  const body = await c.req.json();
  await prisma.faq.update({
    where: { id: c.req.param("id") },
    data: {
      ...(body.question !== undefined ? { question: String(body.question) } : {}),
      ...(body.answer !== undefined ? { answer: String(body.answer) } : {}),
      ...(body.category !== undefined
        ? { category: String(body.category) || null }
        : {}),
      ...(body.sortOrder !== undefined
        ? { sortOrder: Number(body.sortOrder) }
        : {}),
      ...(body.published !== undefined
        ? { published: Boolean(body.published) }
        : {}),
    },
  });
  return c.json({ ok: true });
});

admin.delete("/faqs/:id", async (c) => {
  await prisma.faq.delete({ where: { id: c.req.param("id") } });
  return c.json({ ok: true });
});

// ───────── settings ─────────
admin.get("/settings", async (c) => {
  return c.json({ settings: await getSettings() });
});

admin.patch("/settings", async (c) => {
  const body = (await c.req.json()) as Record<string, unknown>;
  const validKeys = Object.keys(SETTING_DEFAULTS) as SettingKey[];
  for (const [key, value] of Object.entries(body)) {
    if (validKeys.includes(key as SettingKey)) {
      await setSetting(key as SettingKey, value as never);
    }
  }
  return c.json({ ok: true, settings: await getSettings() });
});

// ───────── page content (CMS) ─────────
admin.get("/page/:key", async (c) => {
  const key = c.req.param("key") as ContentPageKey;
  if (!(key in CONTENT_PAGES)) {
    return c.json({ ok: false, message: "Unknown page." }, 404);
  }
  return c.json({ content: await getPageContent(key), defaults: CONTENT_PAGES[key] });
});

admin.put("/page/:key", async (c) => {
  const key = c.req.param("key") as ContentPageKey;
  if (!(key in CONTENT_PAGES)) {
    return c.json({ ok: false, message: "Unknown page." }, 404);
  }
  const body = await c.req.json();
  if (!body.content || typeof body.content !== "object") {
    return c.json({ ok: false, message: "Invalid content." }, 400);
  }
  // merge over defaults so a partial/edited payload can't drop required fields
  await setPageContent(key, { ...CONTENT_PAGES[key], ...body.content });
  return c.json({ ok: true, content: await getPageContent(key) });
});

// ───────── default size guide ─────────
admin.get("/size-guide", async (c) => {
  return c.json({ sizeGuide: await getDefaultSizeGuide() });
});

admin.put("/size-guide", async (c) => {
  const body = await c.req.json();
  if (!isValidSizeGuide(body.sizeGuide)) {
    return c.json({ ok: false, message: "Invalid size guide." }, 400);
  }
  await setDefaultSizeGuide(body.sizeGuide);
  return c.json({ ok: true, sizeGuide: await getDefaultSizeGuide() });
});

// ───────── secrets (encrypted at rest, masked in transit) ─────────
admin.get("/secrets", async (c) => {
  return c.json({
    runtime: await secretStatuses(),
    boot: bootSecretStatuses(),
  });
});

admin.put("/secrets/:key", async (c) => {
  const key = c.req.param("key") as RuntimeSecretKey;
  if (!RUNTIME_SECRET_KEYS.includes(key)) {
    return c.json({ ok: false, message: "Unknown secret key." }, 400);
  }
  const body = await c.req.json();
  const value = typeof body.value === "string" ? body.value.trim() : "";
  if (!value) {
    await deleteSecret(key);
    return c.json({ ok: true, configured: false });
  }
  await setSecret(key, value);
  return c.json({ ok: true, configured: true });
});

// Stub "Test" button: a real impl pings the provider with the decrypted key.
admin.post("/secrets/:key/test", async (c) => {
  const key = c.req.param("key") as RuntimeSecretKey;
  if (!RUNTIME_SECRET_KEYS.includes(key)) {
    return c.json({ ok: false, message: "Unknown secret key." }, 400);
  }
  const statuses = await secretStatuses();
  const configured = statuses.find((s) => s.key === key)?.configured ?? false;
  return c.json({
    ok: configured,
    message: configured ? "Connection OK (stub)." : "Not configured.",
  });
});
