# Pre-launch hardening + parent shell polish — Design

**Date:** 2026-05-12
**Authors:** Engineering
**Source:** `my_doc/NSBH/gap-analysis.md` §5, `docs/remaining_work.md` §2.13 + §2.14
**Target branch:** single feature branch, squash-merged to `main`
**Effort estimate:** ~2.5 dev-days

## 1. Goals and non-goals

### Goals

Ship seven items in one focused PR as pre-launch hardening:

1. Tenant footer with policy links on all parent-shop routes
2. Per-tenant Contact page reading existing onboarding data
3. SEO basics: sitemap, robots, per-tenant + per-PDP `generateMetadata`
4. Apple Pay + Google Pay via Stripe `PaymentElement` swap
5. `payment_intent.payment_failed` webhook handler + dashboard-refund audit-log entry
6. Server-side total assertion shared by `/api/orders` and `/api/stripe/payment-intent`
7. Remove the `getPreviousSizeHint` feature (drop, not fix)

### Non-goals

- **Guest checkout** — explicitly dropped; replaced by future magic-link + Google sign-in (separate work).
- **Email env / DNS configuration on Hostinger** — tracked in `docs/remaining_work.md` §2.8 as ops follow-up, not in this PR.
- **`sizes jsonb` migration on `catalog_variants`** — tracked in §2.14, deferred to a focused PR before tenant #3 onboarding.
- **Accountant sign-off on GST formula** (§3.6) — does not block this PR; the assertion uses the same 1/11 formula the Reports page already uses. Accountant review happens separately.
- **Active-child-scoped size hint** — feature is being removed entirely; no migration needed.
- **Fixing the pre-existing `useSearchParams` Suspense build failure** (#26, §2.8) — out of scope.

## 2. Architecture

### 2.1 Item 1 — Tenant footer

**New component:** `apps/web/src/components/tenant-footer.tsx`

- React Server Component.
- Props: `{ tenant: TenantBrand }` (the shape returned by `toTenantBrand`, already used throughout the parent shop).
- Renders:
  - Four-link strip: **Refund policy** → `/<tenant>/refund-policy`, **Contact** → `/<tenant>/contact`, **Privacy** → `/privacy`, **Terms** → `/terms`.
  - Below the links: `tenant.shopEmail` (as `mailto:`) and `tenant.shopHours` rendered as `<dl>` rows.
  - The refund-policy link is omitted when `tenant.currentLegalVersionId === null` (a school that hasn't signed off a policy yet).
- Styling: parchment background, gold rule top border (`border-t border-rule`), 16px vertical padding, type scale matching existing card footers. No fixed positioning — sits in normal scroll flow.

**Modified:** `apps/web/src/components/mobile-shell.tsx`

- New optional prop: `tenant?: TenantBrand`.
- When `tenant` is provided, render `<TenantFooter tenant={tenant} />` at the end of `children`, before the slot occupied by `BottomNav`.
- `BottomNav` remains fixed; footer scrolls naturally above it.
- When `tenant` is absent (e.g. the root `/` school picker), no footer is rendered. Backwards-compatible.

**Modified pages — thread tenant prop into `MobileShell`:**

Every `app/[tenant]/*/page.tsx` already fetches the tenant record. Add it to the `MobileShell` invocation:

- `app/[tenant]/page.tsx` (catalog home)
- `app/[tenant]/item/[itemId]/page.tsx`
- `app/[tenant]/cart/page.tsx`
- `app/[tenant]/checkout/page.tsx`
- `app/[tenant]/order/placed/page.tsx`
- `app/[tenant]/refund-policy/page.tsx`
- `app/[tenant]/contact/page.tsx` (new, see §2.2)

The `app/orders/` cross-tenant pages do not use `MobileShell` with a tenant prop; they are out of scope for the tenant footer.

### 2.2 Item 2 — Per-tenant Contact page

**New route:** `apps/web/src/app/[tenant]/contact/page.tsx`

- React Server Component.
- Pattern matches the existing `app/[tenant]/refund-policy/page.tsx` (same tenant lookup, same `MobileShell` wrapper).
- Reads `tenant.shopEmail`, `tenant.shopHours`, `tenant.address`, `tenant.collectionInstructions` — all already populated by the platform onboarding wizard (`app/platform/tenants/new/steps/step-3-operator.tsx` and step-1).
- Layout (top to bottom):
  - `<h1>` "Contact {tenant.name}"
  - Email card: label + `mailto:` link
  - Hours card: label + multi-line text (`tenant.shopHours` rendered with `whitespace-pre-wrap`)
  - Address card: label + multi-line text
  - Collection instructions card: optional, only renders when non-null
- `generateMetadata`: `{ title: 'Contact ${tenant.name}', robots: { index: true } }` — contact pages are useful SEO targets.
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

The `alternates.canonical` strips any `?cat=` query param from the canonical URL.

**New file:** `apps/web/src/app/sitemap.ts`

```ts
import type { MetadataRoute } from "next";
import { getPubliclyListedTenants, getActiveCatalog } from "@/db/queries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://uniformorder.online";
  const tenants = await getPubliclyListedTenants();
  const entries: MetadataRoute.Sitemap = [];
  for (const tenant of tenants) {
    entries.push({ url: `${base}/${tenant.id}`, changeFrequency: "weekly" });
    entries.push({ url: `${base}/${tenant.id}/contact`, changeFrequency: "monthly" });
    const items = await getActiveCatalog(tenant.id);
    for (const item of items) {
      entries.push({
        url: `${base}/${tenant.id}/item/${item.id}`,
        changeFrequency: "weekly",
      });
    }
  }
  return entries;
}
```

If `getPubliclyListedTenants` does not exist, this spec authorises adding it as a thin wrapper around the existing tenant fetch with the standard filter (`isPubliclyListed = true AND platformApprovalStatus = 'approved'`).

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

**Modified:** `apps/web/src/app/[tenant]/checkout/checkout-screen.tsx`

Current state (line 90-102): client-side mounts `elements.create("card", { hidePostalCode: true })` and calls `stripe.confirmCardPayment(clientSecret, { payment_method: { card } })`.

Change:

1. Replace element creation with the unified PaymentElement:
   ```ts
   const paymentElement = elements.create("payment", { layout: "tabs" });
   paymentElement.mount("#payment-element");
   ```

2. Replace payment confirmation:
   ```ts
   const { error } = await stripe.confirmPayment({
     elements,
     clientSecret,
     confirmParams: {
       return_url: `${window.location.origin}/${tenant.id}/order/placed?orderId=${orderId}`,
     },
     redirect: "if_required",
   });
   ```

   `redirect: "if_required"` keeps card payments in-flow (no redirect); wallets and 3DS flows that require redirect use `return_url`.

3. Update the mount-point JSX from `<div id="card-element" />` (or whatever it currently is) to `<div id="payment-element" />`.

4. Error handling path stays the same — `error.message` surfaces to the existing error banner.

**No changes to:** `apps/web/src/app/api/stripe/payment-intent/route.ts` — `automatic_payment_methods: { enabled: true }` is already set at line 75.

**No changes to:** `apps/web/src/app/[tenant]/order/placed/page.tsx`. Stripe's `return_url` redirect appends `payment_intent`, `payment_intent_client_secret`, `redirect_status` query params; the existing `orderId` param is what resolves the order. Extra params are ignored.

**New static asset:** `apps/web/public/.well-known/apple-developer-merchantid-domain-association`

In the PR, this file contains a placeholder comment plus instructions in `docs/remaining_work.md` §2.13 telling whoever does the prod deploy to replace it with the actual file from Stripe Dashboard. Apple Pay will not appear in the wallet tab until the domain is verified, which is a post-merge ops step. Google Pay does not require domain verification and works as soon as the PaymentElement swap is deployed.

### 2.5 Item 5 — `payment_intent.payment_failed` + dashboard-refund audit log

**Schema migration:**

Add `'payment_failed'` to the `order_status` enum (or text-check constraint, whichever the current schema uses). Use Neon MCP `run_sql_transaction` per the `drizzle-kit websocket blocker` memory:

```sql
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'payment_failed';
-- if text/check-constraint style:
-- ALTER TABLE orders DROP CONSTRAINT orders_status_check;
-- ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN (..., 'payment_failed'));
```

Update `apps/web/src/db/schema.ts` `orderStatusEnum` literal type to include `'payment_failed'`.

Insert a manual row into `__drizzle_migrations` per the documented workaround.

**Modified:** `apps/web/src/app/api/stripe/webhook/route.ts`

Add a new switch branch:

```ts
case "payment_intent.payment_failed": {
  const pi = event.data.object as Stripe.PaymentIntent;
  const order = await getOrderByPaymentIntentId(pi.id);
  if (!order) break; // PI we didn't create; ignore
  if (order.status === "paid") break; // already resolved; ignore late failure
  await db
    .update(orders)
    .set({ status: "payment_failed" })
    .where(eq(orders.id, order.id));
  await logAuditEvent({
    actorEmail: "stripe-webhook",
    actorRole: "system",
    action: "order.payment_failed",
    targetType: "order",
    targetId: order.id,
    payload: {
      paymentIntentId: pi.id,
      lastPaymentError: pi.last_payment_error?.message ?? null,
      declineCode: pi.last_payment_error?.decline_code ?? null,
    },
  });
  break;
}
```

**Verify** the existing `payment_intent.succeeded` branch transitions to `'paid'` regardless of the row's current status (so a parent who fails, then retries successfully, ends up `paid`). If the current handler has a `WHERE status = 'pending_payment'` clause, broaden it to `WHERE status IN ('pending_payment', 'payment_failed')`. The spec authorises this widening.

**Modified:** `apps/web/src/app/api/stripe/webhook/route.ts` — `charge.refunded` branch

Per the TODO at `api/orders/[orderId]/refund/route.ts:176-178`, the dashboard-initiated refund path currently skips audit logging. Add:

```ts
await logAuditEvent({
  actorEmail: "stripe-webhook",
  actorRole: "system",
  action: "order.refunded.via_dashboard",
  targetType: "order",
  targetId: order.id,
  payload: {
    chargeId: charge.id,
    amountRefundedCents: charge.amount_refunded,
    fullyRefunded: charge.refunded,
  },
});
```

**Modified:** `apps/web/src/db/queries.ts` `listOrdersForParent`

Add `WHERE status != 'payment_failed'` (in Drizzle syntax: `ne(orders.status, 'payment_failed')`) so parents never see their declined-card attempts in `/orders`. Admin and operator views are unaffected — failed rows remain visible in the Kanban (filtered to non-`payment_failed` per existing logic) and in the audit log surface.

### 2.6 Item 6 — Server-side total assertion

**New file:** `apps/web/src/lib/order-totals.ts`

```ts
export type LineInput = {
  unitPriceCents: number;
  qty: number;
};

export type ComputedTotals = {
  subtotalCents: number;
  gstCents: number;
  totalCents: number;
};

export function computeTotals(args: {
  lines: LineInput[];
  deliveryFeeCents: number;
}): ComputedTotals {
  const subtotalCents = args.lines.reduce((sum, l) => sum + l.unitPriceCents * l.qty, 0);
  const totalCents = subtotalCents + args.deliveryFeeCents;
  const gstCents = Math.round(totalCents / 11);
  return { subtotalCents, gstCents, totalCents };
}

export class TotalsMismatchError extends Error {
  constructor(
    readonly expected: ComputedTotals,
    readonly received: { subtotalCents: number; gstCents: number; totalCents: number },
  ) {
    super("totals_mismatch");
  }
}

export function assertTotalsMatch(args: {
  lines: LineInput[];
  deliveryFeeCents: number;
  received: { subtotalCents: number; gstCents: number; totalCents: number };
}): ComputedTotals {
  const expected = computeTotals({ lines: args.lines, deliveryFeeCents: args.deliveryFeeCents });
  const ok =
    Math.abs(expected.subtotalCents - args.received.subtotalCents) <= 1 &&
    Math.abs(expected.gstCents - args.received.gstCents) <= 1 &&
    Math.abs(expected.totalCents - args.received.totalCents) <= 1;
  if (!ok) throw new TotalsMismatchError(expected, args.received);
  return expected;
}
```

GST formula is **1/11 of GST-inclusive total**, matching the Reports page convention. 1¢ tolerance per field absorbs JavaScript float rounding differences. Both server and client work in integer cents.

**Modified call sites:**

- `apps/web/src/app/api/orders/route.ts` — before the `db.batch` insert, call `assertTotalsMatch({ lines, deliveryFeeCents: tenant.deliveryFeeCents, received: { subtotalCents, gstCents, totalCents } })`. On `TotalsMismatchError`, return `400` with body `{ code: 'totals_mismatch', expected, received }`.
- `apps/web/src/app/api/stripe/payment-intent/route.ts` — before `stripe.paymentIntents.create`, call the same helper. Same 400 response on mismatch. **Use the server-computed `totalCents` as the PaymentIntent `amount`**, not the client-supplied value, so a mismatch can never reach Stripe.

**Reports page consolidation:** the existing GST calculation in `app/platform/billing/` and `app/admin/[tenant]/reports/` should switch to importing `computeTotals` from `lib/order-totals.ts` so the formula has a single source of truth. If the existing calculations differ by formula or rounding, the spec authorises adopting the new helper's behaviour as canonical — this is a deliberate consolidation, accountant sign-off in §3.6 should review this helper not the duplicates.

### 2.7 Item 7 — Remove `getPreviousSizeHint`

**Deletions:**

- Delete `getPreviousSizeHint` function from `apps/web/src/db/queries.ts:427-467`.
- Delete its imports throughout the codebase. TypeScript will surface them.
- Delete the hint render block from `apps/web/src/app/[tenant]/item/[itemId]/interactive.tsx:173-178`.
- If `app/[tenant]/item/[itemId]/page.tsx` calls `getPreviousSizeHint` and threads its result as a prop to `interactive.tsx`, remove that call and prop.

**Doc update:**

Add a one-line note to `docs/completed.md` §4.8 (the "Riley wore size X last year" entry): "Removed 2026-05-12 — see `docs/remaining_work.md` §2.14 for reasoning."

## 3. Data flow

### 3.1 Checkout payment (item 4)

1. Parent reaches `/[tenant]/checkout`. RSC fetches tenant + creates draft order context.
2. Client calls `POST /api/stripe/payment-intent` → server computes totals via `assertTotalsMatch` (item 6), creates PI with `automatic_payment_methods.enabled = true`, returns `client_secret`.
3. Client mounts `PaymentElement` with `layout: "tabs"`. Stripe renders Card / Apple Pay / Google Pay tabs based on browser, device, and verification state.
4. Parent submits. Client calls `stripe.confirmPayment({ elements, clientSecret, confirmParams: { return_url: ... }, redirect: "if_required" })`.
5. **Card path (no redirect):** Stripe resolves the promise inline. On success, client POSTs `/api/orders` to commit the row with `assertTotalsMatch` recheck. Server transitions order to `paid` once webhook `payment_intent.succeeded` fires.
6. **Wallet / 3DS path (redirect):** browser navigates to `return_url` (`/[tenant]/order/placed?orderId=...&payment_intent=...&redirect_status=succeeded`). The page resolves order by `orderId`.

### 3.2 Failed payment (item 5)

1. Parent's card declines during `confirmPayment`.
2. Stripe sends `payment_intent.payment_failed` to our webhook.
3. Handler looks up order by `stripePaymentIntentId`, transitions `status` to `'payment_failed'`, audit-logs the failure with decline_code.
4. Parent's `/orders` page (filtered) does not list the failed row.
5. Parent may retry: PaymentElement supports retry against the same `client_secret`. On success, `payment_intent.succeeded` handler transitions `'payment_failed' → 'paid'`.

### 3.3 Total assertion (item 6)

1. Client POSTs to `/api/orders` or `/api/stripe/payment-intent` with `{ lines, deliveryFeeCents, subtotalCents, gstCents, totalCents }`.
2. Server calls `assertTotalsMatch({ lines, deliveryFeeCents: tenant.deliveryFeeCents, received: { subtotalCents, gstCents, totalCents } })`.
3. On mismatch → 400 with `{ code: 'totals_mismatch', expected, received }`. Client surfaces a generic "Something went wrong, please refresh and try again" message.
4. On match → server uses the **server-computed** totals for the DB write and the PI amount, never the client-supplied values.

## 4. Error handling

| Surface | Failure | Behaviour |
|---|---|---|
| PaymentElement mount | Stripe.js fails to load | Existing error banner; no change |
| `confirmPayment` | Card declined | Stripe returns `error.code = 'card_declined'`; existing error banner surfaces `error.message`; webhook transitions order to `payment_failed` (out-of-band) |
| `confirmPayment` | 3DS challenge cancelled | Stripe returns `error.code = 'payment_intent_authentication_failure'`; same handling |
| `/api/orders` | `totals_mismatch` | 400 with structured payload; client shows generic error |
| `/api/stripe/payment-intent` | `totals_mismatch` | 400 same shape |
| Webhook | `payment_intent.payment_failed` for unknown PI | Log and ignore (we didn't create this PI) |
| Webhook | `payment_intent.payment_failed` for already-paid order | Log and ignore (late event, real outcome is paid) |
| Webhook | `charge.refunded` for unknown charge | Existing behaviour preserved |
| Contact page | Tenant not found | `notFound()` (404) |
| Contact page | Tenant fails visibility gate | `notFound()` for non-platform-admins |
| Sitemap | `getPubliclyListedTenants` returns empty | Empty sitemap; valid; not an error |
| Footer | `tenant.currentLegalVersionId` is null | Refund-policy link omitted; other links render |

## 5. Sequencing

Recommended commit order within the feature branch. Each commit type-checks cleanly. Squash-merge at the end per repo convention.

1. `chore: remove getPreviousSizeHint feature` — item 7 — zero risk, independent
2. `feat: tenant footer with policy links + contact page` — items 1 + 2 — additive UI
3. `feat: SEO basics — sitemap, robots, generateMetadata` — item 3 — additive infra
4. `refactor: extract lib/order-totals.ts helper` — item 6 part 1 — Reports + new helper, no enforcement yet
5. `feat: server-side total assertion in order + PI endpoints` — item 6 part 2 — turns on enforcement
6. `feat: payment_failed webhook handler + dashboard-refund audit log` — item 5 — includes status enum migration
7. `feat: Stripe PaymentElement (Apple Pay + Google Pay)` — item 4 — highest test surface; last for bisect safety

## 6. Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| PaymentElement `return_url` redirect breaks confirmation flow | Medium | Smoke-test wallet + 3DS test cards before merging; `/order/placed` already tolerates extra query params |
| Total assertion rejects legitimate orders due to per-line rounding | Medium | 1¢ tolerance per field; manual smoke with awkward prices ($19.95 × 3, etc.) before merge |
| `payment_intent.succeeded` handler doesn't transition from `payment_failed` | Low | Spec authorises broadening the status WHERE clause; verify and adjust during implementation |
| Apple Pay domain unverified at merge → wallets don't appear | Expected | Documented as ops follow-up in `docs/remaining_work.md` §2.13; Google Pay unaffected |
| `payment_failed` rows leak into parent `/orders` | Low | `WHERE status != 'payment_failed'` in `listOrdersForParent` covered by item 5 |
| Removing size-hint leaves dead imports | Low | `pnpm check-types:web` catches unused imports |
| Enum migration fails to apply via Neon MCP | Low | Documented workaround in memory; spec calls out the migration mechanism explicitly |
| Existing Reports GST formula differs from new helper | Low | Consolidation is explicit; accountant sign-off in §3.6 reviews the unified helper |

## 7. Testing approach

No test suite exists in this repo. `pnpm check-types:web` is the only correctness gate. Verification is manual on the dev server.

### Type / build gates

- After each commit: `pnpm check-types:web` must pass.
- Before merge: `pnpm build:web` — note pre-existing `useSearchParams` Suspense issue (#26, §2.8); spec considers this out of scope.

### Manual smoke tests (Stripe test mode)

1. **Card path:** catalog → PDP → cart → checkout, pay with `4242 4242 4242 4242`. PaymentElement renders tabs layout; card tab works inline; order transitions to `paid`.
2. **Decline path:** retry with `4000 0000 0000 0002`. Order transitions to `payment_failed` (verify in DB / admin Kanban); audit log entry created with `decline_code`; parent `/orders` does **not** list the row.
3. **Retry-after-failure:** with the same PI still open, retry with the good card. Order transitions `payment_failed → paid`.
4. **Wallet path:** if a test Apple Pay or Google Pay device is available, exercise that tab. Verify `return_url` redirect lands on `/[tenant]/order/placed` and resolves the order.
5. **3DS path:** pay with `4000 0027 6000 3184` (requires 3DS). Verify redirect + return resolves correctly.
6. **Totals tamper test:** in browser devtools, modify POSTed `totalCents` to `1` before submitting `/api/orders`. Verify 400 `totals_mismatch`.
7. **Awkward-price totals:** order with items summing to non-round amounts ($19.95, $7.33 × 3). Verify server assertion passes.
8. **Contact page:** visit `/<nsbh>/contact`. Verify shopEmail, shopHours, address, collectionInstructions all render correctly.
9. **Footer presence:** verify footer renders on catalog, PDP, cart, contact, refund-policy, order-detail pages. All four links navigate correctly.
10. **SEO:** `curl http://localhost:3000/sitemap.xml` — verify nsbh + rgsh items appear. `curl http://localhost:3000/robots.txt` — verify admin/platform/auth/api are disallowed. View source on `/nsbh` and `/nsbh/item/<id>` — verify per-tenant + per-item title/description.
11. **Size hint removal:** visit PDP for an item that previously showed the hint. Verify the block is gone; no console errors.

## 8. Open questions / deferred decisions

- **Apple domain-association file:** the placeholder in `public/.well-known/` is replaced post-merge from Stripe Dashboard. Add an explicit step to `docs/remaining_work.md` §2.13 once the PR merges so the deploy doesn't forget.
- **GST formula accountant sign-off (§3.6):** independent. The unified helper makes future formula adjustments cheap — change one file.
- **`getPubliclyListedTenants()` existence:** if not present in `db/queries.ts`, add as a thin wrapper. Spec authorises.

## 9. References

- `docs/remaining_work.md` §2.13 (musts) + §2.14 (bug-class items)
- `my_doc/NSBH/gap-analysis.md` §5.1, §5.4, §5.5, §5.6, §5.10, §5.11
- `apps/web/src/app/api/stripe/webhook/route.ts` — webhook handler
- `apps/web/src/app/[tenant]/checkout/checkout-screen.tsx:90-102` — PaymentElement swap site
- `apps/web/src/db/queries.ts:427-467` — `getPreviousSizeHint` removal target
- Memory: `project_drizzle_kit_websocket_blocker.md` — Neon MCP migration workaround
- Memory: `project_no_inventory.md` — stock tracking out of scope (relevant to declining the active-child fix)
