import { Hono } from "hono";
import { Prisma } from "@prisma/client";
import { getSuperadminSession } from "@/lib/admin-guard";
import { prisma, TX_OPTS } from "@/lib/db";
import { storage, deleteObjects } from "@/lib/integrations/storage";
import { validateUpload } from "@/lib/integrations/media";
import { mailer } from "@/lib/integrations/mailer";
import { payment } from "@/lib/integrations/payment";
import { verifyDiscord } from "@/lib/integrations/notifier";
import { removedUrls, contentMediaUrls } from "@/lib/integrations/media-cleanup";
import {
  createManualOrder,
  ordersToCsv,
  updateOrderStatus,
  type OrderStatus,
} from "@/lib/orders";
import { toSen } from "@/lib/money";
import {
  buildTimeseries,
  topProducts,
  type DashRange,
  type OrderInput,
} from "@/lib/dashboard-stats";
import {
  RUNTIME_SECRET_KEYS,
  bootSecretStatuses,
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
  deleteCampaignBatch,
  generateCampaignBatch,
  MAX_BATCH_CODES,
  updateCampaignBatch,
} from "@/lib/codes";
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
  const [orders, paidOrders, productCount, customers, subscribers, pendingCount] =
    await Promise.all([
      prisma.order.count(),
      prisma.order.findMany({
        where: { status: { in: [...PAID_STATUSES] } },
        select: { total: true, subtotal: true, discountAmount: true, items: true },
      }),
      prisma.product.count(),
      prisma.user.count({ where: { role: "customer" } }),
      prisma.emailSubscriber.count(),
      prisma.order.count({ where: { status: "pending" } }),
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

  const { lowStockThreshold } = await getSettings();
  const lowStock = await prisma.productVariant.findMany({
    where: { stock: { lte: lowStockThreshold } },
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
    pendingCount,
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

// Lightweight count of variants at/below the configurable low-stock threshold,
// for the sidebar restock badge.
admin.get("/low-stock-count", async (c) => {
  const { lowStockThreshold } = await getSettings();
  const count = await prisma.productVariant.count({
    where: { stock: { lte: lowStockThreshold } },
  });
  return c.json({ count });
});

// New orders awaiting fulfillment (paid, not yet processed/shipped) + their
// total paid, for the sidebar "new orders" badge.
admin.get("/new-orders-count", async (c) => {
  const where = { status: "paid" as const, archived: false };
  const [count, agg] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.aggregate({ where, _sum: { total: true } }),
  ]);
  return c.json({
    count,
    totalSen: agg._sum.total != null ? toSen(agg._sum.total) : 0,
  });
});

// Range-aware time series for the dashboard charts (revenue/profit/orders +
// top products). Re-fetched on every toggle change.
admin.get("/stats/timeseries", async (c) => {
  const range = ((): DashRange => {
    const r = c.req.query("range");
    return r === "7d" || r === "30d" || r === "90d" || r === "12mo" ? r : "12mo";
  })();
  const now = new Date();
  const windowStart = new Date(now);
  if (range === "7d") windowStart.setDate(windowStart.getDate() - 8);
  else if (range === "30d") windowStart.setDate(windowStart.getDate() - 31);
  else if (range === "90d") windowStart.setDate(windowStart.getDate() - 92);
  else windowStart.setMonth(windowStart.getMonth() - 12);

  const paid = await prisma.order.findMany({
    where: { status: { in: [...PAID_STATUSES] }, placedAt: { gte: windowStart } },
    select: {
      placedAt: true,
      total: true,
      subtotal: true,
      discountAmount: true,
      items: {
        select: {
          productId: true,
          productName: true,
          unitPrice: true,
          costPrice: true,
          quantity: true,
        },
      },
    },
  });

  const orders: OrderInput[] = paid.map((o) => ({
    placedAt: o.placedAt,
    totalSen: toSen(o.total),
    subtotalSen: toSen(o.subtotal),
    discountSen: toSen(o.discountAmount),
    items: o.items.map((it) => ({
      productId: it.productId,
      productName: it.productName,
      unitPriceSen: toSen(it.unitPrice),
      costPriceSen: it.costPrice == null ? null : toSen(it.costPrice),
      quantity: it.quantity,
    })),
  }));

  const buckets = buildTimeseries(orders, range, now);
  const top = topProducts(orders, range, now, 5);

  // Attach a thumbnail per top product (best-effort; product may be deleted).
  const images = await prisma.productImage.findMany({
    where: { productId: { in: top.map((t) => t.productId) } },
    orderBy: { sortOrder: "asc" },
    select: { productId: true, imageUrl: true },
  });
  const imageByProduct = new Map<string, string>();
  for (const img of images) {
    if (!imageByProduct.has(img.productId)) imageByProduct.set(img.productId, img.imageUrl);
  }

  return c.json({
    range,
    buckets,
    topProducts: top.map((t) => ({ ...t, image: imageByProduct.get(t.productId) ?? null })),
  });
});

// ───────── customers (CRM) ─────────
admin.get("/customers", async (c) => {
  const pageSize = 20;
  const page = Math.max(1, Number(c.req.query("page") ?? 1));
  const q = (c.req.query("q") ?? "").trim().toLowerCase();

  // A "customer" is anyone who has an account OR has placed an order. We merge
  // both sources by (lowercased) email so guest buyers show up too.
  const [users, orders] = await Promise.all([
    prisma.user.findMany({
      where: { role: "customer" },
      select: { id: true, name: true, email: true, phone: true, createdAt: true },
    }),
    prisma.order.findMany({
      select: {
        customerEmail: true,
        customerName: true,
        customerPhone: true,
        total: true,
        status: true,
        placedAt: true,
        manual: true,
        userId: true,
      },
    }),
  ]);

  interface Row {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    type: "account" | "guest";
    joinedAt: Date;
    lastOrderAt: Date | null;
    orders: number;
    spentSen: number;
  }
  const byEmail = new Map<string, Row>();

  for (const u of users) {
    byEmail.set(u.email.toLowerCase(), {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      type: "account",
      joinedAt: u.createdAt,
      lastOrderAt: null,
      orders: 0,
      spentSen: 0,
    });
  }

  const paid = new Set<string>(PAID_STATUSES);
  for (const o of orders) {
    // Anonymous walk-in (manual order not saved as a customer) → not in the CRM.
    if ((o.manual && !o.userId) || !o.customerEmail) continue;
    const key = o.customerEmail.toLowerCase();
    let row = byEmail.get(key);
    if (!row) {
      row = {
        id: `guest:${key}`,
        name: o.customerName,
        email: o.customerEmail,
        phone: o.customerPhone,
        type: "guest",
        joinedAt: o.placedAt,
        lastOrderAt: null,
        orders: 0,
        spentSen: 0,
      };
      byEmail.set(key, row);
    }
    row.orders += 1;
    if (paid.has(o.status)) row.spentSen += toSen(o.total);
    if (!row.lastOrderAt || o.placedAt > row.lastOrderAt) row.lastOrderAt = o.placedAt;
    if (o.placedAt < row.joinedAt) row.joinedAt = o.placedAt;
    if (!row.name && o.customerName) row.name = o.customerName;
    if (!row.phone && o.customerPhone) row.phone = o.customerPhone;
  }

  let rows = [...byEmail.values()];
  if (q) {
    rows = rows.filter(
      (r) =>
        (r.name ?? "").toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q),
    );
  }
  rows.sort(
    (a, b) =>
      (b.lastOrderAt ?? b.joinedAt).getTime() -
      (a.lastOrderAt ?? a.joinedAt).getTime(),
  );

  const total = rows.length;
  const start = (page - 1) * pageSize;

  return c.json({
    page,
    pageSize,
    total,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    customers: rows.slice(start, start + pageSize),
  });
});

// One customer's wishlist, looked up by email → the user account behind it (any
// role). Returns hasAccount=false when no login account exists for that email.
admin.get("/customers/wishlist", async (c) => {
  const email = (c.req.query("email") ?? "").trim().toLowerCase();
  if (!email) return c.json({ hasAccount: false, items: [] });
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) return c.json({ hasAccount: false, items: [] });
  const items = await prisma.wishlistItem.findMany({
    where: { userId: user.id },
    include: {
      product: {
        include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return c.json({
    hasAccount: true,
    items: items.map((w) => ({
      productId: w.productId,
      name: w.product.name,
      slug: w.product.slug,
      image: w.product.images[0]?.imageUrl ?? null,
    })),
  });
});

// ───────── wishlist (demand signal) ─────────
admin.get("/wishlist", async (c) => {
  const grouped = await prisma.wishlistItem.groupBy({
    by: ["productId"],
    _count: { _all: true },
    orderBy: { _count: { productId: "desc" } },
    take: 10,
  });
  const products = await prisma.product.findMany({
    where: { id: { in: grouped.map((g) => g.productId) } },
    include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  return c.json({
    items: grouped
      .map((g) => {
        const p = byId.get(g.productId);
        if (!p) return null;
        return {
          productId: g.productId,
          name: p.name,
          image: p.images[0]?.imageUrl ?? null,
          count: g._count._all,
        };
      })
      .filter(Boolean),
  });
});

// ───────── uploads (Storage stub → /public/uploads) ─────────
admin.post("/upload", async (c) => {
  const form = await c.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return c.json({ ok: false, message: "No file" }, 400);
  }
  const check = validateUpload({ contentType: file.type, size: file.size });
  if (!check.ok) {
    return c.json({ ok: false, message: check.error }, 400);
  }
  const uploaded = await storage.upload({
    name: file.name,
    contentType: file.type,
    bytes: Buffer.from(await file.arrayBuffer()),
  });
  return c.json({ ok: true, url: uploaded.url, mediaType: check.mediaType });
});

// ───────── products ─────────
admin.get("/products", async (c) => {
  const [products, { lowStockThreshold }] = await Promise.all([
    prisma.product.findMany({
      include: {
        variants: { orderBy: { sortOrder: "asc" } },
        images: { orderBy: { sortOrder: "asc" } },
        drop: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    getSettings(),
  ]);
  return c.json({ products, lowStockThreshold });
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
    soldOut: Boolean(body.soldOut),
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

type ImageBody = {
  imageUrl: string;
  alt?: string;
  mediaType?: "image" | "video";
};

function variantData(v: VariantBody, sortOrder: number) {
  return {
    size: String(v.size ?? "").trim(),
    colour: String(v.colour ?? "").trim(),
    stock: Math.max(0, Math.floor(Number(v.stock ?? 0))),
    sku: v.sku ? String(v.sku) : null,
    costPrice:
      v.costPrice !== null && v.costPrice !== undefined && v.costPrice !== ""
        ? Number(v.costPrice).toFixed(2)
        : null,
    sortOrder,
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
        create: ((body.variants as VariantBody[]) ?? []).map((v, i) =>
          variantData(v, i),
        ),
      },
      images: {
        create: ((body.images as ImageBody[]) ?? []).map((img, i) => ({
          imageUrl: img.imageUrl,
          alt: img.alt ?? null,
          sortOrder: i,
          mediaType: img.mediaType ?? "image",
        })),
      },
    },
  });
  return c.json({ ok: true, id: product.id });
});

admin.patch("/products/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  let orphanedImages: string[] = [];
  await prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id }, data: productData(body) });
    if (Array.isArray(body.variants)) {
      const incoming = (body.variants as (VariantBody & { id?: string })[]).map(
        (v, i) => ({ id: v.id, ...variantData(v, i) }),
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
      const newImages = body.images as ImageBody[];
      const existing = await tx.productImage.findMany({
        where: { productId: id },
        select: { imageUrl: true },
      });
      orphanedImages = removedUrls(
        existing.map((i) => i.imageUrl),
        newImages.map((i) => i.imageUrl),
      );
      await tx.productImage.deleteMany({ where: { productId: id } });
      await tx.productImage.createMany({
        data: newImages.map((img, i) => ({
          productId: id,
          imageUrl: img.imageUrl,
          alt: img.alt ?? null,
          sortOrder: i,
          mediaType: img.mediaType ?? "image",
        })),
      });
    }
  }, TX_OPTS);
  await deleteObjects(orphanedImages);
  return c.json({ ok: true });
});

admin.delete("/products/:id", async (c) => {
  const id = c.req.param("id");
  const images = await prisma.productImage.findMany({
    where: { productId: id },
    select: { imageUrl: true },
  });
  await prisma.product.delete({ where: { id } });
  await deleteObjects(images.map((i) => i.imageUrl));
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
      status: ["upcoming", "current", "past", "soldout"].includes(body.status)
        ? body.status
        : "current",
      featuredOnHome: Boolean(body.featuredOnHome),
      sortOrder: Number(body.sortOrder ?? 0),
    },
  });
  return c.json({ ok: true, id: drop.id });
});

