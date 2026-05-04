# Stripe Integration — Uniform Order

This document covers the full Stripe implementation: how checkout works, how
school accounts connect, how analytics are derived, and what you need to go live.

---

## Table of Contents

1. [Overview](#overview)
2. [Checkout Flow](#checkout-flow)
3. [API Routes](#api-routes)
4. [Stripe Connect (School Onboarding)](#stripe-connect-school-onboarding)
5. [Database Schema](#database-schema)
6. [Admin Analytics](#admin-analytics)
7. [Going Live](#going-live)

---

## Overview

Stripe is used for two distinct purposes:

| Purpose | What it does |
|---|---|
| **Card Checkout** | Parents pay for uniform orders via a Stripe card element embedded in the checkout page |
| **Stripe Connect** | Each school (tenant) connects their own Stripe account so payouts go directly to the school |

```
┌─────────────────────────────────────────────────────────────────┐
│                        PLATFORM (you)                           │
│                                                                 │
│   STRIPE_SECRET_KEY  ──►  Stripe Platform Account              │
│                                                                 │
│   ┌─────────────────┐         ┌─────────────────┐              │
│   │  School A (nsbh)│         │  School B (rgsh)│              │
│   │  Connected Acct │         │  Connected Acct │              │
│   │  acct_abc123    │         │  acct_xyz789    │              │
│   └─────────────────┘         └─────────────────┘              │
└─────────────────────────────────────────────────────────────────┘

Payments flow through the platform and settle into each school's
connected account. The platform does not hold the money.
```

---

## Checkout Flow

### Step-by-step

```
  Parent Browser                    Next.js Server                Stripe
       │                                  │                          │
       │  1. Page loads                   │                          │
       │─────────────────────────────────►│                          │
       │                                  │                          │
       │  2. Stripe.js loads card element │                          │
       │◄─────────────────────────────────│                          │
       │         (iframe rendered)        │                          │
       │                                  │                          │
       │  3. Parent fills form + clicks Pay                          │
       │─────────────────────────────────►│                          │
       │                                  │                          │
       │  4. POST /api/stripe/payment-intent                         │
       │─────────────────────────────────►│                          │
       │                                  │  5. stripe.paymentIntents│
       │                                  │     .create(amount, AUD) │
       │                                  │─────────────────────────►│
       │                                  │◄─────────────────────────│
       │                                  │   clientSecret           │
       │◄─────────────────────────────────│                          │
       │   { clientSecret }               │                          │
       │                                  │                          │
       │  6. stripe.confirmCardPayment(clientSecret, card)           │
       │─────────────────────────────────────────────────────────────►
       │◄─────────────────────────────────────────────────────────────
       │   { paymentIntent.status: "succeeded" }                     │
       │                                  │                          │
       │  7. POST /api/orders (save order to DB)                     │
       │─────────────────────────────────►│                          │
       │◄─────────────────────────────────│                          │
       │   { orderId }                    │                          │
       │                                  │                          │
       │  8. Redirect → /order/placed     │                          │
       │                                  │                          │
```

### Key safety rule — payment lock

After card payment is confirmed but before the order is saved, a network error
could leave the parent with a charged card but no order. The app handles this:

```
  stripe.confirmCardPayment() succeeds
           │
           ▼
  POST /api/orders ──► OK?
           │                └── YES ──► clearCart() → redirect to /order/placed
           │
           └── NO (network error / 500)
                    │
                    ▼
          paymentLocked = true   ← button disabled permanently
          Show message:
          "Your payment was confirmed. Do not retry.
           Contact the shop with Stripe ref pi_xxxx"
```

This prevents the parent from clicking Pay again and being charged twice.

---

## API Routes

### `POST /api/stripe/payment-intent`

Creates a PaymentIntent on Stripe and returns the `clientSecret` to the browser.

**Request body:**
```json
{
  "tenantId": "nsbh",
  "amount": 127.50,
  "currency": "aud",
  "metadata": {
    "parentEmail": "parent@example.com",
    "studentName": "Riley Qiao",
    "studentYear": "Year 9",
    "delivery": "pickup"
  }
}
```

**Response:**
```json
{
  "clientSecret": "pi_xxx_secret_yyy",
  "paymentIntentId": "pi_xxx"
}
```

**Amount handling:** Dollar amount is multiplied by 100 to convert to cents
before being sent to Stripe (e.g. `$127.50 → 12750`).

---

### `POST /api/stripe/connect`

Starts Stripe Connect onboarding for a school. Called from Admin → Settings.

```
  Admin clicks "Connect Stripe"
           │
           ▼
  POST /api/stripe/connect { tenantId: "nsbh" }
           │
           ▼
  Does tenant already have stripeAccountId in DB?
           │
      NO ──┤
           │   stripe.accounts.create({ type: "standard", ... })
           │   Save accountId → tenants table
           │
      YES ──┤  (skip creation, reuse existing accountId)
           │
           ▼
  stripe.accountLinks.create({ type: "account_onboarding" })
           │
           ▼
  Return { url: "https://connect.stripe.com/..." }
           │
           ▼
  Frontend redirects admin to Stripe's onboarding wizard
           │
           ▼
  Stripe redirects back to:
    success → /admin/nsbh/settings?stripe=success
    refresh → /admin/nsbh/settings?stripe=refresh
```

---

### `GET /api/stripe/connect?tenantId=nsbh`

Checks the current status of a school's connected account.

```
  Response:
  {
    "connected": true,
    "accountId": "acct_abc123",
    "payoutsEnabled": true,
    "chargesEnabled": true,
    "detailsSubmitted": true
  }
```

Also writes the latest `payoutsEnabled` / `chargesEnabled` values back to the
`tenants` table so the admin settings page stays in sync.

---

## Stripe Connect (School Onboarding)

Stripe Connect allows each school to have their own Stripe account. The app
uses **Standard accounts** — the school completes full Stripe KYC and owns the
account. Funds settle directly into the school's bank.

```
  ONBOARDING STATES
  ─────────────────

  [ Not connected ]
       │
       │  Admin clicks "Connect Stripe"
       ▼
  [ Stripe onboarding in progress ]
       │  School completes KYC on stripe.com
       ▼
  [ detailsSubmitted = true ]
       │  Stripe reviews
       ▼
  [ chargesEnabled = true ]   ← can accept payments
       │
       ▼
  [ payoutsEnabled = true ]   ← payouts settle to school bank
```

Until `chargesEnabled` is true, the payment intent API will still work
(the platform account is used as fallback), but funds won't automatically
route to the school.

---

## Database Schema

### `tenants` table — Stripe columns

```
  tenants
  ┌──────────────────────────┬──────────────────────────────────────┐
  │ stripe_account_id        │ "acct_abc123" or NULL                │
  │ stripe_payouts_enabled   │ boolean (default false)              │
  │ stripe_charges_enabled   │ boolean (default false)              │
  └──────────────────────────┴──────────────────────────────────────┘
```

### `orders` table — Stripe columns

```
  orders
  ┌──────────────────────────┬──────────────────────────────────────┐
  │ stripe_payment_intent_id │ "pi_xxx" — the Stripe PaymentIntent  │
  │ stripe_ref               │ reserved for future use              │
  └──────────────────────────┴──────────────────────────────────────┘
```

The `stripe_payment_intent_id` is the single source of truth linking a DB
order to a Stripe transaction. You can look it up directly in the Stripe
dashboard to see payment status, card details, and refund history.

---

## Admin Analytics

Analytics are computed from live DB data — not from Stripe's API. Every order
written by `POST /api/orders` is immediately reflected.

### Dashboard — `getLiveDashboardData(tenantId)`

```
  All orders for tenant (DB)
           │
           ▼
  ┌─────────────────────────────────────────────┐
  │  Last 30 days                               │
  │  ┌──────────┐  ┌───────────┐  ┌──────────┐ │
  │  │ Revenue  │  │  Orders   │  │ Avg Order│ │
  │  │  $4,210  │  │    33     │  │  $127.58 │ │
  │  └──────────┘  └───────────┘  └──────────┘ │
  └─────────────────────────────────────────────┘
           │
           ▼
  ┌──────────────────────────────────────────────┐
  │  Sparkline (last 12 days, daily revenue)     │
  │                                              │
  │  $500 ┤                    ╭─╮               │
  │  $400 ┤          ╭─╮      ╭╯ ╰─╮            │
  │  $300 ┤   ╭─╮   ╭╯ ╰─╮  ╭╯    ╰╮           │
  │  $200 ┤  ╭╯ ╰─╮ ╯    ╰──╯      ╰╮          │
  │  $100 ┤ ╭╯    ╰╯                 ╰─         │
  │    $0 ┼─────────────────────────────        │
  │       Day-12  ...              Today         │
  └──────────────────────────────────────────────┘
           │
           ▼
  ┌───────────────────────────────┐
  │  Top 5 items (last 30 days)   │
  │  by revenue from order_lines  │
  └───────────────────────────────┘
           │
           ▼
  ┌───────────────────────────────┐
  │  Recent 5 orders              │
  │  (all time, sorted by date)   │
  └───────────────────────────────┘
```

All timezone calculations use **Australia/Sydney** — daily and monthly buckets
snap to Sydney midnight, not UTC midnight.

---

### Reports — `getLiveReportsData(tenantId)`

```
  6-month window (current month − 5 months)
           │
           ▼
  Monthly revenue bar chart
  ──────────────────────────
  Dec  ████████████  $1,240
  Jan  ██████████████████  $1,860
  Feb  ████████  $820
  Mar  ██████████████  $1,420
  Apr  ████████████████████  $2,050
  May  ██████  $640  ← current month (partial)

           │
           ▼
  Category revenue breakdown
  ──────────────────────────
  Winter    ████████████████  45%
  Summer    ████████  22%
  Sports    ██████  18%
  Formal    ████  10%
  Other     ██   5%

           │
           ▼
  GST / payout summary (per month, newest first)
  ──────────────────────────────────────────────────────
  Period    Gross    GST     Net     Fees*   Payout
  May 26    $640    $58.18  $581.82  $18.99  $562.83
  Apr 26   $2,050  $186.36 $1,863.64 $60.58 $1,803.06
  ...

  * Stripe fee estimate: 2.9% + $0.13 per transaction (Aus domestic)
    Formula: gross × 0.029 + 0.13
```

---

## Going Live

### Required environment variables

```
  .env.local (or Vercel / hosting env vars)
  ──────────────────────────────────────────
  STRIPE_SECRET_KEY=sk_live_...            # server only — never expose
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...  # safe for browser
```

### Checklist

```
  [ ] Set STRIPE_SECRET_KEY (live key)
  [ ] Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (live key)
  [ ] Each school admin completes Stripe Connect onboarding
        Admin → Settings → "Connect Stripe" button
  [ ] Verify chargesEnabled = true for each school
  [ ] Verify payoutsEnabled = true for each school
  [ ] Test a $1.00 live payment end-to-end
  [ ] Confirm order appears in Admin → Orders board
  [ ] Confirm payment appears in Stripe dashboard
```

### Stripe dashboard links (live)

| What | Where |
|---|---|
| All payments | Stripe Dashboard → Payments |
| A specific order | Search by `pi_xxx` (the `stripePaymentIntentId` from DB) |
| School payouts | Stripe Dashboard → Connect → Accounts → select school |
| Refund a payment | Stripe Dashboard → Payments → find payment → Refund |
