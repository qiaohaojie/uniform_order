import { db, orders, orderLines, catalogItems, catalogVariants, tenants, orderRefunds, parentChildren, tenantLegalVersions } from "./index";
import { and, eq, desc, or, gte, inArray, lt, sql, sum, isNotNull } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { cache } from "react";
import type { CatalogItem, Tenant } from "@/lib/data";

export type LiveOrderStatus = "pending_payment" | "new" | "packing" | "ready" | "collected" | "partially_refunded" | "refunded";

export type LiveRecentOrder = {
  id: string;
  tenantId: string;
  status: LiveOrderStatus;
  delivery: "pickup" | "ship";
  kid: string;
  year: string;
  rollClass: string;
  parent: string;
  email: string;
  total: number;
  createdAt: Date | null;
};

export type LiveTopItem = {
  name: string;
  qty: number;
  revenue: number;
};

export type LiveDashboardData = {
  revenue: number;
  orders: number;
  avgOrder: number;
  awaitingPickup: number;
  readyOverSevenDays: number;
  spark: number[];
  topItems: LiveTopItem[];
  recentOrders: LiveRecentOrder[];
};

export type LiveMonthlyRevenue = {
  month: string;
  label: string;
  revenue: number;
};

export type LiveCategoryRevenue = {
  cat: string;
  revenue: number;
  pct: number;
};

export type LiveGstRow = {
  period: string;
  gross: number;
  gst: number;
  net: number;
  fees: number;
  payout: number;
};

export type LiveReportsData = {
  revenue: number;
  orders: number;
  avgOrder: number;
  gst: number;
  monthlyRevenue: LiveMonthlyRevenue[];
  categoryRevenue: LiveCategoryRevenue[];
  gstRows: LiveGstRow[];
};

export type PopularItem = {
  itemId: string;
  name: string;
  imageUrl: string | null;
  minPrice: number;
  totalQty: number;
};

export function money(value: string | number | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

const REPORTING_TIME_ZONE = "Australia/Sydney";
const sydneyDatePartsFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: REPORTING_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const sydneyDateTimePartsFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: REPORTING_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
const sydneyMonthLabelFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: REPORTING_TIME_ZONE,
  month: "short",
});
const sydneyMonthPeriodFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: REPORTING_TIME_ZONE,
  month: "short",
  year: "numeric",
});

function sydneyDateParts(date: Date) {
  const parts = sydneyDatePartsFormatter.formatToParts(date);
  const part = (type: "year" | "month" | "day") => {
    const value = parts.find((p) => p.type === type)?.value;
    return value ? Number(value) : 0;
  };

  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
  };
}

function sydneyOffsetMs(date: Date) {
  const parts = sydneyDateTimePartsFormatter.formatToParts(date);
  const part = (type: "year" | "month" | "day" | "hour" | "minute" | "second") => {
    const value = parts.find((p) => p.type === type)?.value;
    return value ? Number(value) : 0;
  };
  const asUtc = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second")
  );
  return asUtc - date.getTime();
}

function sydneyLocalDateToUtc(year: number, month: number, day: number) {
  const localAsUtc = Date.UTC(year, month - 1, day);
  const firstGuess = new Date(localAsUtc);
  const secondGuess = new Date(localAsUtc - sydneyOffsetMs(firstGuess));
  return new Date(localAsUtc - sydneyOffsetMs(secondGuess));
}

function startOfDay(date: Date) {
  const parts = sydneyDateParts(date);
  return sydneyLocalDateToUtc(parts.year, parts.month, parts.day);
}

function addSydneyDays(date: Date, days: number) {
  const parts = sydneyDateParts(date);
  return sydneyLocalDateToUtc(parts.year, parts.month, parts.day + days);
}

function addSydneyMonths(date: Date, months: number) {
  const parts = sydneyDateParts(date);
  return sydneyLocalDateToUtc(parts.year, parts.month + months, 1);
}

function monthKey(date: Date) {
  const parts = sydneyDateParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
}

function dayKey(date: Date) {
  const parts = sydneyDateParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return sydneyMonthLabelFormatter.format(date);
}

function monthPeriod(date: Date) {
  return sydneyMonthPeriodFormatter.format(date);
}

