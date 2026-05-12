# Feature Gap Analysis — North Sydney Boys Uniform Shop vs. Uniform Order

**Date:** 2026-05-12
**Target site:** https://north-sydney-boys-uniform-shop.myshopify.com/
**This codebase:** `/Volumes/T7/georgeqiao/dev/uniform_order/` (deployed to Hostinger Node.js at `uniformorder.online`)
**Method:** parallel reconnaissance + four chunked deep-dives. Raw outputs in `_working/`.

---

## 1. Executive summary

1. **The competition is bare-bones, not formidable.** Target is stock Shopify "Horizon" theme (v3.5.1), **zero third-party apps**, 26 products in 7 collections. No size guide, no FAQ, no contact page, no about page — every standard CMS URL 404s. Search returns 0 for "blazer" despite a "Navy Jacket" being one. A Horizon theme bug renders a "subscription/recurring purchase" disclaimer on every PDP.
2. **This is an asymmetric gap analysis.** On parent-storefront cosmetics and SEO Shopify wins for free; on operator workflow, multi-tenancy, branding, GST/BAS, and audit defensibility we are dramatically ahead and they cannot match without bespoke development per school.
3. **Six real Must-haves before NSBH-grade go-live (~3 dev-days total).** Wallet payments (Apple Pay + Google Pay), guest checkout, email-env-vars on Hostinger, sitemap+robots+`generateMetadata`, tenant footer with policy links, per-tenant contact page. The first two are the only ones a parent could plausibly notice and abandon over.
4. **One credibility bug needs attention this week.** `app/[tenant]/page.tsx:78-86` renders a search-bar shaped `<div>` with no input and no handler — worse than no search at all. Either wire a 10-line client-side filter or remove it.
5. **Recon-app.md had three errors that need to be corrected in any downstream artifact.** (a) Deployment is **Hostinger Node.js**, not Vercel; (b) transactional email IS wired (Emailit via `lib/email/client.ts`), it just needs env-var + DNS confirmation on Hostinger; (c) `catalog_variants.qty` does not exist — there is no inventory column at all, consistent with the deliberate "no inventory management" stance.
6. **Five positioning pillars where we lead** — Pickup-native Kanban + batch A4 pick-slip print; the `/platform` provision-wizard + approval workflow; per-tenant branding + versioned legal (`tenant_legal_versions`); operator audit log (`audit_events`); GST/BAS CSV export per tenant. Each one requires bespoke Shopify dev per school to match.
7. **Two consumer-facing differentiators worth lead-line marketing.** Multi-child manager (`parent_children` table + active-child cookie propagated across catalog/cart/checkout) and **cross-tenant order history** under one parent login — Shopify's per-store accounts cannot do this by architecture.
8. **Stop building features the competitor needs.** Avoid: subscription-style boilerplate at checkout, selectable out-of-stock variants, customer-passwordless-OTP-only with no fallback, treating refunds as out-of-band manual workflow, evasive pickup-info ("details after order").
9. **Things to consciously skip.** No second-hand/preloved listings, no name-tape add-on, no live chat, no Apple Pay/Google Pay roadmap beyond the wallet swap — these are nice and the target doesn't have them either. Win on the operator pillars, not on storefront feature creep.
10. **One genuinely under-served structural area:** the Year-7 starter-kit and per-school curated collections. Both sides miss it; the school's biggest single-order moment of the year goes through 8 separate add-to-carts instead of one. Phase-1 as a curated collection, phase-2 as a real bundles table.

---

## 2. Target site overview

### 2.1 What kind of site is this

Stock Shopify "Horizon" theme (schema 3.5.1, theme store id 2481 — a free 2025 Shopify release). Vendor: "North Sydney Boys Uniform Shop". No third-party apps detected — homepage HTML grep returns zero matches for Klaviyo, Judge.me, Yotpo, GemPages, Tidio, Gorgias, Privy, Recharge, Bold, Afterpay/Clearpay. Only Shopify-first-party scripts load (Shopify Perf Kit 3.3.1, predictive search). Accounts use Shopify's 2024+ "new customer accounts" (passwordless email OTP).

### 2.2 IA & page inventory

**Header navigation:** Log in · Home · Winter Uniforms · Summer Uniforms · Sports Uniforms · Bags · Stationery · All products.

**Resolves:**

| URL | Notes |
|---|---|
| `/` | Hero (school crest + "Shop all") + announcement bar + "Most Frequently Bought" row |
| `/collections/winter` | 14 products |
| `/collections/summer` | 5 products |
| `/collections/sports-uniform` | 9 products |
| `/collections/bags` | 2 |
| `/collections/stationary` | 2 (handle misspelled — should be `stationery`) |
| `/collections/accessories` | 8 |
| `/collections/most-frequently-bought` | 16 (curated featured row) |
| `/cart` | Page-based; empty-state copy: "Have an account? Log in to check out **faster**" |
| `/search?q=…` | Predictive search enabled; relevance poor |
| `/customer_authentication/redirect` | Shopify new customer accounts (passwordless OTP) |
| `/policies/{privacy,refund,shipping,terms}` | Standard Shopify boilerplate |
| `/sitemap.xml` + 3 sub-sitemaps | Auto-generated |

**404s — every standard CMS page:** `/pages/contact`, `/pages/about`, `/pages/faq`, `/pages/size-guide`, `/policies/contact-information`. Footer contains only the four policy links — no contact, no social, no newsletter.

### 2.3 Catalog structure

- 26 products, all under a single vendor; **no `product_type`, no `tags`** on any product (verified via `/products.json`).
- 4 variant axes used inconsistently: `Size` (numeric AU 10–26), `Size` (boy/men dual cm labels on trousers — `Boys 10/64cm` … `Mens 8/102cm`), `Senior Tie long` (literal option name on senior tie), `Default Title` for single-variant items.
- No size guide, no fit notes, no swatches, no related products, no reviews, no kits, no second-hand, no name-tape. School Scarf is fully OOS; jumper has 3 OOS sizes that remain visually selectable.
- Stock signal: variant-level OOS badge (still clickable); collection-page "Availability" facet.

### 2.4 Checkout, payments, shipping

- **Cart:** page-based (drawer presence inconclusive). No order notes, no shipping estimator, no gift wrap. Cart copy implies guest checkout is allowed.
- **Payments (confirmed via `/payments/config`):** Apple Pay + Google Pay + card. **No Shop Pay, no PayPal, no Afterpay, no Klarna.**
- **Shipping:** "We do not provide postal, courier, or third-party delivery services." Collection-only. **No pre-purchase explanation of pickup hours, location, or rules** — policy says "details provided after your order."
- **Refunds:** 14 days, term-time, original packaging required. No RMA form, no link. Out-of-band only.

