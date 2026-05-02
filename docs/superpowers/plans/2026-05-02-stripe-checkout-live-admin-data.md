# Stripe Checkout and Live Admin Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mock checkout payment path with confirmed Stripe card payments and move admin dashboard/reporting data from static fixtures to tenant-scoped live Neon orders.

**Architecture:** Keep checkout in the existing mobile client component, using `@stripe/stripe-js` directly with a mounted Card Element and the existing `/api/stripe/payment-intent` route. Add live analytics helpers to `apps/web/src/db/queries.ts`, then feed dashboard and reports server pages with parsed, tenant-scoped aggregate data.

**Tech Stack:** Next.js App Router, React client components, Stripe JS, Drizzle ORM, Neon PostgreSQL, pnpm workspaces, TypeScript.

---

## File Structure

- Modify `apps/web/src/app/[tenant]/checkout/checkout-screen.tsx`
  - Owns form validation, Stripe Card Element mounting, PaymentIntent creation, card confirmation, order creation, and inline checkout errors.
- Modify `apps/web/src/db/queries.ts`
  - Adds tenant-scoped live admin analytics helpers and order summary mapping.
- Modify `apps/web/src/app/admin/[tenant]/dashboard/page.tsx`
  - Replaces `SALES_DATA` and static recent orders with live query helper output.
- Modify `apps/web/src/app/admin/[tenant]/dashboard/dashboard-client.tsx`
  - Replaces fixture types with compact live analytics props, adds empty states, and keeps the existing visual layout.
- Modify `apps/web/src/app/admin/[tenant]/reports/page.tsx`
  - Replaces static report arrays with live query helper output.
- Optionally modify `docs/FEATURE_AUDIT.md`
  - Updates fixed-item notes after verification succeeds.

## Task 1: Implement Live Stripe Checkout

**Files:**
- Modify: `apps/web/src/app/[tenant]/checkout/checkout-screen.tsx`

- [ ] **Step 1: Add Stripe imports and state**

Add the Stripe JS imports near the top of `checkout-screen.tsx`:

```ts
import { loadStripe, type Stripe, type StripeCardElement, type StripeElements } from "@stripe/stripe-js";
```

Change the existing React import to include `useRef`:

```ts
import { useState, useEffect, useRef } from "react";
```

Add module-level Stripe key/client setup below `YEAR_OPTIONS`:

```ts
const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;
```

Add these refs/state inside `CheckoutScreen`:

```ts
const cardMountRef = useRef<HTMLDivElement | null>(null);
const stripeRef = useRef<Stripe | null>(null);
const elementsRef = useRef<StripeElements | null>(null);
const cardRef = useRef<StripeCardElement | null>(null);
const [paymentReady, setPaymentReady] = useState(false);
const [paymentError, setPaymentError] = useState<string | null>(
  stripePublishableKey ? null : "Stripe checkout is not configured. Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY."
);
```

- [ ] **Step 2: Mount the Stripe Card Element**

Add this effect after the saved-student effect:

```ts
useEffect(() => {
  let cancelled = false;

  if (!stripePromise || !cardMountRef.current) return;

  async function mountCard() {
    const stripe = await stripePromise;
    if (!stripe || cancelled || !cardMountRef.current || cardRef.current) return;

    const elements = stripe.elements();
    const card = elements.create("card", {
      hidePostalCode: true,
      style: {
        base: {
          color: "#1F2933",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: "14px",
          "::placeholder": { color: "#8A8175" },
        },
        invalid: { color: "#B23A2A" },
      },
    });

    card.on("ready", () => {
      setPaymentReady(true);
      setPaymentError(null);
    });
    card.on("change", (event) => {
      setPaymentError(event.error?.message ?? null);
    });

    card.mount(cardMountRef.current);
    stripeRef.current = stripe;
    elementsRef.current = elements;
    cardRef.current = card;
  }

  mountCard();

  return () => {
    cancelled = true;
    cardRef.current?.destroy();
    cardRef.current = null;
    elementsRef.current = null;
    stripeRef.current = null;
    setPaymentReady(false);
  };
}, []);
```