function estimateStripeFees(gross: number) {
  if (gross <= 0) return 0;
  return money(gross * 0.029 + 0.13);
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export async function getOrdersByTenant(tenantId: string) {
  return db
    .select()
    .from(orders)
    .where(eq(orders.tenantId, tenantId))
    .orderBy(desc(orders.createdAt));
}

export async function getOrdersByTenantAndParentEmail(tenantId: string, email: string) {
  return db
    .select()
    .from(orders)
    .where(and(eq(orders.tenantId, tenantId), sql`lower(${orders.parentEmail}) = lower(${email})`))
    .orderBy(desc(orders.createdAt));
}

export async function getLiveDashboardData(tenantId: string): Promise<LiveDashboardData> {
  const orderRows = await db
    .select()
    .from(orders)
    .where(eq(orders.tenantId, tenantId))
    .orderBy(desc(orders.createdAt));

  if (orderRows.length === 0) {
    return {
      revenue: 0,
      orders: 0,
      avgOrder: 0,
      awaitingPickup: 0,
      readyOverSevenDays: 0,
      spark: Array.from({ length: 12 }, () => 0),
      topItems: [],
      recentOrders: [],
    };
  }

  const today = startOfDay(new Date());
  const last30Start = addSydneyDays(today, -29);
  const sparkStart = addSydneyDays(today, -11);
  const tomorrowStart = addSydneyDays(today, 1);
  const sevenDaysAgo = addSydneyDays(today, -7);

  const last30Orders = orderRows.filter((order) => {
    return order.createdAt !== null && order.createdAt >= last30Start && order.createdAt < tomorrowStart;
  });

  const revenue = money(last30Orders.reduce((sum, order) => sum + money(order.total), 0));
  const orderCount = last30Orders.length;
  const avgOrder = orderCount > 0 ? money(revenue / orderCount) : 0;
  const awaitingPickup = orderRows.filter((order) => {
    return order.delivery === "pickup" && order.status === "ready";
  }).length;
  const readyOverSevenDays = orderRows.filter((order) => {
    return (
      order.delivery === "pickup" &&
      order.status === "ready" &&
      order.createdAt !== null &&
      order.createdAt < sevenDaysAgo
    );
  }).length;

  const sparkBuckets = new Map<string, number>();
  for (let i = 0; i < 12; i += 1) {
    const day = addSydneyDays(sparkStart, i);
    sparkBuckets.set(dayKey(day), 0);
  }
  for (const order of orderRows) {
    if (!order.createdAt || order.createdAt < sparkStart || order.createdAt >= tomorrowStart) continue;
    const key = dayKey(order.createdAt);
    if (!sparkBuckets.has(key)) continue;
    sparkBuckets.set(key, money((sparkBuckets.get(key) ?? 0) + money(order.total)));
  }

  const datedRecentRows = orderRows
    .filter((order) => order.createdAt !== null)
    .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
  const nullDatedRows = orderRows.filter((order) => order.createdAt === null);
  const recentOrders: LiveRecentOrder[] = [...datedRecentRows, ...nullDatedRows].slice(0, 5).map((order) => ({
    id: order.id,
    tenantId: order.tenantId,
    status: order.status,
    delivery: order.delivery,
    kid: order.studentName,
    year: order.studentYear,
    rollClass: order.studentRoll,
    parent: order.parentName,
    email: order.parentEmail,
    total: money(order.total),
    createdAt: order.createdAt,
  }));

  const last30OrderIds = last30Orders.map((order) => order.id);
  const topItemsByName = new Map<string, LiveTopItem>();
  if (last30OrderIds.length > 0) {
    const lineRows = await db
      .select()
      .from(orderLines)
      .where(inArray(orderLines.orderId, last30OrderIds));

    for (const line of lineRows) {
      const current = topItemsByName.get(line.itemName) ?? {
        name: line.itemName,
        qty: 0,
        revenue: 0,
      };
      current.qty += line.qty;
      current.revenue = money(current.revenue + money(line.lineTotal));
      topItemsByName.set(line.itemName, current);
    }
  }

  return {
    revenue,
    orders: orderCount,
    avgOrder,
    awaitingPickup,
    readyOverSevenDays,
    spark: Array.from(sparkBuckets.values()),
    topItems: Array.from(topItemsByName.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5),
    recentOrders,
  };
}

export async function getLiveReportsData(tenantId: string): Promise<LiveReportsData> {
  const now = new Date();
  const nowParts = sydneyDateParts(now);
  const currentMonth = sydneyLocalDateToUtc(nowParts.year, nowParts.month, 1);
  const firstMonth = addSydneyMonths(currentMonth, -5);
  const nextMonthStart = addSydneyMonths(currentMonth, 1);
  const months = Array.from({ length: 6 }, (_, index) => {
    return addSydneyMonths(firstMonth, index);
  });

  const orderRows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.tenantId, tenantId), gte(orders.createdAt, firstMonth), lt(orders.createdAt, nextMonthStart)))
    .orderBy(desc(orders.createdAt));

  const monthlyTotals = new Map(months.map((month) => [monthKey(month), 0]));
  const gstTotals = new Map(months.map((month) => [monthKey(month), 0]));

  for (const order of orderRows) {
    if (!order.createdAt) continue;
    const key = monthKey(order.createdAt);
    monthlyTotals.set(key, money((monthlyTotals.get(key) ?? 0) + money(order.total)));
    gstTotals.set(key, money((gstTotals.get(key) ?? 0) + money(order.gst)));
  }

  const revenue = money(orderRows.reduce((sum, order) => sum + money(order.total), 0));
  const orderCount = orderRows.length;
  const avgOrder = orderCount > 0 ? money(revenue / orderCount) : 0;
  const gst = money(orderRows.reduce((sum, order) => sum + money(order.gst), 0));
  const monthlyRevenue = months.map((month) => ({
    month: monthKey(month),
    label: monthLabel(month),
    revenue: money(monthlyTotals.get(monthKey(month)) ?? 0),
  }));
  const gstRows = [...months].reverse().map((month) => {
    const gross = money(monthlyTotals.get(monthKey(month)) ?? 0);
    const rowGst = money(gstTotals.get(monthKey(month)) ?? 0);
    const net = money(gross - rowGst);
    const fees = estimateStripeFees(gross);
    return {
      period: monthPeriod(month),
      gross,
      gst: rowGst,
      net,
      fees,
      payout: money(net - fees),
    };
  });

  const orderIds = orderRows.map((order) => order.id);
  const categoryTotals = new Map<string, number>();
  if (orderIds.length > 0) {
    const lineRows = await db
      .select({
        category: catalogItems.category,
        lineTotal: orderLines.lineTotal,
      })
      .from(orderLines)
      .leftJoin(
        catalogItems,
        and(eq(orderLines.itemId, catalogItems.id), eq(catalogItems.tenantId, tenantId))
      )
      .where(inArray(orderLines.orderId, orderIds));

    for (const line of lineRows) {
      const category = line.category ?? "Uncategorised";
      categoryTotals.set(category, money((categoryTotals.get(category) ?? 0) + money(line.lineTotal)));
    }
  }

  const categoryTotal = money(
    Array.from(categoryTotals.values()).reduce((sum, value) => sum + value, 0)
  );
  const categoryRevenue = Array.from(categoryTotals.entries())
    .map(([cat, categoryRevenueValue]) => ({
      cat,
      revenue: money(categoryRevenueValue),
      pct: categoryTotal > 0 ? money((categoryRevenueValue / categoryTotal) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    revenue,
    orders: orderCount,
    avgOrder,
    gst,
    monthlyRevenue,
    categoryRevenue,
    gstRows,
  };
}

export async function getOrderById(orderId: string) {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order) return null;

  const lines = await db
    .select()
    .from(orderLines)
    .where(eq(orderLines.orderId, orderId));

  return { ...order, lines };
}

export async function getOrdersByParentEmail(email: string) {
  return db
    .select()
    .from(orders)
    .where(sql`lower(${orders.parentEmail}) = lower(${email})`)
    .orderBy(desc(orders.createdAt));
}

export async function updateOrderStatus(
  orderId: string,
  status: "new" | "packing" | "ready" | "collected" | "partially_refunded" | "refunded"
) {
  return db
    .update(orders)
    .set({ status, updatedAt: new Date() })
    .where(eq(orders.id, orderId))
    .returning({ id: orders.id });
}

export async function getOrderRefunds(orderId: string) {
  return db
    .select()
    .from(orderRefunds)
    .where(eq(orderRefunds.orderId, orderId))
    .orderBy(desc(orderRefunds.createdAt));
}

export async function getTotalRefunded(orderId: string): Promise<number> {
  const [result] = await db
    .select({ total: sum(orderRefunds.amount) })
    .from(orderRefunds)
    .where(eq(orderRefunds.orderId, orderId));
  return money(result?.total ?? 0);
}

export async function addOrderRefund(data: {
  orderId: string;
  lineId?: string;
  amount: string | number;
  reason?: string;
  operatorUserId?: string;
  stripeRefundId?: string;
}) {
  return db
    .insert(orderRefunds)
    .values({
      orderId: data.orderId,
      lineId: data.lineId ?? null,
      amount: String(data.amount),
      reason: data.reason ?? null,
      operatorUserId: data.operatorUserId ?? null,
      stripeRefundId: data.stripeRefundId ?? null,
    })
    .returning({ id: orderRefunds.id });
}

// ─── Catalog ─────────────────────────────────────────────────────────────────

export type CatalogItemRow = typeof catalogItems.$inferSelect;
export type CatalogVariantRow = typeof catalogVariants.$inferSelect;
export type CatalogItemWithVariants = CatalogItemRow & {
  variants: CatalogVariantRow[];
};

export async function getCatalogByTenant(tenantId: string) {
  const items = await db
    .select()
    .from(catalogItems)
    .where(eq(catalogItems.tenantId, tenantId))
    .orderBy(catalogItems.sortOrder);

  if (items.length === 0) return [];

  const variants = await db
    .select()
    .from(catalogVariants)
    .where(
      or(
        ...items.map((i) => eq(catalogVariants.itemId, i.id))
      )
    );

  return items.map((item) => ({
    ...item,
    variants: variants.filter((v) => v.itemId === item.id),
  }));
}

export async function getCatalogItemById(itemId: string) {
  const [item] = await db
    .select()
    .from(catalogItems)
    .where(eq(catalogItems.id, itemId))
    .limit(1);
  if (!item) return null;

  const variants = await db
    .select()
    .from(catalogVariants)
    .where(eq(catalogVariants.itemId, itemId));

  return { ...item, variants };
}

export async function addCatalogItem(data: {
  id: string;
  tenantId: string;
  name: string;
  category: string;
  description?: string | null;
  imageUrl?: string | null;
  active?: boolean;
  sortOrder?: number;
  variants: { label: string; price: number; active?: boolean; sizes?: string[] }[];
}) {
  // neon-http driver doesn't support interactive db.transaction; use db.batch
  // which runs all statements atomically in a single HTTP round-trip.
  const itemInsert = db.insert(catalogItems).values({
    id: data.id,
    tenantId: data.tenantId,
    name: data.name,
    category: data.category,
    description: data.description ?? null,
    imageUrl: data.imageUrl ?? null,
    active: data.active ?? true,
    sortOrder: data.sortOrder ?? 0,
  });
  const variantInserts = data.variants.map((v) =>
    db.insert(catalogVariants).values({
      itemId: data.id,
      label: v.label,
      price: String(v.price),
      active: v.active ?? true,
      sizes: v.sizes ?? [],
    })
  );
  const stmts: [BatchItem<"pg">, ...BatchItem<"pg">[]] = [
    itemInsert,
    ...variantInserts,
  ];
  await db.batch(stmts);
}

/**
 * Partial item update with optional diff-based variant sync.
 * If `variants` is provided, the variant list is reconciled by id:
 *   - input variant with `id` matching an existing row → update that row
 *   - input variant without `id` (or with unknown id) → insert new row
 *   - existing rows whose id is not in the input → delete
 * IDs are preserved across edits so cart entries keyed by variantId remain
 * valid after a save that didn't actually change that variant. Order history
 * is unaffected — order_lines holds its own snapshots and does not FK
 * catalog_variants.
 */
export async function updateCatalogItem(
  itemId: string,
  fields: {
    name?: string;
    category?: string;
    description?: string | null;
    imageUrl?: string | null;
    active?: boolean;
    sortOrder?: number;
  },
  variants?: {
    id?: string;
    label: string;
    price: number;
    active?: boolean;
    sizes?: string[];
  }[]
) {
  // neon-http driver doesn't support interactive db.transaction. We read
  // existing variant ids first (one round-trip), then run all writes via
  // db.batch (atomic HTTP-level transaction). Concurrent edits between the
  // read and write are not protected — acceptable for the 1-2 ops/tenant
  // catalog editor.
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (fields.name !== undefined) updates.name = fields.name;
  if (fields.category !== undefined) updates.category = fields.category;
  if (fields.description !== undefined) updates.description = fields.description;
  if (fields.imageUrl !== undefined) updates.imageUrl = fields.imageUrl;
  if (fields.active !== undefined) updates.active = fields.active;
  if (fields.sortOrder !== undefined) updates.sortOrder = fields.sortOrder;

  const itemUpdate = db
    .update(catalogItems)
    .set(updates)
    .where(eq(catalogItems.id, itemId));

  if (variants === undefined) {
    const stmts: [BatchItem<"pg">] = [itemUpdate];
    await db.batch(stmts);
    return;
  }

  const existing = await db
    .select({ id: catalogVariants.id })
    .from(catalogVariants)
    .where(eq(catalogVariants.itemId, itemId));
  const existingIds = new Set(existing.map((v) => v.id));
  const keptIds = new Set<string>();

  const variantWrites: BatchItem<"pg">[] = [];

  for (const v of variants) {
    if (v.id && existingIds.has(v.id)) {
      variantWrites.push(
        db
          .update(catalogVariants)
          .set({
            label: v.label,
            price: String(v.price),
            active: v.active ?? true,
            sizes: v.sizes ?? [],
          })
          .where(eq(catalogVariants.id, v.id))
      );
      keptIds.add(v.id);
    } else {
      variantWrites.push(
        db.insert(catalogVariants).values({
          itemId,
          label: v.label,
          price: String(v.price),
          active: v.active ?? true,
          sizes: v.sizes ?? [],
        })
      );
    }
  }

  const toDelete = [...existingIds].filter((id) => !keptIds.has(id));
  if (toDelete.length > 0) {
    variantWrites.push(
      db.delete(catalogVariants).where(inArray(catalogVariants.id, toDelete))
    );
  }

  const stmts: [BatchItem<"pg">, ...BatchItem<"pg">[]] = [
    itemUpdate,
    ...variantWrites,
  ];
  await db.batch(stmts);
}

/**
 * Bulk-renumber a tenant's catalog items to dense 0..N-1 order.
 * Uses db.batch (neon-http) — not db.transaction (unsupported on neon-http).
 * db.batch is a pipeline, not a transaction: individual statements can succeed
 * independently. A partial failure leaves sort_order in a mixed state;
 * re-dragging recovers. Revisit if neon pooled mode (transactions) is adopted.
 * Caller must have already validated that `orderedIds` is the exhaustive set
 * of catalog item IDs for this tenant.
 */
export async function reorderCatalogItems(
  tenantId: string,
  orderedIds: string[],
): Promise<void> {
  if (orderedIds.length === 0) return;
  const statements = orderedIds.map((id, index) =>
    db
      .update(catalogItems)
      .set({ sortOrder: index })
      .where(and(eq(catalogItems.id, id), eq(catalogItems.tenantId, tenantId))),
  );
  // neon-http: db.batch accepts a tuple of queries; we cast for the variadic shape.
  await db.batch(statements as unknown as Parameters<typeof db.batch>[0]);
}

export async function deleteCatalogItem(itemId: string) {
  return db
    .delete(catalogItems)
    .where(eq(catalogItems.id, itemId))
    .returning({ id: catalogItems.id, imageUrl: catalogItems.imageUrl });
}

// ─── Tenants ─────────────────────────────────────────────────────────────────

export const getTenant = cache(async (tenantId: string) => {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return tenant ?? null;
});

export async function updateTenantStripe(
  tenantId: string,
  data: {
    stripeAccountId: string;
    stripePayoutsEnabled: boolean;
    stripeChargesEnabled: boolean;
  }
) {
  return db
    .update(tenants)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));
}

