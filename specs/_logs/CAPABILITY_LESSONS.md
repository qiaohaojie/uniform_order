# Capability Lessons

> Append-only log of **reusable** capability insights from gq-spec builds.
> Project-only decisions stay in DECISION.md. The build skill Persist step writes
> here via .gq-spec/log-capability-lesson.sh, then promotes to the Obsidian
> capability doc library (vault 0010 index) when the machine-local path resolves.
>
> Path resolution (portable): GQ_CAPABILITY_DOCS_DIR env, then gitignored
> .gq-spec/capability-docs-path. Never hard-code Mac/Windows absolute paths in git.
>
> Entry fields: docId · kind (works|fails|note) · status (provisional|verified) · milestone

## Drizzle columns that are nullable or have .default() stay optional on insert, so existing insert sites typecheck after additive schema fields.
- **ID:** 301534e5-8645-4536-b814-04dd15fb1e45
- **Date:** 2026-09-06T14:03:45Z
- **DocId:** 0300
- **Kind:** works
- **Status:** verified
- **Milestone:** M01
- **Project:** uniform_order
- **Version scope:** drizzle-orm ^0.45.2; TypeScript 6.0.3; Next.js 16.2.4
- **Detail:** Adding gst_free boolean notNull default false plus nullable uuid/text on order_lines did not require editing POST /api/orders. Keep additive history columns optional/defaulted rather than required on insert.
- **Evidence:** apps/web/src/db/schema.ts orderLines gstFree/prelovedSkuId/condition; implement summaries: pnpm check-types:web (tsc --noEmit) exit 0 without order insert edits.
- **Links:** specs/milestones/M01-preloved-foundation.md

## z.number().gt(0) then Number#toFixed(scale) into numeric(p,s) accepts values that persist as 0.
- **ID:** 90124d95-fe0a-437e-809b-c65c77aca06f
- **Date:** 2026-09-06T14:03:45Z
- **DocId:** 0300
- **Kind:** fails
- **Status:** verified
- **Milestone:** M01
- **Project:** uniform_order
- **Version scope:** zod ^4.4.3; Postgres numeric(4,2); JS Number#toFixed
- **Detail:** Validate at persistence scale: round with the same toFixed(s) used to write, then require rounded >= 10^(-s) and <= max. HTML min and Zod gt(0) are not a store bound.
- **Evidence:** 0.001 and 0.004 passed gt(0).lte(2) and stored as 0.00 via toFixed(2). roundPriceFractionOfNew + isPersistablePriceFractionOfNew now reject them and accept 0.005 as 0.01 (apps/web/src/lib/preloved.ts; Zod transform+refine on PATCH).
- **Links:** specs/milestones/M01-preloved-foundation.md

## One shared round-then-bound helper must own numeric(p,s) writes across Zod, the upsert helper, and the client.
- **ID:** c97ecdf9-635e-4907-ad87-6d6e750cead5
- **Date:** 2026-09-06T14:03:45Z
- **DocId:** 0300
- **Kind:** works
- **Status:** verified
- **Milestone:** M01
- **Project:** uniform_order
- **Version scope:** zod ^4.4.3; drizzle-orm 0.45 numeric; neon-http
- **Detail:** Duplicating toFixed(2)+bounds reintroduces drift. upsertPrelovedSettings still throws RangeError after rounding if the helper is bypassed, so a bad direct call cannot write 0.00.
- **Evidence:** roundPriceFractionOfNew / isPersistablePriceFractionOfNew in apps/web/src/lib/preloved.ts wired from PatchSchema, upsertPrelovedSettings, and the settings client.
- **Links:** specs/milestones/M01-preloved-foundation.md

