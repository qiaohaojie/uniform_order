# Parent Order Detail Page — Design

**Date:** 7 May 2026
**Tracks:** `docs/remaining_work.md` §3.4
**Status:** Design approved; ready for implementation plan

## Problem

The parent portal has an orders list (`/orders`) but no per-order detail view. Today a parent can see status text in the list but cannot inspect line items, payment, refunds, or progress through fulfillment for a specific order. Order confirmation and "ready for pickup" emails have no deep link to a status page.

## Goal

Ship a parent-facing order detail page at `/orders/[orderId]` that:

- Shows current fulfillment status as a stepper (Placed → Packing → Ready → Collected).
- Lists line items, pickup/shipping details, payment summary, and any refunds.
- Provides a support contact CTA scoped to the order's tenant.
- Is reachable from the parent orders list, the post-checkout placed page, and the transactional emails (confirmation + ready).

## Non-goals

- Per-status transition timestamps (would require a `status_history` table — tracked separately under §4.6 audit log).
- Magic-link / token access for non-logged-in parents (session-only; matches `/orders` list).
- Real-time updates / polling (page reload is acceptable for an admin-paced flow).
- Adminside changes (admin already has `/admin/[tenant]/orders/[orderId]`).

## Auth model

Session-only, mirrors `/orders/page.tsx`:

```
const user = await getSessionUser();
if (!user) redirect(`/auth/sign-in?callbackURL=${encodeURIComponent("/orders/" + orderId)}`);

const order = await getOrderById(orderId);
if (!order) notFound();

// Reuse the canonical helper rather than inlining email normalization.
// ensureParentEmailAccess returns a NextResponse on mismatch; we map that → notFound().
if (ensureParentEmailAccess(user, order.parentEmail)) notFound();
```

Key distinction:

- **Unauthenticated** → `redirect()` to sign-in with `callbackURL`. Logged-out parent clicking an email link must not see "page not found." Plan must verify the sign-in flow honors `callbackURL` back to deep links like `/orders/{id}` (the existing `/orders` list uses this pattern, so the precedent is there).
- **Authenticated but wrong owner / order missing** → `notFound()`. No distinction between the two — prevents enumeration of valid order IDs.
- **Authenticated owner but order is `pending_payment`** → render full detail; the stepper is replaced with a "Payment processing" banner. See UX section.

## Order ID format

Orders use tenant-prefixed string IDs in the format `{TENANT}-{XXXXXXXXXX}` (e.g. `NSBH-A1B2C3D4E5`), generated in `apps/web/src/app/api/orders/route.ts:19,23`. They are **not** UUIDs.

- URL: `/orders/{full order.id}` — pass through verbatim, no transformation.
- Display: render the full `order.id` as-is. Already short (≤16 chars) and human-readable; no shortening needed.

## Architecture

### New files

- `apps/web/src/app/orders/[orderId]/page.tsx` — server component. Owns auth, data fetching, soft-state branching.
- `apps/web/src/app/orders/[orderId]/order-detail-client.tsx` — `"use client"` presentational component. Receives all data as props; no fetching. Mirrors the server/client split used elsewhere in the parent portal.
- `apps/web/src/components/order-status-stepper.tsx` — reusable 4-step stepper.

### Reused

- `getSessionUser()`, `ensureParentEmailAccess()` — `@/lib/auth/authorization`
- `getOrderById(orderId)` — already returns `{ ...order, lines }`. No composite query needed.
- `getOrderRefunds(orderId)` — `@/db/queries:476`
- `getTotalRefunded(orderId)` — `@/db/queries:484`. Canonical money-rounded sum used for the "Net paid" line; avoids client-side drift.
- `getTenant(tenantId)` — for accent colour, `shopEmail`, and pickup-detail fields (all nullable; see fallback rules below)
- `MobileShell`, `BottomNav` — same chrome as `/orders`

### No new API route

The page renders server-side and reads from the DB directly. The existing `GET /api/orders/[orderId]` (which already supports parent auth via `ensureParentEmailAccess`) remains for any client-side consumers; this page does not call it.

## UX — page sections (top to bottom)

The page has three top-state branches based on `order.status`. All three render the same chrome (header + footer) and the same body sections (3–6 below). Only the **status block** (section 2) differs.

**Status block branches:**

| Status | Status block |
|---|---|
| `pending_payment` | Amber "Payment processing" banner. No stepper. |
| `new`, `packing`, `ready`, `collected` | 4-step stepper (see below). |
| `partially_refunded`, `refunded` | Amber refund banner with total refunded amount + "See refunds below". No stepper. |

Refund states hide the stepper entirely because `orders.status` is single-valued — once it flips to `refunded`/`partially_refunded`, the prior fulfillment step is overwritten and not recoverable. A `status_history` table would be needed to render both; that is explicitly out of scope (tracked under §4.6).