export async function updateTenantSettings(
  tenantId: string,
  data: {
    name?: string;
    address?: string;
    shopHours?: string;
    shopEmail?: string;
  }
) {
  return db
    .update(tenants)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId))
    .returning({ id: tenants.id });
}

// ─── Parent saved children ───────────────────────────────────────────────────
export type ParentChildRow = {
  id: string;
  tenantId: string;
  name: string;
  year: string;
  rollClass: string | null;
  lastConfirmedAt: Date;
  createdAt: Date;
};

export async function getChildrenForParent(parentId: string): Promise<ParentChildRow[]> {
  return db
    .select({
      id: parentChildren.id,
      tenantId: parentChildren.tenantId,
      name: parentChildren.name,
      year: parentChildren.year,
      rollClass: parentChildren.rollClass,
      lastConfirmedAt: parentChildren.lastConfirmedAt,
      createdAt: parentChildren.createdAt,
    })
    .from(parentChildren)
    .where(eq(parentChildren.parentId, parentId))
    .orderBy(parentChildren.createdAt);
}

export async function getChildById(id: string): Promise<ParentChildRow & { parentId: string } | null> {
  const [row] = await db
    .select({
      id: parentChildren.id,
      parentId: parentChildren.parentId,
      tenantId: parentChildren.tenantId,
      name: parentChildren.name,
      year: parentChildren.year,
      rollClass: parentChildren.rollClass,
      lastConfirmedAt: parentChildren.lastConfirmedAt,
      createdAt: parentChildren.createdAt,
    })
    .from(parentChildren)
    .where(eq(parentChildren.id, id))
    .limit(1);
  return row ?? null;
}

