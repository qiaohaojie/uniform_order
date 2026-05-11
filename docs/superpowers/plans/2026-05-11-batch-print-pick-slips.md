# Batch print pick slips — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the "Print pick slips" button on `/admin/[tenant]/orders` print one slip per A4 page for every order in status `new`, in the same visual format as the existing single-slip print, with no Kanban/print data drift.

**Architecture:** Extract the pick-slip card body into a shared presentational `<PickSlip />` (no data fetching of its own). Orders state remains owned by `OrdersBoard`; a hidden `print:block` section renders one `<PickSlip />` per `new` order as a sibling of the Kanban. Lines reach the client via a new `?withLines=1` query on `/api/orders`. The topbar button reads a lifted `newCount` to disable/confirm, then calls `window.print()`.

**Tech Stack:** Next.js 16 App Router, React 19 (RSC + client components), Drizzle ORM on Neon, Tailwind CSS v4, native CSS `@page` + `break-after: page`.

**Correctness gate:** This repo has no test suite — `pnpm check-types:web` from the repo root is the type/correctness gate. Visual + interaction verification happens via `pnpm dev:web` in a browser (golden path on `/admin/nsbh/orders`), and §3.7 of `docs/remaining_work.md` carries a manual A4-printer QA pass that is handed off after merge.

**Spec:** `docs/superpowers/specs/2026-05-11-batch-print-pick-slips-design.md`.

---

## File map

- **Create:** `apps/web/src/components/admin/pick-slip.tsx` — pure presentational component (parent-note banner + crest header + student/parent/fulfilment grid + items table + totals + footer + barcode). Accepts a `refundsSlot?: ReactNode` so the detail page can render refunds in the existing visual position without `PickSlip` knowing the refund shape.
- **Modify:** `apps/web/src/app/admin/[tenant]/orders/[orderId]/page.tsx` — replace the inline card JSX with `<PickSlip … refundsSlot={…} />`. Convert `Date` and `Decimal` fields to strings before passing in. `OrderActivityStrip` stays outside the card, unchanged.
- **Modify:** `apps/web/src/app/api/orders/route.ts` — handle `?withLines=1` on the operator-tenant path; one extra batched `inArray` query attaches `lines` to each row.
- **Modify:** `apps/web/src/app/admin/[tenant]/orders/orders-board.tsx` — request `withLines=1`, derive `newOrders` sorted oldest-first, build `linesByOrderId`, render the hidden batch-print block, add `data-no-print` to the Kanban root, fire `onNewCountChange` via `useEffect`.
- **Modify:** `apps/web/src/app/admin/[tenant]/orders/orders-page-client.tsx` — hold `newCount` state, pass `onNewCountChange` to the board, replace the inline `window.print()` with `handlePrint`, add count + `disabled` to the button label.
- **Modify:** `apps/web/src/index.css` — add `@page { size: A4; margin: 12mm; }` inside the existing `@media print` block; if Tailwind v4's `break-after-page` utility does not resolve in this project, add a one-line `@layer utilities` fallback.
- **Modify:** `docs/remaining_work.md` — note §3.7 code half complete; A4-printer QA pass remains.

---

## Task 1: Extract `PickSlip` presentational component

**Files:**
- Create: `apps/web/src/components/admin/pick-slip.tsx`
- Modify: `apps/web/src/app/admin/[tenant]/orders/[orderId]/page.tsx` (lines 1-313)

This task is a pure refactor: zero behaviour change, same DOM output on the detail page.

- [ ] **Step 1: Create the shared component**

Create `apps/web/src/components/admin/pick-slip.tsx` with the exact content below. The JSX is lifted verbatim from `[orderId]/page.tsx` lines 110-265 + 300-307 (the card wrapper, parent-note print banner, header, details grid, parent-note callout, items table with totals, and the footer with barcode). The `Barcode` helper at lines 13-38 moves into this file as `PickSlipBarcode`. The Refunds block at lines 267-298 is **not** included; the detail page passes it via `refundsSlot`.

