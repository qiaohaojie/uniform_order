# Parent Order Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a parent-facing order detail page at `/orders/[orderId]` showing fulfillment timeline, line items, payment summary, and refunds — wired into the orders list, the post-checkout placed page, and the transactional emails.

**Architecture:** Session-only auth via `getSessionUser` + `ensureParentEmailAccess`. Server component does data fetching directly from `@/db/queries` (no new API route). Status block branches on `order.status`: 4-step stepper for fulfillment statuses, "Payment processing" banner for `pending_payment`, refund banner for `partially_refunded` / `refunded`. Order IDs are tenant-prefixed strings (`NSBH-XXXXXXXXXX`), used verbatim everywhere.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Drizzle ORM, Neon Auth, `@react-email/components` for email templates.

**Project conventions** (per `CLAUDE.md`):
- No test suite. **Type-check (`pnpm check-types:web`) is the correctness gate.**
- Server/client split: thin server `page.tsx` → `"use client"` companion (`*-client.tsx`).
- Path alias `@/*` → `apps/web/src/*`.
- Bespoke Tailwind components, design tokens in `src/index.css` (`--color-parchment`, `--color-paper`, `--color-rule`, `--color-gold`, `.tnum`, `var(--color-ink-dim)`).
- Each task ends with `pnpm check-types:web` and a commit. Frequent commits.

**Spec:** `docs/superpowers/specs/2026-05-07-parent-order-detail-design.md`

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `apps/web/src/components/order-status-stepper.tsx` | Presentational 4-step stepper (Placed → Packing → Ready → Collected) keyed on fulfillment status. Pure props, no DB. | Create |
| `apps/web/src/app/orders/[orderId]/page.tsx` | Server component: auth (`getSessionUser` redirect / `ensureParentEmailAccess` notFound), data fetch (order, refunds, tenant, totalRefunded), pass props to client. | Create |
| `apps/web/src/app/orders/[orderId]/order-detail-client.tsx` | `"use client"` presentational: header, status block (3 branches), pickup details, line items, payment summary, support CTA. Pure props, no fetching. | Create |
| `apps/web/src/app/orders/orders-list-client.tsx` | Wrap order rows in `Link href="/orders/{id}"`. Active card → whole card linkable. Past row → details area linkable, Re-order link stays separate. | Modify |
| `apps/web/src/app/[tenant]/order/placed/page.tsx` | Update "View order details" button to link to `/orders/{orderId}` (currently links to `/orders` list). | Modify |
| `apps/web/src/lib/email/templates/OrderConfirmation.tsx` | Add `orderUrl` prop + "View order status" button after the items table. | Modify |
| `apps/web/src/lib/email/templates/OrderReady.tsx` | Same pattern: add `orderUrl` prop + "View order status" button. | Modify |
| `apps/web/src/lib/email/index.ts` | Thread `orderUrl = ${requireAppUrl()}/orders/${order.id}` into both email render calls. | Modify |

---

## Reused (no changes)

| Symbol | Path | Purpose |
|---|---|---|
| `getSessionUser` | `@/lib/auth/authorization` | Returns `{id, email, name}` or `null`. Page calls this directly (NOT `requireSessionUser`, which returns a `NextResponse` shaped for API routes). |
| `ensureParentEmailAccess(user, parentEmail)` | `@/lib/auth/authorization` | Returns `null` (allow) or `NextResponse` (deny). Page maps deny → `notFound()`. |
| `getOrderById(orderId)` | `@/db/queries:397` | Returns `{...order, lines}` or `null`. |
| `getOrderRefunds(orderId)` | `@/db/queries:476` | Returns array of refund rows. |
| `getTotalRefunded(orderId)` | `@/db/queries:484` | Canonical money-rounded sum, used for "Net paid". |
| `getTenant(tenantId)` | `@/db/queries:597` | Returns DB tenant row (accent, shopEmail, shopHours, address, collectionInstructions — all nullable). Used for live contact + pickup details. |
| `TENANTS`, `Tenant` | `@/lib/data` | Mock tenant lookup keyed by tenant id. Used **only** for `<Crest>` because `Crest` is typed against the mock `Tenant` shape (non-null fields, `accentInk`/`motto` etc.). Matches the pattern in `orders-list-client.tsx`. |
| `MobileShell`, `BottomNav` | `@/components/...` | Same chrome as `/orders`. |
| `Crest`, `Chip` | `@/components/...` | Header crest + status chip. Chip's `tone` union: `"neutral" \| "navy" \| "success" \| "warn" \| "info" \| "danger" \| "gold"`. |
| `DoubleRule` | `@/components/double-rule` | Decorative divider used between totals and refund rows. |

---

## Task 1: Verify sign-in `callbackURL` honors deep links

No code change unless the verification fails. This task de-risks Task 3 before we wire any page logic to redirect.

**Files:** none (read-only verification)