export async function createChild(data: {
  parentId: string;
  tenantId: string;
  name: string;
  year: string;
  rollClass: string | null;
}): Promise<ParentChildRow> {
  const [row] = await db
    .insert(parentChildren)
    .values(data)
    .returning({
      id: parentChildren.id,
      tenantId: parentChildren.tenantId,
      name: parentChildren.name,
      year: parentChildren.year,
      rollClass: parentChildren.rollClass,
      lastConfirmedAt: parentChildren.lastConfirmedAt,
      createdAt: parentChildren.createdAt,
    });
  return row;
}

export async function updateChild(
  id: string,
  patch: { name?: string; year?: string; rollClass?: string | null }
): Promise<ParentChildRow | null> {
  const [row] = await db
    .update(parentChildren)
    .set({ ...patch, lastConfirmedAt: new Date() })
    .where(eq(parentChildren.id, id))
    .returning({
      id: parentChildren.id,
      tenantId: parentChildren.tenantId,
      name: parentChildren.name,
      year: parentChildren.year,
      rollClass: parentChildren.rollClass,
      lastConfirmedAt: parentChildren.lastConfirmedAt,
      createdAt: parentChildren.createdAt,
    });
  return row ?? null;
}

export async function deleteChild(id: string): Promise<void> {
  await db.delete(parentChildren).where(eq(parentChildren.id, id));
}

