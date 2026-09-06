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

## Misc  ([decisions/misc.md](misc.md)) — 1
- 2026-09-06 · 2f31cd1c · onboard · HeroUI OSS only — this repo is open source
