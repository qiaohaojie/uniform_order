# Decision Index

> Fast lookup for `decisions/`. One scannable line per decision; full entries live in the
> shard files linked below. Rebuild this file with `node .gq-spec/reindex-decisions.mjs`.
>
> Grouped by milestone (M01, M02, …), plus **Design** (planning) and **Misc** (onboard/cleanup).

## Design  ([decisions/design.md](design.md)) — 2
- 2026-09-06 · e476bc31 · design · Preloved Phase 1 is donation-only
- 2026-09-06 · 42680fa4 · design · Preloved Phase 1 sequenced as M01–M06

## M01  ([decisions/M01.md](M01.md)) — 13
- 2026-09-06 · 52798c05 · build:M01 · Store preloved config in tenant_preloved_settings 1:1, not on tenants or workflow tenant_settings
- 2026-09-06 · c4ee5af3 · build:M01 · Preloved query helpers live in sibling files, not queries.ts
- 2026-09-06 · 7dd736d8 · build:M01 · Dedicated operator PATCH /api/tenant/:tenantId/preloved; shop-details save path unchanged
- 2026-09-06 · d412dc99 · build:M01 · Hand-write SQL migration 0018 + journal idx 18; no drizzle snapshot
- 2026-09-06 · 656b64f8 · build:M01 · intakeMode enum includes donation_and_consignment; Phase 1 never writes or shows it
- 2026-09-06 · 38b85195 · build:M01 · order_lines.preloved_sku_id is a nullable FK ON DELETE RESTRICT (drift from no-FK sketch)
- 2026-09-06 · 274121b6 · build:M01 · Preloved settings UI stays bespoke Tailwind like the rest of the settings page
- 2026-09-06 · a839c24a · build:M01 · Pooled SKU unique on (tenant, source item, size, condition) including inactive rows; qty only here
- 2026-09-06 · be2a1aa4 · build:M01 · refuse_list stored as jsonb string[] not native text[]
- 2026-09-06 · 3b96a603 · build:M01 · Intake events store item/size/condition plus accepted|rejected|written_off; DTO field is kind mapped to DB action
- 2026-09-06 · 9eccbc94 · build:M01 · SKU unique violations throw PrelovedSkuConflictError via the named constraint only
- 2026-09-06 · 8f116a7c · build:M01 · Price fraction warns above 0.50, hard-bounds 0.01–2 after round-to-2dp, shared helper across Zod/upsert/UI
- 2026-09-06 · 7c16c268 · build:M01 · upsertPrelovedSettings is a single insert().onConflictDoUpdate(); neon-http db.batch not needed for one row

## M02  ([decisions/M02.md](M02.md)) — 8
- 2026-09-06 · 0a07f8ba · build:M02 · Sale-time gstFree is live donatedGstFree AND a valid donated preloved SKU; never the client flag
- 2026-09-06 · a4d0101e · build:M02 · Extend PendingOrderLineSnapshot JSON with gstFree; no SQL migration
- 2026-09-06 · 68a3e6c5 · build:M02 · POST /api/orders recomputes gst from snapshot line flags; Stripe amount remains the total lock
- 2026-09-06 · cd2a2d73 · build:M02 · Reports add taxable + GST-free preloved columns; gross still includes GST-free sales
- 2026-09-06 · 419297f4 · build:M02 · M02 does not edit parent checkout UI or preloved-queries.ts
- 2026-09-06 · 4e203e56 · build:M02 · Preloved SKU price/name lookup is inlined in the PaymentIntent route
- 2026-09-06 · c047df59 · build:M02 · Shared GstReportRow + GST_REPORT_HEADERS in lib/gst-report.ts (drift from client-local CsvRow)
- 2026-09-06 · 23ee3c5b · build:M02 · Fail-closed PaymentIntent creation if the pending snapshot insert fails; plain insert, no onConflict

## M03  ([decisions/M03.md](M03.md)) — 6
- 2026-09-06 · bbe4b22a · build:M03 · Accept SKU upsert and accepted event run in one db.batch via INSERT…SELECT
- 2026-09-06 · 7ef0c42e · build:M03 · Refuse accept onto expired in-stock SKUs until write-off zeros qty
- 2026-09-06 · 3426375d · build:M03 · Hand-write SQL migration 0019 defect_note + journal idx 19; no drizzle snapshot
- 2026-09-06 · 1363642b · build:M03 · Skip SKU photos on M03; defect note is the inspection record
- 2026-09-06 · 349ef46e · build:M03 · Write-off records preloved_intake_events written_off only; no audit_events row
- 2026-09-06 · 4e507191 · build:M03 · drizzle insert().select() for intake events must list every table column in schema order

## M04  ([decisions/M04.md](M04.md)) — 5
- 2026-09-06 · 8b41c8d4 · build:M04 · Optional bag notes live in preloved_donation_notes; no SKU, listing, or operator inbox in M04
- 2026-09-06 · 693a7356 · build:M04 · Hand-write SQL 0020 + journal idx 20; no drizzle snapshot
- 2026-09-06 · bdc9d463 · build:M04 · TenantFooter is an async RSC that reads prelovedEnabled itself (drift from optional prop)
- 2026-09-06 · 891e6af9 · build:M04 · ACL preloved clause persists on a new legal version when preloved is on, with display-time fallback
- 2026-09-06 · 9eb26846 · build:M04 · Donate POST is public, visibility-gated, and IP-limited; no login, photo, price, or Stripe

## M05  ([decisions/M05.md](M05.md)) — 8
- 2026-09-07 · 7692e138 · build:M05 · Preloved PDP is /[tenant]/preloved/[skuId], not the new-item page.
- 2026-09-07 · 0315f28c · build:M05 · Preloved is a shop filter, not an ItemCategory.
- 2026-09-07 · ef9d09b6 · build:M05 · CartLine gains optional prelovedSkuId, condition, and qtyOnHand; merge and cap live in cart-store.
- 2026-09-07 · d13f715f · build:M05 · Parent shop SKU reads live in preloved-queries; admin listInStockPrelovedSkus stays as-is.
- 2026-09-07 · 565198f3 · build:M05 · GST display is derived from RSC donatedGstFree; never persist gstFree on CartLine.
- 2026-09-07 · d9ea0b05 · build:M05 · Playwright persists prelovedEnabled via PATCH, not the admin switch click.
- 2026-09-07 · b89ff2f1 · build:M05 · Dev CSP connect-src allows ws/wss; middleware skips /_next/.
- 2026-09-07 · a8708d49 · build:M05 · Allow 127.0.0.1 as a Next.js allowedDevOrigin so Playwright hydrates

## Misc  ([decisions/misc.md](misc.md)) — 1
- 2026-09-06 · 2f31cd1c · onboard · HeroUI OSS only — this repo is open source