```tsx
import type { ReactNode } from "react";
import type { Tenant } from "@/lib/data";
import { Chip } from "@/components/chip";
import { DoubleRule } from "@/components/double-rule";
import { Crest } from "@/components/crest";

export interface PickSlipOrder {
  id: string;
  status: string;
  parentName: string;
  parentEmail: string;
  parentMobile: string;
  parentNote: string | null;
  studentName: string;
  studentYear: string;
  studentRoll: string;
  delivery: string;
  total: string;
  gst: string;
  stripeRef: string | null;
  createdAt: string; // ISO string — see Task 2 for the detail-page adapter
}

export interface PickSlipLine {
  itemName: string;
  variantLabel: string | null;
  qty: number;
  lineTotal: string;
}

const STATUS_MAP: Record<string, { tone: "info" | "warn" | "success" | "neutral" | "danger"; label: string }> = {
  pending_payment: { tone: "neutral", label: "Pending payment" },
  new: { tone: "info", label: "New" },
  packing: { tone: "warn", label: "Packing" },
  ready: { tone: "success", label: "Ready for pickup" },
  collected: { tone: "neutral", label: "Collected" },
  partially_refunded: { tone: "danger", label: "Partially refunded" },
  refunded: { tone: "danger", label: "Refunded" },
};

function PickSlipBarcode({ orderId }: { orderId: string }) {
  const widths = [3, 1, 2, 1, 1, 3, 1, 2, 3, 1, 1, 2, 3, 2, 1, 1, 3, 1, 2, 1, 1, 3, 2, 1];
  let x = 0;
  return (
    <svg width={180} height={48}>
      {widths.map((w, i) => {
        const fill = i % 2 === 0 ? "var(--color-ink)" : "transparent";
        const el = <rect key={i} x={x} y={0} width={w * 2} height={36} fill={fill} />;
        x += w * 2 + 1;
        return el;
      })}
      <text
        x={0}
        y={46}
        fontFamily="var(--font-mono)"
        fontSize="10"
        fill="var(--color-ink-dim)"
        letterSpacing="2"
      >
        {orderId}
      </text>
    </svg>
  );
}

export interface PickSlipProps {
  order: PickSlipOrder;
  tenant: Tenant;
  lines: PickSlipLine[];
  /** Rendered between the items table and the footer. Detail page uses it for the refunds block; batch print passes nothing. */
  refundsSlot?: ReactNode;
}

export function PickSlip({ order, tenant, lines, refundsSlot }: PickSlipProps) {
  const statusInfo = STATUS_MAP[order.status] ?? { tone: "neutral" as const, label: order.status };
  const total = parseFloat(order.total);
  const gst = parseFloat(order.gst);
  const placedAt = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString("en-AU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";

  return (
    <div
      className="bg-white rounded-xl border p-7"
      style={{ borderColor: "var(--color-rule)" }}
    >
      {/* Print-only: parent note at top of pick slip */}
      {order.parentNote && (
        <div className="print:block hidden mb-4 p-3 border-2 border-black">
          <div className="text-[11px] font-bold uppercase tracking-wide mb-1">Note from parent</div>
          <div className="text-[13px] leading-snug">{order.parentNote}</div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Crest tenant={tenant} size={44} />
            <div>
              <div className="type-h2 leading-tight" style={{ color: "var(--color-ink)" }}>
                Pick Slip
              </div>
              <div
                className="font-mono text-[13px] font-semibold"
                style={{ color: tenant.accent }}
              >
                {order.id}
              </div>
            </div>
          </div>
          <div className="text-[11.5px] mt-1" style={{ color: "var(--color-ink-dim)" }}>
            Placed {placedAt}
          </div>
        </div>
        <Chip tone={statusInfo.tone}>{statusInfo.label}</Chip>
      </div>

      <DoubleRule />

      {/* Details grid */}
      <div className="grid grid-cols-3 gap-6 mt-4 mb-5">
        <div>
          <div className="type-label mb-1" style={{ color: "var(--color-ink-dim)" }}>Student</div>
          <div className="font-serif text-[16px] font-medium" style={{ color: "var(--color-ink)" }}>
            {order.studentName}
          </div>
          <div className="text-[11px]" style={{ color: "var(--color-ink-dim)" }}>
            {order.studentYear} · Roll {order.studentRoll}
          </div>
        </div>
        <div>
          <div className="type-label mb-1" style={{ color: "var(--color-ink-dim)" }}>Parent</div>
          <div className="font-serif text-[16px] font-medium" style={{ color: "var(--color-ink)" }}>
            {order.parentName}
          </div>
          <div className="text-[11px]" style={{ color: "var(--color-ink-dim)" }}>
            {order.parentMobile}
          </div>
        </div>
        <div>
          <div className="type-label mb-1" style={{ color: "var(--color-ink-dim)" }}>Fulfilment</div>
          <div className="font-serif text-[16px] font-medium" style={{ color: "var(--color-ink)" }}>
            {order.delivery === "pickup" ? "Pickup at office" : "Ship to home"}
          </div>
          <div className="text-[11px]" style={{ color: "var(--color-ink-dim)" }}>
            {order.delivery === "pickup" ? "Notify when ready" : order.parentEmail}
          </div>
        </div>
      </div>

      <DoubleRule />

      {/* Parent note callout (on-screen, screen + print) */}
      {order.parentNote && (
        <div
          className="rounded-lg border p-3 mb-4 mt-4"
          style={{ borderColor: "var(--color-rule)", background: "var(--color-parchment)" }}
        >
          <div className="text-[11px] font-bold tracking-[1.2px] uppercase mb-1" style={{ color: "var(--color-gold)" }}>
            Note from parent
          </div>
          <div className="text-[13px] leading-[1.5]" style={{ color: "var(--color-ink)" }}>
            {order.parentNote}
          </div>
        </div>
      )}

      {/* Items table */}
      <table className="w-full border-collapse text-[13px] mt-3.5" style={{ fontFamily: "var(--font-sans)" }}>
        <thead>
          <tr className="text-[10.5px] uppercase tracking-[0.6px]" style={{ color: "var(--color-ink-dim)" }}>
            <th className="text-left py-2 font-bold border-b w-8" style={{ borderColor: "var(--color-rule)" }}>✓</th>
            <th className="text-left py-2 font-bold border-b" style={{ borderColor: "var(--color-rule)" }}>Item</th>
            <th className="text-left py-2 font-bold border-b w-[150px]" style={{ borderColor: "var(--color-rule)" }}>Variant</th>
            <th className="text-center py-2 font-bold border-b w-[50px]" style={{ borderColor: "var(--color-rule)" }}>Qty</th>
            <th className="text-right py-2 font-bold border-b w-[90px]" style={{ borderColor: "var(--color-rule)" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr
              key={i}
              className="border-b"
              style={{ borderColor: "var(--color-rule)", borderStyle: "dashed" }}
            >
              <td className="py-3">
                <div
                  className="w-[18px] h-[18px] border rounded"
                  style={{ borderColor: "var(--color-ink)", borderWidth: 1.5 }}
                />
              </td>
              <td className="py-3 font-medium" style={{ color: "var(--color-ink)" }}>{line.itemName}</td>
              <td className="py-3 text-[12px]" style={{ color: "var(--color-ink-dim)" }}>{line.variantLabel}</td>
              <td className="py-3 text-center font-bold font-mono" style={{ color: "var(--color-ink)" }}>{line.qty}</td>
              <td className="py-3 text-right font-semibold tnum" style={{ color: "var(--color-ink)" }}>
                ${parseFloat(line.lineTotal).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} className="pt-3.5 text-right font-serif text-[16px] font-semibold" style={{ color: "var(--color-ink)" }}>
              Total (incl. GST)
            </td>
            <td className="pt-3.5 text-right font-serif text-[22px] font-semibold tnum" style={{ color: "var(--color-ink)" }}>
              ${total.toFixed(2)}
            </td>
          </tr>
          <tr>
            <td colSpan={4} className="text-right text-[11px]" style={{ color: "var(--color-ink-dim)" }}>GST included</td>
            <td className="text-right text-[11px] tnum" style={{ color: "var(--color-ink-dim)" }}>${gst.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      {refundsSlot}

      {/* Footer */}
      <div className="mt-6 flex items-center justify-between">
        <div className="text-[11px] font-mono" style={{ color: "var(--color-ink-dim)" }}>
          {order.stripeRef ? `Paid via Stripe · ${order.stripeRef}` : "Payment pending"} · {order.parentEmail}
        </div>
        <PickSlipBarcode orderId={order.id} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewire the detail page to use `<PickSlip />`**

Replace the file body of `apps/web/src/app/admin/[tenant]/orders/[orderId]/page.tsx` with the version below. Changes vs. current: removes the local `Barcode` helper; removes the inline `statusMap`/`total`/`gst`/`placedAt` derivations (they live in `PickSlip` now); converts `order.createdAt` (Date) to ISO string before passing in; renders the refunds block via the `refundsSlot` prop so its visual position between items table and footer is preserved.

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrderById, getOrderRefunds, getTotalRefunded, getTenant, toTenantBrand } from "@/db/queries";
import { AdminTopbar } from "@/components/admin-shell";
import { DoubleRule } from "@/components/double-rule";
import { OrderDetailActions } from "./order-detail-actions";
import { PrintButton } from "@/components/print-button";
import { loadOrderActivity } from "@/lib/audit/load-order-activity";
import { OrderActivityStrip } from "@/components/admin/order-activity-strip";
import { PickSlip, type PickSlipOrder, type PickSlipLine } from "@/components/admin/pick-slip";

export default async function OrderDetailPage({
  params,
}: { params: Promise<{ tenant: string; orderId: string }> }) {
  const { tenant: tid, orderId } = await params;
  const tenantRecord = await getTenant(tid);
  if (!tenantRecord) notFound();
  const tenant = toTenantBrand(tenantRecord);

  const order = await getOrderById(orderId);
  if (!order || order.tenantId !== tid) notFound();

  const refunds = await getOrderRefunds(orderId);
  const refundedTotal = await getTotalRefunded(orderId);
  const activityRows = await loadOrderActivity(orderId);

  const total = parseFloat(order.total);

  const slipOrder: PickSlipOrder = {
    id: order.id,
    status: order.status,
    parentName: order.parentName,
    parentEmail: order.parentEmail,
    parentMobile: order.parentMobile,
    parentNote: order.parentNote,
    studentName: order.studentName,
    studentYear: order.studentYear,
    studentRoll: order.studentRoll,
    delivery: order.delivery,
    total: order.total,
    gst: order.gst,
    stripeRef: order.stripeRef,
    createdAt: order.createdAt ? order.createdAt.toISOString() : "",
  };

  const slipLines: PickSlipLine[] = order.lines.map((line) => ({
    itemName: line.itemName,
    variantLabel: line.variantLabel,
    qty: line.qty,
    lineTotal: line.lineTotal,
  }));

  const refundsBlock = refunds.length > 0 ? (
    <>
      <DoubleRule />
      <div className="mt-4">
        <div className="text-[10.5px] uppercase tracking-[0.6px] font-bold mb-2" style={{ color: "var(--color-ink-dim)" }}>
          Refunds
        </div>
        {refunds.map((refund) => (
          <div key={refund.id} className="flex items-center justify-between py-2 border-b text-[12.5px]" style={{ borderColor: "var(--color-rule)", borderStyle: "dashed" }}>
            <div style={{ color: "var(--color-ink)" }}>
              {refund.reason ? refund.reason : "Refund"}
              {refund.stripeRefundId && (
                <span className="ml-1 text-[10px] font-mono" style={{ color: "var(--color-ink-dim)" }}>
                  · {refund.stripeRefundId}
                </span>
              )}
            </div>
            <div className="font-semibold tnum" style={{ color: "#B23A2A" }}>
              −${parseFloat(String(refund.amount)).toFixed(2)}
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between pt-2 text-[12.5px] font-semibold">
          <div style={{ color: "var(--color-ink)" }}>Net total</div>
          <div className="tnum" style={{ color: "var(--color-ink)" }}>
            ${Math.max(0, total - refundedTotal).toFixed(2)}
          </div>
        </div>
      </div>
    </>
  ) : null;

  return (
    <>
      <AdminTopbar
        kicker={`${tenant.short} · Orders`}
        title={order.id}
        right={
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/${tid}/orders`}
              className="h-9 px-3.5 text-[12.5px] font-semibold rounded-md border flex items-center gap-1.5"
              style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
            >
              ← Back to orders
            </Link>
            <PrintButton label="Print pick slip" />
            <div className="relative">
              <OrderDetailActions
                orderId={order.id}
                tenantId={tid}
                currentStatus={order.status}
                accent={tenant.accent}
                parentEmail={order.parentEmail}
                parentName={order.parentName}
                studentName={order.studentName}
                total={total}
                refunded={refundedTotal}
              />
            </div>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto p-7">
        <div className="max-w-3xl mx-auto">
          <PickSlip order={slipOrder} tenant={tenant} lines={slipLines} refundsSlot={refundsBlock} />
          <OrderActivityStrip rows={activityRows} />
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Type-check**

