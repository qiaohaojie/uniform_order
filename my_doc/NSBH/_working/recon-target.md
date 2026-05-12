# NSBH Shopify Store — Reconnaissance Report

**Target:** https://north-sydney-boys-uniform-shop.myshopify.com/
**Date of recon:** 2026-05-12
**Method:** HTTP fetches of Shopify storefront + JSON endpoints (`/products.json`, `/collections.json`, `/sitemap.xml`, `.js` product endpoints) + raw HTML inspection.
**Theme:** "Updated copy of Horizon" (Shopify `Horizon` theme, schema v3.5.1, theme_store_id 2481 — stock Shopify free theme released 2025).

---

## 1. Site map (linked list)

### Storefront URLs that resolve
- `/` — homepage
- `/collections/all` — 26 items, full catalog
- `/collections/winter` — Winter Uniform (14 products)
- `/collections/summer` — Summer Uniform (5 products)
- `/collections/sports-uniform` — Sports Uniform (9 products)
- `/collections/bags` — Bags (2 products)
- `/collections/stationary` — Stationery (2 products) [misspelled handle]
- `/collections/accessories` — Accessories (8 products)
- `/collections/most-frequently-bought` — Most Frequently Bought (16 products)
- `/cart` — cart page (renders empty-state during recon)
- `/search?q=…` — predictive + results search
- `/customer_authentication/redirect?locale=en&region_country=AU` — login (Shopify new customer accounts; legacy `/account/login` blocked by my fetcher but is redirect target)
- `/policies/privacy-policy`, `/policies/refund-policy`, `/policies/shipping-policy`, `/policies/terms-of-service`
- `/sitemap.xml`, `/sitemap_products_1.xml`, `/sitemap_collections_1.xml`, `/sitemap_pages_1.xml`

### URLs that 404
- `/pages/home` is the only entry in `sitemap_pages` (an auto-generated alias). **No `/pages/contact`, `/pages/about-us`, `/pages/faq`, `/pages/size-guide`, `/pages/contact-us`** — every standard CMS page returns 404.
- `/policies/contact-information` 404.
- No blog (sitemap_blogs is empty).

### Header navigation (parsed from homepage HTML, in order)
| Label | Destination |
|---|---|
| Log in | `/customer_authentication/redirect?locale=en&region_country=AU` |
| Home | `/` |
| Winter Uniforms | `/collections/winter` |
| Summer Uniforms | `/collections/summer` |
| Sports Uniforms | `/collections/sports-uniform` |
| Bags | `/collections/bags` |
| Stationery | `/collections/stationary` |
| All products | `/collections/all` |

### Footer (parsed)
Only the four policy pages. No "About", "Contact", "FAQ", social icons, or newsletter signup detected.

---

## 2. Page-by-page observations

### Homepage (`/`)
- Hero banner: school logo image (`North-Sydney-Boys-High-School.png`) + headline "North Sydney Boys High School Uniform Shop" + "Shop all" CTA → `/collections/all`.
- "Welcome to our store" announcement bar at top.
- One featured section: **"Most Frequently Bought"** product grid with a "View all" link to `/collections/most-frequently-bought`.
- No additional storytelling rows (no "Shop the look", "About the school", "Year 7 starter", testimonials, newsletter signup, Instagram feed, blog teasers).
- Very minimal Horizon-default layout.

### Collection pages
All 7 collections use identical scaffolding (no per-collection custom blocks beyond a short description on the three "Uniform" collections):
- **Filters present:** Availability (In stock / Out of stock) + Price slider only. **No year-level, gender, sport, or size filter.**
- **Sort:** Featured / Most relevant / Best selling / A-Z / Z-A / Date / Price.
- **Layout:** "Column grid" toggle (1-col vs 2-col on mobile, etc.). Active filters render as chips.
- "Sports Uniform" and "Winter Uniform" have HTML descriptions that act as policy text (e.g. "School sports uniform is to be worn on Wednesday for sport and during PE lessons. COMPULSORY: Sports Top with crest, Sports Shorts, Socks…").

### Product detail pages (sampled)
| Product | URL | Option axis | Variant count | Price | Body copy length |
|---|---|---|---|---|---|
| Senior Tie | `/products/senior-tie` | "Senior Tie long" (SENIOR 137CM / 147CM) | 2 | $20–$21 | 82 chars |
| V-neck Knit Jumper | `/products/jumper` | Size (10–26) | 9 | $80–$87 | 226 chars |
| Trousers | `/products/sample-uniform` | Size (10/64cm … Mens 8/102cm) | 12 | $60–$62 | 308 chars |
| School Backpack | `/products/school-backpack` | none (Default Title) | 1 | $95 | 292 chars |
| Swimming Briefs | `/products/swimming-briefs` | Size (28 XS … 38 XXL) | 6 | $45 | 0 chars |

