import { db, orders, orderLines, catalogItems, catalogVariants, tenants, orderRefunds } from "./index";
import { and, eq, desc, or, gte, inArray, lt, sql, sum, isNotNull } from "drizzle-orm";

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

export async function getPreviousSizeHint(
  tenantId: string,
  parentEmail: string,
  itemId: string,
): Promise<{ studentName: string; size: string; variantLabel: string } | null> {
  const [latest] = await db
    .select({ id: orders.id, studentName: orders.studentName })
    .from(orders)
    .innerJoin(orderLines, eq(orderLines.orderId, orders.id))
    .where(
      and(
        eq(orders.tenantId, tenantId),
        eq(orders.parentEmail, parentEmail),
        eq(orderLines.itemId, itemId),
        isNotNull(orderLines.size),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(1);

  if (!latest) return null;

  const tuples = await db
    .selectDistinct({
      size: orderLines.size,
      variantLabel: orderLines.variantLabel,
    })
    .from(orderLines)
    .where(
      and(
        eq(orderLines.orderId, latest.id),
        eq(orderLines.itemId, itemId),
        isNotNull(orderLines.size),
      ),
    );

  if (tuples.length !== 1) return null;
  const t = tuples[0];
  if (!t.size) return null;
  return { studentName: latest.studentName, size: t.size, variantLabel: t.variantLabel };
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
  description?: string;
  variants: { label: string; price: number }[];
}) {
  await db.insert(catalogItems).values({
    id: data.id,
    tenantId: data.tenantId,
    name: data.name,
    category: data.category,
    description: data.description,
  });

  for (const v of data.variants) {
    await db.insert(catalogVariants).values({
      itemId: data.id,
      label: v.label,
      price: String(v.price),
    });
  }
}

export async function updateCatalogItemName(itemId: string, name: string) {
  return db
    .update(catalogItems)
    .set({ name, updatedAt: new Date() })
    .where(eq(catalogItems.id, itemId))
    .returning({ id: catalogItems.id });
}

export async function deleteCatalogItem(itemId: string) {
  return db
    .delete(catalogItems)
    .where(eq(catalogItems.id, itemId))
    .returning({ id: catalogItems.id });
}

// ─── Tenants ─────────────────────────────────────────────────────────────────

export async function getTenant(tenantId: string) {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return tenant ?? null;
}

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