Run from the repo root: `pnpm check-types:web`
Expected: clean, no errors.

- [ ] **Step 4: Visual sanity check**

Run: `pnpm dev:web`. Open `http://localhost:3000/admin/nsbh/orders/<any-order-id>` (pick any order from the Kanban). Confirm:
- The page looks identical to before (header, crest, slip card, items, totals, refunds if present, audit activity strip below).
- Click "Print pick slip" — the print preview shows the slip card alone, no sidebar/topbar.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/admin/pick-slip.tsx \
        "apps/web/src/app/admin/[tenant]/orders/[orderId]/page.tsx"
git commit -m "refactor: extract PickSlip component from order detail page

Pure refactor: no visual or behavioural change on the detail page.
PickSlip is a presentational component that takes a JSON-shaped
order, tenant, and lines, plus an optional refundsSlot for the
detail page's refunds block. Sets up Task 2 (batch print)."
```

---

## Task 2: Eager line-item fetch on `/api/orders?withLines=1`

**Files:**
- Modify: `apps/web/src/app/api/orders/route.ts` (the GET handler, lines 27-77)

- [ ] **Step 1: Add `withLines` handling on the operator path**

In `apps/web/src/app/api/orders/route.ts`:

1. Add `inArray` to the existing `drizzle-orm` import.
2. Add `orderLines` to the existing `@/db` import (it is already exported from `@/db` per Task 2 of audit-log impl).
3. After `const rows = await getOrdersByTenant(tenantId);` (currently line 71) and **before** the `return NextResponse.json(rows);`, insert the `withLines` branch.

Final handler shape (replace the operator branch block beginning at the `ensureTenantAccess` check):

```ts
const tenantAccessResponse = ensureTenantAccess(authResult.user, tenant.shopEmail);
if (tenantAccessResponse) return tenantAccessResponse;