### 2.5 Account

- Email-OTP login via `/customer_authentication/redirect`. Standard Shopify order history. No multi-child / saved students. No saved address (Shop Pay would handle, but Shop Pay isn't enabled here).

---

## 3. Uniform Order — current state

### 3.1 Shape

Next.js 16 monorepo (`apps/web`, App Router + RSC + server actions). Postgres on Neon + Drizzle ORM (no transactions on neon-http — uses `db.batch()`). Neon Auth (email+password + verification + reset). Stripe Connect Standard (destination charges). UploadThing for crest/image upload. PostHog for events. HeroUI v3 + HeroUI Pro installed. Tailwind v4 with `@theme` tokens (parchment / paper / gold / navy + Newsreader serif). Deploy target: **Hostinger Node.js** (`uniformorder.online`).

### 3.2 Three portals

- **Parent shop** (`app/[tenant]/`) — mobile-first, hard-capped at 430px (`components/mobile-shell.tsx:17`). Catalog → item → cart → checkout → confirmation → my-orders. Bottom nav: Shop / Orders.
- **School admin** (`app/admin/[tenant]/`) — desktop sidebar. Dashboard / Orders Kanban / Catalog / Upload / Reports / Settings.
- **Platform console** (`app/platform/`) — super-admin only. Tenant list + KPIs, six-step provision wizard, approval workflow, branding editor, billing/GST, audit log.

### 3.3 Capabilities by stage

| Stage | What we have | Key files |
|---|---|---|
| **Browse** | 6-category enum filter, search-bar **non-functional placeholder**, `GarmentVector` SVG product imagery (accent-coloured), no `imageUrl` rendered yet on PDP | `app/[tenant]/page.tsx`, `lib/schemas/catalog.ts:3`, `components/garment.tsx` |
| **PDP** | Size guide table (jsonb-backed), "Riley wore size 14 last year" hint from order history, fit + size selector, qty stepper, sticky ATC bar | `app/[tenant]/item/[itemId]/page.tsx`, `interactive.tsx`, `db/queries.ts:427-467` (`getPreviousSizeHint`) |
| **Cart** | localStorage (`uo:cart:v1`), GST line, pickup-or-ship toggle (ship at $9.50), 500-char parent note (on checkout, not cart) | `lib/cart-store.ts`, `app/[tenant]/cart/`, `app/[tenant]/checkout/checkout-screen.tsx:485-499` |
| **Checkout** | Auth-gated (hard redirect to `/auth/sign-in`), Stripe `card` element only (no wallets), versioned refund-policy consent, GST display, atomic order creation via `db.batch()` + unique `stripePaymentIntentId` | `app/[tenant]/checkout/`, `api/stripe/payment-intent/route.ts`, `api/orders/route.ts` |
| **Post-purchase** | Success page with school hours, my-orders cross-tenant list, order-detail with `mailto:` to school | `app/[tenant]/order/placed/`, `app/orders/page.tsx`, `app/orders/[orderId]/order-detail-client.tsx:302` |
| **Email** | Emailit-wired (`lib/email/client.ts`); `OrderConfirmation` + `OrderReady` templates; idempotent stamps via `orders.emailsSent` jsonb | `lib/email/`, `db/schema.ts:157` |
| **Operator** | 4-column Kanban (new→packing→ready→collected), batch A4 pick-slip print, single + partial refunds via Stripe API (`reverse_transfer`), audit-logged | `app/admin/[tenant]/orders/`, `api/orders/[orderId]/refund/route.ts` |
| **Platform** | 6-step provision wizard, approval workflow, branding editor (oklch accent + crest), versioned legal editor, GST/BAS CSV export | `app/platform/`, `db/schema.ts:41-64,67-93,240-258` |
| **Data integrity** | Atomic order creation (`db.batch`), idempotent emails, `account.updated` webhook syncs Connect status, `charge.refunded` reconciles dashboard refunds, livemode guard on webhooks | `api/stripe/webhook/route.ts` |
| **Multi-tenant** | Tenant slug in route, FK constraints, browsing gate (`isPubliclyListed && platformApprovalStatus === 'approved'`), platform-admin bypass | `app/[tenant]/page.tsx`, `lib/auth/authorization.ts` |

### 3.4 Self-identified gaps (from `docs/remaining_work.md`)

Outstanding pre-launch: prod NSBH seed, RGSH catalog sign-off, Stripe Connect onboarding sync verification, live CSV bulk-import wiring, multi-operator RBAC. Outstanding post-launch: real-time order updates (currently polling), product search (real, not placeholder), bulk-upload CSV preview, parent invoice PDF export, parent multi-child UX (per recon-app — **but verification shows this is largely shipped**: `parent_children` table + home picker + cookie-based active child + REST CRUD all exist).

---

## 4. Side-by-side capability matrix

Consolidated across all four deep-dive chunks. Sorted by user journey.

| Capability | Target | Uniform Order | Gap | Priority |
|---|---|---|---|---|
| **Browse / catalog** ||||
| Multi-axis taxonomy (year-level / sport / kit) | No | No | Tied | Should |
| Garment-type collections | 7 collections | 6-category enum | Parity | — |
| Featured / curated collection | "Most Frequently Bought" (16 items) | None | Yes | Should |
| Product search | Predictive (poor relevance) | **Fake `<div>` placeholder** | Yes — credibility bug | Must (fix or remove) |
| Sort options (parent-side) | 6 modes | None | Yes | Nice |
| Availability filter | Yes | No | Yes | Nice |
| Admin reorder UI | n/a | `sortOrder` column, no DnD UI | Partial | Should |
| **PDP** ||||
| Hero imagery | 1–3 raster photos | SVG `GarmentVector` only | Different model; `imageUrl` column exists but unread | Should |
| Variant axis flexibility | Inconsistent option names | Two-level (`label` + `sizes[]`) | UO ahead | — |
| Size guide on PDP | None | jsonb + collapsible table | **UO ahead** | — |
| Previous-size hint | None | "Riley wore size 14 last year" | **UO ahead (headline)** | — |
| Stock indication | Variant pills + OOS badge | `active` flag; OOS hidden, not disabled | Partial | Should |
| Subscription-disclaimer bug | Yes (theme misconfig) | No | UO ahead | — |
| **Cart / checkout** ||||
| Cart surface | Full page | Full mobile page + parent note | Parity | — |
| Apple Pay / Google Pay | Yes (confirmed) | **No — card-only** | Yes | **Must** |
| Shop Pay / Afterpay / Klarna | No | No | Tied | — |
| Guest checkout | Yes | **No — hard redirects to sign-in** | Yes | **Must** |
| Pickup vs ship choice | Pickup only | Both ($9.50 ship) | UO ahead | — |
| Pickup info pre-purchase | "Details after order" | School hours on confirmation, not on cart | Partial | Should |
| GST display | Auto-Shopify | Server-calculated, 10% inclusive | Parity | — |
| GST server-side recompute & assert | Auto-Shopify | Client-supplied, stored as-sent | Partial | Should |
| Idempotent order creation | Auto-Shopify | `db.batch` + unique `stripePaymentIntentId` + UI lock | UO ahead | — |
| Webhook reconciliation | Internal Shopify | 3 events handled + livemode guard | UO equivalent | — |
| **Post-purchase** ||||
| Order confirmation email | Auto-Shopify | Emailit-wired + idempotent stamp | Parity in code; **needs env-var + DNS** in prod | **Must** (ops) |
| Operator refund UI | Shopify dashboard | In-app, partial, audit-logged, `reverse_transfer` | UO ahead | — |
| Partial-refund status | Shopify | First-class `partially_refunded` enum | UO ahead | — |
| `charge.refunded` reconciliation | n/a | Yes | UO ahead | — |
| Parent-initiated RMA | None (policy text only) | None | Tied | Nice |
| Versioned refund policy | Single blob | `tenant_legal_versions` + `orders.legalVersionId` pin | **UO ahead** | — |
| **Account / self-service** ||||
| Login | Passwordless OTP | Email + password | Target lower friction | Should |
| Multi-child / saved students | None | `parent_children` table + home picker + active-child cookie | **UO ahead (headline)** | — |
| Cross-tenant order history | Per-store only | One login → all schools | **UO ahead** | — |
| Saved sizes via order history | None | `getPreviousSizeHint` shipped | **UO ahead** | — |
| Saved payment methods | Implicit via Shop Pay (off) | None | Parity in practice | Nice |
| Account deletion / data export | Shopify GDPR admin | None | Yes | Should (within 90d for APP-12) |
| **Content / IA / SEO** ||||
| Homepage layout | Hero + featured row | Tenant picker (multi-tenant) | Different model | Should (per-tenant landing) |
| Header navigation | Collection links | Bottom nav (Shop/Orders) | Different model; we're mobile-first | — |
| Persistent footer with policy links | Yes | **None on tenant routes** | Yes | **Must** |
| Per-tenant Contact page | None | None (data exists, route missing) | Yes | **Must** |
| FAQ / About / Size guide page | None | None | Tied | Nice |
| `sitemap.xml` / `robots.txt` | Auto-Shopify | **None — verified absent** | Yes | **Must** |
| Per-page `generateMetadata` | Auto-Shopify | Single platform `<title>="UniformOrder"`; one use in entire codebase | Yes | **Must** |
| Mobile responsiveness | Responsive | 430px hard cap on parent shop | Partial — desktop view is a phone-column | Should |
| Visual design | Stock Horizon | Bespoke parchment/serif palette + per-tenant accent | **UO ahead** | — |
| **Operator differentiation** ||||
| Pickup-native Kanban | n/a (generic admin) | 4-column board + transitions | **UO ahead** | — |
| Batch A4 pick-slip print | n/a | One-click multi-page A4 | **UO ahead** | — |
| Platform console | n/a (one-store-per-merchant) | 6-step wizard + approval + branding + billing | **UO ahead** | — |
| Per-tenant branding | n/a | oklch accent + crest + motto + refund policy | **UO ahead** | — |
| Versioned legal w/ declarant | n/a | `tenant_legal_versions` w/ attribution + ACL ack | **UO ahead** | — |
| Audit log | n/a (Shopify timeline is shipment-shaped) | `audit_events` table + indexed 3 ways, surfaced per order + per tenant | **UO ahead** | — |
| GST/BAS rollup CSV | n/a | Per-tenant export | **UO ahead** | — |

---

## 5. Feature gap deep-dives

The deep-dives that landed at **Must / Should** priority appear here. Nice-to-haves are listed compactly in §8 (Roadmap → Later). Raw per-chunk reports — including all Nice items — are in `_working/chunk-*.md`.

### 5.1 Wallet payments (Apple Pay + Google Pay) — **Must**

**What it is.** Target's `/payments/config` (a public Shopify storefront JSON) confirms `applePayConfig.shopifyPaymentsEnabled: true` and `googlePayConfig.capabilities.environment: "PRODUCTION"`. Cart HTML grep for `afterpay|klarna|shoppay|paypal` returns zero. Conclusion: Apple Pay + Google Pay + card at checkout.

**Why it matters.** AU mobile parents are the dominant cohort (school-newsletter clicks on phones). Wallet-pay is one-tap with FaceID/fingerprint vs. typing a card number on a small screen. Conversion lever.

**Current state in Uniform Order.** `app/[tenant]/checkout/checkout-screen.tsx:90-102` mounts Stripe `elements.create("card", { hidePostalCode: true })`. The PaymentIntent route at `api/stripe/payment-intent/route.ts:75` already passes `automatic_payment_methods: { enabled: true }`, so Stripe could surface wallets — but `PaymentElement` is never instantiated, so wallets never render.

**Gap.** Yes. Target has wallets; we are card-only despite Stripe being configured for them.

**Proposed mitigation.** Swap `elements.create("card", ...)` for `elements.create("payment", { layout: "tabs" })`, replace `confirmCardPayment` with `stripe.confirmPayment({ clientSecret, elements, confirmParams: { return_url } })`. Place Apple Pay domain-verification asset at `public/.well-known/apple-developer-merchantid-domain-association`. Wallets ride the same PaymentIntent — destination-charge config unchanged.

**Impact.** Touches `checkout-screen.tsx` only. Add static asset to `public/`. Domain-verify with Apple via Stripe Dashboard. No DB change. Effort **M** (~1 day).

**Priority.** **Must.** The single most observable parent-side gap.

---

### 5.2 Guest checkout — **Must**

**What it is.** Target cart copy reads "**Log in** to check out **faster**" — optional. Shopify's new-customer-accounts lets parents complete payment without prior signup.

**Why it matters.** School-uniform parents shop once or twice a year. Forcing them to set a password to buy a $20 tie is the most common abandonment trigger; password-reset flows fail more often than they succeed for annual users.

**Current state in Uniform Order.** `app/[tenant]/checkout/page.tsx:13-16` calls `getSessionUser()` and **hard-redirects** to `/auth/sign-in?callbackURL=…` if null. `POST /api/orders` further enforces `normalizedParentEmail === authResult.user.email` (`route.ts:153-155`) and 403s on mismatch.

**Gap.** Yes — target allows guest; we hard-block.

**Proposed mitigation.** Soft onboarding: collect email on checkout, allow PaymentIntent creation + order placement without a session. On payment success, send a "Save this to an account" CTA in the receipt email (signed-link to `/auth/sign-up?email=…&claimOrder=…`). When the parent later logs in with the same email, retroactively bind the order via `orders.userId`. Guests view the single order through a signed-link receipt (HMAC of `orderId + parentEmail`, exp 30 days).

**Impact.** Remove `redirect()` in `checkout/page.tsx`. Loosen email-match assertion in `POST /api/orders` to allow `authResult.user === null`. Rate-limit by IP rather than user for guest path. Order-detail page needs a signed-link fallback. `orders.userId` is already nullable. Effort **M** (~1–1.5 days).

**Priority.** **Must.** Removes the second most likely abandonment cause and matches the competitor's posture exactly.

---

### 5.3 Transactional email — environment + DNS (verification) — **Must**

**What it is.** Order-confirmation and "ready for pickup" emails. recon-app.md incorrectly stated email delivery was unwired; verification shows otherwise.

**Why it matters.** A missed receipt creates panic ("did my $300 order go through?") and inbound contact volume.

**Current state in Uniform Order.** Fully implemented:
- Provider: **Emailit** via `lib/email/client.ts` (Bearer REST API, 5s timeout, 4xx-no-retry, 5xx-throw).
- Templates: `lib/email/templates/OrderConfirmation.tsx`, `OrderReady.tsx` (`@react-email/components`).
- Senders called from `api/orders/route.ts:291`, `api/stripe/webhook/route.ts:77` (idempotent via `orders.emailsSent` jsonb stamp), `api/orders/[orderId]/route.ts:112`.
- Dev fallback: missing `EMAILIT_API_KEY` logs to console and returns `dev-mode-id`.

**Gap.** None functional. Risk: if env vars are missing in production, emails silently console-log.

**Proposed mitigation.** Ops checklist for go-live (no code):
1. Set `EMAILIT_API_KEY` in hPanel → Advanced → Node.js → Environment Variables.
2. Set `FROM_EMAIL` (use `noreply@uniformorder.online`).
3. Set `NEXT_PUBLIC_APP_URL=https://uniformorder.online` — `requireAppUrl()` throws if missing (`lib/email/index.ts:17`).
4. Configure SPF + DKIM at the DNS level for `uniformorder.online` via Emailit's onboarding.
5. Restart the Node.js app.
6. Place a probe order against the platform-admin email; verify both `orders.emailsSent.confirmation` populates and the inbox arrives.

**Impact.** Pure ops. Effort **S** (~1 hour assuming DNS access is in hand).

**Priority.** **Must.** Code-complete; this is a release-readiness checkbox.

---

### 5.4 SEO basics — sitemap, robots, `generateMetadata` — **Must**

**What it is.** Target gets `/sitemap.xml` and three sub-sitemaps for free from Shopify, plus per-page `<title>`, OG, and canonical from the theme.

**Why it matters.** Two consequences today:
- A parent who Googles "north sydney boys uniform shop online" finds the Shopify storefront, not us.
- Catalog item links shared in iMessage/WhatsApp show the platform-wide title `"UniformOrder"` in link previews — looks unbranded.

Plus: `/admin/*` and `/platform/*` are not noindexed, which is a leak risk.

**Current state in Uniform Order.** Verified by reading and grepping:
- `app/layout.tsx:28-31` sets a single platform-wide title and description.
- `generateMetadata` is used in **exactly one** place across the entire codebase: `app/[tenant]/refund-policy/page.tsx:7-10` (and only to set `robots: noindex`).
- `app/sitemap.ts` and `app/robots.ts` **do not exist**.

**Gap.** Yes. Three small files unlock 80% of the value.

**Proposed mitigation.**
1. `app/[tenant]/layout.tsx` — add `generateMetadata` returning `{ title: '\${tenant.name} Uniform Shop', description: tenant.motto ?? '\${tenant.name} parent shop', openGraph: { images: [{ url: tenant.logoUrl }] } }`. Data exists in `tenants.motto` (`db/schema.ts:73`), `logoUrl` (`schema.ts:74`).
2. `app/[tenant]/item/[itemId]/page.tsx` — add `generateMetadata` for PDPs (`'\${item.name} — \${tenant.name}'`).
3. `app/sitemap.ts` — enumerate `getPubliclyListedTenants()` × public catalog items per tenant.
4. `app/robots.ts` — `disallow: ['/admin', '/platform', '/auth', '/api']`.

**Impact.** Three new files plus one `generateMetadata` addition. No DB change. Effort **M** (~4 hours).

**Priority.** **Must.** Cheap and addresses a real strategic gap; the admin-noindex correction is itself a security improvement.

---

### 5.5 Tenant footer with policy links — **Must**

**What it is.** Shopify themes (including Horizon) put all four policy links in the footer of every page. NSBH's footer is policy-only but at least present.

**Why it matters.** Australian Consumer Law expects the refund policy to be easily findable. Today our parents have to know to navigate to `/<tenant>/refund-policy` — not linked from cart, checkout (except as a checkbox label), catalog, or PDP.

**Current state in Uniform Order.** `components/mobile-shell.tsx` renders the parent shop wrapper. There is no `<TenantFooter>` and `app/privacy/page.tsx`, `app/terms/page.tsx` are bare `<main>` without a footer.

**Gap.** Yes. Refund policy data is rich (versioned `tenant_legal_versions` with declarant attribution) but invisible in the parent journey.

**Proposed mitigation.** Add a `<TenantFooter>` component to `MobileShell` (rendered above the bottom nav so it doesn't collide). Links: `/<tenant>/refund-policy`, `/<tenant>/contact` (see §5.6), `/privacy`, `/terms`. Plus the school's `shopEmail` and `shopHours` as text.

**Impact.** One new component, two-line addition to `MobileShell`. No DB change. Effort **S** (~3 hours).

**Priority.** **Must.** Compliance posture + cheap.

---

### 5.6 Per-tenant Contact page — **Must**

**What it is.** A page parents can reach pre-purchase to ask "do you have size 18?" — target has nothing of the kind anywhere on its site.

**Why it matters.** Trust + dispute deflection. Today `tenant.shopEmail` is surfaced only on order detail (`app/orders/[orderId]/order-detail-client.tsx:302`) and inside checkout (`checkout-screen.tsx:522`). A pre-purchase parent has no contact path.

**Current state in Uniform Order.** All data already exists on `tenants`: `shopEmail`, `shopHours`, `address`, `collectionInstructions` (`db/schema.ts:75-77`). The route is missing.

**Gap.** Yes (and also missing on target — we can leapfrog them with a single page).

**Proposed mitigation.** New route `app/[tenant]/contact/page.tsx` rendering the four fields. RSC; tenant fetched via existing `getTenant(slug)`. Link from `<TenantFooter>` (§5.5).

**Impact.** One new file. No DB change. Effort **S** (~2 hours).

**Priority.** **Must.** Trust signal + leapfrogs the competitor for two hours of work.

---

### 5.7 Search bar credibility bug — Must (fix or remove)

**What it is.** `app/[tenant]/page.tsx:78-86` renders a search-bar shaped `<div>` with placeholder text. There is no `<input>`, no handler, no `/search` route.

**Why it matters.** A non-functional search UI is worse than no search at all — it signals the rest of the product is also half-built.

**Proposed mitigation.** Option A (cheap): client-side `useMemo` filter on the already-fetched `catalog` array, matching `name + description` substring. Catalogs are 12–30 items; client-side is sufficient. Option B (cheaper): remove the placeholder until v1.5.

**Impact.** UI-only change in `app/[tenant]/page.tsx`. Effort **S** (~½ day for client-side filter; ~10 minutes to remove).

**Priority.** **Must** (one of the two options). The current state has been shipped and looks broken.

---

### 5.8 Stock signal on PDP — Should

**What it is.** Target keeps OOS variants visually present-but-selectable; we currently hide inactive variants entirely via `getActiveCatalog` (`db/queries.ts:926-947`).

**Why it matters.** A parent searching for a known size who can't see it represented at all isn't sure if it's discontinued or just out today. Memory note "no inventory management" stands — we won't add quantity tracking — but per-variant `active` is the right lever.

**Proposed mitigation.** Expose inactive variants in the PDP read path with a `disabled` flag; render the pill with strike-through + tooltip "Currently unavailable". Don't show on catalog grid count. Schema unchanged. Effort **S** (~1 day).

---

### 5.9 Shop hours on pickup option (pre-purchase) — Should

**What it is.** Target's pickup policy says "details after your order" — we surface school hours only on the success page. Cheap to expose pre-purchase.

**Proposed mitigation.** Read `tenant.shopHours` in `checkout/page.tsx`, thread to `CheckoutScreen`, replace the literal "Free · Ready in 1–2 school days" copy on the pickup `DeliveryOption` card (`checkout-screen.tsx:415`) with `tenant.shopHours` if set. Effort **S** (~1 hour).

---

### 5.10 Server-side total assertion — Should

**What it is.** Client supplies `subtotal`, `gst`, `total` to `POST /api/orders`; backend stores as-sent. The Stripe PaymentIntent uses `amount` from the client too. Tampering risk is low (Stripe ultimately governs cash flow) but it should be cleaned up before any BAS audit conversation.

**Proposed mitigation.** Helper `assertTotalsMatch({ lines, deliveryFee, subtotal, gst, total })` in `lib/order-totals.ts`; recompute server-side; reject 400 on >1¢ delta. Call from `POST /api/orders` and `POST /api/stripe/payment-intent`. Effort **S** (~2 hours).

---

### 5.11 `payment_intent.payment_failed` webhook handler — Should

**What it is.** Currently `pending_payment` order rows stuck after card failures aren't cleaned up. There's an acknowledged TODO at `refund/route.ts:176-178` for the audit-log gap on dashboard-initiated refunds.

**Proposed mitigation.** Add a `payment_intent.payment_failed` branch to `webhook/route.ts` that deletes or cancels the pending order. Add a `logAuditEvent` call in the `charge.refunded` branch with `actorRole: "system"`. Effort **S** (~3 hours).

---

### 5.12 Admin drag-to-reorder + size-guide editor — Should

**What it is.** `catalog_items.sortOrder` exists (`db/schema.ts:107`) and `getActiveCatalog` already sorts by it (`db/queries.ts:947`). The drawer at `item-drawer.tsx:121` accepts `sortOrder` as a numeric input, but there is **no drag-handle UI** on `catalog-table.tsx`. Similarly, `catalog_items.sizeGuide jsonb` is rendered on PDP but cannot be edited from admin — only seeded via `lib/data.ts`.

**Proposed mitigation.** Two combined wins:
1. Drag-to-reorder via `@dnd-kit/sortable` on `catalog-table.tsx` rows. Persist via PATCH `/api/catalog/[itemId]`.
2. Size-guide editor in `item-drawer.tsx` — column headers as comma-list, rows as a tabular grid with add/remove.

Effort **S** total (~1.5 days for both).

---

### 5.13 PDP imagery — photo + SVG fallback — Should

**What it is.** Target uses raster photos (1–3 per product, often phone snaps on white). We use `GarmentVector` SVG silhouettes coloured by tenant accent. `catalog_items.imageUrl text` exists in the schema (`db/schema.ts:104`, gated to UploadThing-hosted URLs via `lib/schemas/catalog.ts:18-23`) but is **never read** in the PDP — the PDP only renders `GarmentVector`.

**Why it matters.** SVG is beautiful but stylised; a parent confirming "is this the right crest?" wants a photo of the actual garment with the actual school crest stitched on. The cleanest result is both: `imageUrl` when set, vector fallback when not.

**Proposed mitigation.** Read `item.imageUrl` in `interactive.tsx` and `app/[tenant]/page.tsx` grid; render via `next/image` when present, fall back to `GarmentVector`. Add an upload field to `item-drawer.tsx` (UploadThing route already gated by `platformApprovalStatus === 'approved'`). Schools start photoless and upload as they go. Effort **S** (~1 day).

---

### 5.14 Catalog taxonomy — collections layer + Year-7 starter — Should

**What it is.** Both sides use a single-axis taxonomy (Winter/Summer/Sports/Bags/Stationery + a few utility) and neither supports overlapping cuts: year level, sport team, house, kit, second-hand. The single biggest order moment of the year — Year 7 enrolment — goes through 8 separate add-to-carts.

**Proposed mitigation.** Phase 1 (Should, ~3 days): add a `catalog_collections` table (`id, tenantId, slug, name, kind: 'featured'|'year'|'sport'|'custom', sortOrder, isVisible`) + `catalog_item_collections` join. Keep `category` enum as the default axis for back-compat. Render an optional "Featured" row above the category chips. Seed NSBH and RGSH with a "Year 7 starter" curated collection. Phase 2 (Later, separate): real `catalog_bundles` table with a single Add-all-to-cart button.

**Impact.** Two new tables + join, one new admin tab, additive UI on `app/[tenant]/page.tsx`. Effort **M** (2–3 days for Phase 1; bundles is **L** separately).

---

### 5.15 `sizes` column on `catalog_variants` — Should

**What it is.** UO's variant model is two-level: `catalog_variants.label` (the fit/style axis) + a per-variant `sizes[]` array. The sizes array currently lives in static `lib/data.ts`, not in the DB (TODO at `db/queries.ts:904`). Cloned tenants beyond NSBH/RGSH can't define their own size grids without a code change.

**Proposed mitigation.** Add `sizes jsonb` column to `catalog_variants`. Migrate the existing static map. Expose in admin item drawer as a comma-separated input next to `label`. Read path is already in place (`interactive.tsx` reads from the same shape). Effort **S** (~½ day).

---

### 5.16 OTP / magic-link login — Should (post-launch)

**What it is.** Target uses Shopify passwordless OTP via `/customer_authentication/redirect`. Parents log in once or twice a year — they'll forget any password they set in February by November.

**Proposed mitigation.** Check whether Neon Auth's `AuthView` (`app/auth/[[...path]]/page-client.tsx`) offers a magic-link or email-OTP path; if so flip the default and keep password as a fallback. Otherwise add "Email me a sign-in link" as a secondary action. Effort **S–M** depending on Neon Auth's surface (need to inspect the SDK).

**Priority.** Should (post-launch). Not a go-live blocker — reset flow works. Don't go OTP-only: every Year 12 mum has a flaky inbox.

---

### 5.17 Per-tenant homepage option — Should

**What it is.** Target has a hero with the school crest, name, and one featured row. We have a tenant picker at `/` and the catalog grid at `/<tenant>`. A parent landing on `/<tenant>` from a school newsletter sees a product grid with no orientation, no pickup banner, no "Year 7 starter" CTA.

**Proposed mitigation.** Optional landing rendered at `/<tenant>` on first visit (cookie-gated; subsequent visits go straight to catalog). Surfaces: crest, motto (`tenants.motto`), pickup banner (`shopHours` + `collectionInstructions`), and a "Most ordered this term" row driven from order history. Effort **M** (~6 hours).

---

### 5.18 Desktop frame for parent shop — Should

**What it is.** Parent shop is hard-capped at 430px (`mobile-shell.tsx:17`). On a desktop browser, it renders as a phone-shaped column floating mid-page — which reads as broken on first sight.

**Proposed mitigation.** Keep the 430px column but treat the surrounding desktop canvas as a parchment-backed "frame": subtle shadow, school crest faded into the corner, a "Tip: open on your phone for the full experience" line. Don't widen the catalog grid — the mobile-first thesis is core to the visual brand. Effort **M** (~4 hours).

---

### 5.19 Account deletion + data export — Should (within 90 days of launch)

**What it is.** APP-12 compliance and Apple/Google app-listing parity. Target uses Shopify's GDPR admin (parent-invisible). We have no parent-facing "Delete my account" or "Download my data" UI; `app/privacy/page.tsx` is text-only.

**Proposed mitigation.** Add a `/account` page with a "Danger zone" card: confirm-typed-email modal calls a Neon Auth deletion endpoint, then anonymises `orders.parentEmail/parentName` to `redacted-{hash}@uniformorder.online` (orders must remain for tax + refund traceability). `parent_children` cascades via existing FK. Data export: email a JSON of the parent's `parent_children` + `orders` on request. Effort **M** (~1 day).

---

## 6. Information architecture & product-attribute analysis

### 6.1 Taxonomy axes — both sides under-shape the catalog

Target uses Shopify collections as the only browse axis: garment-type-or-season on six links plus utility (Bags / Stationery / Accessories / Most Frequently Bought). Underlying data has no `product_type` and no `tags` (verified via `/products.json`). We use a frozen 6-value enum (`Summer/Winter/Sports/Formal/Bags/Stationery`) at `lib/schemas/catalog.ts:3`, stored as `catalog_items.category text` (`db/schema.ts:102`), surfaced as category chips on the catalog home (`app/[tenant]/page.tsx:88-108`).

**These choices are equivalent and equally constraining.** Neither supports overlapping cuts that map to real parent intent: year level, gender, sport team, house, kit, second-hand. The fix isn't to dilute the category enum (which carries weight in three places — `GarmentVector` switch, `getActiveCatalog` filter, bulk CSV) but to add a parallel `catalog_collections` layer (§5.14). Tags are technically richer but operationally messier; collections give curation control without ambiguity.

### 6.2 Variant axes — UO's model is structurally better, then under-exposed

Target's `/products/*.js` payloads show **four parallel option-name systems**: `Size` (numeric), `Size` (boy/men cm-dual), `Senior Tie long` (literal label), `Default Title` for single-variant items. The senior tie literally uses the option-name "Senior Tie long" instead of "Size" — a config bug that ships to parents. The trousers' `10/64cm … Mens 8/102cm` mix is information-rich but unexplained.

We have `catalog_variants.label text` + a nested `sizes[]` array (currently in `lib/data.ts`, see §5.15). That two-level model is more expressive than target's flat one-axis. The shipped flaw is that `sizes` lives in static code — non-launch tenants can't self-edit. Fix is one column + a comma-separated admin input.

### 6.3 PDP anatomy — both lean, ours is denser with real signal

Target PDP: image gallery → title → price → option pills → qty → ATC → 0–308 char description → errant subscription disclaimer. No size guide, no related products, no reviews, no fit notes.

Our PDP: back nav + cart icon → `GarmentVector` accent-themed → category chip + serif title + description → fit selector + size-guide toggle → size pill grid → **previous-size hint sourced from real order history** (`db/queries.ts:427-467`, surfaced at `interactive.tsx:173-178`) → sticky qty + ATC total bar. The size guide and the size hint are real differentiators — but coverage is partial (only 2/12 NSBH items have a size guide today) and the hint keys on `parentEmail + itemId`, not the active child — so a parent with two kids at the same school sees "whichever kid bought this last". The active-child fix is a follow-up paragraph in §5.4 of chunk C.

### 6.4 Imagery — neither approach is complete

Target: 1–3 raster photos per product, white-background, often phone snaps. We: SVG `GarmentVector` accent-coloured silhouettes. Each approach leaves a confidence gap. We have `catalog_items.imageUrl` in schema but never read it — see §5.13.

### 6.5 Filtering — both light, parent expectations are also light

Target collection pages: Availability + Price slider + 6 sort modes. Our catalog: 5 category chips (no "All"). For 12–30-item catalogs, two facets is plenty. Cheap wins: add an "All" chip (~½ hour) and the OOS-disabled-not-hidden rendering (§5.8).

### 6.6 Search

Target has Shopify predictive search; relevance is poor (zero hits for "blazer" against a "Navy Jacket"). We have a non-functional placeholder `<div>` (§5.7). Both effectively non-search; both should improve. On 30-item catalogs a client-side substring filter on `name + description` is fine.

### 6.7 Navigation posture

Target: desktop-first responsive (collection-link header + policy-link footer). Us: mobile-first hard cap at 430px with bottom nav (`Shop` / `Orders`). Different models, both intentional. Two issues: (a) no persistent footer with policy links on tenant routes (§5.5); (b) no desktop frame for a parent on a laptop — the 430px column reads as broken (§5.18).

### 6.8 Content depth — both miss; the bar is higher for school uniforms

Target 404s on `/pages/contact`, `/pages/about`, `/pages/faq`, `/pages/size-guide`. We don't have any of those routes either. The expectation for a school-uniform shop is higher than for a generic Shopify — parents want hours, contact, FAQ, sizing approach. §5.6 (Contact) is the single cheapest leapfrog; FAQ is a Later item.

---

## 7. Things they do that we should NOT copy

1. **Subscription / recurring-purchase disclaimer on every PDP.** Horizon theme default rendering on one-off products. Reads as "your card will be charged again" — a bug, not a feature. Their operator can't easily fix it without a theme dev.
2. **Selectable out-of-stock variants on size pills.** Target leaves OOS sizes clickable; the PDP only fails on Add-to-cart. Even if we never add inventory, render `active: false` variants as disabled, not hidden, but never clickable.
3. **Inconsistent variant option names.** "Senior Tie long" as an option name where every other product says "Size". A parent reading two PDPs back-to-back will second-guess. Enforce a controlled vocabulary on the option label.
4. **Misspelled handle in URL** (`/collections/stationary` for Stationery). Minor SEO/UX defect we don't have since we don't use slugified user-typed handles.
5. **"Details after your order"** — target's pickup-policy evasion. Show shop hours + collection address on the pickup option card *before* the parent commits (§5.9).
6. **Generic refund boilerplate.** Their refund page reads as template text. Cite the school name and link to a per-tenant contact email — we already do via `tenant.shopEmail`.
7. **Card-only payments.** Wallets are table stakes on AU mobile.
8. **Login wall before purchase.** Target's cart copy is "log in to check out **faster**", not "log in to check out". Match that posture (§5.2).
9. **Treat refund as an out-of-band manual workflow.** We have audit-logged partial-refund infrastructure; surface it.
10. **No size guide / no contact / no FAQ / no about.** Their omission. The expectation for a school-uniform shop is higher.
11. **Customer-passwordless OTP only.** OTP is great but every Year-12 mum has a flaky inbox — keep password as a fallback if we add OTP.
12. **Selectable OOS variants and lying receipt copy** — restated for emphasis; these are the two specific UX bugs that ship to parents on the target today.

---

## 8. Recommended roadmap

### Next sprint (Must-haves only, ~3 dev-days total)

Ordered by impact-per-hour. Total work: ~3 days dev + ~1 hour ops + DNS turnaround.

1. **Email env + DNS verify on Hostinger** — `EMAILIT_API_KEY`, `FROM_EMAIL`, `NEXT_PUBLIC_APP_URL` set in hPanel; SPF/DKIM at the DNS level; probe order; restart. **S, ops-only, §5.3.**
2. **Tenant footer with policy links** — new `<TenantFooter>` component on `MobileShell`. **S, ~3h, §5.5.**
3. **Per-tenant Contact page** — new `app/[tenant]/contact/page.tsx` reading `shopEmail/shopHours/address/collectionInstructions`. **S, ~2h, §5.6.**
4. **SEO basics** — `app/sitemap.ts`, `app/robots.ts`, `generateMetadata` on `[tenant]/layout.tsx` and `[tenant]/item/[itemId]/page.tsx`. **M, ~4h, §5.4.**
5. **Search-bar credibility fix** — wire 10-line client-side filter on `app/[tenant]/page.tsx` (or remove the placeholder). **S, ~½ day, §5.7.**
6. **Stripe `PaymentElement` swap → Apple Pay + Google Pay** — `checkout-screen.tsx:90`, plus apple-domain-association asset in `public/.well-known/`. **M, ~1 day, §5.1.**
7. **Guest checkout** — remove redirect in `checkout/page.tsx:13-16`, soften email-match in `POST /api/orders:153-155`, signed-link receipts for guests. **M, ~1.5 days, §5.2.**

### Next quarter (Should-haves, ordered by leverage)

- **Stock-disabled-not-hidden** on PDP (§5.8) — S
- **Shop hours surfaced pre-purchase** on pickup option (§5.9) — S, ~1h
- **Server-side total assertion** (§5.10) — S, ~2h
- **`payment_intent.payment_failed` webhook + audit-log on dashboard refunds** (§5.11) — S, ~3h
- **Admin drag-reorder + size-guide editor** (§5.12) — S, ~1.5d
- **PDP photo + SVG fallback** (`item.imageUrl` read path + UploadThing wired in `item-drawer.tsx`) (§5.13) — S, ~1d
- **Catalog collections layer** (`catalog_collections` table + Year-7 starter curation) (§5.14) — M, ~2–3d
- **`sizes jsonb` column on `catalog_variants`** (§5.15) — S, ~½d
- **Per-tenant homepage option** (`/<tenant>` cookie-gated landing) (§5.17) — M, ~6h
- **Desktop frame for parent shop** (§5.18) — M, ~4h
- **Platform Shipping/Pickup page** (`/shipping` mirroring `/privacy`) — S, ~2h
- **OTP / magic-link login option** (Neon Auth surface dependent) (§5.16) — S–M
- **Account deletion + data export** (APP-12 compliance, within 90 days) (§5.19) — M, ~1d
- **Active-child-scoped `getPreviousSizeHint`** (chunk C §4 follow-up) — S, ~1h

### Later (Nice-to-haves; only if a real demand signal appears)

- Parent-initiated refund/exchange request flow (new `order_refund_requests` table) — L
- Real catalog bundles (single Add-all-to-cart with a `catalog_bundles` table) — L
- Per-tenant FAQ (new `tenant_pages` table, operator-editable) — M
- Refund-policy version-history UI in `platform/tenants/[id]/cards/legal-card.tsx` — S
- Avatar/headshot for active child on PDP — S
- Per-tenant motto in catalog header — S
- Saved payment methods (Stripe `Customer` reuse, multi-tenant Connect complexity) — M
- Cart-level note (we have a 500-char note on checkout; cart-side is nice) — S
- Multi-operator RBAC (today single `tenant.shopEmail`; flagged in `remaining_work.md`) — L
- Real-time order updates via SSE (today polling, flagged in `remaining_work.md`) — M
- Bulk CSV catalog import live wiring (scaffolded today, flagged in `remaining_work.md`) — M

### Things to consciously skip

- Second-hand / preloved listings (consignment workflow has operational cost; neither side has it)
- Name-tape add-on (operational cost vs $5–$10 attach revenue)
- Live chat (operators don't want another inbox)
- Inventory management (explicit "no inventory" per `MEMORY.md`)
- Shop Pay / Afterpay / Klarna (target doesn't have them; AU schools generally dislike BNPL on kids' compulsory wear)
- Sale collections / compare-at prices (uniforms aren't promoted)

---

## 9. Where we're ahead — positioning pillars

This is the part of the report that should anchor sales conversations with heads of school and business managers. Each pillar is something a Shopify store cannot easily match — typically because it would require a custom Shopify app per school.

### Pillar 1 — Pickup-native operator workflow

Shopify admin treats every order as a shipment. For a uniform shop where every order is collected from a school office on a Wednesday, that's wrong-shape. Our `apps/web/src/app/admin/[tenant]/orders/orders-board.tsx:33-35` defines a four-column Kanban (New → Packing → Ready → Collected) with single-click transitions. `orders-page-client.tsx:58-69` prints all New-status orders as one A4 batch in one click; print stylesheet at `index.css:79-113`. `orders-board.tsx:107-129` triggers a pre-filled "ready for pickup" email. A Shopify operator does this with Post-it notes and one-by-one fulfilment clicks. **Sales sheet:** "Batch-print 25 pick slips in one click. Operators trained in 10 minutes."

### Pillar 2 — Platform console (multi-school onboarding)

Shopify's mental model is one store per merchant. Running NSBH and RGSH the Shopify way requires two Plus seats and two theme deployments. Our `app/platform/` (layout gated on `isPlatformAdminEmail`) ships a six-step provision wizard (`platform/tenants/new/steps/step-1-identity.tsx` through `step-6-go-live.tsx`), per-tenant approval workflow (`tenants.platformApprovalStatus`, `db/schema.ts:85`), and Stripe Connect onboarding pane. Provisioning a new school is a wizard, not a re-deployment. **Sales sheet:** "Onboard a new school in 30 minutes."

### Pillar 3 — Per-tenant branding + versioned legal

Each school is its own brand: crest, accent colour, motto, refund policy. We treat all four as editable per-tenant data, not theme code. Branding editor at `platform/tenants/[id]/cards/branding-edit-drawer.tsx`; accent applied via inline `style={{ background: tenant.accent }}` so two tenants can render side-by-side without bleeding styles. The `tenant_legal_versions` table (`db/schema.ts:41-64`) versions refund policies with **declarant attribution** (who said it, when, in what role), `aclAcknowledged` and `sellerOfRecordAcknowledged` flags. Each `orders.legalVersionId` pins the exact policy text in force at purchase time. **Sales sheet:** "When a parent disputes a refund in February for a December order, we produce the exact policy text in force at purchase time."

### Pillar 4 — Audit log (compliance and trust)

`audit_events` table (`db/schema.ts:240-258`) records every operator action with `actorEmail`, `actorRole`, `action`, `targetType`, `targetId`, `payload`, indexed three ways. Surfaced per order and per tenant. For a school subject to NSW DoE procurement audits, this is the difference between a 10-minute disclosure response and a 3-day forensic. Shopify's order timeline is shipment-shaped, not exportable, and has no concept of platform-level events ("platform admin approved this tenant"). **Sales sheet:** "Every operator action is logged, timestamped, and attributable."

### Pillar 5 — GST/BAS export per tenant

We track GST as a stored `numeric(10,2)` per order (`db/schema.ts:146`) and surface remittable amounts per tenant in `app/platform/billing/` with a CSV export (`components/export-csv-button.tsx:20` — Period / Gross / GST collected / Net / Stripe fees / Net payout). For a school treasurer remitting quarterly BAS, the CSV is the workpaper. Shopify Reports has GST data per store but no platform-level rollup across schools. **Sales sheet:** "BAS-ready GST and remittance export per school, per period, with one click."

### Parent-side differentiators (worth lead-line marketing)

- **Multi-child manager** (`parent_children` table at `db/schema.ts:218`, home picker, active-child cookie propagated server-side through catalog/cart/checkout, REST CRUD). Target has nothing.
- **Cross-tenant order history** under one login (`listOrdersForParent` joins on `userId` OR `parentEmail`, returns rows from every school). Shopify cannot do this by architecture.
- **"Riley wore size 14 last year"** size hint sourced from real order history (`db/queries.ts:427-467`). Target has zero size guidance.
- **Bespoke aesthetic** — Newsreader serif, parchment/paper/gold palette, oklch tenant accent. Target is stock Horizon (white background, blue links). The visual gap is dramatic and is what school decision-makers see first.
- **Idempotent order creation** — `db.batch` + unique `stripePaymentIntentId` + UI lock on payment-confirmed-but-order-failed. Hardened beyond what most Shopify stores expose.
- **Email idempotency** via `orders.emailsSent` jsonb stamp — prevents duplicate sends under webhook retries.
- **Connect account-status sync** — `account.updated` webhook keeps `tenants.stripeChargesEnabled` honest; PaymentIntent route refuses to issue if the school's account isn't ready. Better than Shopify's opaque "store unavailable".
- **Parent note** up to 500 chars at checkout, flows to the pick slip. Target has no equivalent.

---

## 10. Appendix — raw subagent outputs

The four parallel deep-dive reports (referenced throughout this synthesis) live in `_working/`:

- `_working/recon-target.md` — initial reconnaissance of the Shopify store (sitemap, page-by-page observations, third-party-app detection, open questions).
- `_working/recon-app.md` — initial inventory of the Uniform Order codebase. *Caveats: states "Vercel" — correct deploy target is Hostinger Node.js per `CLAUDE.md`; states email is "TBD" — correct status is Emailit-wired and code-complete; states `catalog_variants.qty` exists — it does not, no inventory column at all.*
- `_working/chunk-a-catalog.md` — catalog taxonomy, variants, sizing, PDP, imagery, stock signals, search, kits.
- `_working/chunk-b-checkout.md` — cart, checkout, payments, post-purchase, refunds, returns, webhooks.
- `_working/chunk-c-account.md` — account/login, multi-child, order history, saved sizes, contact channel, FAQ, transactional comms, privacy.
- `_working/chunk-d-brand-ops.md` — homepage IA, header/footer, policy pages, missing CMS pages, SEO, mobile/desktop, visual design, plus the five positioning pillars.

Each chunk file follows the same per-feature sub-structure (What it is / Why it matters / Current state / Gap / Mitigation / Impact / Priority) so they can be re-spliced into other artifacts (a roadmap doc, a sales sheet, a release plan) without re-doing the analysis.