// Reorder via drag-and-drop: ids are top-to-bottom; sortOrder ascending, so the
// top drop stacks first on the home page.
admin.post("/drops/reorder", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { ids?: unknown };
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((x): x is string => typeof x === "string")
    : [];
  if (!ids.length) {
    return c.json({ ok: false, message: "No order provided." }, 400);
  }
  await prisma.$transaction(
    ids.map((id, i) =>
      prisma.drop.update({ where: { id }, data: { sortOrder: i } }),
    ),
  );
  return c.json({ ok: true });
});

admin.patch("/drops/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const existing = await prisma.drop.findUnique({ where: { id } });
  const updated = await prisma.drop.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: String(body.name) } : {}),
      ...(body.slug !== undefined ? { slug: String(body.slug) } : {}),
      ...(["upcoming", "current", "past", "soldout"].includes(body.status)
        ? { status: body.status }
        : {}),
      ...(body.featuredOnHome !== undefined
        ? { featuredOnHome: Boolean(body.featuredOnHome) }
        : {}),
      ...(body.countdownUntil !== undefined
        ? { countdownUntil: body.countdownUntil ? new Date(body.countdownUntil) : null }
        : {}),
      ...(body.sortOrder !== undefined
        ? { sortOrder: Number(body.sortOrder) }
        : {}),
    },
  });

  // Launch: upcoming → current fires the "notify me" blast once, then clears
  // the signups so re-saving the drop can't double-send.
  if (existing?.status === "upcoming" && updated.status === "current") {
    const signups = await prisma.dropNotifySignup.findMany({
      where: { dropId: id },
    });
    if (signups.length > 0) {
      const url = `${new URL(c.req.url).origin}/drops`;
      await Promise.allSettled(
        signups.map((s) =>
          mailer.send(s.email, "drop_live", { dropName: updated.name, url }),
        ),
      );
      await prisma.dropNotifySignup.deleteMany({ where: { dropId: id } });
    }
  }
  return c.json({ ok: true });
});