- [ ] **Step 1: Start dev server**

```bash
pnpm dev:web
```

Wait for "Ready" output.

- [ ] **Step 2: Manually verify deep-link callback**

In a private/incognito browser window, visit:

```
http://localhost:3000/auth/sign-in?callbackURL=%2Forders%2FNSBH-TEST123
```

Sign in with a test parent account. Expected: after sign-in, browser lands at `/orders/NSBH-TEST123`. Since the page doesn't exist yet, expect a 404 — that's fine. The point is to confirm Neon Auth redirects to the encoded path, not back to `/`.

- [ ] **Step 3: Stop dev server**

`Ctrl-C` the dev server.

- [ ] **Step 4: Record result**

If the redirect lands on `/orders/NSBH-TEST123` (regardless of 404), Task 1 passes — proceed to Task 2.

If it lands somewhere else (e.g. `/`), update Task 3 to use whatever query-param name Neon Auth actually honors. Inspect `apps/web/src/app/orders/page.tsx:10` for the existing pattern (it uses `callbackURL` and works for `/orders`, so the precedent strongly suggests deep links work too).

- [ ] **Step 5: No commit needed** (no code change)

---

## Task 2: Create `OrderStatusStepper` component

Pure presentational component. No DB, no auth, no Next.js coupling. Easy to verify in isolation.

**Files:**
- Create: `apps/web/src/components/order-status-stepper.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { CheckIcon } from "@/components/icons";

const STEPS = ["Placed", "Packing", "Ready", "Collected"] as const;

export type StepperStatus = "new" | "packing" | "ready" | "collected";

const STATUS_TO_INDEX: Record<StepperStatus, number> = {
  new: 0,
  packing: 1,
  ready: 2,
  collected: 3,
};

export function OrderStatusStepper({
  status,
  accent,
}: {
  status: StepperStatus;
  accent: string;
}) {
  const currentIndex = STATUS_TO_INDEX[status];

  return (
    <div className="flex items-start justify-between relative px-1">
      {/* Rails are inset to dot-center positions:
          dots are 64px flex columns with justify-between, so dot 1 center sits at 32px
          and dot N center sits at (parent − 32px). Rail endpoints match those centers. */}
      <div
        className="absolute h-0.5"
        style={{ left: 32, right: 32, top: 12, background: "var(--color-rule)" }}
      />
      <div
        className="absolute h-0.5 transition-all"
        style={{
          left: 32,
          top: 12,
          width: `calc((100% - 64px) * ${currentIndex / (STEPS.length - 1)})`,
          background: accent,
        }}
      />
      {STEPS.map((label, i) => {
        const isCompleted = i < currentIndex;
        const isCurrent = i === currentIndex;
        const isFuture = i > currentIndex;
        return (
          <div
            key={label}
            className="flex flex-col items-center gap-2 relative z-10"
            style={{ width: 64 }}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center"
              style={{
                background: isFuture ? "var(--color-paper)" : accent,
                border: `1.5px solid ${isFuture ? "var(--color-rule)" : accent}`,
                color: isFuture ? "var(--color-ink-dim)" : "#fff",
              }}
            >
              {isCompleted ? (
                <CheckIcon size={14} />
              ) : (
                <span className="text-[11px] font-bold">{i + 1}</span>
              )}
            </div>
            <div
              className="text-[10.5px] font-semibold tracking-[0.3px] text-center"
              style={{
                color: isCurrent
                  ? accent
                  : isFuture
                  ? "var(--color-ink-dim)"
                  : "var(--color-ink)",
              }}
            >
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm check-types:web
```

Expected: clean (no errors).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/order-status-stepper.tsx
git commit -m "feat(orders): add OrderStatusStepper presentational component"
```

---

## Task 3: Create server component `page.tsx` with auth + data fetch

Server component owns auth and data. It returns a React tree that delegates rendering to the client component (Task 4 — for now we render a stub).

**Files:**
- Create: `apps/web/src/app/orders/[orderId]/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
import { notFound, redirect } from "next/navigation";
import {
  getSessionUser,
  ensureParentEmailAccess,
} from "@/lib/auth/authorization";
import {
  getOrderById,
  getOrderRefunds,
  getTotalRefunded,
  getTenant,
} from "@/db/queries";
import { TENANTS, type TenantId } from "@/lib/data";
import { OrderDetailClient } from "./order-detail-client";