- [ ] **Step 3: Replace the order-only submit with payment-first submit**

Replace `onPay` with this flow:

```ts
const onPay = async () => {
  if (!validate()) return;
  if (lines.length === 0) {
    setPaymentError("Your cart is empty.");
    return;
  }
  if (!stripeRef.current || !cardRef.current || !paymentReady) {
    setPaymentError("Payment form is still loading. Please try again in a moment.");
    return;
  }

  writeStudentDetails(student);
  setPaying(true);
  setPaymentError(null);

  let paymentIntentId: string | null = null;

  try {
    const intentRes = await fetch("/api/stripe/payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId: tenant.id,
        amount: total,
        currency: "aud",
        metadata: {
          parentEmail: student.email,
          studentName: student.studentName,
          delivery,
        },
      }),
    });

    const intentData = await intentRes.json().catch(() => null);
    if (!intentRes.ok || !intentData?.clientSecret || !intentData?.paymentIntentId) {
      throw new Error(intentData?.error ?? "Failed to start Stripe payment.");
    }

    paymentIntentId = intentData.paymentIntentId;

    const confirmation = await stripeRef.current.confirmCardPayment(intentData.clientSecret, {
      payment_method: {
        card: cardRef.current,
        billing_details: {
          name: student.parentName,
          email: student.email,
          phone: student.mobile,
        },
      },
    });

    if (confirmation.error) {
      throw new Error(confirmation.error.message ?? "Payment was not completed.");
    }

    if (confirmation.paymentIntent?.status !== "succeeded") {
      throw new Error("Payment was not completed. Please check your card details and try again.");
    }

    const orderRes = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId: tenant.id,
        parentName: student.parentName,
        parentEmail: student.email,
        parentMobile: student.mobile,
        studentName: student.studentName,
        studentYear: student.year,
        studentRoll: student.rollClass,
        delivery,
        deliveryFee: delivery === "ship" ? 9.5 : 0,
        subtotal,
        gst,
        total,
        stripePaymentIntentId: confirmation.paymentIntent.id,
        lines: lines.map((l) => ({
          itemId: l.itemId,
          itemName: l.name,
          variantLabel: l.variantLabel,
          qty: l.qty,
          unitPrice: l.price,
          lineTotal: l.price * l.qty,
        })),
      }),
    });

    const orderData = await orderRes.json().catch(() => null);
    if (!orderRes.ok || !orderData?.orderId) {
      throw new Error(
        `Payment succeeded (${confirmation.paymentIntent.id}) but the order could not be saved. Please contact the uniform shop before retrying.`
      );
    }

    clearCart();
    router.push(`/${tenant.id}/order/placed?total=${total.toFixed(2)}&delivery=${delivery}&orderId=${orderData.orderId}`);
  } catch (err) {
    console.error("Checkout error:", err);
    const message = err instanceof Error ? err.message : "Checkout failed. Please try again.";
    setPaymentError(
      paymentIntentId && message.includes("order could not be saved")
        ? message
        : message
    );
    setPaying(false);
  }
};
```

- [ ] **Step 4: Replace the mock payment block with the mounted card UI**

In the payment section, replace the fake card number/expiry/CVC blocks with:

```tsx
<div
  className="rounded-md border bg-white px-3 py-3 min-h-11"
  style={{ borderColor: paymentError ? "#B23A2A" : "var(--color-rule)" }}
>
  <div ref={cardMountRef} />
</div>
{!stripePublishableKey && (
  <div className="mt-2 text-[11px]" style={{ color: "#B23A2A" }}>
    Stripe checkout is not configured for this environment.
  </div>
)}
{stripePublishableKey && !paymentReady && !paymentError && (
  <div className="mt-2 text-[11px]" style={{ color: "var(--color-ink-dim)" }}>
    Loading secure payment form…
  </div>
)}
{paymentError && (
  <div className="mt-2 text-[11px] leading-[1.4]" style={{ color: "#B23A2A" }}>
    {paymentError}
  </div>
)}
```