admin.delete("/drops/:id", async (c) => {
  await prisma.drop.delete({ where: { id: c.req.param("id") } });
  return c.json({ ok: true });
});

// ───────── orders ─────────
admin.get("/orders", async (c) => {
  const status = c.req.query("status");
  const archived = c.req.query("archived") === "true";
  const { showTestOrders } = await getSettings();
  const orders = await prisma.order.findMany({
    where: {
      // Hide cancelled by default; show them only when explicitly filtered.
      ...(status
        ? { status: status as OrderStatus }
        : { status: { not: "cancelled" } }),
      ...(showTestOrders ? {} : { isTest: false }),
      archived,
    },
    include: { items: true },
    orderBy: { placedAt: "desc" },
  });
  return c.json({ orders });
});

// Soft delete: archive / restore an order (hidden from the active list, never
// destroyed — orders are financial records).
admin.patch("/orders/:id/archive", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as { archived?: unknown };
  const order = await prisma.order.findUnique({ where: { id }, select: { id: true } });
  if (!order) return c.json({ ok: false, message: "Order not found." }, 404);
  await prisma.order.update({
    where: { id },
    data: { archived: body.archived !== false },
  });
  return c.json({ ok: true });
});

// Hard delete — irreversible. Only allowed once an order is archived, so it
// can't be triggered straight from the active list. Items cascade.
admin.delete("/orders/:id", async (c) => {
  const id = c.req.param("id");
  const order = await prisma.order.findUnique({
    where: { id },
    select: { archived: true },
  });
  if (!order) return c.json({ ok: false, message: "Order not found." }, 404);
  if (!order.archived) {
    return c.json(
      { ok: false, message: "Archive the order before deleting it." },
      400,
    );
  }
  await prisma.order.delete({ where: { id } });
  return c.json({ ok: true });
});

