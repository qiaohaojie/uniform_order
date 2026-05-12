# Chunk A — Catalog, PDP, variants, sizing & search

**Scope** — This chunk compares product surfaces only: how each side organises a 26-item uniform catalog into browseable groups, how variants and sizes are modelled and pickable, what the PDP shows beyond title+price, how imagery is sourced, what stock signals reach the buyer, and whether a search box exists. Out-of-scope (covered elsewhere): cart, checkout, payments, multi-child profiles, navigation/IA, account, content/policy pages.

## Capability matrix

| Capability | Target (NSBH Shopify) | Uniform Order | Gap | Priority |
|---|---|---|---|---|
| Top-level taxonomy | 4 season/type collections + 3 utility (Bags/Stationery/Most-Bought) | Fixed 6-category enum (Summer/Winter/Sports/Formal/Bags/Stationery) — single axis | Partial — UO can't ship cross-cuts (e.g. "Year 7 starter", "Sport") | Should-have |
| Variant axes | 1 axis per product, **inconsistent option names** ("Size", "Senior Tie long", etc.) | 1 axis per variant + nested `sizes[]` array; free-text `label` | UO model is richer but unaudited; both flat | Nice-to-have |
| Size guide on PDP | None | `sizeGuide` jsonb + collapsible table on PDP | UO ahead | n/a |
| Previous-size hint | None | "Riley wore size 14 last year" from order history | UO ahead | n/a |
| Image gallery | 1–3 raster images per PDP (single image typical) | 1 SVG `GarmentVector` per item, accent-coloured | Neither has lifestyle/on-model photography | Should-have |
| Stock indicators on PDP | OOS badge at variant level (still selectable) | None — `qty` field does not exist | Yes | Should-have |
| Out-of-stock filter on listing | Yes (Availability facet) | No | Yes | Nice-to-have |
| Price filter on listing | Yes (slider) | No | Yes | Nice-to-have |
| Sort options | 6 sort modes (Featured/Best/A-Z/Z-A/Date/Price) | None — fixed by `sortOrder` integer | Yes for parents | Nice-to-have |
| Admin sort/reorder UI | n/a | `sortOrder` column exists; **no drag/reorder UI** | Partial | Should-have |
| Product search | Predictive search with poor relevance | None implemented | Yes | Should-have |
| Subscription disclaimer bug | Renders on every PDP | n/a | UO ahead | n/a |
| Kits / Year-7 starter bundle | None | None | Tied gap, opportunity | Should-have |
| Second-hand / preloved track | None | None | Tied gap, opportunity | Nice-to-have |
| Name-tape / labelling add-on | None | None | Tied gap, opportunity | Nice-to-have |

---

### Collection / taxonomy structure

**What it is** — Target uses Shopify collections as the only browse axis: `/collections/winter` (14 products), `/collections/summer` (5), `/collections/sports-uniform` (9), plus utility collections `/collections/bags` (2), `/collections/stationary` (2, misspelled handle), `/collections/accessories` (8), and a curated `/collections/most-frequently-bought` (16). No tags, no `product_type` on any product (confirmed via `/products.json` and `/products/jumper.js`). Header navigation lists Winter / Summer / Sports / Bags / Stationery / All products.

**Why it matters** — Parents shop by occasion ("what does Riley need for Year 7?", "Wednesday sport kit") more than by season. A single-axis taxonomy can't express overlapping cuts (year level, gender, sport, house, new arrivals).

**Current state in Uniform Order** — `ITEM_CATEGORIES` is a frozen 6-value enum at `lib/schemas/catalog.ts:3` (Summer/Winter/Sports/Formal/Bags/Stationery) stored as `catalog_items.category text` at `db/schema.ts:102`. Parent shop renders these as a horizontal chip row via `CATEGORIES` at `lib/data.ts:302`, surfaced in `app/[tenant]/page.tsx:88-108`. No tag system, no secondary axis, no curated/featured collection concept.

**Gap** — **Partial.** UO and target are equivalent at v1 (single-axis browse), but neither can ship cross-cut merchandising. UO has one extra category (`Formal`) the target lacks.