Keep the Stripe badge and secure-payment copy above this block.

- [ ] **Step 5: Disable payment until Stripe is ready**

Update the footer button disabled state:

```tsx
disabled={paying || lines.length === 0 || !stripePublishableKey || !paymentReady}
```

Update the button text:

```tsx
{paying ? "Processing…" : !stripePublishableKey ? "Payment unavailable" : `Pay $${total.toFixed(2)} securely`}
```

- [ ] **Step 6: Type-check the checkout change**

Run:

```bash
pnpm check-types:web
```

Expected: TypeScript exits successfully. If `PageProps` or `LayoutProps` route types are missing, run `pnpm --filter web exec next typegen`, then rerun `pnpm check-types:web`.

## Task 2: Add Live Admin Analytics Query Helpers

**Files:**
- Modify: `apps/web/src/db/queries.ts`

- [ ] **Step 1: Extend Drizzle imports**

Update the import from `drizzle-orm`:

```ts
import { and, eq, desc, or, gte, inArray } from "drizzle-orm";
```

- [ ] **Step 2: Add live admin types**

Add these types near the top of `queries.ts`, below the imports:

```ts
export type LiveOrderStatus = "new" | "packing" | "ready" | "collected";

export interface LiveRecentOrder {
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
}

export interface LiveTopItem {
  name: string;
  qty: number;
  revenue: number;
}

export interface LiveDashboardData {
  revenue: number;
  orders: number;
  avgOrder: number;
  awaitingPickup: number;
  readyOverSevenDays: number;
  spark: number[];
  topItems: LiveTopItem[];
  recentOrders: LiveRecentOrder[];
}

export interface LiveMonthlyRevenue {
  month: string;
  label: string;
  revenue: number;
}

export interface LiveCategoryRevenue {
  cat: string;
  revenue: number;
  pct: number;
}

export interface LiveGstRow {
  period: string;
  gross: number;
  gst: number;
  net: number;
  fees: number;
  payout: number;
}

export interface LiveReportsData {
  revenue: number;
  orders: number;
  avgOrder: number;
  gst: number;
  monthlyRevenue: LiveMonthlyRevenue[];
  categoryRevenue: LiveCategoryRevenue[];
  gstRows: LiveGstRow[];
}
```

- [ ] **Step 3: Add numeric/date helpers**

Add these helpers before the `// ─── Orders` section:

```ts
function money(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString("en-AU", { month: "short" });
}

function monthPeriod(date: Date): string {
  return date.toLocaleDateString("en-AU", { month: "short", year: "numeric" });
}

function estimateStripeFees(gross: number): number {
  if (gross <= 0) return 0;
  return gross * 0.0175 + 0.3;
}
```

- [ ] **Step 4: Add `getLiveDashboardData`**

Add this helper after `getOrdersByTenantAndParentEmail`:

```ts
export async function getLiveDashboardData(tenantId: string): Promise<LiveDashboardData> {
  const now = new Date();
  const thirtyDaysAgo = startOfDay(new Date(now));
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  const sevenDaysAgo = startOfDay(new Date(now));
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const tenantOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.tenantId, tenantId))
    .orderBy(desc(orders.createdAt));

  const last30 = tenantOrders.filter((order) => order.createdAt && order.createdAt >= thirtyDaysAgo);
  const revenue = last30.reduce((sum, order) => sum + money(order.total), 0);
  const orderCount = last30.length;
  const awaitingPickup = tenantOrders.filter((order) => order.delivery === "pickup" && order.status === "ready").length;
  const readyOverSevenDays = tenantOrders.filter(
    (order) => order.delivery === "pickup" && order.status === "ready" && order.createdAt && order.createdAt < sevenDaysAgo
  ).length;

  const recentOrders: LiveRecentOrder[] = tenantOrders.slice(0, 5).map((order) => ({
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

  const sparkDays = Array.from({ length: 12 }, (_, index) => {
    const day = startOfDay(new Date(now));
    day.setDate(day.getDate() - (11 - index));
    return day;
  });
  const spark = sparkDays.map((day) => {
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    return tenantOrders
      .filter((order) => order.createdAt && order.createdAt >= day && order.createdAt < next)
      .reduce((sum, order) => sum + money(order.total), 0);
  });

  const orderIds = last30.map((order) => order.id);
  let topItems: LiveTopItem[] = [];
  if (orderIds.length > 0) {
    const lines = await db
      .select()
      .from(orderLines)
      .where(inArray(orderLines.orderId, orderIds));
    const byName = new Map<string, LiveTopItem>();
    for (const line of lines) {
      const existing = byName.get(line.itemName) ?? { name: line.itemName, qty: 0, revenue: 0 };
      existing.qty += line.qty;
      existing.revenue += money(line.lineTotal);
      byName.set(line.itemName, existing);
    }
    topItems = Array.from(byName.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }

  return {
    revenue,
    orders: orderCount,
    avgOrder: orderCount > 0 ? revenue / orderCount : 0,
    awaitingPickup,
    readyOverSevenDays,
    spark,
    topItems,
    recentOrders,
  };
}
```

- [ ] **Step 5: Add `getLiveReportsData`**

Add this helper after `getLiveDashboardData`:

```ts
export async function getLiveReportsData(tenantId: string): Promise<LiveReportsData> {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return date;
  });
  const firstMonth = months[0];

  const tenantOrders = await db
    .select()
    .from(orders)
    .where(and(eq(orders.tenantId, tenantId), gte(orders.createdAt, firstMonth)))
    .orderBy(desc(orders.createdAt));

  const revenue = tenantOrders.reduce((sum, order) => sum + money(order.total), 0);
  const gst = tenantOrders.reduce((sum, order) => sum + money(order.gst), 0);
  const orderCount = tenantOrders.length;

  const monthlyRevenue = months.map((month) => {
    const key = monthKey(month);
    const gross = tenantOrders
      .filter((order) => order.createdAt && monthKey(order.createdAt) === key)
      .reduce((sum, order) => sum + money(order.total), 0);
    return { month: key, label: monthLabel(month), revenue: gross };
  });

  const gstRows = months
    .map((month) => {
      const key = monthKey(month);
      const monthOrders = tenantOrders.filter((order) => order.createdAt && monthKey(order.createdAt) === key);
      const gross = monthOrders.reduce((sum, order) => sum + money(order.total), 0);
      const monthGst = monthOrders.reduce((sum, order) => sum + money(order.gst), 0);
      const fees = estimateStripeFees(gross);
      return {
        period: monthPeriod(month),
        gross,
        gst: monthGst,
        net: gross - monthGst,
        fees,
        payout: gross - fees,
      };
    })
    .reverse();

  let categoryRevenue: LiveCategoryRevenue[] = [];
  const orderIds = tenantOrders.map((order) => order.id);
  if (orderIds.length > 0) {
    const lineRows = await db
      .select({
        itemId: orderLines.itemId,
        lineTotal: orderLines.lineTotal,
        category: catalogItems.category,
      })
      .from(orderLines)
      .leftJoin(catalogItems, and(eq(orderLines.itemId, catalogItems.id), eq(catalogItems.tenantId, tenantId)))
      .where(inArray(orderLines.orderId, orderIds));

    const byCategory = new Map<string, number>();
    for (const row of lineRows) {
      const category = row.category ?? "Uncategorised";
      byCategory.set(category, (byCategory.get(category) ?? 0) + money(row.lineTotal));
    }
    const categoryTotal = Array.from(byCategory.values()).reduce((sum, value) => sum + value, 0);
    categoryRevenue = Array.from(byCategory.entries())
      .map(([cat, catRevenue]) => ({
        cat,
        revenue: catRevenue,
        pct: categoryTotal > 0 ? (catRevenue / categoryTotal) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  return {
    revenue,
    orders: orderCount,
    avgOrder: orderCount > 0 ? revenue / orderCount : 0,
    gst,
    monthlyRevenue,
    categoryRevenue,
    gstRows,
  };
}
```