// Manual / offline order creation (walk-in sales). Deducts stock when the chosen
// status implies the sale is done.
admin.post("/orders", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const rawItems = Array.isArray(body.items) ? body.items : [];
  const items = rawItems
    .map((i) => i as { variantId?: unknown; quantity?: unknown })
    .filter((i) => typeof i.variantId === "string")
    .map((i) => ({
      variantId: i.variantId as string,
      quantity: Math.max(1, Math.floor(Number(i.quantity) || 1)),
    }));
  const customer = (body.customer ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const validStatuses: OrderStatus[] = [
    "pending",
    "paid",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
  ];
  const status = validStatuses.includes(body.status as OrderStatus)
    ? (body.status as OrderStatus)
    : "paid";

  const totalSen =
    body.totalSen != null && Number.isFinite(Number(body.totalSen))
      ? Math.max(0, Math.round(Number(body.totalSen)))
      : undefined;

  const result = await createManualOrder({
    items,
    customer: {
      name: str(customer.name),
      email: str(customer.email),
      phone: str(customer.phone),
      address: str(customer.address),
      state: str(customer.state),
    },
    status,
    note: str(body.note) || null,
    totalSen,
    createCustomer: body.createCustomer === true,
    paymentMethod: str(body.paymentMethod) || undefined,
  });
  return c.json(result, result.ok ? 200 : 422);
});

