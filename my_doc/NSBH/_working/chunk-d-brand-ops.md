# Chunk D — Brand, IA, content, navigation, SEO + operator-tooling differentiation

**Target:** https://north-sydney-boys-uniform-shop.myshopify.com/ (stock Shopify Horizon theme, 26 products, no apps)
**Codebase:** `/Volumes/T7/georgeqiao/dev/uniform_order/`, deployed to **Hostinger Node.js** at `uniformorder.online` (NOT Vercel — codebase recon is wrong on this)
**Date:** 2026-05-12

Other chunks own catalog/PDP/search (A), checkout/payments/post-purchase (B), and account/self-service (C). This chunk covers the storefront wrapper around them — homepage IA, header/footer, policy pages, CMS pages, SEO, mobile/desktop posture, visual design, and the theme-vs-bespoke trade — and then flips to the **operator differentiation pillar** that is our biggest positioning advantage.

## Capability matrix

| Surface | NSBH (Horizon) | UniformOrder | Verdict |
|---|---|---|---|
| Homepage IA | Hero + MFB row | Tenant picker (no per-tenant home; catalog is the landing) | Different model, both fit-for-purpose |
| Header nav | 6 collections + login + all-products | Bottom nav (Shop/Orders), tenant top bar | We are mobile-first; they are desktop-first |
| Footer | 4 policy links only | None on tenant routes; sparse on root | **They beat us on policy discoverability** |
| Policy pages | 4 standard Shopify policies, plaintext | Privacy + Terms (platform-wide) + per-tenant Refund Policy (versioned) | We're ahead on refund per-tenant versioning |
| CMS pages (Contact / About / FAQ / Size guide) | None (all 404) | None | Tied — both gap |
| `sitemap.xml` / `robots.txt` | Shopify auto-generated, complete | **Not implemented** | **They beat us — real SEO gap** |
| `<title>` / OG / canonical / `generateMetadata` | Auto per page | Platform-wide root only; no per-tenant or per-PDP `generateMetadata` | **They beat us — real SEO gap** |
| Mobile responsiveness | Responsive at all viewports | Mobile-first 430px shell, **no desktop view of parent shop** | They render fine on desktop; we don't (parent side) |
| Visual design | Stock Horizon, white/blue links | Newsreader serif, parchment/paper/gold, oklch tenant accent | **We're dramatically ahead aesthetically** |
| Theme dependency | Stock free theme, no apps | Bespoke Tailwind v4 + HeroUI | We bear maintenance; they bear theme bugs (see §1.8) |
| Operator: Kanban | Generic Shopify admin | Pickup-specific 4-column board, batch print, "ready" email | **We are dramatically ahead** |
| Operator: audit log | None parent-facing | `audit_events` table + UI per order/per tenant | **We are dramatically ahead** |
| Operator: platform console | None (one school = one Shopify store) | `/platform` provision wizard, approval, branding editor, billing | **We are dramatically ahead** |
| Operator: branding editor | One school = one store | oklch accent + crest + refund policy per tenant | **We are dramatically ahead** |
| GST handling | Shopify computes/displays | 10% line included; tracked per-tenant in platform billing; CSV export | Tied on parent display; we win on operator reporting |

---

# Half 1 — Storefront / IA / content gaps

## 1.1 Homepage IA