export default async function OrderDetailPage({
  params,
}: PageProps<"/orders/[orderId]">) {
  const { orderId } = await params;

  const user = await getSessionUser();
  if (!user) {
    redirect(
      `/auth/sign-in?callbackURL=${encodeURIComponent(`/orders/${orderId}`)}`
    );
  }

  const order = await getOrderById(orderId);
  if (!order) notFound();

  // ensureParentEmailAccess returns a NextResponse on mismatch; we map → notFound()
  // (no enumeration distinction between "wrong owner" and "missing").
  if (ensureParentEmailAccess(user, order.parentEmail)) notFound();

  const dbTenant = await getTenant(order.tenantId);
  if (!dbTenant) notFound();

  // Crest is typed against the mock `Tenant` shape (non-null fields, accentInk/motto).
  // We use the mock entry for Crest only; everything else uses `dbTenant`.
  // This matches the pattern in `orders-list-client.tsx`.
  const crestTenant = TENANTS[order.tenantId as TenantId];
  if (!crestTenant) notFound();

  const refunds = await getOrderRefunds(orderId);
  const totalRefunded = await getTotalRefunded(orderId);

  return (
    <OrderDetailClient
      order={order}
      crestTenant={crestTenant}
      dbTenant={dbTenant}
      refunds={refunds}
      totalRefunded={totalRefunded}
    />
  );
}
```

- [ ] **Step 2: Verify the path-alias type for `PageProps<"/orders/[orderId]">`**

Next.js generates this in `.next/dev/types/routes.d.ts`. The page's route segment is new, so the type must be regenerated. Prefer `next typegen` over running the dev server:

```bash
pnpm --filter web exec next typegen
```

If that command is unavailable in this Next version, fall back to a brief `pnpm dev:web` (wait for "Ready", then Ctrl-C).

- [ ] **Step 3: Type-check**

```bash
pnpm check-types:web
```

Expected: fails on `OrderDetailClient` import — that file doesn't exist yet. That's the gate to Task 4.

If errors are about anything OTHER than the missing import (e.g. wrong query signature), fix them now.

- [ ] **Step 4: Commit (skipped until Task 4)**

Do NOT commit yet — the page references `OrderDetailClient` which Task 4 creates. Combine into one commit at the end of Task 4.

---

## Task 4: Create `order-detail-client.tsx` (presentational, all sections)

Renders header + status block (3 branches) + pickup + line items + payment summary + support CTA. Pure props, no fetching. Uses the stepper from Task 2 for fulfillment statuses.

**Files:**
- Create: `apps/web/src/app/orders/[orderId]/order-detail-client.tsx`

- [ ] **Step 1: Write the client component**

```tsx
"use client";

import { MobileShell } from "@/components/mobile-shell";
import { BottomNav } from "@/components/bottom-nav";
import { Crest } from "@/components/crest";
import { Chip } from "@/components/chip";
import { DoubleRule } from "@/components/double-rule";
import { OrderStatusStepper, type StepperStatus } from "@/components/order-status-stepper";
import type { Tenant } from "@/lib/data";

type OrderRow = {
  id: string;
  tenantId: string;
  parentEmail: string;
  parentName: string;
  studentName: string;
  studentYear: string | null;
  delivery: "pickup" | "ship";
  status:
    | "pending_payment"
    | "new"
    | "packing"
    | "ready"
    | "collected"
    | "partially_refunded"
    | "refunded";
  subtotal: string;
  total: string;
  createdAt: Date;
  updatedAt: Date;
  lines: Array<{
    id: string;
    itemName: string;
    variantLabel: string;
    qty: number;
    unitPrice: string;
    lineTotal: string;
  }>;
};

type DbTenantRow = {
  id: string;
  name: string;
  accent: string;
  shopEmail: string | null;
  shopHours: string | null;
  address: string | null;
  collectionInstructions: string | null;
};

type RefundRow = {
  id: string;
  amount: string;
  reason: string | null;
  createdAt: Date;
};

const STATUS_LABEL: Record<OrderRow["status"], string> = {
  pending_payment: "Payment processing",
  new: "Order placed",
  packing: "Packing",
  ready: "Ready for pickup",
  collected: "Collected",
  partially_refunded: "Partially refunded",
  refunded: "Refunded",
};

// Tones must come from Chip's union: "neutral" | "navy" | "success" | "warn" | "info" | "danger" | "gold"
const STATUS_TONE: Record<
  OrderRow["status"],
  "neutral" | "navy" | "success" | "warn" | "info" | "danger" | "gold"
