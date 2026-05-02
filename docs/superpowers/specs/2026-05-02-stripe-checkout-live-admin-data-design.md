# Stripe Checkout and Live Admin Data Design

## Context

The parent checkout currently shows a mock card UI and creates orders with
`stripePaymentIntentId: null`. The app already has a live Stripe PaymentIntent
route at `/api/stripe/payment-intent`, a live Neon-backed `POST /api/orders`,
and Stripe client dependencies installed.

The admin dashboard and reports still read static sales data from
`apps/web/src/lib/admin-data.ts`, even though order creation, order status
updates, and order detail views now use live Neon data.

## Goals

- Replace the mock checkout payment block with a minimal real Stripe Elements
  flow.
- Create orders only after Stripe confirms payment.
- Persist the confirmed PaymentIntent ID into `POST /api/orders`.
- Surface checkout API, payment, configuration, and order persistence errors
  inline.
- Move dashboard recent orders, KPIs, top items, and report summaries to
  tenant-scoped Neon data where the current schema supports it.
- Keep the existing mobile-first checkout UI and admin page layout intact.

## Non-Goals

- No new refund or exchange workflow.
- No Stripe webhook reconciliation.
- No saved cards, Apple Pay, Google Pay, or hosted Checkout migration.
- No new database tables for payment status, Stripe fees, or balance
  transactions.
- No full super-admin portal work.

## Checkout Design

`apps/web/src/app/[tenant]/checkout/checkout-screen.tsx` remains the parent
checkout client component. It will keep the existing student, delivery, order
summary, and footer button styling. The payment section will mount a small
Stripe Elements child component in place of the fake card number, expiry, and
CVC display.

The checkout sequence is:

1. Validate student/contact details and cart contents.
2. Persist student details to local storage.
3. Call `POST /api/stripe/payment-intent` with `tenantId`, `amount`, currency,
   and order metadata.
4. Confirm the PaymentIntent on the client with Stripe Elements.
5. If confirmation succeeds, call `POST /api/orders` with all existing order
   fields plus the confirmed `stripePaymentIntentId`.
6. Clear the cart and route to the existing order placed screen.

If `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is not configured, the payment section
shows a configuration error and disables payment. If Stripe intent creation,
card confirmation, or order persistence fails, the checkout remains on screen
and shows the error in the payment area instead of using `alert()`.

The implementation will use the installed `@stripe/stripe-js` package. If the
package does not provide React bindings, the component will use the core Stripe
JS APIs directly rather than adding a new dependency unless type-checking shows
the React package is already available transitively.

## Admin Data Design

Shared DB query helpers will be added to `apps/web/src/db/queries.ts` so admin
pages do not duplicate query logic. Helpers will remain tenant-scoped and will
not instantiate DB clients at import time.

Dashboard data will come from live orders and order lines:

- Revenue for the last 30 days from `orders.total`.
- Order count for the last 30 days.
- Average order value for the last 30 days.
- Awaiting pickup from live pickup orders in `ready` status.
- Recent orders from the latest live orders for the tenant.
- Top selling items from live order lines joined to tenant orders.
- Sparkline values from recent daily revenue buckets.

Reports data will come from live tenant orders and order lines:

- Six-month total revenue, total orders, average order value, and GST collected.
- Monthly revenue bars for the last six calendar months.
- Revenue by category by joining order lines to catalog items where item IDs
  still match catalog records.
- GST summary rows grouped by month from live order totals and GST values.

Stripe fees in the GST summary will be estimated from gross sales using the
current local reporting convention, because the database stores PaymentIntent
references but not Stripe balance transaction fee records. The UI should not
claim these fees are exact Stripe settlement records.

## Types and Component Contracts

Dashboard client props will use a local live analytics type rather than
`SalesData` from `lib/admin-data.ts`. Recent order props will use a compact
live order summary type derived from the DB shape instead of `AdminOrder`.

Reports can stay mostly server-rendered, with the existing `ExportCsvButton`
receiving live GST rows. Numeric database fields will be parsed to numbers
before formatting.

## Error Handling

Checkout errors are visible inline and specific enough to distinguish:

- Missing Stripe publishable key.
- Payment form not ready.
- PaymentIntent creation failure.
- Stripe confirmation failure.
- Order persistence failure after payment confirmation.

For the order persistence failure after a confirmed payment, the message should
tell the parent not to retry payment and to contact the uniform shop with the
Stripe reference. This avoids duplicate charges.

Admin pages should render empty states when there are no live orders rather
than falling back to static mock analytics.

## Verification

The verification gates are:

```bash
pnpm check-types
pnpm build:web
```

If generated Next route types are missing, run:

```bash
pnpm --filter web exec next typegen
```

Then rerun the verification gates.