- [ ] **Step 6: Type-check query helpers**

Run:

```bash
pnpm check-types:web
```

Expected: TypeScript exits successfully.

## Task 3: Wire Dashboard to Live Data

**Files:**
- Modify: `apps/web/src/app/admin/[tenant]/dashboard/page.tsx`
- Modify: `apps/web/src/app/admin/[tenant]/dashboard/dashboard-client.tsx`

- [ ] **Step 1: Replace dashboard page imports and data load**

In `dashboard/page.tsx`, replace:

```ts
import { TENANTS, type TenantId } from "@/lib/data";
import { SALES_DATA, getOrdersByTenant } from "@/lib/admin-data";
```

with:

```ts
import { TENANTS, type TenantId } from "@/lib/data";
import { getLiveDashboardData } from "@/db/queries";
```

Replace:

```ts
const sales = SALES_DATA[tid as TenantId];
const orders = getOrdersByTenant(tid as TenantId);
const recentOrders = orders.slice(0, 5);
```

with:

```ts
const dashboard = await getLiveDashboardData(tid);
```

Replace the client render:

```tsx
<AdminDashboardClient tenant={tenant} sales={sales} recentOrders={recentOrders} />
```

with:

```tsx
<AdminDashboardClient tenant={tenant} dashboard={dashboard} />
```

- [ ] **Step 2: Update dashboard client imports and types**

In `dashboard-client.tsx`, replace:

```ts
import type { SalesData, AdminOrder } from "@/lib/admin-data";
```

with:

```ts
import type { LiveDashboardData, LiveRecentOrder, LiveOrderStatus } from "@/db/queries";
```

Update `StatusBadge`:

```ts
function StatusBadge({ status }: { status: LiveOrderStatus }) {
  const map: Record<LiveOrderStatus, { tone: "warn" | "info" | "success" | "neutral"; label: string }> = {
```

Update component props:

```ts
export function AdminDashboardClient({
  tenant,
  dashboard,
}: {
  tenant: Tenant;
  dashboard: LiveDashboardData;
}) {
```

- [ ] **Step 3: Replace `sales` references with `dashboard`**

Replace stats setup:

```ts
const stats = [
  { label: "Revenue · 30d", value: `$${dashboard.revenue.toLocaleString()}`, delta: "Live orders", tone: "pos" as const, spark: dashboard.spark },
  { label: "Orders · 30d", value: String(dashboard.orders), delta: "Live orders", tone: "pos" as const },
  { label: "Avg order", value: `$${dashboard.avgOrder.toFixed(2)}`, delta: "Last 30 days", tone: "pos" as const },
  { label: "Awaiting pickup", value: String(dashboard.awaitingPickup), delta: `${dashboard.readyOverSevenDays} over 7d`, tone: "warn" as const },
];
```

Replace all `sales.topItems` with `dashboard.topItems`, `sales.revenue` with `dashboard.revenue`, and `recentOrders` with `dashboard.recentOrders`.

- [ ] **Step 4: Add empty states**

In the top-selling table body, render this before mapping when there are no top items:

```tsx
{dashboard.topItems.length === 0 && (
  <tr>
    <td colSpan={4} className="py-6 text-center text-[12px]" style={{ color: "var(--color-ink-dim)" }}>
      No live order lines yet.
    </td>
  </tr>
)}
```

Use a safe share percentage:

```ts
const pct = dashboard.revenue > 0 ? (r.revenue / dashboard.revenue) * 100 : 0;
```

Replace the hard-coded attention copy:

```tsx
<b>{dashboard.readyOverSevenDays} orders</b> ready for pickup over 7 days.{" "}
```

Replace the Stripe payout copy with estimated live wording:

```tsx
Stripe payout estimate from live orders: <b>${(dashboard.revenue * 0.26).toLocaleString()}</b>.
```