### Sections

1. **Header** — tenant crest + accent rule, `Order #{order.id}` (the full tenant-prefixed ID, e.g. `NSBH-A1B2C3D4E5`), current status chip.
2. **Status block** — branches per table above:
   - **Stepper:** 4 steps Placed → Packing → Ready → Collected. Mapping: `new`→1, `packing`→2, `ready`→3, `collected`→4. Current step uses tenant accent; completed steps show a check; future steps muted. Above: "Placed {createdAt formatted}". Below: "Last updated {updatedAt formatted}".
   - **Payment-processing banner:** "Payment is being confirmed. This usually clears within a minute — refresh to check again."
   - **Refund banner:** "{Partially refunded|Refunded} — {amount from `getTotalRefunded`} returned. See refunds below."
3. **Pickup / shipping details** — student name, school name, delivery method. For `pickup`: render `tenant.shopHours`, `tenant.address`, and `tenant.collectionInstructions` only if non-null (omit the row otherwise; do not render empty labels).
4. **Line items** — item name, variant label, qty, line total. `.tnum` on prices. Mirrors the order confirmation email body. Always rendered (lines exist as soon as the order row exists, even in `pending_payment`).
5. **Payment summary** — subtotal, total. If `getOrderRefunds` returns rows: itemized refund rows (date, amount, reason) followed by a "Net paid = total − getTotalRefunded(orderId)" line. Always rendered.
6. **Support CTA** — if `tenant.shopEmail` is non-null: `mailto:{tenant.shopEmail}?subject=Order%20{order.id}` button. If null: render a plain-text message instead — "Contact your school directly for help with this order." (no button).

### Why pending_payment renders full detail

Order rows + lines are persisted by `POST /api/orders` (`apps/web/src/app/api/orders/route.ts:161,194`) immediately after the client confirms payment via `confirmCardPayment`. The order confirmation email is also sent from that same request (`route.ts:249,256`). The webhook only flips status from `pending_payment` → `new`. Webhook lag affects status, not whether the order contents exist — so suppressing line items / payment summary during this window would hide authoritative data.

### Visual language

Reuse existing parent-portal Tailwind tokens (parchment bg, paper cards, gold/accent rule, Newsreader serif headings, Inter body, `.tnum` on prices). No HeroUI components introduced.

## Wire-ups (same PR)

- `apps/web/src/app/orders/orders-list-client.tsx` — wrap each order row in a `Link` to `/orders/{id}`.
- `apps/web/src/lib/email/templates/OrderConfirmation.tsx` — add a "View order status" button linking to `${appUrl}/orders/{id}`.
- `apps/web/src/lib/email/templates/OrderReady.tsx` — same CTA (replaces or supplements any existing CTA).
- `apps/web/src/app/[tenant]/order/placed/...` — add a "Track this order" link to `/orders/{orderId}`.

## Error handling

- Order not found / wrong owner → `notFound()` (Next.js 404 page).
- DB exception during fetch → bubble up; Next.js renders `error.tsx`. Include `serverCaptureException` in the page server component for visibility.
- Refunds query failure → log + render the page without the refund section (rather than hard-fail the whole page).

## Testing

Manual verification (no test suite in this repo):

1. **Logged-out access** — visit `/orders/{anyId}` → redirected to `/auth/sign-in?callbackURL=/orders/{anyId}`.
2. **Wrong-owner access** — log in as parent A, visit one of parent B's order URLs → 404.
3. **Happy path** — log in, click order from `/orders` list → detail page renders correctly across each status (`new`, `packing`, `ready`, `collected`).
4. **pending_payment** — set an order to `pending_payment` in DB, view → "Payment processing" banner replaces stepper; line items + payment summary still render.
5. **Refund states** — view a `partially_refunded` and `refunded` order → stepper hidden, refund banner shows total refunded; refund rows + "Net paid" appear in payment summary.
6. **Tenant fallbacks** — view an order whose tenant has `shopEmail = null` → support CTA renders as plain text, not a button. Same for null `shopHours` / `address` / `collectionInstructions` — those rows are omitted, not rendered with empty values.
7. **Email CTA + callbackURL** — trigger an order confirmation email, click "View order status" while logged out → lands on sign-in, completes auth, redirects to `/orders/{id}`. Confirms `callbackURL` honors deep links (precedent: `/orders` list).
8. **Type check** — `pnpm check-types:web` clean.

## Out of scope (explicit)

- §4.6 operator audit log / per-status timestamps
- Magic-link tokens
- Polling / live updates
- Admin changes
- Stock counts (§4.5), i18n (§4.4)

## Open questions

None at design time. Implementation may surface small choices (e.g., exact stepper visual treatment) — those are presentation-only and don't change the spec.