## OR-ing isUniqueConstraintError(err, NAME) with a nameless 23505 match makes the named check dead and remaps any unique violation, including PK.
- **ID:** 10227f42-a289-42b6-99c7-adef93320c3b
- **Date:** 2026-09-06T14:03:45Z
- **DocId:** 0300
- **Kind:** fails
- **Status:** verified
- **Milestone:** M01
- **Project:** uniform_order
- **Version scope:** Postgres 23505; drizzle-orm 0.45.x; @neondatabase/serverless neon-http (NeonDbError.constraint since 0.9.3)
- **Detail:** isUniqueConstraintError(error) with no name is true for every SQLSTATE 23505. Use only the named constraint. NeonDbError.constraint exists; sibling callers already pass the constraint name.
- **Evidence:** apps/web/src/lib/db/unique-constraint.ts; insertPrelovedSku now calls only isUniqueConstraintError(err, PRELOVED_SKU_UNIQUE_CONSTRAINT). Named-only also in queries.ts and tenant legal-version actions.
- **Links:** specs/milestones/M01-preloved-foundation.md

## neon-http single-row upserts do not need db.batch; insert().onConflictDoUpdate().returning() is enough.
- **ID:** 3d54f3a5-8eb7-448e-aaa0-627634266705
- **Date:** 2026-09-06T14:03:45Z
- **DocId:** 0300
- **Kind:** works
- **Status:** verified
- **Milestone:** M01
- **Project:** uniform_order
- **Version scope:** drizzle-orm 0.45 + neon-http (no db.transaction)
- **Detail:** db.batch is required for multi-statement writes because neon-http has no interactive transactions. Wrapping one insert in BatchItem only adds types and a SELECT-merge with no extra safety. Write only patched columns so omitted fields keep DB defaults on first insert and stay unchanged on conflict.
- **Evidence:** apps/web/src/db/preloved-queries.ts upsertPrelovedSettings: insert values {tenantId, ...columns} onConflictDoUpdate set {...columns, updatedAt} returning.
- **Links:** specs/milestones/M01-preloved-foundation.md

## When a later milestone owns a god-file queries module, put the new domain’s helpers in a sibling file and do not re-export through that barrel.
- **ID:** 1fd28052-7705-4ba1-b6d0-5dc3f2503690
- **Date:** 2026-09-06T14:03:45Z
- **DocId:** 0300
- **Kind:** note
- **Status:** provisional
- **Milestone:** M01
- **Project:** uniform_order
- **Version scope:** Next.js 16 App Router + Drizzle 0.45 neon-http
- **Detail:** File-DAG isolation beats appending to queries.ts. Callers import the new module; re-exporting retakes the contested file.
- **Evidence:** M01 exclusive write set was db/preloved-queries.ts + lib/preloved.ts so M02 can edit queries.ts; M03 also required preloved helpers out of reports/totals.
- **Links:** specs/milestones/M01-preloved-foundation.md

## Keep sellable stock on a pooled SKU unique (tenant, source item, size, condition) with qty_on_hand; do not add qty to catalogue variants.
- **ID:** ad6ce49a-0df8-452f-8206-dac61104dcc0
- **Date:** 2026-09-06T14:03:45Z
- **DocId:** 0300
- **Kind:** note
- **Status:** verified
- **Milestone:** M01
- **Project:** uniform_order
- **Version scope:** drizzle-orm 0.45 / Postgres / neon-http
- **Detail:** Uniqueness includes inactive rows so intake reuses the row instead of inserting after deactivate. Unique-partial-WHERE-active blocks a second insert. source item ON DELETE RESTRICT so live catalogue items with stock cannot be deleted. History lines may RESTRICT on SKU delete; audit events SET NULL so rejects survive without a SKU.
- **Evidence:** preloved_skus unique index tenant+item+size+condition; qty_on_hand CHECK >= 0; catalog_variants still id/itemId/label/price/sizes/active only.
- **Links:** specs/milestones/M01-preloved-foundation.md

## Feature settings that are not fulfilment/workflow belong on a 1:1 table; getters must return in-code defaults when the row is missing.
- **ID:** beb5d8e6-1fa3-4400-b3fa-53d96d203109
- **Date:** 2026-09-06T14:03:45Z
- **DocId:** 0300
- **Kind:** note
- **Status:** provisional
- **Milestone:** M01
- **Project:** uniform_order
- **Version scope:** Drizzle 0.45 neon-http; Zod 4 strict objects
- **Detail:** New tenants may lack a row until first save; migration backfill covers existing tenants only. Public types should omit unused future-phase columns; persist only the live patch fields and rely on DB defaults for omitted ones including unused enum/commission columns. API may store future enum values but must never write them until that phase.
- **Evidence:** tenant_preloved_settings PK tenantId; getPrelovedSettings in-code defaults when no row; PATCH Zod .strict() omits intakeMode/commissionBps; upsert never writes commission.
- **Links:** specs/milestones/M01-preloved-foundation.md