In the recent orders list, render this empty state:

```tsx
{dashboard.recentOrders.length === 0 && (
  <div className="py-6 text-center text-[12px]" style={{ color: "var(--color-ink-dim)" }}>
    No live orders yet.
  </div>
)}
```

When mapping recent orders, keep the existing display and use:

```tsx
{dashboard.recentOrders.map((o, i) => (
```

- [ ] **Step 5: Type-check dashboard**

Run:

```bash
pnpm check-types:web
```

Expected: TypeScript exits successfully.

## Task 4: Wire Reports to Live Data

**Files:**
- Modify: `apps/web/src/app/admin/[tenant]/reports/page.tsx`

- [ ] **Step 1: Replace static imports and constants**

In `reports/page.tsx`, remove:

```ts
import { SALES_DATA } from "@/lib/admin-data";
```

Add:

```ts
import { getLiveReportsData } from "@/db/queries";
```

Delete the static `GST_ROWS` constant.

- [ ] **Step 2: Load reports data**

Replace:

```ts
const sales = SALES_DATA[tid as TenantId];

const months = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr"];
const monthlyRevenue = [2840, 4120, 3960, 2780, 3240, 1480];
const maxRev = Math.max(...monthlyRevenue);
```

with:

```ts
const reports = await getLiveReportsData(tid);
const maxRev = Math.max(1, ...reports.monthlyRevenue.map((row) => row.revenue));
const rangeLabel =
  reports.monthlyRevenue.length > 0
    ? `${reports.monthlyRevenue[0].label} - ${reports.monthlyRevenue[reports.monthlyRevenue.length - 1].label}`
    : "Last 6 months";
```

- [ ] **Step 3: Feed live rows to CSV export**

Replace:

```tsx
<ExportCsvButton
  rows={GST_ROWS}
  filename={`${tid}-gst-report.csv`}
/>
```

with:

```tsx
<ExportCsvButton
  rows={reports.gstRows}
  filename={`${tid}-gst-report.csv`}
/>
```

- [ ] **Step 4: Replace summary cards**

Replace summary card values with:

```tsx
{[
  { label: "Total revenue", value: `$${reports.revenue.toLocaleString()}`, sub: "6 months" },
  { label: "Total orders", value: String(reports.orders), sub: "6 months" },
  { label: "Avg order value", value: `$${reports.avgOrder.toFixed(2)}`, sub: "6 months" },
  { label: "GST collected", value: `$${reports.gst.toFixed(0)}`, sub: "Remittable" },
].map((s) => (
```

- [ ] **Step 5: Replace monthly revenue chart**

Replace the date label:

```tsx
<span className="text-[11px]" style={{ color: "var(--color-ink-dim)" }}>{rangeLabel}</span>
```

Replace the chart mapping:

```tsx
{reports.monthlyRevenue.map((row, i) => {
  const pct = (row.revenue / maxRev) * 100;
  const isLast = i === reports.monthlyRevenue.length - 1;
  return (
    <div key={row.month} className="flex-1 flex flex-col items-center gap-1.5">
      <div className="text-[11px] font-semibold tnum" style={{ color: "var(--color-ink-dim)" }}>
        ${(row.revenue / 1000).toFixed(1)}k
      </div>
      <div className="w-full flex items-end" style={{ height: 120 }}>
        <div
          className="w-full rounded-t"
          style={{
            height: `${pct}%`,
            background: isLast ? `${tenant.accent}60` : tenant.accent,
            minHeight: row.revenue > 0 ? 4 : 0,
          }}
        />
      </div>
      <div className="text-[11px]" style={{ color: "var(--color-ink-dim)" }}>
        {row.label}
      </div>
    </div>
  );
})}
```

- [ ] **Step 6: Replace category breakdown**

Replace the static category array with:

```tsx
{reports.categoryRevenue.length === 0 && (
  <div className="py-6 text-center text-[12px]" style={{ color: "var(--color-ink-dim)" }}>
    No live category sales yet.
  </div>
)}
{reports.categoryRevenue.map((c) => (
```