**Proposed mitigation** — Add a `catalog_collections` table (id, tenantId, slug, name, kind: `category|featured|year-level|custom`, sortOrder, isVisible) plus a `catalog_item_collections` join table. Keep `category` as the required default axis for back-compat; collections become an additive layer. Surface in parent shop as a horizontal "Featured" row above the category chips on the catalog home, plus a "Year 7 Starter" deep-link slot. School admin gets a "Collections" tab next to Catalog where rows are hand-curated.

**Impact on existing app** — Two new tables + join, one new admin tab, one extra section on `app/[tenant]/page.tsx`. No migration risk to orders. Effort **M** (2–3 days).

**Priority** — Should-have. Single-axis works for 12-item launch catalogs; the bigger lift unlocks Year-7-Starter and seasonal merchandising once the parent base grows past one school.

---

### Variant axes & size systems

**What it is** — Target's `/products/*.js` payloads show four parallel option-name systems with inconsistent labels: `Size` (numeric AU 10–26 on jumper, swim sizes `28 (XS) … 38 (XXL)` on briefs), `Senior Tie long` (`SENIOR 137CM` / `SENIOR 147CM` on senior tie), `Title` (`Default Title` on single-variant items like backpack/scarf), and the trousers `Size` system that intermixes `10/64cm … 18/82cm` with `Mens 5/87cm … Mens 8/102cm`. The senior tie literally uses the option name "Senior Tie long" instead of "Size" — a config bug that ships to parents.

**Why it matters** — Inconsistent option names erode predictability ("why does this tie say 'Senior Tie long' but this jumper say 'Size'?"). The mixed boys/mens-cm system on trousers is information-rich but unexplained.

**Current state in Uniform Order** — `catalog_variants` (`db/schema.ts:113-121`) stores a single free-text `label text not null` (e.g. "Size 8", "Small"). Each variant is independently priced. The parent UI also nests a `sizes[]` array (`lib/data.ts` shape, surfaced in `interactive.tsx:153-172` as a 5-col grid of pill buttons) — sourced from the static `CATALOG` via `sizesForVariant()` at `db/queries.ts:907-917`. This is technically richer (variant → sizes is two-level), but `sizes` lives in static code not the DB. The `interactive.tsx:27` default-size pick uses the third entry, not "first available".

**Gap** — **No** — UO's two-level model is more expressive than target's. The shipped issue is that `sizes` lives in `lib/data.ts` not in `catalog_variants`, so non-launch tenants can't define their own size grids without a code change (TODO at `db/queries.ts:904`).

**Proposed mitigation** — Add `sizes jsonb` column to `catalog_variants`. Migrate the existing static map. Expose in admin item drawer as a comma-separated input next to the label. No parent-side change required — `interactive.tsx` already reads from the same shape.

**Impact on existing app** — One additive column, one Drizzle migration, one admin drawer field. Read path is already in place. Effort **S** (½ day).

**Priority** — Should-have. Blocks self-serve catalog editing for cloned tenants beyond NSBH/RGSH; flagged in the platform-portal plan.

---

### Size guide on PDP

**What it is** — Target has zero size guidance. No `/pages/size-guide`, no fit-notes section on any PDP I inspected (verified jumper, swimming-briefs, trousers, senior-tie, school-backpack, school-scarf via `/products/*.js`). Description fields are 0–308 chars and contain only fit prose like "Model wears size 18".

**Why it matters** — Uniform sizing varies wildly between manufacturers; parents shopping online without a fitting appointment need chest/waist measurements to confidently pick.

**Current state in Uniform Order** — `catalog_items.sizeGuide jsonb` exists at `db/schema.ts:105` (shape `{unit, cols, rows}` — array of size×measurement). Surfaced on PDP as a "Size guide" toggle button at `interactive.tsx:85-95` and a collapsible measurement table at `interactive.tsx:121-147`. Currently populated for two items via `lib/data.ts:65, 79, 114`. **UO is ahead here.**

**Gap** — **No** — UO ships a real differentiator. The remaining work is coverage (only 2 of 12 NSBH items have a size guide) and an admin editor (`item-drawer.tsx` does not yet edit `sizeGuide`).

**Proposed mitigation** — Build a size-guide editor into `item-drawer.tsx`: column headers as comma-list, rows as a tabular grid with add/remove row buttons. Schools fill in for their high-volume items first (blazer, trousers, shirt).

**Impact on existing app** — Admin-only UI work. Effort **S** (½ day).

**Priority** — Should-have to fill coverage; the read path is already in production.