// Quick restock of a single variant (used by the manual-order stock dialog).
admin.patch("/variants/:id", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as { stock?: unknown };
  const stock = Math.max(0, Math.round(Number(body.stock)));
  if (!Number.isFinite(stock)) {
    return c.json({ ok: false, message: "Invalid stock." }, 400);
  }
  const v = await prisma.productVariant.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!v) return c.json({ ok: false, message: "Variant not found." }, 404);
  await prisma.productVariant.update({ where: { id }, data: { stock } });
  return c.json({ ok: true, stock });
});

// Edit an existing order: amount paid (after-the-fact discount) and/or the
// recorded payment method.
admin.patch("/orders/:id", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as {
    totalSen?: unknown;
    paymentMethod?: unknown;
  };
  const order = await prisma.order.findUnique({
    where: { id },
    select: { subtotal: true },
  });
  if (!order) return c.json({ ok: false, message: "Order not found." }, 404);

  const data: Prisma.OrderUpdateInput = {};

  if (body.totalSen !== undefined) {
    const totalSen = Math.max(0, Math.round(Number(body.totalSen)));
    if (!Number.isFinite(totalSen)) {
      return c.json({ ok: false, message: "Invalid amount." }, 400);
    }
    const subtotalSen = toSen(order.subtotal);
    const discountSen = Math.max(0, subtotalSen - totalSen);
    data.total = (totalSen / 100).toFixed(2);
    data.discountAmount = (discountSen / 100).toFixed(2);
    data.appliedDiscountLabel = discountSen > 0 ? "Manual adjustment" : null;
  }

  if (typeof body.paymentMethod === "string") {
    data.paymentMethod = body.paymentMethod.trim() || null;
  }

  if (Object.keys(data).length === 0) {
    return c.json({ ok: false, message: "Nothing to update." }, 400);
  }
  await prisma.order.update({ where: { id }, data });
  return c.json({ ok: true });
});

// Per-status counts for the orders overview bar (always all orders, ignores the
// active list filter).
admin.get("/orders/counts", async (c) => {
  const orders = await prisma.order.findMany({
    where: { archived: false },
    select: { status: true, items: { select: { quantity: true } } },
  });
  const counts: Record<string, number> = {};
  const itemCounts: Record<string, number> = {};
  for (const o of orders) {
    counts[o.status] = (counts[o.status] ?? 0) + 1;
    const qty = o.items.reduce((s, i) => s + i.quantity, 0);
    itemCounts[o.status] = (itemCounts[o.status] ?? 0) + qty;
  }
  return c.json({ counts, itemCounts });
});

admin.get("/orders/export.csv", async (c) => {
  const status = c.req.query("status");
  const from = c.req.query("from");
  const to = c.req.query("to");
  const archived = c.req.query("archived") === "true";
  const includeTest = c.req.query("includeTest") === "true";

  const where: Prisma.OrderWhereInput = { archived };
  if (status) where.status = status as OrderStatus;
  if (!includeTest) where.isTest = false;
  if (from || to) {
    const placedAt: Prisma.DateTimeFilter = {};
    if (from) placedAt.gte = new Date(`${from}T00:00:00`);
    if (to) placedAt.lte = new Date(`${to}T23:59:59`);
    where.placedAt = placedAt;
  }

  const orders = await prisma.order.findMany({
    where,
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
  if (body.status === "shipped") {
    const courier =
      typeof body.courierName === "string" ? body.courierName.trim() : "";
    const tracking =
      typeof body.trackingNumber === "string" ? body.trackingNumber.trim() : "";
    if (!courier || !tracking) {
      return c.json(
        {
          ok: false,
          message: "Courier and tracking number are required to mark an order shipped.",
        },
        422,
      );
    }
  }
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
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });
  return c.json({ campaigns });
});