## When Drizzle snapshots stopped, hand-write SQL + journal idx; do not drizzle-kit generate a snapshot for one additive migration.
- **ID:** 1f52e4de-ae1f-493a-b406-c585d83c7171
- **Date:** 2026-09-06T14:03:45Z
- **DocId:** 0300
- **Kind:** note
- **Status:** verified
- **Milestone:** M01
- **Project:** uniform_order
- **Version scope:** drizzle-kit journal without snapshots after 0012
- **Detail:** Forgot journal entry = migrator skips the file. generate would churn unrelated snapshot JSON and can later try to recreate objects if snapshots stay stale.
- **Evidence:** apps/web/drizzle/0018_preloved_foundation.sql journaled as idx 18; snapshots stop at 0012; 0013–0017 were already hand SQL.
- **Links:** specs/milestones/M01-preloved-foundation.md

## Do not extend a public tenant GET/PATCH with operator-only settings; use a dedicated operator write route and the same session+tenant-access sequence as the sibling.
- **ID:** 32b8f658-f002-4462-8af3-5f51bc9a275d
- **Date:** 2026-09-06T14:03:45Z
- **DocId:** 0200
- **Kind:** works
- **Status:** verified
- **Milestone:** M01
- **Project:** uniform_order
- **Version scope:** Next.js 16 App Router; Neon Auth session helpers
- **Detail:** Refuse lists, tax flags, and unreleased-phase fields must not leak on a public GET. Zod .strict() on operator-writable keys 400s extra future-phase fields instead of storing them. Independent settings cards keep independent save endpoints so one save cannot mix schemas.
- **Evidence:** PATCH /api/tenant/[tenantId]/preloved: requireSessionUser + getTenant + ensureTenantAccess matching apps/web/src/app/api/tenant/[tenantId]/route.ts; no GET; PatchSchema.strict(); shop-details save path unchanged.
- **Links:** specs/milestones/M01-preloved-foundation.md

## On a page that already uses bespoke form chrome, match that chrome for a new card rather than introducing a second component system on one screen.
- **ID:** f7eeff52-91a7-4f9a-a1c9-27fbb853cb2b
- **Date:** 2026-09-06T14:03:45Z
- **DocId:** 0600
- **Kind:** note
- **Status:** provisional
- **Milestone:** M01
- **Project:** uniform_order
- **Version scope:** HeroUI OSS @heroui/react ^3.1.0; Tailwind CSS v4; repo OSS-only exception
- **Detail:** HeroUI OSS (or Pro) belongs on new screens or screens already on primitives. Mixing a Switch next to custom fulfilment toggles reads as a different product. OSS-only repos still must not pull Pro.
- **Evidence:** Admin settings is custom Tailwind (type-h2, rule borders, accent toggle). PrelovedSettingsSection reuses shop-details input/toggle/checkbox chrome; zero @heroui/react on that screen.
- **Links:** specs/milestones/M01-preloved-foundation.md

## Legal/tax opt-in controls need the exact confirmation copy beside the checkbox; hide unreleased-phase fields even if columns exist.
- **ID:** 46fffd89-94e4-4805-aba3-74ca11cbd996
- **Date:** 2026-09-06T14:03:46Z
- **DocId:** 0600
- **Kind:** works
- **Status:** verified
- **Milestone:** M01
- **Project:** uniform_order
- **Version scope:** Admin settings client; Zod PATCH bounds
- **Detail:** A warning at a recommended default is not a legal cap: UI may warn while the API still accepts a documented hard bound. Do not ship intake-mode or commission controls in a donation-only phase.
- **Evidence:** preloved-settings-section.tsx GST_FREE_COPY next to donatedGstFree; no intakeMode/commissionBps controls; copy states donation-only; UI warns above 0.50 while API allows 0.01–2.
- **Links:** specs/milestones/M01-preloved-foundation.md

