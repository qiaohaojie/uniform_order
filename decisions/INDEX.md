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

## Misc  ([decisions/misc.md](misc.md)) — 1
- 2026-09-06 · 2f31cd1c · onboard · HeroUI OSS only — this repo is open source