- **What it is.** What greets a visitor at the root of the shop.
- **What they do.** Single hero (school crest + headline + "Shop all"), announcement bar, one "Most Frequently Bought" row, then footer. No upsell rows. (recon-target §2 Homepage)
- **What we do.** `app/page.tsx:1-72` is a **school picker** — logged-out users see a list of `getPubliclyListedTenants()`; logged-in users with one child get redirected to `/<tenant>`. Per-tenant landing at `/<tenant>` is the catalog itself (`app/[tenant]/page.tsx` — see Chunk A). There is no per-tenant homepage with hero / value-prop / pickup info.
- **Gap.** The picker is the right pattern for a multi-tenant platform, but **a parent who lands on `/<tenant>` from a school newsletter sees a product grid with no orientation, no pickup-hours banner, no "Year 7 starter kit" CTA, no school crest+motto header beyond the small one in `MobileShell`.** NSBH at least delivers a hero with the school name and a curated row.
- **Mitigation.** Add an optional per-tenant homepage at `/<tenant>` rendered only when `?landing=1` or first-time visitor (else go to catalog). Surface: crest, motto from `tenants.motto` (schema.ts:73), pickup info from `tenants.collectionInstructions` + `tenants.shopHours` (schema.ts:75-77), and a "Most ordered this term" row (drive from order history).
- **Impact.** Medium. The catalog-as-landing pattern is fine on mobile (parents are intent-driven) but feels naked when shared from a school link.
- **Priority.** Should.

## 1.2 Header / footer navigation