// Reorder via drag-and-drop: ids are top-to-bottom, top wins ties. Assign
// descending priorities so the on-screen order matches the saved order.
admin.post("/campaigns/reorder", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { ids?: unknown };
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((x): x is string => typeof x === "string")
    : [];
  if (!ids.length) {
    return c.json({ ok: false, message: "No order provided." }, 400);
  }
  const n = ids.length;
  await prisma.$transaction(
    ids.map((id, i) =>
      prisma.campaign.update({ where: { id }, data: { priority: n - i } }),
    ),
  );
  return c.json({ ok: true });
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
    type: "collab" as const, // blog is gone — all content posts are collabs
    excerpt: (body.excerpt as string) || null,
    featured: Boolean(body.featured),
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
  const existing = await prisma.contentPost.findUnique({
    where: { id },
    include: { blocks: true },
  });
  if (!existing) return c.json({ ok: false }, 404);
  const data = postData(body);
  const newBlocks = blockCreates(body.blocks);
  const oldMedia = contentMediaUrls(
    existing.coverImageUrl,
    existing.blocks.map((b) => ({
      type: b.type,
      data: (b.data ?? {}) as Record<string, unknown>,
    })),
  );
  const newMedia = contentMediaUrls(
    data.coverImageUrl,
    newBlocks.map((b) => ({
      type: b.type,
      data: (b.data ?? {}) as Record<string, unknown>,
    })),
  );
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
      data: newBlocks.map((b) => ({ ...b, postId: id })),
    }),
  ]);
  await deleteObjects(removedUrls(oldMedia, newMedia));
  return c.json({ ok: true });
});