> = {
  pending_payment: "warn",
  new: "neutral",
  packing: "info",
  ready: "success",
  collected: "success",
  partially_refunded: "warn",
  refunded: "danger",
};

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function OrderDetailClient({
  order,
  crestTenant,
  dbTenant,
  refunds,
  totalRefunded,
}: {
  order: OrderRow;
  crestTenant: Tenant;
  dbTenant: DbTenantRow;
  refunds: RefundRow[];
  totalRefunded: number;
}) {
  const isStepperStatus = (
    s: OrderRow["status"]
  ): s is StepperStatus =>
    s === "new" || s === "packing" || s === "ready" || s === "collected";

  const isRefundStatus =
    order.status === "partially_refunded" || order.status === "refunded";

  const subtotal = parseFloat(order.subtotal);
  const total = parseFloat(order.total);
  const netPaid = Math.max(0, total - totalRefunded);
  const accent = dbTenant.accent;

  return (
    <MobileShell bg="var(--color-paper)">
      {/* Header — crest + order id + status chip only (timestamps live in the stepper block) */}
      <div className="px-5 pt-4 pb-3 flex items-center gap-3 flex-shrink-0">
        <Crest tenant={crestTenant} size={36} />
        <div className="flex-1 min-w-0">
          <div className="font-serif text-[15px] font-semibold leading-[1.2]">
            Order {order.id}
          </div>
        </div>
        <Chip tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Chip>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {/* Status block */}
        <div
          className="bg-white rounded-xl border p-4 mb-4"
          style={{ borderColor: "var(--color-rule)" }}
        >
          {order.status === "pending_payment" ? (
            <div
              className="rounded-md p-3 text-[13px] leading-[1.5]"
              style={{
                background: "var(--color-parchment)",
                color: "var(--color-ink-dim)",
              }}
            >
              <div
                className="font-semibold mb-1"
                style={{ color: "var(--color-ink)" }}
              >
                Payment processing
              </div>
              Payment is being confirmed. This usually clears within a minute —
              refresh to check again.
            </div>
          ) : isRefundStatus ? (
            <div
              className="rounded-md p-3 text-[13px] leading-[1.5]"
              style={{
                background: "var(--color-parchment)",
                color: "var(--color-ink-dim)",
              }}
            >
              <div
                className="font-semibold mb-1"
                style={{ color: "var(--color-ink)" }}
              >
                {STATUS_LABEL[order.status]} — ${totalRefunded.toFixed(2)} returned
              </div>
              See refunds below for the breakdown.
            </div>
          ) : isStepperStatus(order.status) ? (
            <>
              <div
                className="text-[10.5px] text-center mb-2.5"
                style={{ color: "var(--color-ink-dim)" }}
              >
                Placed {formatDate(order.createdAt)}
              </div>
              <OrderStatusStepper status={order.status} accent={accent} />
              <div
                className="text-[10.5px] text-center mt-3"
                style={{ color: "var(--color-ink-dim)" }}
              >
                Last updated {formatDate(order.updatedAt)}
              </div>
            </>
          ) : null}
        </div>

        {/* Pickup / shipping details */}
        <div
          className="bg-white rounded-xl border p-4 mb-4"
          style={{ borderColor: "var(--color-rule)" }}
        >
          <div
            className="text-[11px] tracking-[0.4px] uppercase font-bold mb-2"
            style={{ color: "var(--color-ink-dim)" }}
          >
            {order.delivery === "pickup" ? "Pickup" : "Shipping"}
          </div>
          <Row label="Student" value={order.studentName} />
          {order.studentYear && <Row label="Year" value={order.studentYear} />}
          <Row label="School" value={dbTenant.name} />
          {order.delivery === "pickup" && (
            <>
              {dbTenant.shopHours && (
                <Row label="Shop hours" value={dbTenant.shopHours} />
              )}
              {dbTenant.address && <Row label="Address" value={dbTenant.address} />}
              {dbTenant.collectionInstructions && (
                <Row
                  label="Instructions"
                  value={dbTenant.collectionInstructions}
                />
              )}
            </>
          )}
        </div>

        {/* Line items */}
        <div
          className="bg-white rounded-xl border p-4 mb-4"
          style={{ borderColor: "var(--color-rule)" }}
        >
          <div
            className="text-[11px] tracking-[0.4px] uppercase font-bold mb-2"
            style={{ color: "var(--color-ink-dim)" }}
          >
            Items
          </div>
          {order.lines.map((line) => (
            <div
              key={line.id}
              className="flex justify-between py-2 text-[13px] border-b last:border-b-0"
              style={{ borderColor: "var(--color-rule)" }}
            >
              <div className="flex-1 min-w-0 pr-3">
                <div className="font-semibold">{line.itemName}</div>
                <div
                  className="text-[11px]"
                  style={{ color: "var(--color-ink-dim)" }}
                >
                  {line.variantLabel} · qty {line.qty}
                </div>
              </div>
              <div className="font-bold tnum">
                ${parseFloat(line.lineTotal).toFixed(2)}
              </div>
            </div>
          ))}
        </div>

        {/* Payment summary */}
        <div
          className="bg-white rounded-xl border p-4 mb-4"
          style={{ borderColor: "var(--color-rule)" }}
        >
          <div
            className="text-[11px] tracking-[0.4px] uppercase font-bold mb-2"
            style={{ color: "var(--color-ink-dim)" }}
          >
            Payment
          </div>
          <Row label="Subtotal" value={`$${subtotal.toFixed(2)}`} tnum />
          <Row label="Total" value={`$${total.toFixed(2)}`} bold tnum />
          {refunds.length > 0 && (
            <>
              <DoubleRule />
              {refunds.map((r) => (
                <Row
                  key={r.id}
                  label={`Refund · ${formatDate(r.createdAt)}${
                    r.reason ? ` · ${r.reason}` : ""
                  }`}
                  value={`-$${parseFloat(r.amount).toFixed(2)}`}
                  tnum
                />
              ))}
              <DoubleRule />
              <Row label="Net paid" value={`$${netPaid.toFixed(2)}`} bold tnum />
            </>
          )}
        </div>

        {/* Support CTA */}
        <div
          className="bg-white rounded-xl border p-4"
          style={{ borderColor: "var(--color-rule)" }}
        >
          <div
            className="text-[11px] tracking-[0.4px] uppercase font-bold mb-2"
            style={{ color: "var(--color-ink-dim)" }}
          >
            Need help?
          </div>
          {dbTenant.shopEmail ? (
            <a
              href={`mailto:${dbTenant.shopEmail}?subject=${encodeURIComponent(
                `Order ${order.id}`
              )}`}
              className="inline-block text-[13px] font-semibold underline"
              style={{ color: accent }}
            >
              Email {dbTenant.name}
            </a>
          ) : (
            <div className="text-[13px]" style={{ color: "var(--color-ink-dim)" }}>
              Contact your school directly for help with this order.
            </div>
          )}
        </div>
      </div>

      <BottomNav active="orders" />
    </MobileShell>
  );
}