const rateLimitResponse = applyRateLimit(req, `orders:tenant:${tenantId}:${authResult.user.id}`, {
  limit: 120,
  windowMs: 60_000,
});
if (rateLimitResponse) return rateLimitResponse;

const rows = await getOrdersByTenant(tenantId);

if (searchParams.get("withLines") === "1" && rows.length > 0) {
  const ids = rows.map((r) => r.id);
  const lines = await db
    .select()
    .from(orderLines)
    .where(inArray(orderLines.orderId, ids));
  const linesByOrderId: Record<string, typeof lines> = {};
  for (const line of lines) {
    (linesByOrderId[line.orderId] ??= []).push(line);
  }
  return NextResponse.json(
    rows.map((r) => ({ ...r, lines: linesByOrderId[r.id] ?? [] })),
  );
}

return NextResponse.json(rows);
```

The parent-email path (when `email` is present) is unchanged — it never uses `withLines`.

- [ ] **Step 2: Type-check**

Run: `pnpm check-types:web`
Expected: clean.

- [ ] **Step 3: Manual smoke**

Run `pnpm dev:web`. In a browser devtools tab, with the operator session active, fetch:
- `http://localhost:3000/api/orders?tenantId=nsbh` — response is an array of orders **without** `lines`.
- `http://localhost:3000/api/orders?tenantId=nsbh&withLines=1` — response is the same array, each order now has a `lines: [...]` array (may be empty for some).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/orders/route.ts
git commit -m "feat(api): support ?withLines=1 on GET /api/orders