admin.delete("/content/:id", async (c) => {
  const id = c.req.param("id");
  const post = await prisma.contentPost.findUnique({
    where: { id },
    include: { blocks: true },
  });
  await prisma.contentPost.delete({ where: { id } });
  if (post) {
    await deleteObjects(
      contentMediaUrls(
        post.coverImageUrl,
        post.blocks.map((b) => ({
          type: b.type,
          data: (b.data ?? {}) as Record<string, unknown>,
        })),
      ),
    );
  }
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
  const id = c.req.param("id");
  const photo = await prisma.communityPhoto.findUnique({ where: { id } });
  // Idempotent: a double-click / stale list shouldn't 500 on an already-gone row.
  if (!photo) return c.json({ ok: true });
  await prisma.communityPhoto.deleteMany({ where: { id } });
  await deleteObjects([photo.imageUrl]);
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

// ───────── promo code batches (campaign / influencer codes) ─────────
function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

admin.post("/code-batches", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const prefix = typeof body.prefix === "string" ? body.prefix.trim() : "";
  const count = Math.floor(Number(body.count));
  const discountType = body.discountType === "fixed" ? "fixed" : "percent";
  const value = Number(body.value);
  const expiresAt =
    typeof body.expiresAt === "string" && body.expiresAt
      ? new Date(body.expiresAt)
      : null;

  if (!label) return c.json({ ok: false, message: "Campaign label is required." }, 400);
  if (!prefix.replace(/[^a-z0-9]/gi, "")) {
    return c.json({ ok: false, message: "Prefix needs letters or numbers." }, 400);
  }
  if (!Number.isFinite(count) || count < 1 || count > MAX_BATCH_CODES) {
    return c.json({ ok: false, message: `Generate 1–${MAX_BATCH_CODES} codes.` }, 400);
  }
  if (!Number.isFinite(value) || value <= 0) {
    return c.json({ ok: false, message: "Enter a discount value." }, 400);
  }
  if (discountType === "percent" && value > 100) {
    return c.json({ ok: false, message: "Percentage can't exceed 100." }, 400);
  }

  const created = await generateCampaignBatch({
    label,
    prefix,
    count,
    percentage: discountType === "percent" ? Math.round(value) : 0,
    amountOffSen: discountType === "fixed" ? Math.round(value * 100) : null,
    expiresAt,
  });
  return c.json({ ok: true, created });
});

admin.get("/code-batches", async (c) => {
  // Shared quota codes are also source=campaign with a batchLabel; exclude them
  // (maxRedemptions != null) so they don't appear as one-off "batches".
  const where = {
    source: "campaign" as const,
    batchLabel: { not: null },
    maxRedemptions: null,
  };
  const [all, used] = await Promise.all([
    prisma.discountCode.groupBy({
      by: ["batchLabel"],
      where,
      _count: { _all: true },
      _min: { createdAt: true, percentage: true, amountOffSen: true, expiresAt: true },
    }),
    prisma.discountCode.groupBy({
      by: ["batchLabel"],
      where: { ...where, used: true },
      _count: { _all: true },
    }),
  ]);
  const usedMap = new Map(used.map((g) => [g.batchLabel, g._count._all]));
  const batches = all
    .map((g) => ({
      label: g.batchLabel,
      total: g._count._all,
      used: usedMap.get(g.batchLabel) ?? 0,
      percentage: g._min.percentage ?? 0,
      amountOffSen: g._min.amountOffSen,
      expiresAt: g._min.expiresAt,
      createdAt: g._min.createdAt,
    }))
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  return c.json({ batches });
});

admin.get("/code-batches/:label", async (c) => {
  const label = c.req.param("label");
  const paid = new Set<string>(PAID_STATUSES);
  const codes = await prisma.discountCode.findMany({
    where: { source: "campaign", batchLabel: label, maxRedemptions: null },
    include: {
      orders: {
        select: {
          orderNumber: true,
          customerName: true,
          customerEmail: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return c.json({
    label,
    codes: codes.map((dc) => {
      const order = dc.orders.find((o) => paid.has(o.status)) ?? null;
      return {
        code: dc.code,
        used: dc.used,
        percentage: dc.percentage,
        amountOffSen: dc.amountOffSen,
        redeemedBy: order
          ? {
              orderNumber: order.orderNumber,
              customer: order.customerName,
              email: order.customerEmail,
            }
          : null,
      };
    }),
  });
});

admin.patch("/code-batches/:label", async (c) => {
  const label = c.req.param("label");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;

  const newLabel = typeof body.label === "string" ? body.label.trim() : undefined;
  const discountType =
    body.discountType === "fixed"
      ? "fixed"
      : body.discountType === "percent"
        ? "percent"
        : undefined;
  const value = body.value == null ? undefined : Number(body.value);
  const expiresAt =
    body.expiresAt === undefined
      ? undefined
      : typeof body.expiresAt === "string" && body.expiresAt
        ? new Date(body.expiresAt)
        : null;

  if (newLabel !== undefined && !newLabel) {
    return c.json({ ok: false, message: "Campaign label is required." }, 400);
  }

  let percentage: number | undefined;
  let amountOffSen: number | null | undefined;
  if (discountType !== undefined) {
    if (!Number.isFinite(value) || (value as number) <= 0) {
      return c.json({ ok: false, message: "Enter a discount value." }, 400);
    }
    if (discountType === "percent") {
      if ((value as number) > 100) {
        return c.json({ ok: false, message: "Percentage can't exceed 100." }, 400);
      }
      percentage = Math.round(value as number);
      amountOffSen = null;
    } else {
      percentage = 0;
      amountOffSen = Math.round((value as number) * 100);
    }
  }

  const updated = await updateCampaignBatch({
    label,
    newLabel,
    percentage,
    amountOffSen,
    expiresAt,
  });
  return c.json({ ok: true, updated });
});

admin.delete("/code-batches/:label", async (c) => {
  const label = c.req.param("label");
  const deleted = await deleteCampaignBatch(label);
  return c.json({ ok: true, deleted });
});

admin.get("/code-batches/:label/export.csv", async (c) => {
  const label = c.req.param("label");
  const paid = new Set<string>(PAID_STATUSES);
  const codes = await prisma.discountCode.findMany({
    where: { source: "campaign", batchLabel: label, maxRedemptions: null },
    include: {
      orders: {
        select: { orderNumber: true, customerEmail: true, status: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  const header = "Code,Discount,Status,Redeemed by,Order";
  const rows = codes.map((dc) => {
    const discount = dc.amountOffSen
      ? `RM${(dc.amountOffSen / 100).toFixed(2)}`
      : `${dc.percentage}%`;
    const order = dc.orders.find((o) => paid.has(o.status)) ?? null;
    return [
      dc.code,
      discount,
      dc.used ? "Used" : "Unused",
      order?.customerEmail ?? "",
      order?.orderNumber ?? "",
    ]
      .map(csvCell)
      .join(",");
  });
  const csv = [header, ...rows].join("\n") + "\n";
  const safe = label.replace(/[^a-z0-9]+/gi, "_");
  return c.body(csv, 200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename=${safe}-codes.csv`,
  });
});

// ───────── shared quota codes (one code, many redemptions) ─────────

admin.post("/shared-codes", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  // Stored exactly as a customer types it (uppercased) — the checkout lookup only
  // uppercases, so the code must be plain alphanumeric with no spaces/symbols.
  const code =
    typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const quota = Math.floor(Number(body.quota));
  const discountType = body.discountType === "fixed" ? "fixed" : "percent";
  const value = Number(body.value);
  const expiresAt =
    typeof body.expiresAt === "string" && body.expiresAt
      ? new Date(body.expiresAt)
      : null;

  if (!/^[A-Z0-9]+$/.test(code)) {
    return c.json(
      { ok: false, message: "Code must be letters and numbers only (no spaces or symbols)." },
      400,
    );
  }
  if (!Number.isFinite(quota) || quota < 1) {
    return c.json({ ok: false, message: "Quota must be at least 1." }, 400);
  }
  if (!Number.isFinite(value) || value <= 0) {
    return c.json({ ok: false, message: "Enter a discount value." }, 400);
  }
  if (discountType === "percent" && value > 100) {
    return c.json({ ok: false, message: "Percentage can't exceed 100." }, 400);
  }

  const existing = await prisma.discountCode.findUnique({ where: { code } });
  if (existing) return c.json({ ok: false, message: "That code already exists." }, 409);

  const created = await prisma.discountCode.create({
    data: {
      code,
      issuedEmail: null,
      percentage: discountType === "percent" ? Math.round(value) : 0,
      amountOffSen: discountType === "fixed" ? Math.round(value * 100) : null,
      source: "campaign",
      batchLabel: label || code,
      maxRedemptions: quota,
      expiresAt,
    },
  });
  return c.json({ ok: true, id: created.id });
});

admin.get("/shared-codes", async (c) => {
  const rows = await prisma.discountCode.findMany({
    where: { maxRedemptions: { not: null } },
    orderBy: { createdAt: "desc" },
  });
  return c.json({
    codes: rows.map((r) => ({
      id: r.id,
      code: r.code,
      label: r.batchLabel,
      quota: r.maxRedemptions ?? 0,
      redeemed: r.redeemedCount,
      over: Math.max(0, r.redeemedCount - (r.maxRedemptions ?? 0)),
      percentage: r.percentage,
      amountOffSen: r.amountOffSen,
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
    })),
  });
});

admin.patch("/shared-codes/:id", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Record<string, unknown> = {};

  if (typeof body.label === "string") data.batchLabel = body.label.trim() || null;
  if (body.quota !== undefined) {
    const quota = Math.floor(Number(body.quota));
    if (!Number.isFinite(quota) || quota < 1) {
      return c.json({ ok: false, message: "Quota must be at least 1." }, 400);
    }
    data.maxRedemptions = quota;
  }
  if (body.discountType === "percent" && body.value !== undefined) {
    const value = Number(body.value);
    if (!Number.isFinite(value) || value <= 0 || value > 100) {
      return c.json({ ok: false, message: "Enter a percentage 1–100." }, 400);
    }
    data.percentage = Math.round(value);
    data.amountOffSen = null;
  }
  if (body.discountType === "fixed" && body.value !== undefined) {
    const value = Number(body.value);
    if (!Number.isFinite(value) || value <= 0) {
      return c.json({ ok: false, message: "Enter a discount value." }, 400);
    }
    data.amountOffSen = Math.round(value * 100);
    data.percentage = 0;
  }
  if ("expiresAt" in body) {
    data.expiresAt =
      typeof body.expiresAt === "string" && body.expiresAt
        ? new Date(body.expiresAt)
        : null;
  }

  await prisma.discountCode.update({ where: { id }, data });
  return c.json({ ok: true });
});

admin.delete("/shared-codes/:id", async (c) => {
  const id = c.req.param("id");
  await prisma.discountCode.delete({ where: { id } });
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
    // No-op: an empty Save must never wipe an already-stored secret (footgun).
    // Report the current state so the UI status dot stays accurate.
    const existing = await prisma.encryptedSecret.findUnique({ where: { key } });
    return c.json({ ok: true, configured: Boolean(existing) });
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

// Real Stripe connectivity check: pings Stripe with the active mode's secret key.
admin.post("/integrations/stripe/test", async (c) => {
  return c.json(await payment.verifyConnection());
});

// Real Resend connectivity check: validates the saved API key.
admin.post("/integrations/resend/test", async (c) => {
  return c.json(await mailer.verifyConnection());
});

// Real Discord check: posts a test embed to each configured webhook channel.
admin.post("/integrations/discord/test", async (c) => {
  return c.json(await verifyDiscord());
});