function Row({
  label,
  value,
  bold,
  tnum,
}: {
  label: string;
  value: string;
  bold?: boolean;
  tnum?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-[13px]">
      <span style={{ color: "var(--color-ink-dim)" }}>{label}</span>
      <span
        className={`${bold ? "font-bold" : "font-semibold"} ${
          tnum ? "tnum" : ""
        } text-right`}
      >
        {value}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm check-types:web
```

Expected: clean. If `OrderRow` / `DbTenantRow` / `RefundRow` types diverge from what the queries return (e.g. column name mismatch), adjust the type to match what `getOrderById` etc. actually return — DO NOT change the queries.

Confirmed-present columns at plan-writing time (no need to re-verify, but do not assume beyond this list):
- `orders.subtotal`, `orders.total` — `numeric`, returned as string by Drizzle
- `orders.parentEmail`, `parentName`, `studentName`, `studentYear` (nullable), `delivery`, `status`, `createdAt`, `updatedAt`
- `orderLines.id`, `itemName`, `variantLabel`, `qty`, `unitPrice`, `lineTotal`
- `tenants.id`, `name`, `accent`, `shopEmail`, `shopHours`, `address`, `collectionInstructions` (last four nullable)
- `orderRefunds.id`, `amount`, `reason` (nullable), `createdAt`

If anything fails to type-check, read the actual schema in `apps/web/src/db/schema.ts` and adjust the type aliases accordingly.

- [ ] **Step 3: Manual smoke (dev server)**

```bash
pnpm dev:web
```

Visit `/orders/{any real order id}` while logged in as the matching parent. Sanity-check that the page renders all 6 sections without runtime errors. Detailed test scenarios are in Task 9.

Stop dev server with Ctrl-C.

- [ ] **Step 4: Commit (Tasks 3 + 4 together)**

```bash
git add apps/web/src/app/orders/[orderId]/page.tsx \
        apps/web/src/app/orders/[orderId]/order-detail-client.tsx
git commit -m "feat(orders): parent order detail page at /orders/[orderId]

Server component handles auth (getSessionUser → redirect for unauth,
ensureParentEmailAccess → notFound for wrong owner / missing). Client
component renders header, status block (stepper / payment-processing /
refund banner), pickup details, line items, payment summary with refunds,
and a tenant-aware support CTA."
```

---

## Task 5: Wire orders list rows to detail page

Each active card and each past row links to `/orders/{order.id}`. Past rows already contain a "Re-order" `<Link>`; nesting `<a>` tags is invalid HTML, so we wrap only the details area in a Link, leaving Re-order separate.

**Files:**
- Modify: `apps/web/src/app/orders/orders-list-client.tsx`

- [ ] **Step 0: Read the current file**

Open `apps/web/src/app/orders/orders-list-client.tsx` and confirm:
- The active-orders block does NOT contain a nested `<Link>` or `<a>` (would break the wrapping `<Link>` with invalid HTML).
- The past-orders block contains exactly one nested `<Link>` ("Re-order" → `/${tenant.id}`), which we keep separate.
- Existing imports include `Link` from `next/link` (line 3).

If the file has changed since plan-writing and the structure differs, adapt Steps 1–2 to match — the goal is "active card wrapped in `<Link>`, past row's details area wrapped in `<Link>` while Re-order stays a separate sibling Link."

- [ ] **Step 1: Wrap active card in `<Link>`**

Replace the active-orders `<div>` (currently around line 159–187) with:

```tsx
<Link
  key={o.id}
  href={`/orders/${o.id}`}
  className="block bg-white border rounded-xl p-4 mb-3.5 hover:shadow-sm transition-shadow"
  style={{ borderColor: "var(--color-rule)" }}
>
  <div className="flex items-center gap-2.5 mb-2.5">
    <Crest tenant={tenant} size={32} />
    <div className="flex-1 min-w-0">
      <div className="font-serif text-[13.5px] font-semibold leading-[1.2]">
        {tenant.short} · {o.studentName}
      </div>
      <div className="text-[10.5px]" style={{ color: "var(--color-ink-dim)" }}>
        Placed {new Date(o.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })} · {o.id}
      </div>
    </div>
    <Chip tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Chip>
  </div>
  <StatusTrack accent={tenant.accent} status={o.status} />
  <div
    className="mt-2.5 p-2.5 rounded-md text-[11.5px] leading-[1.5]"
    style={{ background: "var(--color-parchment)", color: "var(--color-ink-dim)" }}
  >
    ${parseFloat(o.total).toFixed(2)} ·{" "}
    {o.delivery === "pickup"
      ? `We'll email you when it's ready for pickup at the ${tenant.short} office.`
      : "Shipping to your address."}
  </div>
</Link>
```

- [ ] **Step 2: Make past row's details area a `<Link>` (Re-order remains separate)**

Replace the past-orders `<div key={o.id} ...>` block (around line 204–229) with:

```tsx
<div
  key={o.id}
  className={`flex items-center gap-3 px-4 py-3 ${i < past.length - 1 ? "border-b" : ""}`}
  style={{ borderColor: "var(--color-rule)" }}
>
  <Link
    href={`/orders/${o.id}`}
    className="flex items-center gap-3 flex-1 min-w-0"
  >
    <Crest tenant={tenant} size={32} />
    <div className="flex-1 min-w-0">
      <div className="text-[12.5px] font-semibold">
        {o.studentName}
      </div>
      <div className="text-[10.5px]" style={{ color: "var(--color-ink-dim)" }}>
        {new Date(o.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })} · {o.id}
      </div>
    </div>
  </Link>
  <div className="flex flex-col items-end gap-1">
    <div className="text-[13px] font-bold tnum">${parseFloat(o.total).toFixed(2)}</div>
    <Link
      href={`/${tenant.id}`}
      className="text-[10.5px] font-semibold underline"
      style={{ color: tenant.accent }}
    >
      Re-order
    </Link>
  </div>