export async function confirmChild(id: string): Promise<ParentChildRow | null> {
  const [row] = await db
    .update(parentChildren)
    .set({ lastConfirmedAt: new Date() })
    .where(eq(parentChildren.id, id))
    .returning({
      id: parentChildren.id,
      tenantId: parentChildren.tenantId,
      name: parentChildren.name,
      year: parentChildren.year,
      rollClass: parentChildren.rollClass,
      lastConfirmedAt: parentChildren.lastConfirmedAt,
      createdAt: parentChildren.createdAt,
    });
  return row ?? null;
}

export async function getPubliclyListedTenants() {
  return db
    .select()
    .from(tenants)
    .where(eq(tenants.isPubliclyListed, true))
    .orderBy(tenants.name);
}

export async function getTenantsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  return db.select().from(tenants).where(inArray(tenants.id, ids));
}

export async function getOrderForReceipt(orderId: string) {
  const [row] = await db
    .select({
      id: orders.id,
      tenantId: orders.tenantId,
      parentEmail: orders.parentEmail,
      studentName: orders.studentName,
      studentYear: orders.studentYear,
      total: orders.total,
      delivery: orders.delivery,
      parentNote: orders.parentNote,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  return row ?? null;
}

// ─── Parent UI adapters ───────────────────────────────────────────────────────

/**
 * Active catalog for a tenant in the parent UI's `CatalogItem` shape.
 * Returns only items with `active=true` AND at least one `active=true` variant
 * (innerJoin), sorted by sort_order. Items with zero active variants would
 * render price-less in the parent UI, so they're excluded at the SQL level.
 * Wrapped in React cache() for request-scoped dedup.
 */
export const getActiveCatalog = cache(async (tenantId: string): Promise<CatalogItem[]> => {
  const rows = await db
    .select({
      itemId: catalogItems.id,
      name: catalogItems.name,
      category: catalogItems.category,
      description: catalogItems.description,
      sizeGuide: catalogItems.sizeGuide,
      sortOrder: catalogItems.sortOrder,
      varLabel: catalogVariants.label,
      varPrice: catalogVariants.price,
      varSizes: catalogVariants.sizes,
      imageUrl: catalogItems.imageUrl,
    })
    .from(catalogItems)
    .innerJoin(catalogVariants, eq(catalogVariants.itemId, catalogItems.id))
    .where(
      and(
        eq(catalogItems.tenantId, tenantId),
        eq(catalogItems.active, true),
        eq(catalogVariants.active, true),
      ),
    )
    .orderBy(catalogItems.sortOrder, catalogVariants.label);

  // Group by item, building the UI's `CatalogItem` shape.
  const map = new Map<string, CatalogItem>();
  for (const r of rows) {
    if (!map.has(r.itemId)) {
      map.set(r.itemId, {
        id: r.itemId,
        name: r.name,
        cat: r.category as CatalogItem["cat"],
        description: r.description ?? "",
        sizeGuide: (r.sizeGuide as CatalogItem["sizeGuide"]) ?? undefined,
        imageUrl: r.imageUrl ?? undefined,
        variants: [],
      } as unknown as CatalogItem);
    }
    map.get(r.itemId)!.variants.push({
      label: r.varLabel,
      price: Number(r.varPrice),
      sizes: Array.isArray(r.varSizes) ? (r.varSizes as string[]) : [],
    });
  }
  return Array.from(map.values());
});

/**
 * Single catalog item in the parent UI's `CatalogItem` shape, or null if
 * not found / inactive. Re-uses getActiveCatalog for request-scoped dedup.
 */
export const getCatalogItem = cache(async (
  tenantId: string,
  itemId: string,
): Promise<CatalogItem | null> => {
  const items = await getActiveCatalog(tenantId);
  return items.find((i) => i.id === itemId) ?? null;
});

/**
 * PDP variant of the above: fetches ALL variants for the item (active + inactive),
 * tagging inactive ones with `disabled: true`. Used only by the item detail page
 * so parents see unavailable sizes/fits rather than a silent gap.
 * Still returns null if the item itself is inactive or belongs to another tenant.
 */
export const getCatalogItemForPDP = cache(async (
  tenantId: string,
  itemId: string,
): Promise<CatalogItem | null> => {
  const rows = await db
    .select({
      itemId: catalogItems.id,
      name: catalogItems.name,
      category: catalogItems.category,
      description: catalogItems.description,
      sizeGuide: catalogItems.sizeGuide,
      varLabel: catalogVariants.label,
      varPrice: catalogVariants.price,
      varSizes: catalogVariants.sizes,
      varActive: catalogVariants.active,
      imageUrl: catalogItems.imageUrl,
    })
    .from(catalogItems)
    .leftJoin(catalogVariants, eq(catalogVariants.itemId, catalogItems.id))
    .where(
      and(
        eq(catalogItems.tenantId, tenantId),
        eq(catalogItems.id, itemId),
        eq(catalogItems.active, true),
      ),
    )
    .orderBy(catalogVariants.label);

  if (rows.length === 0) return null;

  const r0 = rows[0]!;
  const item: CatalogItem = {
    id: r0.itemId,
    name: r0.name,
    cat: r0.category as CatalogItem["cat"],
    description: r0.description ?? "",
    sizeGuide: (r0.sizeGuide as CatalogItem["sizeGuide"]) ?? undefined,
    imageUrl: r0.imageUrl ?? undefined,
    variants: [],
  } as unknown as CatalogItem;

  for (const r of rows) {
    if (r.varLabel === null) continue;
    item.variants.push({
      label: r.varLabel,
      price: Number(r.varPrice),
      sizes: Array.isArray(r.varSizes) ? (r.varSizes as string[]) : [],
      ...(r.varActive === false ? { disabled: true } : {}),
    });
  }

  return item.variants.length > 0 ? item : null;
});

/**
 * Adapt a DB tenant row to the parent UI's `Tenant` shape. Materializes
 * `accentInk` (default white) and replaces nullable copy fields with empty
 * strings so existing components don't need null guards.
 */
export function toTenantBrand(row: typeof tenants.$inferSelect): Tenant {
  return {
    id: row.id,
    name: row.name,
    short: row.short,
    accent: row.accent,
    accentInk: "#FFFFFF",
    motto: row.motto ?? "",
    address: row.address ?? "",
    shopHours: row.shopHours ?? "",
    shopEmail: row.shopEmail ?? "",
  };
}

// ─── Cross-tenant parent order history ───────────────────────────────────────

export type ParentOrderRow = {
  id: string;
  tenantId: string;
  status: string;
  total: string;
  delivery: "pickup" | "ship";
  createdAt: Date | null;
  studentName: string;
  parentEmail: string;
  tenantName: string;
  tenantShort: string;
  tenantAccent: string;
};

/**
 * Cross-tenant order list for a parent. Dual-key match: matches on user_id when
 * present, OR on lowercased parent_email. Required because orders.user_id is
 * nullable (pre-auth orders, guest checkouts, FK-orphaned via onDelete:'set null').
 *
 * Joins tenants so historical orders for hidden/disabled tenants stay visible —
 * those flags gate new browsing, not old receipts.
 */
export async function listOrdersForParent(args: {
  userId: string | null;
  email: string;
}): Promise<ParentOrderRow[]> {
  const { userId, email } = args;
  const lowered = email.toLowerCase();

  const rows = await db
    .select({
      id: orders.id,
      tenantId: orders.tenantId,
      status: orders.status,
      total: orders.total,
      createdAt: orders.createdAt,
      studentName: orders.studentName,
      parentEmail: orders.parentEmail,
      delivery: orders.delivery,
      tenantName: tenants.name,
      tenantShort: tenants.short,
      tenantAccent: tenants.accent,
    })
    .from(orders)
    .innerJoin(tenants, eq(tenants.id, orders.tenantId))
    .where(
      or(
        userId ? eq(orders.userId, userId) : sql`false`,
        sql`lower(${orders.parentEmail}) = ${lowered}`,
      ),
    )
    .orderBy(desc(orders.createdAt));

  return rows;
}

export async function getTenantLegalVersion(id: string) {
  const [row] = await db
    .select()
    .from(tenantLegalVersions)
    .where(eq(tenantLegalVersions.id, id))
    .limit(1);
  return row ?? null;
}

export async function getMaxLegalVersionForTenant(tenantId: string): Promise<number> {
  const [row] = await db
    .select({ max: sql<number>`COALESCE(MAX(${tenantLegalVersions.version}), 0)` })
    .from(tenantLegalVersions)
    .where(eq(tenantLegalVersions.tenantId, tenantId));
  return row?.max ?? 0;
}

export async function getPopularItems(
  tenantSlug: string,
  limit = 3,
  days = 90,
): Promise<PopularItem[]> {
  try {
    type Row = {
      itemId: string;
      name: string | null;
      imageUrl: string | null;
      minPrice: string | null; // postgres numeric → string over neon-http
      totalQty: number;
    };
    const result = (await db.execute(sql`
      WITH ranked AS (
        SELECT ol.item_id, SUM(ol.qty)::int AS total_qty
        FROM order_lines ol
        JOIN orders o ON o.id = ol.order_id
        WHERE o.tenant_id = ${tenantSlug}
          AND o.created_at >= NOW() - make_interval(days => ${days})
          AND o.status NOT IN ('pending_payment', 'refunded')
        GROUP BY ol.item_id
        ORDER BY total_qty DESC
        LIMIT ${limit}
      )
      SELECT
        r.item_id          AS "itemId",
        ci.name,
        ci.image_url       AS "imageUrl",
        (SELECT MIN(price)::text FROM catalog_variants cv
         WHERE cv.item_id = r.item_id AND cv.active = true) AS "minPrice",
        r.total_qty        AS "totalQty"
      FROM ranked r
      LEFT JOIN catalog_items ci ON ci.id = r.item_id
      ORDER BY r.total_qty DESC
    `)) as { rows: Row[] };
    return result.rows.map((r) => ({
      itemId: r.itemId,
      name: r.name ?? r.itemId,
      imageUrl: r.imageUrl,
      minPrice: r.minPrice != null ? parseFloat(r.minPrice) : 0,
      totalQty: r.totalQty,
    }));
  } catch (err) {
    console.error("getPopularItems failed", err);
    return [];
  }
}