PDP anatomy is **stock Horizon**:
- Image gallery (1–4 images per product; mostly single image. Garments shown on plain background or mannequin).
- Title, price (with "Sale price / Regular price" wrapper even when no sale).
- Single option selector — radio-style pills, never swatches (size is always a label, no colour anywhere).
- Quantity stepper (− / +).
- "Add to cart" button.
- Body description (1–3 short paragraphs; some say "Worn by year 11 and 12 only" or "Worn by Junior and Senior students during term 2 and 3").
- Boilerplate appears on every PDP: *"This item is a deferred, subscription, or recurring purchase. By continuing, I agree to the cancellation policy and authorize you to charge my payment method…"* — this is a Horizon theme default string being rendered erroneously on one-off products (config bug, not a real subscription).
- **No size guide, no fit notes, no "name tape" / "second-hand" / "preloved" feature, no related products, no reviews, no bundle/kit picker, no school-house badges, no Year-7-starter bundle, no stock counter, no low-stock warning, no "fitting appointment" CTA.**

### Cart (`/cart`)
- Empty state seen during recon: "Your cart is empty. Have an account? Log in to check out faster."
- No cart drawer detected in the page HTML for the homepage (Horizon supports it; not all themes enable it visibly).
- No order notes field, no gift wrap, no shipping estimate widget visible from the empty state.

### Checkout
- Not entered (no items in cart; observation only). Customer-accounts flow uses Shopify "new customer accounts" (`/customer_authentication/…`). Cart copy implies guest checkout *is* available ("Log in to check out faster" = optional).

### Search (`/search?q=…`)
- Predictive search is enabled (`predictive-search` element found in HTML).
- Empirical search relevance is **poor** (the catalog seems to lack standard tags/SEO content):
  - `q=blazer` → **0 results** (but the school sells a "Navy Jacket" — see Open Questions).
  - `q=size+12` → 10 results (matches variant labels).
  - `q=year+7` → 2 results (matches the few products that mention year levels in the body).
- Same In-stock/Out-of-stock + price filters apply.

### Account / Login
- Direct fetch of `/account/login` was blocked by my fetcher (DNS/sandbox issue, not 404), but the header link points to Shopify's new customer-accounts redirect endpoint (`/customer_authentication/redirect`). This means: passwordless email-OTP login (Shopify's 2024+ default for new accounts).

### Policies
- **Refund:** 14-day exchange/refund within term-time. Items must be unused/unworn/unwashed in original packaging.
- **Shipping:** "At this time, we do not offer shipping." **Collection-only.** No domestic or international shipping.
- **Privacy:** Standard Shopify boilerplate (last updated 2026-05-09). Mentions Shopify, ad partners, no specific tracking SDKs.
- **Terms of service:** Generic Shopify boilerplate.

### Help / FAQ / Contact
- **No FAQ page, no contact page, no about-us page exists** on the storefront. The only "contact" surface would be whatever is in policies or via the (unreachable) admin email. This is a real gap.

---

## 3. Product / catalog structure

### Catalog at a glance (from `/products.json`)
- **26 products total**, all under vendor `North Sydney Boys Uniform Shop`. No `product_type` set on any product; no `tags` on any product.

### Collection structure
- **7 collections**, split on **garment type + season** axis only (Winter / Summer / Sports / Bags / Stationery / Accessories) plus the curated "Most Frequently Bought".
- **No collections for: year level (Year 7, 11–12), gender, sport team, house, second-hand, kits, new arrivals, sale.**
- "Stationery" handle is misspelled `stationary` — minor SEO/UX defect.

### Variant axes seen across catalog
| Axis | Used by | Example values |
|---|---|---|
| Size (numeric AU size) | shirts/jumpers/jackets/shorts/hoody | 10, 12, 14, 16, 18, 20, 22, 24, 26 |
| Size (boy/men dual labelling with cm) | trousers / navy shorts | `Boys 10/64cm`, `Mens 5/87cm`, … (up to 12 variants) |
| Size (XS-XXXL with adult equivalent) | navy jacket, track pants, sport short | `XS (16)`, `M (20)`, `XXL (26)` |
| Tie length | senior/junior ties | `SENIOR 137CM` / `SENIOR 147CM` / `JUNIOR 127CM` / `JUNIOR 137CM` |
| Sock size | white/grey/sport socks | `3-7`, `7-11`, `2-8` |
| Belt size | belt | `70-75CM`, `80CM-85CM`, `90CM-95CM` |
| Swim brief size | swimming briefs | `28 (XS)` … `38 (XXL)` |
| Bag size | sports bag | `Small` / `Large` |
| None (Default Title) | tie-bar, prefect tie, cap, scarf, backpack, math sets, A4 book | n/a |

- **Option-name inconsistency** is rampant: `Size`, `size`, `Senior Tie long`, `Accessory size` are all used for the same conceptual axis. Six options pages would feel non-uniform to a parent shopper.
- **Pricing:** mostly per-product flat price; a handful have variant-level price bumps (jumper $80→$87 at larger sizes; trousers $60→$62; ties $20→$21). No bundle discounts, no quantity discounts, no compare-at prices observed.

### Stock / availability
- 25/26 products show `available: true` at the product level. Only **School Scarf** (`/products/school-scarf`) is fully out of stock.
- UI: Out-of-stock variants are still selectable in the option pills (Horizon default). No "low stock" surface.
- Collection page filter offers In-stock / Out-of-stock toggle.