</div>
```

- [ ] **Step 3: Type-check**

```bash
pnpm check-types:web
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/orders/orders-list-client.tsx
git commit -m "feat(orders): link list rows to /orders/[orderId] detail page"
```

---

## Task 6: Update placed page "View order details" link to deep-link

Currently links to `/orders` (list). With the new detail page available, link to `/orders/{orderId}` directly.

**Files:**
- Modify: `apps/web/src/app/[tenant]/order/placed/page.tsx`

- [ ] **Step 1: Update the link**

In `apps/web/src/app/[tenant]/order/placed/page.tsx`, change line 63:

```tsx
// from:
<Link href="/orders">
// to:
<Link href={`/orders/${orderId}`}>
```

The `orderId` variable is already in scope (line 18). Note: when `orderId` falls back to `${tid.toUpperCase()}-XXXXX` (no real order ID in query string), the link will still render but lead to a 404 — this is acceptable because the only path to this page is post-checkout where `orderId` IS in the query string. Document this with a comment.

Final hunk:

```tsx
        <Link href={`/orders/${orderId}`}>
          <Btn variant="primary" size="lg" fullWidth accent={tenant.accent}>
            View order details
          </Btn>
        </Link>
```

- [ ] **Step 2: Type-check**

```bash
pnpm check-types:web
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/[tenant]/order/placed/page.tsx"
git commit -m "feat(checkout): deep-link 'View order details' to /orders/[orderId]"
```

---

## Task 7: Add "View order status" CTA to OrderConfirmation email

Add an `orderUrl` prop and render a button after the items table, before the refund-policy footer text.

**Files:**
- Modify: `apps/web/src/lib/email/templates/OrderConfirmation.tsx`

- [ ] **Step 1: Add prop and CTA**

In `OrderConfirmation.tsx`:

(a) Extend `OrderConfirmationEmailProps` (around line 25):

```tsx
interface OrderConfirmationEmailProps {
  tenantName: string;
  tenantAccent: string;
  orderId: string;
  parentName: string;
  studentName: string;
  studentYear: string;
  items: OrderItem[];
  totalAmount: number;
  refundPolicyUrl: string;
  orderUrl: string;
}
```

(b) Add `orderUrl` to the default destructure (around line 46):

```tsx
  refundPolicyUrl = "#",
  orderUrl = "#",
}: OrderConfirmationEmailProps) => {
```

(c) Insert a CTA `<Section>` between the items section close (`</Section>` after the totals row, around line 100) and the refund-policy footer text (around line 102). Use existing email styles where possible:

```tsx
            <Section style={ctaSection}>
              <Link href={orderUrl} style={{ ...ctaButton, backgroundColor: tenantAccent }}>
                View order status
              </Link>
            </Section>
```

(d) Add styles at the bottom of the file (after the existing const blocks):

```tsx
const ctaSection = {
  textAlign: "center" as const,
  margin: "24px 0 8px",
};

const ctaButton = {
  display: "inline-block",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "bold" as const,
  textDecoration: "none",
  padding: "12px 24px",
  borderRadius: "6px",
};
```

- [ ] **Step 2: Type-check**

```bash
pnpm check-types:web
```

Expected: fails on missing `orderUrl` in `apps/web/src/lib/email/index.ts:70-86` props build. Continue to Task 8 to fix in one place.

- [ ] **Step 3: No commit yet** — combine with Task 8 (the `index.ts` change wires both emails).

---

## Task 8: Add "View order status" CTA to OrderReady email + thread `orderUrl` from `email/index.ts`

**Files:**
- Modify: `apps/web/src/lib/email/templates/OrderReady.tsx`
- Modify: `apps/web/src/lib/email/index.ts`

- [ ] **Step 1: Mirror the CTA in OrderReady.tsx**

(a) Extend `OrderReadyEmailProps` (around line 14):

```tsx
interface OrderReadyEmailProps {
  tenantName: string;
  tenantAccent: string;
  orderId: string;
  studentName: string;
  collectionInstructions: string;
  shopHours: string;
  orderUrl: string;
}
```

(b) Add the default in destructure:

```tsx
  shopHours = "Mon-Fri, 8:30am - 4:00pm",
  orderUrl = "#",
}: OrderReadyEmailProps) => {
```

(c) Add the `Link` import to the existing import (line 1–11):

```tsx
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
```

(d) Insert the CTA after the "Please bring a copy of this email…" Text (around line 57–59):

```tsx
            <Section style={ctaSection}>
              <Link href={orderUrl} style={{ ...ctaButton, backgroundColor: tenantAccent }}>
                View order status
              </Link>
            </Section>
```

(e) Add the same `ctaSection` / `ctaButton` styles at the bottom (mirror Task 7).

- [ ] **Step 2: Thread `orderUrl` from `email/index.ts`**

In `apps/web/src/lib/email/index.ts`:

(a) In `sendOrderConfirmationEmail` (around line 70–86), add `orderUrl` to the props:

```tsx
  const props = {
    tenantName: tenant.name,
    tenantAccent: tenant.accent,
    orderId: order.id,
    parentName: order.parentName,
    studentName: order.studentName,
    studentYear: order.studentYear,
    items: lines.map((line) => ({
      itemName: line.itemName,
      variantLabel: line.variantLabel,
      qty: line.qty,
      unitPrice: Number(line.unitPrice),
      lineTotal: Number(line.lineTotal),
    })),
    totalAmount: Number(order.total),
    refundPolicyUrl: `${requireAppUrl()}/${tenant.id}/refund-policy`,
    orderUrl: `${requireAppUrl()}/orders/${order.id}`,
  };
```

(b) In `sendOrderReadyEmail` (around line 137–145), add `orderUrl`:

```tsx
  const props = {
    tenantName: tenant.name,
    tenantAccent: tenant.accent,
    orderId: order.id,
    studentName: order.studentName,
    collectionInstructions:
      tenant.collectionInstructions || "Please collect from the school office.",
    shopHours: tenant.shopHours || "Mon-Fri, 8:30am - 4:00pm",
    orderUrl: `${requireAppUrl()}/orders/${order.id}`,
  };
```

- [ ] **Step 3: Type-check**

```bash
pnpm check-types:web
```

Expected: clean.

- [ ] **Step 4: Commit (Tasks 7 + 8 together)**

```bash
git add apps/web/src/lib/email/templates/OrderConfirmation.tsx \
        apps/web/src/lib/email/templates/OrderReady.tsx \
        apps/web/src/lib/email/index.ts
git commit -m "feat(email): 'View order status' CTA in confirmation + ready emails

Both transactional emails now include a button linking to
/orders/[orderId]. Logged-out parents land at sign-in with the deep
link as callbackURL."
```

---

## Task 9: Manual smoke test (8 scenarios from spec)

No code change — verification of the implemented surfaces against the spec's testing section. Fix any defects found and re-run before declaring complete.

**Files:** none (read-only verification)

**Setup:** `pnpm dev:web`. Have at least one real order in the DB for a test parent account; if needed, manipulate `orders.status` directly via Drizzle Studio or `psql` to exercise each branch.

- [ ] **Step 1: Logged-out access**

In incognito, visit `http://localhost:3000/orders/{any-id}` → expect redirect to `/auth/sign-in?callbackURL=%2Forders%2F{any-id}`.

- [ ] **Step 2: Wrong-owner access**

Log in as parent A, manually visit `http://localhost:3000/orders/{parent-B-order-id}` → expect Next.js 404 page (no leak that the order exists).

- [ ] **Step 3: Happy path across statuses**

Log in as the matching parent. From `/orders` list, click an order. Walk through statuses by editing `orders.status` in DB:
- `new` → stepper at step 1
- `packing` → stepper at step 2 (step 1 checked)
- `ready` → stepper at step 3 (steps 1–2 checked)
- `collected` → all 4 checked

- [ ] **Step 4: pending_payment**

Set `orders.status = 'pending_payment'`. Reload page → stepper hidden, "Payment processing" banner shown. Line items + payment summary STILL render (per spec).

- [ ] **Step 5: Refund states**

Set `orders.status = 'partially_refunded'` (and ensure at least one row in `order_refunds` for the order). Reload → stepper hidden, refund banner shows total returned, payment summary lists subtotal, total, individual refunds + "Net paid".

Repeat with `orders.status = 'refunded'`.

Eyeball check: a refund row's label is `Refund · {date} · {reason}` and the value is the negative amount. Long reasons (e.g. "Customer changed mind about size") may wrap awkwardly between the two columns. Acceptable for v1; note any visible breakage as a follow-up rather than a blocker. If it does look bad, the cheap fix is to stack the reason on its own line under the row (e.g. render `Refund · {date}` as the label and `{reason}` as a small muted line beneath, instead of concatenating into one label string).

- [ ] **Step 6: Tenant fallbacks**

Run a one-off SQL update setting `tenants.shop_email = NULL`, `shop_hours = NULL`, `address = NULL`, `collection_instructions = NULL` for the test tenant. Reload an order detail page →
- Support CTA renders as plain text ("Contact your school directly…"), no `mailto:` button.
- Pickup section omits the missing rows entirely (no empty labels).

Restore the columns afterwards.

- [ ] **Step 7: Email CTA + callbackURL**

`apps/web/src/lib/email/client.ts` falls back to dev-log mode when `EMAILIT_API_KEY` is unset, so a clickable email may not exist locally. Two paths:

**(a) Real send — preferred when `EMAILIT_API_KEY` is set:**
Place a new test order. In incognito, click "View order status" in the received email → lands on sign-in. Sign in → redirects to `/orders/{id}`. Repeat with the order-ready email by marking the order `ready` from the admin board.

**(b) Fallback when emails are dev-logged:**
Tail the dev server output during `sendOrderConfirmationEmail` / `sendOrderReadyEmail`. The dev-log will contain the rendered HTML; grep for `orders/${order.id}` and confirm the URL matches `${NEXT_PUBLIC_APP_URL}/orders/{order.id}`. Then visit that URL in incognito and confirm the sign-in → deep-link redirect works (already tested in Task 1 / Step 1; this confirms the URL prop threading is correct).

Either path validates the same outcome: the threaded `orderUrl` lands at `/orders/{id}` post-auth.

- [ ] **Step 8: Type check (final)**

```bash
pnpm check-types:web
```

Expected: clean.

- [ ] **Step 9: Commit any fixes found during smoke testing**

If smoke tests surface bugs, fix them with a follow-up commit per fix:

```bash
git commit -m "fix(orders): <description of bug fixed during smoke test>"
```

---

## Done state

- Page reachable at `/orders/[orderId]` rendering all 6 sections per spec
- Three status-block branches verified (stepper, payment-processing, refund banner)
- Wire-ups in place from orders list, placed page, and both transactional emails
- Tenant-metadata fallbacks verified
- Type-check clean across all changes

## Out of scope (per spec, do NOT add)

- Per-status transition timestamps / `status_history` table
- Magic-link tokens
- Polling / live updates
- Admin-side changes
- New API routes (page reads DB directly)

---

## Self-review notes

- All tasks reference real symbols verified during plan writing (`getOrderById:397`, `getOrderRefunds:476`, `getTotalRefunded:484`, `getTenant:597`, `getSessionUser`, `ensureParentEmailAccess`).
- All code blocks contain real code, no TBD/TODO placeholders.
- Type names defined inline in Task 4 are stable across the file.
- Task 3 deliberately doesn't commit until Task 4 lands — `OrderDetailClient` is referenced before it's created, so commits are merged.
- Task 7 deliberately doesn't commit until Task 8 lands — `email/index.ts` must thread `orderUrl` for both templates simultaneously.
- Task 4 Step 2 calls out the schema-mismatch failure mode explicitly (e.g. if `tenants.short` doesn't exist in the DB) so the implementer knows to inspect rather than guess.