Keep the existing category row markup and use `c.cat`, `c.pct`, and `c.revenue`.

- [ ] **Step 7: Replace GST table rows**

Replace:

```tsx
{GST_ROWS.map((r, i) => (
```

with:

```tsx
{reports.gstRows.map((r, i) => (
```

Replace length checks in row borders with `reports.gstRows.length`.

- [ ] **Step 8: Type-check reports**

Run:

```bash
pnpm check-types:web
```

Expected: TypeScript exits successfully.

## Task 5: Update Audit Notes

**Files:**
- Modify: `docs/FEATURE_AUDIT.md`

- [ ] **Step 1: Update changelog**

Add a new row under the changelog:

```md
| 2 May 2026 | **Remaining checkout/admin data items completed:** Checkout now confirms Stripe card payments before order creation and stores the PaymentIntent ID. Dashboard recent orders, 30-day KPIs, top items, and reports now read tenant-scoped live Neon order data. |
```

- [ ] **Step 2: Update parent checkout notes**

Change the Stripe payment UI row to:

```md
| Stripe payment UI | ✅ Done | Uses Stripe Card Element and confirms a live test-mode PaymentIntent before creating the order |
```

- [ ] **Step 3: Update dashboard/report/backend notes**

Change dashboard recent orders to:

```md
| Recent orders feed | ✅ Done | Reads latest tenant-scoped orders from Neon DB |
```

Change the reports rows that currently imply static data where needed:

```md
| Monthly revenue bar chart | ✅ Done | Reads live tenant-scoped order totals from Neon DB |
| Revenue by category breakdown | ✅ Done | Uses live order lines joined to catalog items where item IDs match |
| GST / BAS-ready summary table | ✅ Done | Groups live order totals and GST by month; Stripe fees are estimated because balance transactions are not stored |
```

Change backend dashboard row:

```md
| Dashboard recent orders live | ✅ Done | Dashboard and reports now use tenant-scoped Neon order data |
```

Remove item `18 | Dashboard recent orders connected to live Neon DB` from the remaining lower-priority table.

- [ ] **Step 4: Type-check docs-only change is not needed**

No command is required for the docs-only change. Run the final verification in Task 6.

## Task 6: Final Verification

**Files:**
- No direct file edits unless verification exposes issues.

- [ ] **Step 1: Run full type-check**

Run:

```bash
pnpm check-types
```

Expected: TypeScript exits successfully. If route helper types are missing, run:

```bash
pnpm --filter web exec next typegen
pnpm check-types
```

- [ ] **Step 2: Run production build**

Run:

```bash
pnpm build:web
```

Expected: Next.js production build completes successfully. If it fails because required runtime env vars are missing during build, verify the failing code path and preserve lazy DB/Stripe/Auth initialization patterns rather than adding module-import clients.

- [ ] **Step 3: Inspect git diff**

Run:

```bash
git diff --stat
git diff -- apps/web/src/app/[tenant]/checkout/checkout-screen.tsx apps/web/src/db/queries.ts apps/web/src/app/admin/[tenant]/dashboard/page.tsx apps/web/src/app/admin/[tenant]/dashboard/dashboard-client.tsx apps/web/src/app/admin/[tenant]/reports/page.tsx docs/FEATURE_AUDIT.md
```

Expected: Diff contains only the checkout, live query, admin page, and audit changes described in this plan.

- [ ] **Step 4: Commit implementation**

Run:

```bash
git add apps/web/src/app/[tenant]/checkout/checkout-screen.tsx apps/web/src/db/queries.ts apps/web/src/app/admin/[tenant]/dashboard/page.tsx apps/web/src/app/admin/[tenant]/dashboard/dashboard-client.tsx apps/web/src/app/admin/[tenant]/reports/page.tsx docs/FEATURE_AUDIT.md
git commit -m "Implement Stripe checkout and live admin reports"
```

Expected: Commit succeeds.
