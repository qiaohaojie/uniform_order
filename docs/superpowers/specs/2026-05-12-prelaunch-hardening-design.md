# Pre-launch hardening + parent shell polish — Design (revised)

**Date:** 2026-05-12 (revised 2026-05-12 after code-review pass)
**Authors:** Engineering
**Source:** `my_doc/NSBH/gap-analysis.md` §5, `docs/remaining_work.md` §2.13 + §2.14
**Target branch:** single feature branch, squash-merged to `main`
**Effort estimate:** ~2.5 dev-days

## Revision notes (2026-05-12 v2)

Six substantive corrections after a code-review pass against the actual codebase:

1. **Status enum:** the successful order state is `'new'`, not `'paid'`. There is no `'paid'` value in `orderStatusEnum` (`db/schema.ts:18-19`). Webhook `payment_intent.succeeded` transitions `pending_payment → 'new'` (`webhook/route.ts:62-66`). All "→ paid" references corrected.
2. **Units:** the codebase works in **dollars** (number/decimal), not cents. `/api/orders/route.ts:121-143` accepts `subtotal/gst/total` as `typeof === "number"`. The schema stores `String(total)` in `numeric(10,2)` columns. Checkout uses hardcoded `ship = 9.5`. The order-totals helper is redesigned to stay in dollars.
3. **`getPreviousSizeHint` removal:** also delete the API route `apps/web/src/app/api/orders/size-hint/` and the client `fetch('/api/orders/size-hint?...')` at `interactive.tsx:36`.
4. **Delivery fee:** `tenants` has no per-tenant delivery-fee column. `orders.delivery_fee` is the per-order recorded value. For this PR, use a shared constant `SHIP_FEE_AUD = 9.5` exported from a new module so client and server agree. Per-tenant delivery fee is deferred to a separate PR.
5. **PaymentElement / clientSecret timing:** Stripe requires `clientSecret` (or deferred-intent params) at `stripe.elements()` creation, not at `confirmPayment`. Today `stripe.elements()` is called eagerly (line 90) and the PI is fetched lazily inside `onPay`. We use **deferred-intent mode** so the element can mount before the PI exists.
6. **Retry semantics:** today `onPay` fetches a fresh PI per click. When `/api/stripe/payment-intent` is re-called for an order in `payment_failed` state, the server transitions it back to `pending_payment` and issues a new PI. This preserves the existing flow.

## 1. Goals and non-goals

### Goals

Ship seven items in one focused PR as pre-launch hardening:

1. Tenant footer with policy links on all parent-shop routes
2. Per-tenant Contact page reading existing onboarding data
3. SEO basics: sitemap, robots, per-tenant + per-PDP `generateMetadata`
4. Apple Pay + Google Pay via Stripe `PaymentElement` (deferred-intent mode)
5. `payment_intent.payment_failed` webhook handler + dashboard-refund audit-log entry
6. Server-side total assertion shared by `/api/orders` and `/api/stripe/payment-intent`
7. Remove the `getPreviousSizeHint` feature (drop, not fix)

### Non-goals