- **What they do.** Top header: Log in, Home, Winter, Summer, Sports, Bags, Stationery, All products. Footer: 4 policy links only. No social/newsletter/about. (recon-target §1 Header navigation, Footer)
- **What we do.** Parent routes use `MobileShell` (`components/mobile-shell.tsx:17` — `max-w-[430px]`). Bottom nav is Shop / Orders, top bar has tenant crest + back. No persistent footer on tenant routes; root `app/page.tsx` and `/privacy` / `/terms` have no footer either (the privacy page at `app/privacy/page.tsx:1-58` is bare `<main>`).
- **Gap.** Two distinct issues:
  1. **No category navigation in the parent shop.** Shopify exposes 6 collection links; we route everything through one catalog page with category chips inside it (Chunk A territory). For a parent looking for "just sports gear", their nav surface is more discoverable.
  2. **No persistent footer with policy links.** A parent buying through us has to dig for the refund policy (it lives at `/<tenant>/refund-policy` but isn't linked from cart/checkout/catalog). Shopify puts all four policies in the footer of every page.
- **Mitigation.** Add a `<TenantFooter>` to `MobileShell` with links to `/<tenant>/refund-policy`, `/privacy`, `/terms`, plus `tenants.shopEmail` and `shopHours`. Category nav is Chunk A.
- **Impact.** Medium-high — the missing policy footer is a real trust/compliance issue at checkout. ACL (Australian Consumer Law) expects refund policy to be easily findable.
- **Priority.** **Must** for the footer. Should for category nav (Chunk A may already cover via top-of-catalog chips).

## 1.3 Policy pages

- **What they do.** Standard Shopify boilerplate at `/policies/privacy-policy`, `/policies/refund-policy`, `/policies/shipping-policy`, `/policies/terms-of-service`. Last-updated 2026-05-09. (recon-target §2 Policies)
- **What we do.** Platform-wide privacy at `app/privacy/page.tsx:1-58` (well-written, hand-crafted, mentions Neon/Stripe/Resend/Hostinger). Platform-wide terms at `app/terms/page.tsx`. **Per-tenant refund policy** at `app/[tenant]/refund-policy/page.tsx:1-56`, backed by `tenant_legal_versions` table (`db/schema.ts:41-64`). Versioning is **wired**: each row stores `version`, `policyMode` (`text` | `url`), `policyText`/`policyUrl`, `aclAcknowledged`, `sellerOfRecordAcknowledged`, `declarantName`, `declarantRole`, `enteredByUserId/Email`, `createdAt`. `tenants.currentLegalVersionId` (schema.ts:90) points at the active version; the read flow at `refund-policy/page.tsx:23-31` fetches via `getTenantLegalVersion` (`db/queries.ts:1060`) and renders with declarant attribution+date.
- **Gap.** Three items:
  1. **No shipping policy.** NSBH has one ("collection only"). We have collection-only too but nowhere documented for parents at the platform level.
  2. **`<noindex>` on refund policy** (`metadata.robots.index = false` at refund-policy/page.tsx:9) is correct (it's per-tenant internal), but means the tenant's refund policy can never appear in search results — which is intentional but worth confirming with operators.
  3. **No "previous versions" surface.** The schema supports versioning; the UI only shows `currentLegalVersionId`. Operators may want to view history. Not a parent-facing gap.
- **Mitigation.** Add a top-level `/shipping` (or `/pickup`) page mirroring the privacy/terms platform style. Surface previous refund-policy versions in `app/platform/tenants/[id]/cards/legal-card.tsx` (already exists).
- **Impact.** Low for shipping (we already say "Pickup only" in checkout per Chunk B). High for the versioning advantage — see Half 2.
- **Priority.** Should for shipping page; Nice for version history UI.

## 1.4 Missing CMS pages — Contact / About / FAQ / Size guide

- **What they do.** None exist (recon-target §2 Help/FAQ/Contact). Every standard URL 404s.
- **What we do.** Same — none exist.
- **Gap.** Tied. But the **expectation** for a school uniform shop is higher than for a generic Shopify: parents want a phone/email/hours for the uniform shop, a FAQ ("what if it doesn't fit?"), and a size guide. NSBH's omission is a stock-theme oversight. Ours is a roadmap item.
- **Mitigation.** Two cheap wins:
  1. **Per-tenant Contact page.** `tenants` already stores `shopEmail`, `shopHours`, `address`, `collectionInstructions` (schema.ts:75-77). A `/<tenant>/contact` route rendering these four fields would beat NSBH instantly.
  2. **Per-tenant FAQ.** Could be a fifth `tenant_legal_versions.policyMode` value or a separate `tenant_pages` table. Lower priority.
  3. **Size guide.** `catalogItems.sizeGuide` is jsonb on schema (`db/schema.ts:105`) but unused in the UI — Chunk A territory.
- **Impact.** Medium. Contact info is critical for ACL trust.
- **Priority.** **Must** for Contact (data already exists, only the route is missing). Should for FAQ. Size guide is Chunk A.

## 1.5 SEO — sitemap, robots, canonical, metadata

- **What they do.** Shopify auto-generates `/sitemap.xml`, `/sitemap_products_1.xml`, `/sitemap_collections_1.xml`, `/sitemap_pages_1.xml`. Per-page `<title>`, OG, canonical from theme. (recon-target §1)
- **What we do.** Verified by reading and grepping:
  - `app/layout.tsx:28-31` — single platform-wide `<title>` = `"UniformOrder"` and `description = "Order your school uniform online"`. **No per-tenant override.**
  - **`generateMetadata` is used in exactly one place** in the entire codebase: `apps/web/src/app/[tenant]/refund-policy/page.tsx:7-10` (and only to set `robots: noindex`).
  - **No `apps/web/src/app/sitemap.ts` and no `apps/web/src/app/robots.ts` exist.** Verified — `find apps/web -name "sitemap*" -o -name "robots*"` returns nothing.
  - `next.config.ts` does set security headers (`async headers()` at line 70) but nothing SEO-related.
- **Gap.** This is **real, and bigger than it looks on a B2C marketplace.** A school sends out a newsletter link → parent clicks → fine. But:
  - Parents who Google "north sydney boys uniform shop online" find NSBH's Horizon storefront, **not us**, because we have no per-tenant `<title>`, no description, no sitemap entries, no canonical.
  - Catalog item pages have no `generateMetadata`, so a shared item link shows `"UniformOrder"` in iMessage/WhatsApp link previews — looks unbranded.
  - PostHog acquisition reports can't differentiate by tenant landing because there is no organic SEO surface to begin with.
- **Mitigation.** Three small files unlock most of the value:
  1. `app/[tenant]/layout.tsx` → add `generateMetadata` returning `{ title: '${tenant.name} Uniform Shop', description: '${tenant.motto ?? ...}', openGraph: { images: [logoUrl] } }`. The data exists; we just don't read it.
  2. `app/[tenant]/item/[id]/page.tsx` → add `generateMetadata` for PDPs (item name + tenant name).
  3. Add `app/sitemap.ts` (Next.js 16 file convention) that enumerates `getPubliclyListedTenants()` × public catalog items. Add `app/robots.ts` with `disallow: ['/admin', '/platform', '/auth']`.
- **Impact.** **High strategically** even though traffic is mostly newsletter-driven today. Shopify gets this for free; competing with them in search means we eventually need it. Also: noindex on `/admin/*` and `/platform/*` is a security/leakage concern today.
- **Priority.** **Must.** This is the single most concrete storefront gap in this chunk. ~4 hours of work.

## 1.6 Mobile responsiveness vs desktop coverage

- **What they do.** Horizon is responsive at every viewport. Same UI on desktop and phone, just reflowed. (recon-target §6 Open Question 10)
- **What we do.** Parent shop is **mobile-first hard-capped at 430px** (`components/mobile-shell.tsx:17` — `w-full max-w-[430px]`). On a desktop browser, the parent shop renders as a phone-shaped column in the middle of the page. Admin (`AdminShell`) and platform (`PlatformShell`) are desktop-oriented; only the **parent shop** is locked to 430px.
- **Gap.** Two angles:
  1. **A parent on a laptop sees a phone-shaped column.** This is jarring on first sight and may read as broken/cheap to a parent expecting a Shopify-like responsive store.
  2. **No way to share a "look at this big" view on a desktop screen** when sitting next to a child choosing sizes.
- **Mitigation.** Either (a) keep 430px but add a tasteful desktop "frame" treatment (parchment background, phone-mockup chrome — already half-there visually), or (b) selectively widen on `md:` breakpoint for catalog grids. Option (a) is consistent with the deliberate mobile-first positioning. Option (b) is more work.
- **Impact.** Medium. Most traffic is mobile by acquisition channel (school newsletter clicked on phone). But desktop is the most adversarial visual moment for first impressions.
- **Priority.** Should. Decision is design-led, not feature-led.

## 1.7 Visual design

- **What they do.** Stock Horizon — white background, blue links, system font, generic typography. The school crest is the only personality.
- **What we do.** Tailwind v4 `@theme` tokens (per CLAUDE.md): `--color-parchment` `#FAF6EE` page bg, `--color-paper` `#FDFBF6` cards, `--color-gold` `#B08A3E` accents, `--color-navy-deep` `#081A2D` admin sidebar, Newsreader serif + Inter sans. Per-tenant accent threaded as inline `style` (CLAUDE.md "Multi-tenancy"). `GarmentVector` (`components/garment.tsx`) renders bespoke product SVGs — no raster photography.
- **Gap.** None — we are **dramatically ahead** aesthetically. This is positioning material (see Half 2).
- **Impact.** High for differentiation. School parents perceive premium → school perceives prestige → schools choose us.
- **Priority.** Maintain. Don't dilute.

## 1.8 Theme / app dependency

- **What they do.** Stock Horizon theme + zero third-party apps (recon-target §5). Bug: the Horizon "subscription disclaimer" boilerplate renders on every PDP even though no product is a subscription — a theme misconfiguration their operator can't easily fix without a theme dev.
- **What we do.** Bespoke Tailwind v4 + HeroUI v3 (mostly bespoke; HeroUI installed but underused per CLAUDE.md "Design system").
- **Gap.** Different cost models:
  - **Their cost:** zero install/maintenance, but they inherit theme bugs (subscription disclaimer) and can't change behaviour. Adding "Year 7 Starter Kit" requires either a paid app or a theme dev.
  - **Our cost:** we own every pixel, but we also own every bug. We currently have **no test suite** (CLAUDE.md: `check-types` is the correctness gate); regressions slip easily.
- **Mitigation.** Lean into HeroUI v3 for new interactive elements (per CLAUDE.md guidance) to reduce bespoke-component drift. Continue using Playwright for visual regressions on the print stylesheet (already done — see commit `f577c6c test(print-qa): §3.7`).
- **Impact.** Low-medium. Maintenance burden is real but manageable at this scale.
- **Priority.** Nice (process). No code change required.

---

# Half 2 — Positioning: where we're ahead

The catalog parity story between us and a stock Shopify Horizon shop is a fair-fight — they win on SEO, we win on visual design, the rest is parity-able with a few weeks of work. The **real** story, and the one that should sit in every sales conversation with a head of school or business manager, is the operator side. Below are the five positioning pillars and the reasons a Shopify store cannot easily match them.

## Pillar 1 — Pickup-native order fulfilment

A Shopify admin treats every order as a shipment: the operator-side workflow assumes "fulfill and post". For a uniform shop where every order is **collected from a window on a Wednesday afternoon**, that's wrong shape. We built the workflow around pickup from day one. `apps/web/src/app/admin/[tenant]/orders/orders-board.tsx:33-35` defines a four-column Kanban — New → Packing → Ready → Collected — with single-click transitions, a per-card "Mark ready" CTA that auto-opens a pre-filled email to the parent at line 117-119, and a "Print pick slips" button on the topbar (`orders-page-client.tsx:58-69`) that prints **all New-status orders in one A4 batch run**. The print stylesheet is in `apps/web/src/index.css:79-113` (page size A4, 12mm margin, hides sidebar, expands `.print:full-page`). A Shopify operator picking through 25 orders prints them one at a time and tracks status on Post-it notes. Ours is a single click and a green column. **Why Shopify can't match this:** Shopify Plus apps can extend admin views but none of them know about "pickup at the school office" as a first-class concept. To get our flow on Shopify you'd commission a custom Shopify app (~$15k) per school. Put on the sales sheet: *"Batch-print 25 pick slips in one click. Operators trained in 10 minutes."*

## Pillar 2 — Platform console (multi-school onboarding)

Shopify's mental model is one store per merchant. To run NSBH and RGSH, the school district pays for two Shopify Plus seats and runs two theme deployments. We have `apps/web/src/app/platform/` (`layout.tsx:1-22` gates on `isPlatformAdminEmail`) with a six-step provision wizard (`platform/tenants/new/steps/step-1-identity.tsx` through `step-6-go-live.tsx`), per-tenant approval workflow (`tenants.platformApprovalStatus` enum at `db/schema.ts:85`), and a Stripe Connect onboarding pane (`platform/tenants/[id]/cards/stripe-card.tsx`). Provisioning a new school is a wizard, not a re-deployment. **Why Shopify can't match this:** by architecture. Shopify Markets multiplexes regions, not tenants. A "platform-of-stores" requires Shopify Plus + custom dev + manual store-by-store theme propagation. Put on the sales sheet: *"Onboard a new school in 30 minutes. We provision the storefront, Stripe Connect, branding and refund policy from a single wizard."*

## Pillar 3 — Per-tenant branding editor + versioned legal

Each school is its own brand: crest, accent colour, motto, refund policy. We treat all four as editable per-tenant data, not theme code. `apps/web/src/app/platform/tenants/[id]/cards/branding-edit-drawer.tsx:18-19` exposes `accent` and `logoUrl` as form fields; the accent uses `AccentPicker` and is **applied via inline `style={{ background: tenant.accent }}`** at render time (`orders-board.tsx:107`, `refund-policy/page.tsx:39`) — not via CSS variables — so multiple tenants can render side-by-side in the platform console without bleeding styles. Refund policy lives in the `tenant_legal_versions` table (`db/schema.ts:41-64`) with `policyMode: 'text' | 'url'`, ACL/seller-of-record acknowledgement flags, and declarant attribution (who said it, when, in what role) — when a school updates their policy we keep the previous one for compliance defense. The read path at `app/[tenant]/refund-policy/page.tsx:23-31` resolves the **current** version via `tenant.currentLegalVersionId` (`db/schema.ts:90`). **Why Shopify can't match this:** Shopify's policy pages are a single text blob with no versioning, no attribution, no per-customer-cohort defense ("I changed my refund policy on 1 Feb; this order placed 28 Jan inherits the old one"). To match, a school would need a third-party legal/policy app and a manual audit process. Put on the sales sheet: *"Each refund policy is signed, dated and version-controlled. When a parent disputes a refund in February for a December order, we can produce the exact policy text in force at purchase time."*

## Pillar 4 — Audit log (compliance and trust)

The `audit_events` table (`db/schema.ts:240-258`) records every operator action (status change, refund, policy update, branding edit) with `actorEmail`, `actorRole`, `action`, `targetType`, `targetId`, `payload` JSON, indexed three ways (`idx_audit_events_tenant_time`, `idx_audit_events_target`, `idx_audit_events_actor_time`). The order-detail page reads it via `loadOrderActivity` (`order-detail-actions.tsx` and `apps/web/src/lib/audit/load-order-activity.ts`); the platform tenant page reads tenant-scoped activity via `loadTenantActivity`. **Why Shopify can't match this:** Shopify has an order timeline but it's not exportable, not actor-attributed across roles, and not extensible to platform-level events (it has no concept of "platform admin approved this tenant"). For a school subject to NSW DoE procurement audits, our log is the difference between a 10-minute disclosure response and a 3-day forensic. Put on the sales sheet: *"Every operator action is logged, timestamped, and attributable. Audit-ready by default."*

## Pillar 5 — GST + remittance tracking per tenant

Shopify handles AU GST display for the parent. So do we (`apps/web/src/app/[tenant]/checkout/checkout-screen.tsx:137`, `apps/web/src/components/admin/pick-slip.tsx:209-217`). Where we diverge: we track GST as a stored `numeric(10,2)` field on each order (`db/schema.ts:146`) and surface remittable amounts per tenant in `app/platform/billing/` with a CSV export (`components/export-csv-button.tsx:20` — columns: Period, Gross sales, GST collected, Net (ex-GST), Stripe fees, Net payout). For a school treasurer who has to remit GST quarterly, that CSV is the BAS workpaper. **Why Shopify can't match this:** Shopify Reports has GST data but only at the merchant level; to roll up GST across multiple schools (the platform admin view) a district would need to export from each store and combine in Excel. Put on the sales sheet: *"BAS-ready GST and remittance export per school, per period, with one click."*

---

# Things they do we should NOT copy

- **Subscription disclaimer on every PDP.** A Horizon theme default rendering on one-off products. A bug, not a feature.
- **Misspelled `/collections/stationary`.** Their handle should be `stationery`. We don't have this problem because we don't use slugified user-typed handles.
- **No size guide.** It's a gap for them, but copying their *absence* is not the move — Chunk A should fix this.
- **No related products / no upsell rows on PDP.** Their omission. We may have a reason to leave them out (parents are not browsing — they're filling a list); see Chunk A.
- **Selectable out-of-stock variants.** Horizon lets you click an OOS size. We should not adopt this UX even if we get inventory later (which we won't per `MEMORY.md` "No inventory management").
- **Customer-side passwordless OTP only.** Their Shopify new-accounts is fine, but copying it would mean replacing our Neon Auth flow — Chunk C territory.

---

# Roadmap snippet — storefront-content parity (cheap wins)

Order is by impact-per-hour, not strict dependency.

1. **SEO basics** (~4h, **Must**)
   - Add `app/sitemap.ts` enumerating listed tenants × catalog items.
   - Add `app/robots.ts` disallowing `/admin`, `/platform`, `/auth`.
   - Add `generateMetadata` to `app/[tenant]/layout.tsx` (tenant name, motto, logo OG image).
   - Add `generateMetadata` to `app/[tenant]/item/[id]/page.tsx`.
2. **Per-tenant Contact page** (~2h, **Must**)
   - New route `app/[tenant]/contact/page.tsx` rendering `tenants.shopEmail`, `shopHours`, `address`, `collectionInstructions`. Data already exists (`db/schema.ts:75-77`).
3. **Tenant footer with policy links** (~3h, **Must**)
   - Add `<TenantFooter>` to `MobileShell` linking `/<tenant>/refund-policy`, `/<tenant>/contact`, `/privacy`, `/terms`.
4. **Platform Shipping/Pickup page** (~2h, Should)
   - `/shipping` (or `/pickup`) mirroring `/privacy` style. Explain pickup-only model platform-wide.
5. **Per-tenant homepage option** (~6h, Should)
   - Optional landing at `/<tenant>` (gated on first-visit or `?landing=1`) with crest, motto, pickup banner, "most ordered" row. Catalog moves to `/<tenant>/catalog` or remains at `/<tenant>` for return visitors.
6. **Desktop frame for parent shop** (~4h, Should)
   - Decorate 430px column with parchment background + subtle phone-frame chrome on `md:` breakpoint. Or selectively widen.
7. **Per-tenant FAQ** (~6h, Nice)
   - New `tenant_pages` table or extend `tenant_legal_versions` with a `'faq'` mode. Operator-editable.
8. **Refund-policy version history UI** (~3h, Nice)
   - Surface prior versions in `platform/tenants/[id]/cards/legal-card.tsx`. Schema already supports it.

Total Must work: ~9 hours. Total Should: ~12 hours. Total Nice: ~9 hours.

---

# Cited files (for synthesis chunk)

- `apps/web/src/app/page.tsx:1-72` — root tenant picker
- `apps/web/src/app/layout.tsx:28-31` — platform-wide title/description, only metadata in app
- `apps/web/src/app/[tenant]/layout.tsx:1-15` — slug validation only, no `generateMetadata`
- `apps/web/src/app/[tenant]/refund-policy/page.tsx:1-56` — per-tenant versioned refund policy reader
- `apps/web/src/app/privacy/page.tsx:1-58` — platform privacy page (bare `<main>`, no footer)
- `apps/web/src/app/admin/[tenant]/orders/orders-board.tsx:8,33-35,49-59,107-129` — Kanban + ready-email
- `apps/web/src/app/admin/[tenant]/orders/orders-page-client.tsx:17-69` — batch-print + email-parents topbar
- `apps/web/src/app/admin/[tenant]/orders/[orderId]/order-detail-actions.tsx:55-57` — refund UI state
- `apps/web/src/app/platform/layout.tsx:1-22` — platform-admin gating
- `apps/web/src/app/platform/tenants/new/steps/step-1-identity.tsx … step-6-go-live.tsx` — 6-step provision wizard
- `apps/web/src/app/platform/tenants/[id]/cards/branding-edit-drawer.tsx:18-19,105-145` — branding editor (accent + crest)
- `apps/web/src/app/platform/tenants/[id]/cards/legal-card.tsx`, `legal-edit-drawer.tsx` — operator-facing legal-version editor
- `apps/web/src/db/schema.ts:41-64` — `tenant_legal_versions` table (versioning + declarant attribution)
- `apps/web/src/db/schema.ts:67-93` — `tenants` table (`accent`, `logoUrl`, `motto`, `shopHours`, `address`, `collectionInstructions`, `currentLegalVersionId`)
- `apps/web/src/db/schema.ts:146` — `orders.gst numeric(10,2)`
- `apps/web/src/db/schema.ts:240-258` — `audit_events` table + 3 indexes
- `apps/web/src/db/queries.ts:1060-1073` — `getTenantLegalVersion`
- `apps/web/src/lib/audit/load-order-activity.ts`, `lib/audit/load-tenant-activity.ts` — audit log readers
- `apps/web/src/index.css:79-113` — print stylesheet (A4, hides admin chrome, expands pick slip)
- `apps/web/src/components/mobile-shell.tsx:17` — `max-w-[430px]` hard cap on parent shop
- `apps/web/src/components/admin/pick-slip.tsx:209-217` — per-slip GST line
- `apps/web/src/components/export-csv-button.tsx:20` — BAS-shaped GST CSV columns
- `apps/web/next.config.ts:70` — security headers (set; no SEO config)
- **Absent files (verified):** `apps/web/src/app/sitemap.ts`, `apps/web/src/app/robots.ts`, `app/[tenant]/contact/page.tsx`, `app/[tenant]/about/page.tsx`, `app/[tenant]/faq/page.tsx`, `app/shipping/page.tsx`, `app/about/page.tsx`