Operator-tenant path only. Adds a single batched inArray query for
order_lines keyed on the returned order ids and attaches them as
.lines on each row. Used by the orders Kanban for the upcoming
batch pick-slip print."
```

---

## Task 3: Print CSS — `@page` + `break-after-page` utility

**Files:**
- Modify: `apps/web/src/index.css` (the `@media print` block at lines 77-107)

- [ ] **Step 1: Add `@page` rule and the break utility**

In `apps/web/src/index.css`, inside the existing `@media print { … }` block (currently ending at line 107), add an `@page` rule. The block becomes:

```css
@media print {
  @page {
    size: A4;
    margin: 12mm;
  }

  /* Hide the admin sidebar, topbar, and action buttons */
  nav,
  aside,
  [data-admin-sidebar],
  [data-admin-topbar],
  [data-no-print] {
    display: none !important;
  }

  /* Remove background colours and shadows for clean print output */
  body {
    background: white !important;
    color: black !important;
  }

  /* Expand the pick slip card to fill the page */
  .print\:full-page {
    width: 100% !important;
    max-width: 100% !important;
    box-shadow: none !important;
    border: none !important;
    padding: 0 !important;
  }

  /* Ensure page breaks don't split table rows */
  tr {
    page-break-inside: avoid;
  }
}
```

- [ ] **Step 2: Verify Tailwind's `break-after-page` utility resolves**

Tailwind v4 ships `break-after-page` as a first-class utility. Run a quick check by searching the generated build for the class, or just test on a throwaway element in Task 4. If it does not resolve in this project's config, add the following at the end of `apps/web/src/index.css` (outside the `@media print` block):

```css
@layer utilities {
  .break-after-page { break-after: page; }
}
```

If the utility does resolve, **do not** add the fallback. Pick exactly one. Decide in Task 4 step 3 when you can see the print preview directly.

- [ ] **Step 3: Type-check**

Run: `pnpm check-types:web`
Expected: clean (CSS doesn't affect typecheck, but run anyway to confirm nothing else broke).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/index.css
git commit -m "style(print): add @page A4 rule for pick-slip printing

Sets explicit A4 page size with 12mm margins. Used by the upcoming
batch pick-slip print on the orders page; the existing single-slip
print path inherits the same margins."
```