- **Guest checkout** — explicitly dropped; replaced by future magic-link + Google sign-in (separate work).
- **Email env / DNS configuration on Hostinger** — tracked in `docs/remaining_work.md` §2.8 as ops follow-up, not in this PR.
- **`sizes jsonb` migration on `catalog_variants`** — tracked in §2.14, deferred to a focused PR before tenant #3 onboarding.
- **Per-tenant delivery fee** — out of scope; this PR uses a shared constant. Tracked as a follow-up if/when a school requests a different rate.
- **Dollars → cents migration** — significant refactor across cart, schema, Stripe amount conversions; out of scope. This PR stays in dollars to match existing conventions.
- **Accountant sign-off on GST formula** (§3.6) — does not block this PR; the assertion uses the same 1/11 formula the Reports page already uses. Accountant review happens separately.
- **Active-child-scoped size hint** — feature is being removed entirely; no migration needed.
- **Fixing the pre-existing `useSearchParams` Suspense build failure** (#26, §2.8) — out of scope.

## 2. Architecture

### 2.1 Item 1 — Tenant footer

**New component:** `apps/web/src/components/tenant-footer.tsx`

- React Server Component.
- Props: `{ tenant: TenantRecord }` where `TenantRecord` is the row shape returned by `getTenant(slug)` from `db/queries.ts`. Verify the shape exposes `shopEmail`, `shopHours`, `currentLegalVersionId`, `id`, `name` before implementing — if any field is missing, update the query to select it.
- Renders:
  - Four-link strip: **Refund policy** → `/<tenant>/refund-policy`, **Contact** → `/<tenant>/contact`, **Privacy** → `/privacy`, **Terms** → `/terms`.
  - Below the links: `tenant.shopEmail` (as `mailto:`) and `tenant.shopHours` rendered as `<dl>` rows.
  - The refund-policy link is omitted when `tenant.currentLegalVersionId === null`.
- Styling: parchment background, gold top rule (`border-t border-rule`), 16px vertical padding. No fixed positioning — sits in normal scroll flow.

**Modified:** `apps/web/src/components/mobile-shell.tsx`

- New optional prop: `tenant?: TenantRecord`.
- When `tenant` is provided, render `<TenantFooter tenant={tenant} />` at the end of `children`, before the slot occupied by `BottomNav`.
- `BottomNav` remains fixed; footer scrolls naturally above it.
- When `tenant` is absent, no footer renders. Backwards-compatible.

**Modified pages — thread tenant into `MobileShell`:**

| Page | Tenant already fetched? | Action |
|---|---|---|
| `app/[tenant]/page.tsx` (catalog) | Yes | Pass to `MobileShell` |
| `app/[tenant]/item/[itemId]/page.tsx` | Yes | Pass to `MobileShell` |
| `app/[tenant]/cart/page.tsx` | **Verify** | If not fetched, add `await getTenant(slug)` |
| `app/[tenant]/checkout/page.tsx` | Yes | Pass to `MobileShell` |
| `app/[tenant]/order/placed/page.tsx` | **Verify** | If not fetched, add `await getTenant(slug)` |
| `app/[tenant]/refund-policy/page.tsx` | Yes | Pass to `MobileShell` |
| `app/[tenant]/contact/page.tsx` (new) | Yes | Pass to `MobileShell` |

If `getTenant` returns a `TenantBrand`-converted shape via `toTenantBrand` that differs from the raw record, prefer the raw record for the footer (it has `shopEmail`/`shopHours`/`currentLegalVersionId`). The footer should not depend on the brand-only subset.

The cross-tenant pages under `app/orders/` are out of scope.

### 2.2 Item 2 — Per-tenant Contact page

**New route:** `apps/web/src/app/[tenant]/contact/page.tsx`

- React Server Component, pattern mirrors `app/[tenant]/refund-policy/page.tsx`.
- Reads `tenant.shopEmail`, `tenant.shopHours`, `tenant.address`, `tenant.collectionInstructions` — populated by `app/platform/tenants/new/steps/step-3-operator.tsx` and step-1.
- Layout (top to bottom):
  - `<h1>` "Contact {tenant.name}"
  - Email card: label + `mailto:` link
  - Hours card: multi-line text with `whitespace-pre-wrap`
  - Address card: multi-line text
  - Collection instructions card: optional, renders only when non-null
- `generateMetadata`: `{ title: 'Contact ${tenant.name}', robots: { index: true } }`.
- 404 if tenant not found or fails the public-visibility gate (same logic as catalog home).

### 2.3 Item 3 — SEO basics

**Modified:** `apps/web/src/app/[tenant]/layout.tsx`

Add `generateMetadata`:

```ts
export async function generateMetadata({ params }: PageProps<"/[tenant]">): Promise<Metadata> {
  const { tenant: slug } = await params;
  const tenant = await getTenant(slug);
  if (!tenant) return { title: "Uniform shop" };
  return {
    title: `${tenant.name} Uniform Shop`,
    description: tenant.motto ?? `${tenant.name} parent uniform shop`,
    openGraph: {
      title: `${tenant.name} Uniform Shop`,
      images: tenant.logoUrl ? [{ url: tenant.logoUrl }] : [],
    },
  };
}
```

**Modified:** `apps/web/src/app/[tenant]/item/[itemId]/page.tsx`

Add `generateMetadata`:

```ts
export async function generateMetadata({ params }: PageProps<"/[tenant]/item/[itemId]">): Promise<Metadata> {
  const { tenant: slug, itemId } = await params;
  const [tenant, items] = await Promise.all([getTenant(slug), getActiveCatalog(slug)]);
  const item = items.find((i) => i.id === itemId);
  if (!tenant || !item) return { title: "Item" };
  return {
    title: `${item.name} — ${tenant.name}`,
    description: item.description ?? `${item.name} available from ${tenant.name}`,
    alternates: { canonical: `/${tenant.id}/item/${itemId}` },
  };
}
```

This sets a `<link rel="canonical">` tag on the page pointing at the bare URL (without `?cat=`). Search engines honour the canonical and consolidate ranking signals onto it. Next.js does **not** rewrite or strip the URL itself.

**New file:** `apps/web/src/app/sitemap.ts`

```ts
import type { MetadataRoute } from "next";
import { getPubliclyListedTenants, getActiveCatalog } from "@/db/queries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://uniformorder.online";
  const tenants = await getPubliclyListedTenants();
  const perTenant = await Promise.all(
    tenants.map(async (tenant) => {
      const items = await getActiveCatalog(tenant.id);
      return [
        { url: `${base}/${tenant.id}`, changeFrequency: "weekly" as const },
        { url: `${base}/${tenant.id}/contact`, changeFrequency: "monthly" as const },
        ...items.map((item) => ({
          url: `${base}/${tenant.id}/item/${item.id}`,
          changeFrequency: "weekly" as const,
        })),
      ];
    }),
  );
  return perTenant.flat();
}
```

If `getPubliclyListedTenants` does not exist in `db/queries.ts`, add it as a thin wrapper applying the standard filter (`isPubliclyListed = true AND platformApprovalStatus = 'approved'`). Spec authorises.

**New file:** `apps/web/src/app/robots.ts`

```ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://uniformorder.online";
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/platform", "/auth", "/api"] },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
```

### 2.4 Item 4 — Stripe PaymentElement (Apple Pay + Google Pay)

**Current state at `apps/web/src/app/[tenant]/checkout/checkout-screen.tsx`:**

- Line 90: `const elements = stripe.elements()` called eagerly with no `clientSecret`.
- Line 156-216: `onPay` fetches PI from `/api/stripe/payment-intent` lazily on submit (line 187), then calls `stripe.confirmCardPayment(clientSecret, { payment_method: { card } })` (line 216).

PaymentElement (unlike the legacy Card element) requires either a `clientSecret` at `stripe.elements()` creation, **or** deferred-intent parameters (`mode`, `amount`, `currency`). We use deferred-intent so the PI fetch can stay lazy.

**Changes:**

1. Replace eager `stripe.elements()` (line 90) with deferred-intent initialisation. The element needs `total` to size the wallet button correctly:

   ```ts
   // At line ~90, when stripe loads. Total is reactive — re-init on cart change
   // is unnecessary; deferred-intent re-evaluates amount at confirmPayment time.
   const elements = stripe.elements({
     mode: "payment",
     amount: Math.round(total * 100), // Stripe API expects integer cents
     currency: "aud",
     paymentMethodCreation: "manual",
     appearance: { /* existing appearance config preserved */ },
   });
   const paymentElement = elements.create("payment", { layout: "tabs" });
   paymentElement.mount("#payment-element");
   ```

   Note: even though our app works in dollars, Stripe's API takes integer cents. The `Math.round(total * 100)` conversion happens at the Stripe boundary only.

2. Update JSX mount-point to `<div id="payment-element" />` (was the card-element mount).

3. Modify `onPay` (line 156-): fetch PI as today, then call `confirmPayment`:

   ```ts
   const { clientSecret } = await paymentIntentRes.json();
   // ... existing validation ...

   // Submit elements before confirming (deferred-intent flow requirement)
   const { error: submitError } = await elements.submit();
   if (submitError) {
     setPaymentError(submitError.message ?? "Payment validation failed");
     return;
   }

   const { error, paymentIntent } = await stripe.confirmPayment({
     elements,
     clientSecret,
     confirmParams: {
       return_url: `${window.location.origin}/${tenant.id}/order/placed?orderId=${orderId}`,
     },
     redirect: "if_required",
   });
   ```

   `redirect: "if_required"` keeps card payments inline (no redirect). Wallets and 3DS flows that require a browser redirect use `return_url`.

4. Success path (existing code at line 240-) continues to check `paymentIntent?.status === "succeeded"` and POST to `/api/orders` to commit the row. No change to that block.

5. `paymentMethodCreation: "manual"` defers the PaymentMethod creation until `confirmPayment` — required because we're creating the PI server-side in our own flow.

**No changes to:** `apps/web/src/app/api/stripe/payment-intent/route.ts` — `automatic_payment_methods: { enabled: true }` is already set (line 75).

**No changes to:** `apps/web/src/app/[tenant]/order/placed/page.tsx`. Stripe's `return_url` redirect appends `payment_intent`, `payment_intent_client_secret`, `redirect_status` query params; the existing `orderId` param is what resolves the order. Extra params are ignored.

**New static asset:** `apps/web/public/.well-known/apple-developer-merchantid-domain-association`

In the PR, this file is a placeholder with a comment. Post-merge, ops replaces it with the real file from Stripe Dashboard → Settings → Payment methods → Apple Pay → Add new domain. Apple Pay does not appear in the wallet tab until the domain is verified. Google Pay does not require domain verification and works as soon as the swap deploys.

### 2.5 Item 5 — `payment_intent.payment_failed` + dashboard-refund audit log

**Schema migration:** add `'payment_failed'` to the `order_status` enum.

The codebase uses `drizzle-kit migrate` for migrations, but in this environment that command hangs on websockets — see memory file `/Volumes/T7/georgeqiao/.claude/projects/-Volumes-T7-georgeqiao-dev-uniform-order/memory/project_drizzle_kit_websocket_blocker.md`. Apply SQL directly via Neon MCP `run_sql_transaction`, then insert a `__drizzle_migrations` row manually:

```sql
-- Run via Neon MCP run_sql_transaction:
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'payment_failed';
INSERT INTO __drizzle_migrations (hash, created_at)
VALUES ('<hash-of-the-generated-migration-file>', NOW());
```

Update `apps/web/src/db/schema.ts:18-19` `orderStatusEnum` literal list to include `'payment_failed'`. Generate the corresponding migration file with `drizzle-kit generate` (file-only, do not migrate) and check it in alongside the manual SQL note.

**Modified:** `apps/web/src/app/api/stripe/webhook/route.ts`

Add a new switch branch:

```ts
case "payment_intent.payment_failed": {
  const pi = event.data.object as Stripe.PaymentIntent;
  const matched = await db
    .update(orders)
    .set({ status: "payment_failed" })
    .where(
      and(
        eq(orders.stripePaymentIntentId, pi.id),
        // Only transition pending_payment → payment_failed.
        // If the order is already 'new' (succeeded), this is a late event — ignore.
        eq(orders.status, "pending_payment"),
      ),
    )
    .returning({ id: orders.id });
  if (matched.length === 0) {
    console.info("stripe webhook: no pending_payment order matched payment_failed", pi.id);
    break;
  }
  await logAuditEvent({
    actorEmail: "stripe-webhook",
    actorRole: "system",
    action: "order.payment_failed",
    targetType: "order",
    targetId: matched[0].id,
    payload: {
      paymentIntentId: pi.id,
      lastPaymentError: pi.last_payment_error?.message ?? null,
      declineCode: pi.last_payment_error?.decline_code ?? null,
    },
  });
  break;
}
```

**Verify `actorRole: "system"` is an accepted value** in `audit_events` schema before merge. If the column is a constrained enum/check, either add `'system'` to the allowed set or pick the closest existing value.

**Existing `payment_intent.succeeded` handler (line 62-66):** the current WHERE clause `eq(orders.status, "pending_payment")` is correct for the **happy path**. The retry-after-failure case is handled differently — see retry semantics below.

**Modified:** `apps/web/src/app/api/stripe/webhook/route.ts` — `charge.refunded` branch

Per the acknowledged TODO at `api/orders/[orderId]/refund/route.ts:176-178`, the dashboard-initiated refund path skips audit logging. Inside the existing `charge.refunded` webhook branch, after the order update, add:

```ts
await logAuditEvent({
  actorEmail: "stripe-webhook",
  actorRole: "system",
  action: "order.refunded.via_dashboard",
  targetType: "order",
  targetId: order.id,
  payload: {
    chargeId: charge.id,
    amountRefunded: charge.amount_refunded, // Stripe returns cents here
    fullyRefunded: charge.refunded,
  },
});
```

**Modified:** `apps/web/src/db/queries.ts` `listOrdersForParent`

Add `and(ne(orders.status, 'payment_failed'), ...existingPredicates)` so parents never see declined-card attempts in `/orders`. Admin Kanban and the audit log surface remain unaffected — failed rows remain in the DB and queryable from operator surfaces.

**Retry semantics (new behaviour):**

When a parent submits a second time after a card decline, today `onPay` fetches a fresh PI from `/api/stripe/payment-intent`. Modify that route:

```ts
// At top of POST /api/stripe/payment-intent, after auth check:
// If the parent is retrying against an existing payment_failed order,
// transition it back to pending_payment before issuing a new PI.
const existing = await getOrderByIdForUser(orderId, userId);
if (existing?.status === "payment_failed") {
  await db
    .update(orders)
    .set({ status: "pending_payment" })
    .where(eq(orders.id, existing.id));
}
// ... existing PI creation flow ...
```

This preserves the existing "fresh PI per click" pattern while making the state transitions explicit. The new PI's `id` overwrites `orders.stripePaymentIntentId` on the next successful confirmation; old PI stays in Stripe history as a recorded failure.

### 2.6 Item 6 — Server-side total assertion (dollars throughout)

**New constant:** `apps/web/src/lib/shipping.ts`

```ts
// Flat per-order shipping fee in AUD. Today this is the only delivery option.
// Per-tenant rates are tracked separately in remaining_work.md as a follow-up.
export const SHIP_FEE_AUD = 9.5;
```

The checkout client (`checkout-screen.tsx:135`) currently hardcodes `ship = 9.5`. Replace that literal with `SHIP_FEE_AUD` imported from `lib/shipping.ts`. The server-side assertion imports the same constant, guaranteeing client/server agreement.

**New helper:** `apps/web/src/lib/order-totals.ts`

```ts
import { SHIP_FEE_AUD } from "./shipping";

export type LineInput = {
  unitPrice: number; // AUD dollars (e.g. 19.95)
  qty: number; // positive integer
};

export type ComputedTotals = {
  subtotal: number; // AUD dollars, 2dp
  gst: number;      // AUD dollars, 2dp — 1/11 of GST-inclusive total
  total: number;    // AUD dollars, 2dp — subtotal + shipping
};

export type DeliveryMode = "pickup" | "ship";

// Round to 2dp using bankers/half-away-from-zero (Math.round behaviour).
// Matches the toFixed(2) display rounding used elsewhere.
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeTotals(args: {
  lines: LineInput[];
  delivery: DeliveryMode;
}): ComputedTotals {
  const subtotal = round2(args.lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0));
  const ship = args.delivery === "ship" ? SHIP_FEE_AUD : 0;
  const total = round2(subtotal + ship);
  // GST is 1/11 of GST-inclusive total — AU standard for GST-inclusive pricing.
  // Matches the Reports page formula.
  const gst = round2(total / 11);
  return { subtotal, gst, total };
}

export class TotalsMismatchError extends Error {
  constructor(
    readonly expected: ComputedTotals,
    readonly received: { subtotal: number; gst: number; total: number },
  ) {
    super("totals_mismatch");
  }
}

export function assertTotalsMatch(args: {
  lines: LineInput[];
  delivery: DeliveryMode;
  received: { subtotal: number; gst: number; total: number };
}): ComputedTotals {
  const expected = computeTotals({ lines: args.lines, delivery: args.delivery });
  const TOLERANCE = 0.01; // 1 cent
  const ok =
    Math.abs(expected.subtotal - args.received.subtotal) <= TOLERANCE &&
    Math.abs(expected.gst - args.received.gst) <= TOLERANCE &&
    Math.abs(expected.total - args.received.total) <= TOLERANCE;
  if (!ok) throw new TotalsMismatchError(expected, args.received);
  return expected;
}
```

**Call sites:**

- **`apps/web/src/app/api/orders/route.ts`** — before the `db.batch` insert, after extracting `subtotal`, `gst`, `total` and `lines` from the request body, call:

  ```ts
  try {
    const verified = assertTotalsMatch({
      lines: cartLines.map((l) => ({ unitPrice: l.unitPrice, qty: l.qty })),
      delivery: deliveryMode, // existing field in the request body
      received: { subtotal, gst, total },
    });
    // Use verified.subtotal / verified.gst / verified.total in the insert,
    // not the client-supplied values.
  } catch (e) {
    if (e instanceof TotalsMismatchError) {
      return NextResponse.json(
        { code: "totals_mismatch", expected: e.expected, received: e.received },
        { status: 400 },
      );
    }
    throw e;
  }
  ```

- **`apps/web/src/app/api/stripe/payment-intent/route.ts`** — same assertion before `stripe.paymentIntents.create`. Use `Math.round(verified.total * 100)` for the Stripe `amount` parameter (dollars → cents at the Stripe boundary).

**Reports page consolidation:** the existing GST calculation in `app/platform/billing/` and `app/admin/[tenant]/reports/` should switch to importing `computeTotals` from `lib/order-totals.ts` for a single source of truth. If existing calculations differ in formula or rounding, the spec authorises adopting the new helper's behaviour as canonical — accountant sign-off in §3.6 will review the unified helper.

### 2.7 Item 7 — Remove `getPreviousSizeHint` feature entirely

**Deletions:**

1. Delete the function: `apps/web/src/db/queries.ts:427-467` (`getPreviousSizeHint`).
2. Delete the API route directory: `apps/web/src/app/api/orders/size-hint/` (entire directory including `route.ts`).
3. Delete the client fetch and surrounding state: `apps/web/src/app/[tenant]/item/[itemId]/interactive.tsx:36` calls `fetch('/api/orders/size-hint?...')`. Remove this call, any `useState` / `useEffect` that holds the hint, and the JSX block that renders it (was around `interactive.tsx:173-178`).
4. Delete any imports of `getPreviousSizeHint` throughout the codebase. `pnpm check-types:web` will surface stragglers.

**Doc update:**

Append to `docs/completed.md` §4.8 (the "Riley wore size X last year" entry): "Removed 2026-05-12 — see `docs/remaining_work.md` §2.14 for reasoning."

## 3. Data flow

### 3.1 Checkout payment (item 4)

1. Parent reaches `/[tenant]/checkout`. RSC fetches tenant + draft cart context.
2. On client mount, Stripe loads. The PaymentElement is initialised in **deferred-intent mode** (`stripe.elements({ mode: "payment", amount, currency: "aud", paymentMethodCreation: "manual" })`). `amount` is `Math.round(total * 100)` — the only place dollars convert to cents on the client.
3. Parent submits. Client calls `elements.submit()` (deferred-intent flow requirement). On submit error, surface to the existing error banner.
4. Client POSTs `/api/stripe/payment-intent`. Server runs `assertTotalsMatch` (item 6); if the order is in `payment_failed`, transitions it back to `pending_payment` (item 5 retry semantics); creates PI with `automatic_payment_methods: { enabled: true }`; returns `client_secret`.
5. Client calls `stripe.confirmPayment({ elements, clientSecret, confirmParams: { return_url }, redirect: "if_required" })`.
6. **Card path (no redirect):** `confirmPayment` resolves inline with `paymentIntent.status === "succeeded"`. Client POSTs `/api/orders` to commit the order row (`status: "pending_payment"`). Webhook `payment_intent.succeeded` fires shortly after and transitions `pending_payment → new`.
7. **Wallet / 3DS path (redirect):** browser navigates to `return_url` (`/[tenant]/order/placed?orderId=...&payment_intent=...&redirect_status=succeeded`). Order is resolved by `orderId`; webhook completes the status transition asynchronously.

### 3.2 Failed payment (item 5)

1. Parent's card declines during `confirmPayment`.
2. Stripe sends `payment_intent.payment_failed` to our webhook.
3. Handler updates the matched order's status from `pending_payment → payment_failed` and audit-logs the failure (decline_code, last_payment_error).
4. Parent's `/orders` page (filtered to `status != 'payment_failed'`) does not list the failed row.
5. Parent retries: clicks Pay again. `/api/stripe/payment-intent` detects the order is in `payment_failed`, transitions it back to `pending_payment`, issues a new PI, returns its `client_secret`. New `confirmPayment` call proceeds. On success, webhook transitions `pending_payment → new`.

### 3.3 Total assertion (item 6)

1. Client POSTs to `/api/orders` or `/api/stripe/payment-intent` with `{ lines, deliveryMode, subtotal, gst, total }` — all in dollars.
2. Server calls `assertTotalsMatch({ lines, delivery: deliveryMode, received: { subtotal, gst, total } })`.
3. On mismatch → 400 with `{ code: 'totals_mismatch', expected, received }`. Client surfaces a generic "Something went wrong, please refresh and try again" message.
4. On match → server uses the **server-computed** totals for the DB write and (after `Math.round(verified.total * 100)`) for the Stripe PI amount. Client-supplied values are discarded after assertion.

## 4. Error handling

| Surface | Failure | Behaviour |
|---|---|---|
| PaymentElement mount | Stripe.js fails to load | Existing error banner; no change |
| `elements.submit()` | Field validation error | Surface `submitError.message` to existing banner; do not proceed |
| `confirmPayment` | Card declined | Stripe returns `error.code = 'card_declined'`; existing banner surfaces `error.message`; webhook transitions order to `payment_failed` out-of-band |
| `confirmPayment` | 3DS challenge cancelled | Stripe returns `error.code = 'payment_intent_authentication_failure'`; same handling |
| `/api/orders` | `totals_mismatch` | 400 with structured payload; client shows generic error |
| `/api/stripe/payment-intent` | `totals_mismatch` | 400 same shape |
| `/api/stripe/payment-intent` | Order already in `new` status (rare race) | Return 409 conflict; client refreshes — the order is already paid |
| Webhook | `payment_intent.payment_failed` for unknown PI | Log and ignore (we didn't create this PI) |
| Webhook | `payment_intent.payment_failed` for already-`new` order | Log and ignore (late event; real outcome is success) |
| Webhook | `charge.refunded` for unknown charge | Existing behaviour preserved |
| Contact page | Tenant not found | `notFound()` (404) |
| Contact page | Tenant fails visibility gate | `notFound()` for non-platform-admins |
| Sitemap | `getPubliclyListedTenants` returns empty | Empty sitemap; valid; not an error |
| Footer | `tenant.currentLegalVersionId` is null | Refund-policy link omitted; other links render |

## 5. Sequencing

Recommended commit order within the feature branch. Each commit type-checks cleanly. Squash-merge at the end.

1. `chore: remove getPreviousSizeHint feature` — item 7 — zero risk, independent
2. `feat: tenant footer with policy links + contact page` — items 1 + 2 — additive UI
3. `feat: SEO basics — sitemap, robots, generateMetadata` — item 3 — additive infra
4. `refactor: extract lib/shipping.ts + lib/order-totals.ts helper` — item 6 part 1 — Reports + new helper, no enforcement yet
5. `feat: server-side total assertion in order + PI endpoints` — item 6 part 2 — turns on enforcement
6. `feat: payment_failed webhook + dashboard-refund audit + retry transition` — item 5 — includes status enum migration
7. `feat: Stripe PaymentElement (Apple Pay + Google Pay)` — item 4 — highest test surface; last for bisect safety

## 6. Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Deferred-intent `elements.submit()` flow not exercised before; surprises in client integration | Medium | Smoke-test with test cards + decline cards on the dev server before merge |
| `automatic_payment_methods.enabled = true` plus deferred-intent surfaces unexpected payment methods (e.g. Link, BNPL) | Medium | Configure allowed methods in Stripe Dashboard before merge; or pass explicit `payment_method_types` to override |
| Total assertion rejects legitimate orders due to floating-point rounding | Medium | 1¢ tolerance per field; manual smoke with awkward prices ($19.95, $7.33×3) before merge |
| `payment_intent.succeeded` handler doesn't accept `pending_payment` after retry transition | Low | Retry path transitions `payment_failed → pending_payment` before new PI is issued; handler's WHERE clause matches; verify in smoke test 3 |
| `actorRole: "system"` rejected by audit schema | Low | Verify before commit 6; add to allowed set or use existing value |
| Apple Pay domain unverified at merge → wallets don't appear | Expected | Documented ops follow-up in `docs/remaining_work.md` §2.13; Google Pay unaffected |
| `payment_failed` rows leak into parent `/orders` | Low | `WHERE status != 'payment_failed'` in `listOrdersForParent` covered by item 5 |
| Schema migration via Neon MCP fails silently | Low | Verify with `SELECT enum_range(NULL::order_status)` after applying; cross-check `__drizzle_migrations` row inserted |
| Existing Reports GST formula differs from new helper | Low | Consolidation is explicit; accountant sign-off in §3.6 reviews the unified helper |
| Tenant footer prop type drift between `TenantRecord` and `TenantBrand` | Low | Spec calls out raw record over brand subset; per-page verification step in §2.1 table |

## 7. Testing approach

No test suite exists in this repo. `pnpm check-types:web` is the only correctness gate. Verification is manual on the dev server.

### Type / build gates

- After each commit: `pnpm check-types:web` must pass.
- Before merge: `pnpm build:web` — note pre-existing `useSearchParams` Suspense issue (#26, §2.8) may still surface; out of scope.

### Manual smoke tests (Stripe test mode)

1. **Card path:** catalog → PDP → cart → checkout, pay with `4242 4242 4242 4242`. PaymentElement renders tabs layout; card tab works inline; order in DB transitions `pending_payment → new` after webhook.
2. **Decline path:** retry with `4000 0000 0000 0002`. Order transitions to `payment_failed`; audit log entry created with `decline_code`; parent `/orders` does not list the row.
3. **Retry after failure:** with the same order context still open, retry with the good card. Verify the next `/api/stripe/payment-intent` POST transitions `payment_failed → pending_payment`, issues a new PI, confirms successfully, webhook transitions to `new`.
4. **Wallet path:** if an Apple Pay or Google Pay test device is available, exercise that tab. Verify `return_url` redirect lands on `/[tenant]/order/placed` and resolves the order.
5. **3DS path:** pay with `4000 0027 6000 3184` (requires 3DS). Verify redirect + return resolves correctly.
6. **Totals tamper test:** in devtools, modify POSTed `total` to `1` before submitting `/api/orders`. Verify 400 `totals_mismatch`.
7. **Awkward-price totals:** order with items summing to non-round amounts ($19.95, $7.33 × 3). Verify server assertion passes within 1¢ tolerance.
8. **Contact page:** visit `/<nsbh>/contact`. Verify shopEmail, shopHours, address, collectionInstructions all render.
9. **Footer presence:** verify footer renders on catalog, PDP, cart, contact, refund-policy, order-detail pages. All four links navigate correctly. Verify refund-policy link is omitted when a fresh tenant has `currentLegalVersionId = null`.
10. **SEO:** `curl http://localhost:3000/sitemap.xml` — verify NSBH + RGSH items appear. `curl http://localhost:3000/robots.txt` — verify admin/platform/auth/api are disallowed. View source on `/nsbh` and `/nsbh/item/<id>` — verify per-tenant + per-item title/description; verify PDP has `<link rel="canonical">` pointing to the bare URL.
11. **Size hint removal:** visit PDP for an item that previously showed the hint. Verify the block is gone; no console errors; network tab shows no `/api/orders/size-hint` request.

## 8. Open questions / deferred decisions

- **Apple domain-association file:** post-merge ops replaces the placeholder from Stripe Dashboard. Add explicit step to `docs/remaining_work.md` §2.13 once the PR merges.
- **GST formula accountant sign-off (§3.6):** independent; unified helper means future formula adjustments touch one file.
- **`getPubliclyListedTenants()` existence:** if not present in `db/queries.ts`, add as a thin wrapper. Spec authorises.
- **Per-tenant delivery fee:** explicitly deferred; this PR uses `SHIP_FEE_AUD`. Track as a follow-up if a school requests a different rate.
- **Dollars → cents migration:** deferred; out of scope. Worth doing eventually for rounding hygiene but not under this PR.
- **`actorRole: "system"` allowed values:** verify against `audit_events` schema before commit 6 lands.

## 9. References

- `docs/remaining_work.md` §2.13 (musts) + §2.14 (bug-class items)
- `my_doc/NSBH/gap-analysis.md` §5.1, §5.4, §5.5, §5.6, §5.10, §5.11
- `apps/web/src/app/api/stripe/webhook/route.ts:62-66` — current `pending_payment → new` transition
- `apps/web/src/app/[tenant]/checkout/checkout-screen.tsx:90,156,187,216` — PaymentElement swap sites
- `apps/web/src/db/schema.ts:18-19` — `orderStatusEnum` literal list
- `apps/web/src/db/queries.ts:427-467` — `getPreviousSizeHint` removal target
- `apps/web/src/app/api/orders/size-hint/route.ts` — size-hint API route (delete entire directory)
- `apps/web/src/app/[tenant]/item/[itemId]/interactive.tsx:36,173-178` — client fetch + render block to delete
- Memory: `/Volumes/T7/georgeqiao/.claude/projects/-Volumes-T7-georgeqiao-dev-uniform-order/memory/project_drizzle_kit_websocket_blocker.md` — Neon MCP migration workaround
- Memory: `/Volumes/T7/georgeqiao/.claude/projects/-Volumes-T7-georgeqiao-dev-uniform-order/memory/project_no_inventory.md` — stock tracking out of scope
- Stripe docs: deferred-intent flow with PaymentElement — `mode: 'payment'`, `amount`, `currency`, `paymentMethodCreation: 'manual'`