### Imagery
- Single image per product is the norm (15/26 products have 1 image). A few have 2 (PDP front + back). Bag / backpack have 3–4. Math sets, A4 book, soccer shirt are missing alt-tag-quality imagery and many have white-background placeholder photography.
- No 360°, no on-model lifestyle imagery, no zoom annotations.

### Not present (notable gaps for a school uniform shop)
- No **size guide** page or PDF.
- No **second-hand / preloved** track.
- No **name tape / name labelling** add-on.
- No **kit / starter bundle** product (e.g. "Year 7 Starter Kit").
- No **gender / year-level / house** taxonomy.
- No **sport-team-specific** rows.
- No customer reviews, no Q&A.

---

## 4. Checkout & account flow

### Checkout
- **Guest checkout: appears allowed** (cart copy is "Log in to check out faster" — optional). Not directly confirmed without placing an order.
- **Shipping: none.** Collection from the school only (per shipping policy).
- **Payment methods:** **Could not be confirmed from public pages** — Shop Pay / Apple Pay / Google Pay / Afterpay regex matches all returned `false` on the homepage HTML. Express-pay buttons only render on cart/checkout pages, which I couldn't enter without items. Shopify default is at minimum Shop Pay + credit card. **TBD in deep-dive.**
- No appointment/fitting booking system detected anywhere.

### Account features (inferred — Shopify new customer accounts)
- Login via email OTP (passwordless).
- Standard "Order history" + "Profile" sections; no signs of a custom child/student manager, saved payment methods page beyond Shop Pay, or multi-child profiles.
- No on-site sign-up form (everything redirects to `customer_authentication/redirect`).

---

## 5. Detected third-party apps and integrations

Surprisingly **clean**. Only one external script reference in the homepage HTML:

| Detected | Source |
|---|---|
| Shopify Perf Kit 3.3.1 | `/cdn/shopifycloud/perf-kit/shopify-perf-kit-3.3.1.min.js` (first-party Shopify) |
| Shopify "new customer accounts" | `/customer_authentication/redirect` |
| Predictive search | Horizon theme native |

**Not detected** (regex scans on homepage HTML returned no hits): Klaviyo, Judge.me, Yotpo, Loox, Okendo, GemPages, Tidio, Gorgias, Zendesk, Intercom, Privy, Recharge, Bold, Afterpay/Clearpay, Apple Pay/Google Pay express buttons, pickup-availability widget. The store is essentially **stock Shopify Horizon theme + no third-party apps installed**.

---

## 6. Open questions / things needing deeper inspection

1. **Checkout payment options** — what actually renders at `/checkouts/c/…`? Shop Pay? Afterpay? Australian PayID? Need to add to cart and inspect.
2. **Cart drawer vs cart page** — does Horizon enable a side drawer here, or only the full-page cart? (HTML inspection inconclusive.)
3. **`/account/login` direct render** — could not fetch (sandbox network), but is it the legacy account flow or fully migrated to new customer accounts?
4. **Search relevance** — why does `blazer` return 0 results when there is a "Navy Jacket" worn as a blazer? Are synonyms/tags configurable? (Likely they have no synonym list installed.)
5. **Subscription-disclaimer copy on every PDP** — is this a theme bug or intentional? Looks like a misconfigured product setting.
6. **Sports / season collection product overlap** — "Most Frequently Bought" has 16 products vs 26 total. What's curated logic? Manual or "auto by sales"?
7. **Order confirmation surface** — only observable post-purchase; need to place a test order to capture email + thank-you page.
8. **Pickup logistics** — "collection only" but no page describes pickup hours, location, parent identification, or scheduling. Where does the parent learn?
9. **Returns workflow** — policy says 14 days but doesn't link to an RMA form or contact email. How does a parent initiate?
10. **Mobile/tablet rendering** — only desktop HTML inspected. Horizon is responsive; visual checks needed.

---

## 7. Suggested chunking axes for parallel deep-dives

Recommended split into **four parallel workstreams**, each ~equal in surface area:

1. **Catalog & PDP** — taxonomy, variant axes, imagery, descriptions, missing features (size guide / kits / second-hand / name-tape), search relevance. *Compare to our `lib/data.ts` CATALOG + `GarmentVector` schema.*
2. **Cart, checkout & post-purchase** — guest vs account checkout, payment methods, pickup logistics, returns/refund UX, confirmation surfaces. *Compare to our Stripe Connect + order-status flow.*
3. **Account & parent self-service** — login flow, order history, multi-child support (absent here), policy surfacing, FAQ/contact (absent here). *This is where our app has the biggest opportunity.*
4. **Theme/site polish, navigation, content** — homepage sections, footer, policy/FAQ pages, mobile responsiveness, on-site copy quality, broken-search/broken-search-synonym issues, third-party-app gap analysis. *Likely the lowest-effort gap to beat.*

Alternative axis: split on **"compulsory storefront" vs "school-specific affordances we should add"** — Workstreams 1+2 = parity, Workstreams 3+4 = differentiation.