---

### PDP layout & content

**What it is** — Target PDP (stock Horizon theme) per the recon and confirmed in my fetches: hero image, title, price wrapper, single radio-pill option selector, qty stepper, Add to cart, body description (0–308 chars), and a Horizon-default subscription/recurring disclaimer string that renders on every one-off product (theme misconfig). No related products, reviews, badges, fit appointment CTA, or stock counter.

**Why it matters** — The PDP is the conversion surface for school uniforms — parents who landed on the wrong item should be able to pivot, and parents on the right item need confidence (fit, stock, last-year's-pick).

**Current state in Uniform Order** — `app/[tenant]/item/[itemId]/page.tsx:43-65` renders the RSC shell; `interactive.tsx` is the client island. Anatomy: back-arrow + cart icon (`PhoneNav` `interactive.tsx:216`), large `GarmentVector` (`page.tsx:50`), category chip + serif title + description (`page.tsx:54-62`), Fit selector with optional Size-guide toggle (`interactive.tsx:80-119`), Size pill grid (`interactive.tsx:152-172`), the **previous-size hint** ("Riley wore size 14 last year", `interactive.tsx:173-178`), and a sticky qty-stepper + Add-to-cart total bar (`interactive.tsx:182-211`). The previous-size hint is sourced from a real DB lookup against past order lines (`getPreviousSizeHint`, `db/queries.ts:427-467`).

**Gap** — **No, UO is ahead** — previous-size hint is a genuine differentiator; subscription-disclaimer bug is absent.

**Proposed mitigation** — Polish only: when no previous-size hint exists (new parent), surface the size-guide CTA more prominently so the empty state is not silent. Also consider showing a small "Worn in term 2 & 3" tag on items whose description contains a season hint — parses cleanly from the existing `description` column.

**Impact on existing app** — Pure UI tweak in `interactive.tsx`. Effort **S**.

**Priority** — Nice-to-have polish.

---

### Imagery norms

**What it is** — Target product images are mostly single raster shots on white background; jumper/scarf/swim-briefs all have 1 image, trousers has 3, backpack has 3 (`images` field confirmed in `.js` fetches). No on-model lifestyle, no 360°, no zoom. Many feel like phone snaps.

**Why it matters** — Single low-quality images are forgivable for a known uniform; for a parent confirming "is this the right crest?" they're marginal.

**Current state in Uniform Order** — `components/garment.tsx` renders SVG vector silhouettes keyed by item id, coloured with the tenant accent (`page.tsx:50`). Beautiful, consistent, and accent-themable — but unmistakably stylised, not photographic. `catalog_items.imageUrl text` exists (`db/schema.ts:104`) and is gated to UploadThing-hosted URLs (`lib/schemas/catalog.ts:18-23`), so the schema supports raster images, but no PDP code reads `imageUrl` today (`interactive.tsx` only renders `garment`).

**Gap** — **Partial.** Either approach (SVG-only or photos-only) leaves a confidence gap. Best result is both: hero photo + SVG fallback.

**Proposed mitigation** — Wire `item.imageUrl` into the PDP: when present, render as a `next/image` hero; when absent, fall back to `GarmentVector`. On the catalog grid, same fallback. Schools start photo-less, can upload as they go via the catalog admin (UploadThing route already gated by `platformApprovalStatus === 'approved'`).

**Impact on existing app** — Read `imageUrl` in `interactive.tsx` and `app/[tenant]/page.tsx` grid; add an upload field to `item-drawer.tsx`. No schema change. Effort **S** (1 day).

**Priority** — Should-have. Schools want their crest visible; SVG alone doesn't show the school logo.

---

### Product search

**What it is** — Target has Shopify's predictive search wired (`predictive-search` element in HTML, `/search?q=…` works). Relevance is poor: `q=blazer` returns 0 results despite a "Navy Jacket" being sold as a blazer (recon §2 evidence; no synonym list installed).

**Why it matters** — Parents arriving from email or Google often search by garment name. Zero-results on plausible terms is a confidence-killer.

**Current state in Uniform Order** — A search **input is rendered** on the catalog home (`app/[tenant]/page.tsx:78-86`) but it is a placeholder `<div>` — no input, no handler, no route. No `/search` route exists. No client-side filter on the catalog grid either.

**Gap** — **Yes.** The UI suggests search works; it doesn't. That's worse than no search at all.

**Proposed mitigation** — Either (a) remove the search field until v1.5, or (b) ship the cheapest viable version: a client-side `useMemo` filter on the already-fetched `catalog` array, matching on `name` + `description` substring. Catalogs are 12–30 items; client-side is fine. If keyboard-focused, expand the search box into a real `<input>` and filter the grid live.

**Impact on existing app** — Pure UI change in `app/[tenant]/page.tsx`. No backend. Effort **S** (½ day for client filter, half-day to remove the placeholder).

**Priority** — Should-have. The fake search box is a credibility bug.

---

### Stock indicators & inventory enforcement

**What it is** — Target shows OOS pills at variant level — jumper has 3 OOS sizes (`10`, `14`, `18`) that remain visible-but-unavailable in the size pills (confirmed in `/products/jumper.js`: `oosVariants: ["10","14","18"]`). School Scarf is fully OOS (`available: false`). Collection pages offer an "Availability: In stock / Out of stock" facet.

**Why it matters** — Parents shouldn't add an unavailable size to cart and discover it at checkout.

**Current state in Uniform Order** — Recon-app.md claimed `catalog_variants.qty` exists; **it does not.** Verified in `db/schema.ts:113-121` — only `id, itemId, label, price, active`. No stock column anywhere. `order_lines.qty` (`db/schema.ts:186`) is the purchase quantity, not inventory. No OOS rendering on PDP or catalog grid; checkout cannot block OOS additions. The product-level kill switch is `catalog_items.active` (`db/schema.ts:106`) and variant-level `catalog_variants.active` (`db/schema.ts:120`); the `getActiveCatalog` query filters out items with zero active variants (`db/queries.ts:926-947`).

**Gap** — **Yes.** No quantity tracking, no OOS surface. (CLAUDE.md / memory note "no inventory management" — out-of-scope explicitly.)

**Proposed mitigation** — Given the explicit no-inventory stance, lean into per-variant `active` as the OOS lever: admin toggles `active=false` on a sold-out size; PDP renders that size pill with strike-through and disabled state instead of hiding it (so parents see "we do stock 14, just not right now"). Match against the target's UX without adding a stock-counting system.

**Impact on existing app** — Show inactive variants in PDP read path (today they're filtered out of `getActiveCatalog`); render disabled. Schema unchanged. Effort **S** (1 day).

**Priority** — Should-have. Closes a real parent-frustration gap without violating the no-inventory rule.

---

### Sort order / merchandising on collection pages

**What it is** — Target offers 6 sort modes (Featured, Best selling, A-Z, Z-A, Date, Price) on every collection page. Featured is the school's manual order; the others are Shopify built-ins.

**Why it matters** — Parents often want price-ascending for budget shopping or alphabetical for paper-form parity.

**Current state in Uniform Order** — `catalog_items.sortOrder integer` exists at `db/schema.ts:107`. `getActiveCatalog` already sorts by it (`db/queries.ts:947`). The admin item drawer accepts a `sortOrder` field (`item-drawer.tsx:121`) but **there is no drag-to-reorder UI** in the catalog table (`catalog-table.tsx` greps clean — no DnD imports, no `move`/`reorder` handlers; only `sortOrder` as a passthrough at line 51). Parents have no client-side sort.

**Gap** — **Partial.** Admin reorder UI is missing; parent sort is missing.

**Proposed mitigation** — Two small wins. (1) Admin: add drag handles to `catalog-table.tsx` rows using `@dnd-kit/sortable` (HeroUI-compatible) and persist via PATCH `/api/catalog/[itemId]` with the new `sortOrder`. (2) Parent: defer; client-side filtering covers most needs and a sort dropdown is decoration on 12-item catalogs.

**Impact on existing app** — Admin DnD + a single API mutation. Effort **S** (1 day).

**Priority** — Should-have for admin (operator pain today); Won't-do for parent until catalogs grow.

---

### Filters on collection pages

**What it is** — Target collection pages expose two facets only: "Availability" (In stock / Out of stock) and a price slider. No size facet, no year-level, no gender, no sport. Sort dropdown sits next to filters.

**Why it matters** — On a 14-product page, two facets is plenty. On a 30+ product catalog it becomes thin.

**Current state in Uniform Order** — Five category chips at `app/[tenant]/page.tsx:88-108` are the entire filtering UI. No availability, no price, no size facet. The grid is a single category at a time, no "All".

**Gap** — **Partial.** Both sides under-filter; UO is also missing an "All items" view.

**Proposed mitigation** — Add an "All" chip in front of the category row that drops the `?cat=…` query param, plus the inactive-variant OOS rendering from the Stock section above (which gives parents enough signal without a facet). Defer price slider — schools curate to one band already.

**Impact on existing app** — One chip + a query-param tweak in `app/[tenant]/page.tsx`. Effort **S** (½ day).

**Priority** — Nice-to-have.

---

### Kits / starter packs / second-hand / name-tape

**What it is** — Neither side ships any of: Year-7 Starter Kit bundle, preloved/second-hand listing track, name-tape labelling add-on, sport-team-specific kit. Target has zero (`/products.json` shows 26 flat items, no `product_type`, no tags). UO has zero (no `bundleId`, no parent-side `kits` route, no `kit_lines` table).

**Why it matters** — Year-7 enrolment is the single biggest order moment for a school shop. A "Year 7 Starter — everything you need" SKU dramatically lifts AOV and parent confidence (one click vs eight). Second-hand listings are environmentally on-brand for many schools and surface a price-conscious channel. Name-tapes are a $5–$10 add-on with near-100% attach rate.

**Current state in Uniform Order** — None of the above modelled in `db/schema.ts`. Nothing in the parent flow.

**Gap** — **Yes (both sides).** This is the clearest greenfield opportunity in this chunk.

**Proposed mitigation** — Phase 1: starter-bundle as a pseudo-collection (no new tables, just a curated "Year 7" collection from the Taxonomy section above) where the PDP lists the required items as separate add-to-cart actions. Phase 2 (post-launch): a real `catalog_bundles` table (id, tenantId, name, items[]→{itemId, qty, defaultVariantId}) with a single Add-all-to-cart button. Skip second-hand/name-tape until v2 — they each have meaningful operational implications (consignment workflow, fulfilment).

**Impact on existing app** — Phase 1 piggybacks on the Collections proposal — no new work beyond curation. Phase 2 is **M** (bundle table + parent-side composer).

**Priority** — Should-have for Phase 1 (Year-7 collection); Nice-to-have for Phase 2 bundles; Won't-do for second-hand/name-tape this cycle.

---

## Things they do we should NOT copy

1. **The subscription/recurring-purchase disclaimer on every PDP.** It's a Horizon theme misconfig that renders "By continuing, I agree to the cancellation policy and authorize you to charge my payment method…" on one-off products. Parents reasonably worry their card will be charged again.
2. **Selectable out-of-stock variants on the size pills.** Target leaves OOS sizes clickable; the PDP only fails on Add-to-cart. UO should disable rather than hide, but never leave them addable.
3. **Inconsistent variant option names.** "Senior Tie long" as an option name where every other product says "Size" — a parent reading two PDPs back-to-back will second-guess. UO should enforce a controlled vocabulary on the option label (or just hide the option name in the UI as we already do — we render "Fit" / "Size" as section headers, not the variant's option name).
4. **Misspelled handle in URL** (`/collections/stationary` for Stationery). Minor SEO/UX defect.

## Where we're ahead

1. **Size guide on PDP.** Real `jsonb` column, real measurement table, real toggle UI — target has nothing.
2. **"Riley wore size 14 last year" hint.** Reads a parent's prior order history and surfaces the exact size for the active student. Target literally cannot do this without an app.
3. **Variant model is two-level** (variant `label` → `sizes[]`), so a single "Fit" variant can carry many sizes with one price. Target's flat one-axis model would represent the same product as 10–12 separate variants.
4. **Vector garment imagery is school-themable**. `GarmentVector` recolours every silhouette with the tenant accent — every NSBH item looks distinctly NSBH, every RGSH item distinctly RGSH. Target's raster photography ships the same image to every school.
5. **Subscription-disclaimer bug absent.** Our checkout doesn't lie about recurring billing.
6. **Snapshot semantics in order lines.** `order_lines.itemName`, `variantLabel`, `size` are snapshotted at order time (`db/schema.ts:182-187`), so renaming an item in the catalog doesn't rewrite history — Shopify does this too, but it's worth flagging that we already do.