---

## Task 4: Wire `OrdersBoard` — batch print block + Kanban tagging + count callback

**Files:**
- Modify: `apps/web/src/app/admin/[tenant]/orders/orders-board.tsx`

- [ ] **Step 1: Read the file to locate the integration points**

Open `apps/web/src/app/admin/[tenant]/orders/orders-board.tsx`. The integration points are:
- Top of file: `OrderStatus`, props interface, the `fetchOrders` call.
- The `useEffect` block (around line 167-169) calls `fetchOrders()`.
- Bottom of file: the JSX returns columns + cards. Identify the **root element** of the Kanban (the outermost `<div>` that wraps the columns) — this is where `data-no-print` is added in Step 5.

- [ ] **Step 2: Extend props with `onNewCountChange`**

In the props interface for `OrdersBoard` (or wherever it currently declares `tenantId`, `tenant`, `searchQuery`), add:

```ts
onNewCountChange?: (count: number) => void;
```

Accept it in the destructure: `({ tenantId, tenant, searchQuery, onNewCountChange })`.

- [ ] **Step 3: Extend the order type to include lines**

Wherever the local `Order` (or `OrderRow`) interface is declared in this file, add a `lines` field matching `PickSlipLine` (a re-export from `pick-slip.tsx`):

```ts
import type { PickSlipLine } from "@/components/admin/pick-slip";

interface Order {
  // ...existing fields stay here
  lines: PickSlipLine[]; // populated by the withLines=1 fetch
}
```

If the file already imports types from elsewhere for `Order`, add `lines` to that source instead. Decimal fields on lines (`unitPrice`, `lineTotal`) come over the wire as strings — that matches `PickSlipLine` already.

- [ ] **Step 4: Change the fetch URL to include `withLines=1`**

In `fetchOrders` (around line 153), change:

```ts
const res = await fetch(`/api/orders?tenantId=${encodeURIComponent(tenantId)}`);
```

to:

```ts
const res = await fetch(`/api/orders?tenantId=${encodeURIComponent(tenantId)}&withLines=1`);
```

- [ ] **Step 5: Add `data-no-print` to the Kanban root and render the hidden batch-print block**

Find the JSX block that renders the columns (around line 224 — the `filtered.filter((o) => o.status === col.id)` loop). The outermost wrapping element of this Kanban is the root container — add `data-no-print` to that element.

After the Kanban root's closing tag (still inside the component's returned fragment), append the hidden batch-print section. Import `PickSlip` at the top of the file:

```ts
import { PickSlip, type PickSlipOrder, type PickSlipLine } from "@/components/admin/pick-slip";
```

Then inside the component body, before the return:

```ts
const newOrders = orders
  .filter((o) => o.status === "new")
  .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
```

And in the returned JSX, *after* the Kanban root element, add the hidden batch-print section:

```tsx
<div className="print:block hidden" aria-hidden>
  {newOrders.map((o, idx) => {
    const slipOrder: PickSlipOrder = {
      id: o.id,
      status: o.status,
      parentName: o.parentName,
      parentEmail: o.parentEmail,
      parentMobile: o.parentMobile,
      parentNote: o.parentNote,
      studentName: o.studentName,
      studentYear: o.studentYear,
      studentRoll: o.studentRoll,
      delivery: o.delivery,
      total: o.total,
      gst: o.gst,
      stripeRef: o.stripeRef,
      createdAt: o.createdAt,
    };
    return (
      <div
        key={o.id}
        className={idx < newOrders.length - 1 ? "break-after-page" : undefined}
      >
        <PickSlip order={slipOrder} tenant={tenant} lines={o.lines} />
      </div>
    );
  })}
</div>
```

If a field above (e.g. `parentMobile`) doesn't exist on the local `Order` type but does exist on the JSON the server returns, extend the local `Order` type in Step 3 to include it. Compare against `PickSlipOrder` in `pick-slip.tsx` — those exact field names must be present on the local `Order`.

- [ ] **Step 6: Fire `onNewCountChange` via `useEffect`**

Below the `newOrders` derivation, add:

```tsx
useEffect(() => {
  onNewCountChange?.(newOrders.length);
}, [newOrders.length, onNewCountChange]);
```

The callback **must** be in a `useEffect` (not inline during render) to avoid the parent-`setState`-during-child-render warning and a render loop.

- [ ] **Step 7: Type-check**

Run: `pnpm check-types:web`
Expected: clean. If `Order` is missing fields that `PickSlipOrder` requires, add them in Step 3 and re-run.

- [ ] **Step 8: Visual sanity check + print preview**

Run `pnpm dev:web` and open `http://localhost:3000/admin/nsbh/orders`.

- The Kanban should look unchanged.
- Open browser devtools → Rendering tab → enable "Emulate CSS media type: print" (or use `Cmd+P` to open print preview).
- Confirm: the Kanban disappears, and a sequence of pick slips appears in its place, one per page (page breaks between them), oldest-`createdAt` first. **No trailing blank page after the last slip.**
- If `break-after-page` does not produce page breaks, go back to Task 3 step 2 and add the `@layer utilities` fallback now, then re-check.
- Disable print emulation when done.

- [ ] **Step 9: Commit**

```bash
git add "apps/web/src/app/admin/[tenant]/orders/orders-board.tsx"
git commit -m "feat(orders): hidden batch pick-slip block for print

OrdersBoard now requests withLines=1, derives newOrders sorted
oldest-first, and renders a print-only block of PickSlip components
as a sibling of the Kanban. Adds data-no-print to the Kanban root.
Lifts newCount to OrdersPageClient via onNewCountChange in a
useEffect to avoid setState-during-render."
```

---

## Task 5: Wire `OrdersPageClient` — lifted count, `handlePrint`, button state

**Files:**
- Modify: `apps/web/src/app/admin/[tenant]/orders/orders-page-client.tsx`

- [ ] **Step 1: Add `newCount` state and pass `onNewCountChange` to the board**

At the top of `OrdersPageClient`, alongside the existing `searchQuery` state:

```ts
const [newCount, setNewCount] = useState(0);
```

In the `<OrdersBoard … />` JSX at the bottom of the component, add the new prop:

```tsx
<OrdersBoard
  tenantId={tenantId}
  tenant={tenant}
  searchQuery={searchQuery}
  onNewCountChange={setNewCount}
/>
```

- [ ] **Step 2: Replace the inline `window.print()` with `handlePrint`**

Above the returned JSX, define:

```ts
const handlePrint = () => {
  if (newCount === 0) return;
  // 25 is roughly a full-day picking run at one school. Above that we want a
  // moment of pause before committing operator-side paper + ink.
  if (newCount >= 25 && !window.confirm(`Print ${newCount} pick slips?`)) {
    return;
  }
  window.print();
};
```

In the Print pick slips button JSX (currently `<button onClick={() => window.print()} className="…">…</button>`), replace it with:

```tsx
<button
  onClick={handlePrint}
  disabled={newCount === 0}
  title={newCount === 0 ? "No new orders to pick" : undefined}
  className="h-9 px-3.5 text-[12.5px] font-semibold rounded-md border flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
  style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
>
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
    <rect x="6" y="3" width="12" height="6" /><rect x="3" y="9" width="18" height="9" rx="1" /><rect x="6" y="15" width="12" height="6" />
  </svg>
  {newCount > 0 ? `Print pick slips (${newCount})` : "Print pick slips"}
</button>
```

- [ ] **Step 3: Type-check**

Run: `pnpm check-types:web`
Expected: clean.

- [ ] **Step 4: Manual smoke (golden path + edge cases)**

Run `pnpm dev:web` and open `http://localhost:3000/admin/nsbh/orders`.

- If there are 0 `new` orders, the button is disabled, label reads "Print pick slips", hovering shows tooltip "No new orders to pick".
- If there are some `new` orders, the label reads "Print pick slips (N)" with the live count.
- Click the button — the print dialog opens immediately when N < 25; the hidden batch-print block prints (see Task 4 step 8 for what to look for).
- If you have ≥ 25 `new` orders available, the confirm dialog should appear with the right count; declining cancels.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/admin/[tenant]/orders/orders-page-client.tsx"
git commit -m "feat(orders): batch print button with count + confirm guard

Lifts the new-order count from OrdersBoard via the new callback,
disables the button when zero, suffixes the live count to the label,
and shows a confirm dialog when printing >= 25 slips to prevent
accidental paper avalanches."
```

---

## Task 6: Update `docs/remaining_work.md` for the §3.7 code half

**Files:**
- Modify: `docs/remaining_work.md` (the §3.7 entry, currently lines 95-97)

- [ ] **Step 1: Update §3.7 to note the code half is shipped**

Open `docs/remaining_work.md` and replace the §3.7 block (currently:

```
### 3.7 Print stylesheet QA

`window.print()` works for pick slips, but needs verification on real A4 in Chrome and Safari (page breaks for multi-page picks, single-slip-per-page mode for batch printing).
```

) with:

```
### 3.7 Print stylesheet QA — manual A4 verification only

**Code half shipped.** `window.print()` works for the single-slip path (order detail page) and for batch picking from the orders page (one slip per A4 page for every order in status `new`, via the shared `PickSlip` component, `@page A4` rule, and `break-after-page` between slips). See `docs/superpowers/plans/2026-05-11-batch-print-pick-slips.md` and spec `…/specs/2026-05-11-batch-print-pick-slips-design.md`.

**Remaining (manual):** Real A4 paper QA in Chrome and Safari on macOS — single slip prints clean, batch prints one slip per page with no trailing blank, parent-note banner appears on slips that have a note, barcode renders, Kanban never appears in print output.
```

- [ ] **Step 2: Commit**

```bash
git add docs/remaining_work.md
git commit -m "docs: §3.7 code half shipped; manual A4 QA remains

Batch pick-slip print is implemented (PickSlip component + @page
A4 + hidden print:block batch section on the orders page). The
remaining work is real-A4 verification on Chrome and Safari."
```

---

## Self-review checklist (run after Task 6)

- [ ] Open the spec `docs/superpowers/specs/2026-05-11-batch-print-pick-slips-design.md` and confirm each numbered design section has a corresponding implementation step in this plan: §1 (PickSlip) → Task 1. §2 (batch render in OrdersBoard, `data-no-print`, callback in `useEffect`) → Task 4. §3 (`withLines=1`) → Task 2. §4 (button behaviour) → Task 5. §5 (`@page` + `break-after-page`) → Task 3.
- [ ] Confirm verification steps cover: §6.1 single slip prints (Task 1 step 4), §6.2-§6.5 batch with 0 / 1 / N / ≥25 orders (Task 4 step 8 + Task 5 step 4), §6.6 Kanban hidden in print (Task 4 step 8), §6.7 Safari pass — flag for the user that this part is manual and lives in `remaining_work.md` §3.7 post-merge.
- [ ] Confirm no step references `"paid"` status, `placedAt`, or a server-side fetch in `orders/page.tsx` — all three were corrected after spec review.
- [ ] Confirm `PickSlipOrder` field list in Task 1 matches the field list consumed by `PickSlip` JSX and the field list mapped from `getOrderById` in Task 1 step 2 and from `Order` in Task 4 step 5. Names must be identical across all three.

If any item fails, fix the relevant task inline.
