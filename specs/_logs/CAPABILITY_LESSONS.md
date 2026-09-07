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

## For GST-inclusive AUD carts, Stripe charges the total; remittable GST is 1/11 of the taxable base, not amount/11.
- **ID:** 6c14b796-20c0-4ca6-a840-2d08d01ddfb8
- **Date:** 2026-09-06T15:43:59Z
- **DocId:** 0400
- **Kind:** works
- **Status:** verified
- **Milestone:** M02
- **Project:** uniform_order
- **Version scope:** Next.js 16.2 / stripe ^22.1.0 / PaymentIntent amount in cents
- **Detail:** GST-free donated lines still add to subtotal/total. computeTotals uses gst = round2((taxableSubtotal + shipping) / 11) and omits only gstFree===true from the base; missing gstFree stays taxable so legacy carts match total/11. Shipping stays in the taxable base. After payment, orders.total/subtotal come from PaymentIntent.amount minus shipping; orders.gst is recomputed from snapshot line flags, not snapshot.gst and not authoritativeTotal/11.
- **Evidence:** apps/web/src/lib/order-totals.ts computeTotals; apps/web/src/app/api/orders/route.ts verifiedTotals; PI snapshot gstFree. Static AC: new-only gst=(subtotal+shipping)/11; mixed gstFree excluded from the 1/11 base.
- **Links:** specs/milestones/M02-mixed-cart-gst.md

## Stamp tax-exempt flags server-side at PaymentIntent creation from the live operator setting plus a resolved SKU; cancel the PI if the pending snapshot insert fails.
- **ID:** ef411b1f-7b68-4c6f-b15e-e042d510e26c
- **Date:** 2026-09-06T15:43:59Z
- **DocId:** 0400
- **Kind:** works
- **Status:** verified
- **Milestone:** M02
- **Project:** uniform_order
- **Version scope:** stripe ^22.1.0; Next.js 16 App Router
- **Detail:** Client gstFree is ignored and should not appear on the request line type. A line is GST-free only when prelovedSkuId resolves to an active tenant SKU and donatedGstFree is true at charge time — not a listing-time sku.gstFree copy. Persist gstFree/prelovedSkuId on pending_order_snapshots so POST /api/orders can recompute GST without a catalog re-read. If snapshot insert throws, cancel the PI (cancellation_reason abandoned) and return 500 without clientSecret. Swallowing insert failure left a payable PI whose order POST forced gstFree:false and GST=total/11.
- **Evidence:** apps/web/src/app/api/stripe/payment-intent/route.ts pricedLines + snapshot insert/cancel; apps/web/src/app/api/orders/route.ts computeTotals from snapshot. ClientOrderLine has no gstFree field.
- **Links:** specs/milestones/M02-mixed-cart-gst.md

## Stripe PaymentIntent metadata is not a reliable GST-free line carrier.
- **ID:** d2f70944-370e-4045-a45b-894898c325fa
- **Date:** 2026-09-06T15:43:59Z
- **DocId:** 0400
- **Kind:** fails
- **Status:** verified
- **Milestone:** M02
- **Project:** uniform_order
- **Version scope:** stripe ^22.1.0, Next.js 16.2.4
- **Detail:** Metadata values cap at 500 characters and 50 keys. A full pending-order line snapshot (item names, SKU UUIDs, gstFree, condition) overflows typical mixed carts. A flag-only encoding misaligns if the client reorders lines or omits SKU ids. Keep the DB snapshot as the single tax-flag carrier and fail closed on insert.
- **Evidence:** M02 mixed-cart GST: payment-intent route previously caught snapshot insert errors and still returned clientSecret; POST /api/orders then set gstFree:false and GST=total/11.
- **Links:** specs/milestones/M02-mixed-cart-gst.md

## Newly minted Stripe PaymentIntent ids are unique; insert the pending snapshot without onConflict and cancel the PI on any thrown error.
- **ID:** 7e535389-cb37-46d9-92a9-3349fcee1225
- **Date:** 2026-09-06T15:43:59Z
- **DocId:** 0400
- **Kind:** note
- **Status:** provisional
- **Milestone:** M02
- **Project:** uniform_order
- **Version scope:** stripe ^22.1.0; drizzle-orm ^0.45.2; neon-http
- **Detail:** payment_intent_id is the PK and Stripe does not reuse PI ids, so onConflictDoNothing().returning() plus a follow-up SELECT is dead weight. A thrown insert already reaches fail-closed cancel+500. A leftover-row 500 is acceptable.
- **Evidence:** apps/web/src/app/api/stripe/payment-intent/route.ts; pending_order_snapshots.payment_intent_id PK.
- **Links:** specs/milestones/M02-mixed-cart-gst.md

## Pending snapshot jsonb can grow new fields without a SQL migration; coerce missing gstFree to false on read.
- **ID:** ff5f18d9-9b16-4a6a-90c6-535918e2bc4e
- **Date:** 2026-09-06T15:43:59Z
- **DocId:** 0300
- **Kind:** note
- **Status:** provisional
- **Milestone:** M02
- **Project:** uniform_order
- **Version scope:** drizzle-orm ^0.45.2 jsonb $type
- **Detail:** Drizzle $type on jsonb does not require a drizzle SQL file. Make gstFree required on the TypeScript write type so new inserts include it; keep prelovedSkuId/condition optional. Readers use gstFree === true so legacy rows stay all-taxable (historical 1/11).
- **Evidence:** PendingOrderLineSnapshot in apps/web/src/db/schema.ts; orders fallback gstFree: false; no new file in apps/web/drizzle/.
- **Links:** specs/milestones/M02-mixed-cart-gst.md

## Keep GST-free donated sales in gross (turnover); reports sum persisted order.gst and split GST-free line totals from taxable sales.
- **ID:** 489f7b1e-9f6d-43e0-8820-b3c8ba847572
- **Date:** 2026-09-06T15:43:59Z
- **DocId:** 0300
- **Kind:** works
- **Status:** verified
- **Milestone:** M02
- **Project:** uniform_order
- **Version scope:** drizzle-orm ^0.45.2; neon-http; order_lines.gstFree / prelovedSkuId
- **Detail:** Do not recompute header GST as 1/11 of taxable in reports. gstFreePrelovedSales = sum of order_lines.lineTotal where gstFree && prelovedSkuId is not null for that month; taxableSales = gross minus that overlay (shipping stays in taxable). A gstFree line without prelovedSkuId stays in taxableSales. Fold the split into the existing category line query rather than a second SUM round-trip.
- **Evidence:** getLiveReportsData in apps/web/src/db/queries.ts; apps/web/src/lib/gst-report.ts; apps/web/src/components/export-csv-button.tsx.
- **Links:** specs/milestones/M02-mixed-cart-gst.md

## After mapping no-snapshot fallback rows onto the snapshot line shape, persist and total from the normalized fields — do not re-branch on whether a snapshot existed.
- **ID:** 50819b52-e98f-427d-8815-28400f56c994
- **Date:** 2026-09-06T15:43:59Z
- **DocId:** 0300
- **Kind:** note
- **Status:** provisional
- **Milestone:** M02
- **Project:** uniform_order
- **Version scope:** Next.js 16 App Router order POST; neon-http db.batch insert
- **Detail:** === true / non-empty string / enum membership already implement missing=default. Extra snapshotLines ternaries hid that the fallback already wrote gstFree: false. Paid legacy PIs without a snapshot stay all-taxable and must not copy client prelovedSkuId.
- **Evidence:** apps/web/src/app/api/orders/route.ts persistedLines mapper plus computeTotals/order_lines insert.
- **Links:** specs/milestones/M02-mixed-cart-gst.md

## Drizzle onConflictDoNothing().returning() is empty on skip; empty returning is inconclusive unless you SELECT.
- **ID:** 1d94268c-3291-4ad6-b8e2-ad48a2b40177
- **Date:** 2026-09-06T15:43:59Z
- **DocId:** 0300
- **Kind:** note
- **Status:** provisional
- **Milestone:** M02
- **Project:** uniform_order
- **Version scope:** drizzle-orm ^0.45.2, neon-http
- **Detail:** Postgres RETURNING yields no rows when ON CONFLICT DO NOTHING skips. Treat empty returning as maybe-already-there: select by PK, then fail closed if the row is still missing. For a PK that cannot collide, skip onConflict and fail closed on a thrown insert instead.
- **Evidence:** Mid-run payment-intent snapshot persist used onConflict+SELECT; later simplified to plain insert because Stripe PI ids cannot conflict.
- **Links:** specs/milestones/M02-mixed-cart-gst.md

## Shared table/CSV header constants used by a Server Component and a Client Component must live in a module without "use client" and without importing db/queries at runtime.
- **ID:** 6262cc65-5693-4f9f-a9d7-ac4728605d28
- **Date:** 2026-09-06T15:43:59Z
- **DocId:** 0600
- **Kind:** works
- **Status:** verified
- **Milestone:** M02
- **Project:** uniform_order
- **Version scope:** Next.js 16.2.4 App Router
- **Detail:** Next.js App Router rejects importing a non-component value from a Client Component into a Server Component. A client exporter must not import queries.ts (Drizzle). One plain TS module can alias the row type and export the header array so empty-state colSpan and CSV stay in the same column order.
- **Evidence:** apps/web/src/lib/gst-report.ts GST_REPORT_HEADERS; apps/web/src/app/admin/[tenant]/reports/page.tsx (RSC) + apps/web/src/components/export-csv-button.tsx (client).
- **Links:** specs/milestones/M02-mixed-cart-gst.md

## On neon-http, pair a qty upsert with an audit insert in one db.batch using INSERT…SELECT of the eligible unique-key row, not VALUES from INSERT RETURNING.
- **ID:** ed514699-bd3e-4a96-a49e-49fdb5d7fcf8
- **Date:** 2026-09-06T17:33:18Z
- **DocId:** 0300
- **Kind:** works
- **Status:** verified
- **Milestone:** M03
- **Project:** uniform_order
- **Version scope:** drizzle-orm ^0.45.2; @neondatabase/serverless neon-http (no db.transaction)
- **Detail:** Batch queries are composed before INSERT…RETURNING is available. A VALUES event insert still writes when ON CONFLICT setWhere no-ops. Sequential upsert-then-event can leave a qty increment if the event write fails and a retry increments again. Gate the event SELECT with the same canAcceptOntoSku predicate as setWhere; empty upsert RETURNING is the refuse signal.
- **Evidence:** apps/web/src/db/preloved-queries.ts acceptAndPool; decisions/M03.md bbe4b22a
- **Links:** specs/milestones/M03-operator-intake.md

## On neon-http, a qty UPDATE followed by an audit INSERT can commit the first write and 409 the retry if already-zero is treated as ineligible; do not db.batch an ungated INSERT with a CAS UPDATE.
- **ID:** b147633a-855c-463f-bbd1-a94a35ebf4ff
- **Date:** 2026-09-06T17:33:18Z
- **DocId:** 0300
- **Kind:** fails
- **Status:** provisional
- **Milestone:** M03
- **Project:** uniform_order
- **Version scope:** drizzle-orm 0.45.2, @neondatabase/serverless 1.1.0, neon-http
- **Detail:** db.batch is a pipeline: the INSERT is not gated on UPDATE RETURNING, so a CAS miss still inserts and can duplicate the audit row under concurrency. Heal when the row is already in the post-update state and the listing-scoped audit event is missing, or use one SQL CTE. Reconstruct heal qty from accepted events since listedAt rather than treating qty<=0 as a hard reject.
- **Evidence:** writeOffPrelovedSku in apps/web/src/db/preloved-queries.ts: update qtyOnHand to 0 then insertPrelovedIntakeEvent; retry hit qtyOnHand<=0 → PrelovedWriteOffNotEligibleError (409).
- **Links:** specs/milestones/M03-operator-intake.md

## drizzle-orm 0.45 onConflictDoUpdate uses setWhere (not where) for UPDATE WHERE; a false predicate returns no row instead of throwing.
- **ID:** 7f988378-2625-4157-ae55-7cac1c43372c
- **Date:** 2026-09-06T17:33:18Z
- **DocId:** 0300
- **Kind:** works
- **Status:** verified
- **Milestone:** M03
- **Project:** uniform_order
- **Version scope:** drizzle-orm ^0.45.2
- **Detail:** PostgreSQL INSERT … ON CONFLICT DO UPDATE SET … WHERE <false> does not update and RETURNING is empty. Treat empty returning as the refuse signal (here: expired in-stock SKU → PrelovedExpiredStockError / 409) rather than assuming the upsert always persisted.
- **Evidence:** acceptAndPool setWhere on expired in-stock SKUs; apps/web/src/db/preloved-queries.ts
- **Links:** specs/milestones/M03-operator-intake.md

## ON CONFLICT DO UPDATE that always assigns listing fields (price, notes) reprices pooled inventory on every qty increment.
- **ID:** 8ff832d5-501b-4039-a804-b9e125201b88
- **Date:** 2026-09-06T17:33:18Z
- **DocId:** 0300
- **Kind:** fails
- **Status:** verified
- **Milestone:** M03
- **Project:** uniform_order
- **Version scope:** drizzle-orm ^0.45.2, Postgres numeric(10,2), neon-http
- **Detail:** For pooled rows keyed by (item, size, condition), restock/listing fields must CASE WHEN qty_on_hand = 0; the increment itself is qty_on_hand + 1. Bound numerics interpolated as strings need ::numeric so CASE types match the column. Apply operator price and optional defect note only on empty-qty restock, not on every accept onto in-stock qty.
- **Evidence:** apps/web/src/db/preloved-queries.ts acceptAndPool conflictSet; M03 second-accept of same item+size+Good
- **Links:** specs/milestones/M03-operator-intake.md

## HeroUI v3 Tabs.Tab render props are typed as HTMLDivElement, so spreading onto next/link fails tsc.
- **ID:** 3e904c64-be64-4119-99ee-fe31d677cce6
- **Date:** 2026-09-06T17:33:18Z
- **DocId:** 0600
- **Kind:** fails
- **Status:** verified
- **Milestone:** M03
- **Project:** uniform_order
- **Version scope:** @heroui/react ^3.1.0, next ^16.2.4
- **Detail:** Official docs use render={(domProps: any) => <Link {...domProps} />}. Without any, tsc errors because onError/ref are HTMLDivElement handlers. Cast domProps as unknown as ComponentProps<typeof Link> and set href after the spread.
- **Evidence:** pnpm check-types:web failed on Tabs.Tab render, then passed after the cast (preloved-section-tabs / admin-shell).
- **Links:** specs/milestones/M03-operator-intake.md

## Read-only admin lists can stay RSC plus existing Tailwind table chrome; do not pull HeroUI Table just to list rows.
- **ID:** 3fe8b07c-4a7a-4ae3-99eb-ed46fb96d2b1
- **Date:** 2026-09-06T17:33:19Z
- **DocId:** 0600
- **Kind:** works
- **Status:** verified
- **Milestone:** M03
- **Project:** uniform_order
- **Version scope:** Next.js 16.2 + @heroui/react ^3.1.0 + Tailwind v4; HeroUI OSS-only repo exception
- **Detail:** HeroUI Table needs a client boundary. A stock list with no in-page actions matches reports/catalog semantic tables (parchment/rule/.tnum). New interactive desks can still use HeroUI OSS form primitives on a paper card.
- **Evidence:** apps/web/src/app/admin/[tenant]/preloved/stock/page.tsx; intake desk uses Select/RadioGroup/TextField; write-offs kept the parchment table.
- **Links:** specs/milestones/M03-operator-intake.md

## Child pages under a section layout that already renders AdminTopbar plus tabs will double the chrome if they also mount a per-page topbar.
- **ID:** 3950cb2e-55f8-4853-aa8a-cfffebd9a8dd
- **Date:** 2026-09-06T17:33:19Z
- **DocId:** 0600
- **Kind:** fails
- **Status:** verified
- **Milestone:** M03
- **Project:** uniform_order
- **Version scope:** Next.js 16 App Router nested layouts; admin AdminTopbar
- **Detail:** Nested layouts own shared section title, feature-off notFound(), and in-section tabs. Catalog-style per-page AdminTopbar is only for routes without that layout. Children should render a padding-only body. Drop the extra topbar; do not invent a second title variant.
- **Evidence:** apps/web/src/app/admin/[tenant]/preloved/layout.tsx owns title Preloved + Intake/Stock/Write-offs tabs; stock/page.tsx stacked a second AdminTopbar until removed; intake and write-offs were already children-only.
- **Links:** specs/milestones/M03-operator-intake.md

## HeroUI v3 OSS Select on an admin form is a labelled button plus a listbox dialog of role=option, not a native select.
- **ID:** 74b5bc50-5b55-4b97-ad84-7eb7c40c9c47
- **Date:** 2026-09-06T17:33:19Z
- **DocId:** 0600
- **Kind:** works
- **Status:** verified
- **Milestone:** M03
- **Project:** uniform_order
- **Version scope:** @heroui/react ^3.1.0; playwright-cli 0.1.9; Next.js 16.2.4
- **Detail:** Trigger accessible name is placeholder + Label (e.g. Select a catalogue item Catalogue item). Playwright: click the trigger button, then getByRole('option', { name }). data-testid on Button is forwarded (intake-accept / intake-reject).
- **Evidence:** playwright-cli session m03t5 against /admin/demo-academy/preloved/intake; snapshots 2026-09-06T16-25-20 through 16-26-46
- **Links:** specs/milestones/M03-operator-intake.md

## A client PATCH that changes a server-layout flag needs router.refresh() or the shell keeps the old props until a full reload.
- **ID:** 5bfb3358-cefb-41c9-85f2-85742e5b8105
- **Date:** 2026-09-06T17:33:19Z
- **DocId:** 0600
- **Kind:** works
- **Status:** verified
- **Milestone:** M03
- **Project:** uniform_order
- **Version scope:** Next.js ^16.2.4 App Router, RSC layout + client companion
- **Detail:** Admin layout reads feature flags and passes them into a client shell. fetch() updates Neon but does not re-run the layout RSC. useRouter().refresh() rebuilds nav in place. Do not auto-push to the newly enabled section: disable would 404, and unrelated field saves should stay on the settings page.
- **Evidence:** M03: enable persisted, Preloved nav stayed hidden until reload. Fix: router.refresh() after res.ok in preloved-settings-section.tsx. Same pattern already used in write-offs-client and order-detail-actions.
- **Links:** specs/milestones/M03-operator-intake.md

## Feature-only client chrome in a shared shell client module ships on every page that imports the shell.
- **ID:** c1c32730-ccea-4cd9-83a5-6d0534ed43f5
- **Date:** 2026-09-06T17:33:19Z
- **DocId:** 0600
- **Kind:** works
- **Status:** verified
- **Milestone:** M03
- **Project:** uniform_order
- **Version scope:** Next.js 16.2.4, HeroUI OSS 3.1.0
- **Detail:** Next.js App Router bundles a use client module with all of its importers. HeroUI Tabs for Preloved lived in AdminShell, so dashboard/orders/catalog paid for that UI. Colocate section tabs next to the feature layout; keep the shared shell as nav-only.
- **Evidence:** PrelovedSectionTabs moved to apps/web/src/app/admin/[tenant]/preloved/preloved-section-tabs.tsx; admin-shell.tsx dropped @heroui/react; typecheck stayed green.
- **Links:** specs/milestones/M03-operator-intake.md

## Bind this worktree's Next origin; a listener on another localhost port may be a different repo.
- **ID:** a7e0d8c0-d43d-4f02-932f-bf952a8417a0
- **Date:** 2026-09-06T17:33:19Z
- **DocId:** 0100
- **Kind:** note
- **Status:** verified
- **Milestone:** M03
- **Project:** uniform_order
- **Version scope:** playwright-cli 0.1.9; Next.js 16.2.4
- **Detail:** lsof showed next-server on :3001 with cwd greatjob-marketplace. This worktree was started on :3000. Dev login cookie uo_dev_email works for admin if the email is shopEmail or PLATFORM_ADMIN_EMAILS. Do not drive Playwright against a foreign listener.
- **Evidence:** ps/lsof cwd /Volumes/T7/georgeqiao/dev/greatjob-marketplace/apps/web vs this repo next on :3000
- **Links:** specs/milestones/M03-operator-intake.md

## Web Playwright must not boot Next.js; resolve an already-running origin and use workers:1 for pooled-qty assertions.
- **ID:** 5a97c43f-ef74-483e-b730-907d1328a2e0
- **Date:** 2026-09-06T17:33:19Z
- **DocId:** 0100
- **Kind:** note
- **Status:** verified
- **Milestone:** M03
- **Project:** uniform_order
- **Version scope:** playwright ^1.59.1; Next.js 16.2; pnpm workspace apps/web
- **Detail:** resolveBaseURL prefers PLAYWRIGHT_BASE_URL, then .dev-local/web.url, then PORT. fullyParallel false and workers 1 so parallel accepts cannot race the same unique-key row. Assert qty = before+n, not a hardcoded empty-rack 1 then 2. Running playwright test against a missing server is not a product fail. Mint the operator session via GET /api/dev/login in development rather than Neon Auth UI or storage-state secrets.
- **Evidence:** apps/web/playwright.config.ts; apps/web/tests/preloved/m03-intake-stock.spec.ts; package.json test:m03-intake-stock
- **Links:** specs/milestones/M03-operator-intake.md

## In development, mint the operator session with GET /api/dev/login instead of Neon Auth UI or committed storage-state.
- **ID:** 2a2fd5fe-bc1d-4dca-937e-4f3a45e35965
- **Date:** 2026-09-06T17:33:19Z
- **DocId:** 0200
- **Kind:** works
- **Status:** verified
- **Milestone:** M03
- **Project:** uniform_order
- **Version scope:** Next.js 16.2.4; Neon Auth; playwright ^1.59.1
- **Detail:** This repo already has a uo_dev_email fallback. Spec hits /api/dev/login?email=… then Settings → Intake → Stock. Fails if NODE_ENV is not development; do not use it as a production e2e path.
- **Evidence:** apps/web/tests/preloved/m03-intake-stock.spec.ts; playwright-cli m03t5 logged in as platformadmin against demo-academy
- **Links:** specs/milestones/M03-operator-intake.md

## drizzle-orm insert().select() requires selected fields in the same order as the table definition, including defaulted columns.
- **ID:** fe2c4c6f-1fdc-444e-9e8b-733e7e66866b
- **Date:** 2026-09-06T17:33:19Z
- **DocId:** 0300
- **Kind:** fails
- **Status:** verified
- **Milestone:** M03
- **Project:** uniform_order
- **Version scope:** drizzle-orm ^0.45.2; neon-http
- **Detail:** Omitting id, createdAt, or nullable rejectReason from an INSERT…SELECT into preloved_intake_events throws at runtime: selected fields are not the same or are in a different order compared to the table definition. List every column in schema.ts order; use gen_random_uuid()/now()/null for defaults.
- **Evidence:** M03 accept POST 500 until acceptAndPool select listed id, rejectReason, createdAt. Playwright then passed: pnpm test:m03-intake-stock on a synthetic tenant polo size 10 Good twice.
- **Links:** specs/milestones/M03-operator-intake.md

## When Drizzle snapshots stopped, hand-write SQL plus a journal idx; do not drizzle-kit generate a snapshot for one additive migration.
- **ID:** 77cb11ce-8fc1-43a5-911a-584f05573a5d
- **Date:** 2026-09-06T23:39:17Z
- **DocId:** 0300
- **Kind:** works
- **Status:** verified
- **Milestone:** M04
- **Project:** uniform_order
- **Version scope:** drizzle-kit 0.31.10, drizzle-orm 0.45.2, neon-http
- **Detail:** Snapshots ended at 0012; later additive tables (0018–0020) are SQL files plus meta/_journal.json only. Generate churns unrelated snapshot JSON and can recreate objects. Journal `when` must be strictly after the previous idx (Date.now() can sort before a rounded prior timestamp). Forgetting the journal row means the migrator skips the file.
- **Evidence:** apps/web/drizzle/0020_preloved_donation_notes.sql; drizzle/meta/_journal.json idx 20; snapshots 0000–0012 only
- **Links:** specs/milestones/M04-donate-and-refund-policy.md

## Render-time legal overlays desync versioned consent; persist a new immutable version instead of appending at read time.
- **ID:** 4d24c44d-59f0-4848-a843-bc340fc95b4f
- **Date:** 2026-09-06T23:39:17Z
- **DocId:** 0300
- **Kind:** fails
- **Status:** verified
- **Milestone:** M04
- **Project:** uniform_order
- **Version scope:** Next.js 16 + Drizzle + neon-http
- **Detail:** If checkout stores currentLegalVersionId and admin UI reads stored policyText, a parent-page addendum makes those sources lie. Exclusive policy_mode checks (text XOR url) also block storing overlay text on URL rows. Do not UPDATE historical version rows. Idempotent substring-detect (whitespace-normalized) before insert. A leftover display helper that ignores the feature flag is a trap.
- **Evidence:** apps/web/src/lib/preloved-refund-policy.ts displayRefundPolicyText; insertNextTenantLegalVersion; tenant_legal_versions check constraint
- **Links:** specs/milestones/M04-donate-and-refund-policy.md

## When a legal mode cannot store body text, skip the outbound redirect and show the required clause on the tenant route with a link out.
- **ID:** 2b926ebd-4b5c-4800-9d08-0ed0ad52f024
- **Date:** 2026-09-06T23:39:17Z
- **DocId:** 0300
- **Kind:** works
- **Status:** verified
- **Milestone:** M04
- **Project:** uniform_order
- **Version scope:** Next.js 16 App Router redirect()
- **Detail:** URL-mode rows keep policy_url and null policy_text. Redirecting before the display-time (or persist) path skips the tenant-surface AC. You cannot inspect a remote hosted policy. Keep URL mode valid; do not auto-convert URL→text.
- **Evidence:** apps/web/src/app/[tenant]/refund-policy/page.tsx; ensurePrelovedRefundClauseOnLegalVersion no-ops unless policyMode is text
- **Links:** specs/milestones/M04-donate-and-refund-policy.md

## Persisting a derived clause only on the next settings save leaves already-enabled tenants without it; tests that always PATCH hide the gap.
- **ID:** 8cff5005-838a-49ab-a07d-7ad0dea7d39e
- **Date:** 2026-09-06T23:39:17Z
- **DocId:** 0300
- **Kind:** fails
- **Status:** verified
- **Milestone:** M04
- **Project:** uniform_order
- **Version scope:** Next.js 16 + Drizzle tenant_legal_versions
- **Detail:** ensure-on-enable with no backfill means a tenant that turned the feature on earlier can show the nav link while stored policy text still lacks the required paragraph. E2E that toggles the flag as setup never exercises the stale-on path. Backfill by inserting the next version (never UPDATE) on read or deploy.
- **Evidence:** apps/web/src/db/preloved-queries.ts ensurePrelovedRefundClauseOnLegalVersion; PATCH /api/tenant/:id/preloved; m04-donate-refund.spec.ts always enables via UI
- **Links:** specs/milestones/M04-donate-and-refund-policy.md

## A parent message-to-operator belongs on its own table with no inventory/SKU FK; do not extend intake/event enums.
- **ID:** 76c049c0-0dc5-43dc-8a63-375bca7ae609
- **Date:** 2026-09-06T23:39:17Z
- **DocId:** 0300
- **Kind:** works
- **Status:** verified
- **Milestone:** M04
- **Project:** uniform_order
- **Version scope:** drizzle-orm 0.45.2, neon-http
- **Detail:** Reusing stock events or attaching a SKU makes a drop-off note look like a listing and fights parallel enum work. Keep CHECK bounds on the DB; the public POST returns 201 { ok: true } with no sku/note id so clients cannot treat it as a listing.
- **Evidence:** apps/web/src/db/schema.ts preloved_donation_notes; insertDonationNote; POST donate 201 body
- **Links:** specs/milestones/M04-donate-and-refund-policy.md

## Do not copy a helper RangeError→400 mapper onto a route whose insert never throws RangeError; keep Zod plus the DB CHECK.
- **ID:** 0b272f17-9d9d-454f-ac6d-c7b00f19dd4b
- **Date:** 2026-09-06T23:39:17Z
- **DocId:** 0300
- **Kind:** fails
- **Status:** verified
- **Milestone:** M04
- **Project:** uniform_order
- **Version scope:** Next.js 16.2.4, Zod 4, drizzle-orm 0.45.2, neon-http
- **Detail:** Postgres check-constraint failures are not RangeError. If the only caller already ran schema.safeParse with the same min/max, a throw/catch on that path is dead. Drop both layers unless another caller skips parse.
- **Evidence:** insertDonationNote is db.insert().values(); DonateSchema.int().min().max(); donate POST catch is 500-only
- **Links:** specs/milestones/M04-donate-and-refund-policy.md

## HeroUI v3 compound Card and Chip can be imported into a Next 16 RSC page without a local use-client wrapper.
- **ID:** 5169b0e9-c1a9-45c8-956d-47aea74b29d6
- **Date:** 2026-09-06T23:39:17Z
- **DocId:** 0600
- **Kind:** works
- **Status:** verified
- **Milestone:** M04
- **Project:** uniform_order
- **Version scope:** @heroui/react ^3.1.0, next ^16.2.4
- **Detail:** Card.Header/Title/Description/Content and Chip (size sm, variant secondary) typecheck in an async server page that also calls notFound() and DB helpers. Client boundary stays inside the library. This repo is OSS @heroui/react only.
- **Evidence:** apps/web/src/app/[tenant]/preloved/donate/page.tsx
- **Links:** specs/milestones/M04-donate-and-refund-policy.md

## Client screens cannot import async RSCs; pass the server chrome as a ReactNode slot.
- **ID:** 10eb9ad9-1e01-4e8a-ae6f-ac4361845cd6
- **Date:** 2026-09-06T23:39:17Z
- **DocId:** 0600
- **Kind:** works
- **Status:** verified
- **Milestone:** M04
- **Project:** uniform_order
- **Version scope:** Next.js 16.2.4, React 19.2.5
- **Detail:** An async footer that reads settings cannot be imported from a "use client" landing/layout. The server page renders <Footer /> and passes it as footer={...}. If a future client file imports the async footer directly, the build should fail rather than silently hide the link.
- **Evidence:** apps/web/src/components/tenant-footer.tsx; apps/web/src/app/[tenant]/landing-screen.tsx footer slot
- **Links:** specs/milestones/M04-donate-and-refund-policy.md

## A default-false feature flag on shared chrome silently hides the control on every call site that forgets the prop.
- **ID:** b46281d6-a9e6-4af3-9bff-0abe372cac2e
- **Date:** 2026-09-06T23:39:17Z
- **DocId:** 0600
- **Kind:** fails
- **Status:** verified
- **Milestone:** M04
- **Project:** uniform_order
- **Version scope:** Next.js App Router shared footer
- **Detail:** Landing/catalogue showed Donate while cart/checkout/item/donate/refund stayed dark. Prefer resolving the flag in layout/chrome (or requiring the prop) over optional default-false. Tradeoff: fetching settings inside a shared component pulls the query layer into UI; a layout-level cache() read plus a required prop is cleaner.
- **Evidence:** TenantFooter originally defaulted prelovedEnabled=false; later became async getPrelovedSettings(tenant.id)
- **Links:** specs/milestones/M04-donate-and-refund-policy.md

## Next 16 PageProps<"/new-route"> fails tsc until typegen AppRoutes includes that path; use inline Promise params until then.
- **ID:** 3d7cfea7-f221-4818-b343-2663bd4d7dfb
- **Date:** 2026-09-06T23:39:17Z
- **DocId:** 0600
- **Kind:** fails
- **Status:** verified
- **Milestone:** M04
- **Project:** uniform_order
- **Version scope:** Next.js 16.2.4 App Router; tsc --noEmit
- **Detail:** PageProps<"/[tenant]/preloved/donate"> was TS2344 and params became unknown. Inline { params: Promise<{ tenant: string }> } plus await params typechecks. Existing routes can use PageProps only because they are already in generated AppRoutes. After `next typegen`, switching is optional cleanup.
- **Evidence:** pnpm check-types:web failed donate/page.tsx TS2344, then passed after Wave 1 inline params
- **Links:** specs/milestones/M04-donate-and-refund-policy.md

## Do not assert copy via a shared Tailwind class; put a unique data-testid on the document body.
- **ID:** e137f874-f995-4159-9e92-df24994774bf
- **Date:** 2026-09-06T23:39:17Z
- **DocId:** 0600
- **Kind:** fails
- **Status:** verified
- **Milestone:** M04
- **Project:** uniform_order
- **Version scope:** Playwright ^1.59.1, Next.js 16, Tailwind v4
- **Detail:** page.locator('.whitespace-pre-wrap') matched both refund-policy text and footer shop hours; Playwright toContainText is a single-element/strict-mode assertion. Heading following-sibling xpath is also brittle. Testids stay unique if layout classes are reused.
- **Evidence:** apps/web/src/app/[tenant]/refund-policy/page.tsx data-testid=refund-policy-text; tenant-footer.tsx shopHours also whitespace-pre-wrap
- **Links:** specs/milestones/M04-donate-and-refund-policy.md

## A parent MobileShell max-w ~430px still looks like a phone card at a 1440 desktop viewport.
- **ID:** 7ad0dc15-cce6-4443-9e0f-bf7ece5d7a39
- **Date:** 2026-09-06T23:39:17Z
- **DocId:** 0600
- **Kind:** note
- **Status:** provisional
- **Milestone:** M04
- **Project:** uniform_order
- **Version scope:** Next.js 16 parent shop MobileShell
- **Detail:** Visual proof should resize to ~430 and 1440, but expect the same narrow shell on both. Do not treat a wide viewport as a desktop layout for this chrome.
- **Evidence:** apps/web/src/components/mobile-shell.tsx; m04 spec MOBILE_VIEWPORT/DESKTOP_VIEWPORT
- **Links:** specs/milestones/M04-donate-and-refund-policy.md

## A page-level public-listing 404 does not stop unauthenticated writes on a sibling API that only checks tenant existence.
- **ID:** 2ea17d39-df12-4cbb-856d-fd3df8cb7b77
- **Date:** 2026-09-06T23:39:17Z
- **DocId:** 0200
- **Kind:** fails
- **Status:** verified
- **Milestone:** M04
- **Project:** uniform_order
- **Version scope:** Next.js 16 App Router; Neon Auth getSessionUser
- **Detail:** Match GET and POST: same isPubliclyListed && platformApprovalStatus === 'approved' gate, 404 (not 403) to avoid existence leaks, and the same platform-admin preview exception if the form is visible to admins. Rate-limit the public POST (IP, per-tenant, in-memory limiter resets on cold start).
- **Evidence:** donate/page.tsx vs POST /api/tenant/[tenantId]/preloved/donate; applyRateLimit 10/min; getSessionUser + isPlatformAdminEmail
- **Links:** specs/milestones/M04-donate-and-refund-policy.md

## Dev-session actor ids are not neon_auth UUIDs; copy enteredByUserId from the current row when parseActorId fails.
- **ID:** 4c940976-8d08-4c36-a347-62d93658d391
- **Date:** 2026-09-06T23:39:17Z
- **DocId:** 0200
- **Kind:** works
- **Status:** provisional
- **Milestone:** M04
- **Project:** uniform_order
- **Version scope:** Neon Auth; NODE_ENV=development /api/dev/login
- **Detail:** entered_by_user_id is a UUID FK. Dev login ids like `dev-${email}` fail the insert. Fallback to the previous version's user id and record the operator email on enteredByEmail. Do not invent a nil UUID.
- **Evidence:** ensurePrelovedRefundClauseOnLegalVersion parseActorId(actorUserId) ?? current.enteredByUserId
- **Links:** specs/milestones/M04-donate-and-refund-policy.md

## Preloved Playwright binds a live Next instance (no webServer); workers stay 1; NODE_ENV=development is required for /api/dev/login.
- **ID:** 83df1d04-44ee-422d-af92-cc1053390918
- **Date:** 2026-09-06T23:39:17Z
- **DocId:** 0100
- **Kind:** note
- **Status:** verified
- **Milestone:** M04
- **Project:** uniform_order
- **Version scope:** Playwright ^1.59.1; Next.js 16
- **Detail:** baseURL: PLAYWRIGHT_BASE_URL, then .dev-local/web.url, then PORT. Specs do not boot the app. Feature-flagged routes: serial tests each set Enable preloved via the operator UI rather than a direct PATCH or one mega-test, so they do not race the shared tenant flag.
- **Evidence:** apps/web/playwright.config.ts; apps/web/tests/preloved/m04-donate-refund.spec.ts; pnpm test:m04-donate-refund
- **Links:** specs/milestones/M04-donate-and-refund-policy.md

## Optional additive fields on persisted cart/line types typecheck against existing samples and add sites without editing those callers.
- **ID:** 7bedd66a-00b0-4c5d-b855-942c041c0c2b
- **Date:** 2026-09-07T02:18:15Z
- **DocId:** 0300
- **Kind:** works
- **Status:** verified
- **Milestone:** M05
- **Project:** uniform_order
- **Version scope:** TypeScript / Next.js 16 apps/web; localStorage cart uo:cart:v1
- **Detail:** New identity fields (sku id, condition, on-hand cap) must be optional so old localStorage rows still parse and unlimited new-stock add sites stay valid. Merge keys stay product-type-specific: capped lines merge on sku id only; uncapped lines keep item+variant+size.
- **Evidence:** CartLine optional prelovedSkuId/condition/qtyOnHand; SAMPLE_CART and new-item add sites unchanged; pnpm check-types:web exit 0 after T1.
- **Links:** specs/milestones/M05-parent-preloved-shop.md

## Joining a catalog parent on id does not inherit that parent's live tenant/active gate.
- **ID:** efda8ca4-4802-406f-af9c-e9cb63f6f567
- **Date:** 2026-09-07T02:18:15Z
- **DocId:** 0300
- **Kind:** fails
- **Status:** provisional
- **Milestone:** M05
- **Project:** uniform_order
- **Version scope:** drizzle-orm ^0.45.2; Next.js ^16.2.4
- **Detail:** Child rows filtered by tenant, active, and qty>0 still leak unpublished or cross-tenant parents unless the same predicates sit on the shared WHERE used by list and get. Put those predicates on the shop WHERE helper, not only the JOIN ON clause. Operator stock lists that must show inactive/zero rows need a separate WHERE.
- **Evidence:** listShopPrelovedSkus/getShopPrelovedSku shopInStockWhere gained catalogItems.tenantId + catalogItems.active; listInStockPrelovedSkus unchanged; getActiveCatalog already filtered both.
- **Links:** specs/milestones/M05-parent-preloved-shop.md

## Public shop reads need a stricter query than operator in-stock lists.
- **ID:** ae2e7820-a4f6-49ce-bcfd-0e9727dc63ba
- **Date:** 2026-09-07T02:18:15Z
- **DocId:** 0300
- **Kind:** note
- **Status:** provisional
- **Milestone:** M05
- **Project:** uniform_order
- **Version scope:** Drizzle neon-http shop vs admin query split
- **Detail:** Parents should see only active qty>0 rows; operators still need inactive and zero-qty. Do not reuse the admin list and filter in the UI. Hold/expiry is an operator write-off trigger, not an auto-hide, unless product says otherwise.
- **Evidence:** listShopPrelovedSkus/getShopPrelovedSku: active AND qtyOnHand>0; listInStockPrelovedSkus stays qty>0 only; expired in-stock SKUs remain shoppable until write-off.
- **Links:** specs/milestones/M05-parent-preloved-shop.md

## Guard uuid-typed lookups for non-UUID route params before querying Postgres.
- **ID:** 1b5cf4f1-c38a-4f84-a640-1194e4b98dba
- **Date:** 2026-09-07T02:18:15Z
- **DocId:** 0300
- **Kind:** note
- **Status:** provisional
- **Milestone:** M05
- **Project:** uniform_order
- **Version scope:** Postgres uuid columns; Next.js 16 App Router dynamic params
- **Detail:** uuid columns throw on junk ids. A public detail URL should 404, not 500. Keep the regex local to the get helper so list/detail share one null path.
- **Evidence:** getShopPrelovedSku returns null for non-UUID skuId instead of selecting; PDP notFound() on null.
- **Links:** specs/milestones/M05-parent-preloved-shop.md

## Copy-pasted domain predicates with different names or return shapes drift; GST and keys then disagree.
- **ID:** cd003d2f-e087-4350-9d92-31a5a03134db
- **Date:** 2026-09-07T02:18:15Z
- **DocId:** 0300
- **Kind:** fails
- **Status:** provisional
- **Milestone:** M05
- **Project:** uniform_order
- **Version scope:** Next.js 16.2 / apps/web cart-store
- **Detail:** Export one id extractor (string | undefined) plus a type guard from the owning store module. Use both at merge, UI keys, tax estimate, and charge-line mapping. Do not Boolean(field) beside a second guard, and do not park the helper next to unrelated catalog constants.
- **Evidence:** cartLinePrelovedSkuId + isPrelovedLine in cart-store.ts; GST had used Boolean(prelovedSkuId) beside a type guard.
- **Links:** specs/milestones/M05-parent-preloved-shop.md

## Persisted client carts that clamp only on add/setQty will render stale or tampered qty until the next mutation.
- **ID:** 9c7a8909-3e13-4fb0-b09a-49145f9dbf04
- **Date:** 2026-09-07T02:18:15Z
- **DocId:** 0300
- **Kind:** fails
- **Status:** provisional
- **Milestone:** M05
- **Project:** uniform_order
- **Version scope:** Next.js 16 App Router client cart, localStorage
- **Detail:** Hydrate through the same clamp as writes and drop qty<=0. Disable + on a finite cap (qty >= qtyOnHand), not on a product-type check that can disagree with clamp. Live oversell still belongs on the charge API.
- **Evidence:** cart-store read() now clampQty(line.qty, line.qtyOnHand); isAtQtyCap for cart +; previously only add/setQty clamped and CartScreen also required isPrelovedLine.
- **Links:** specs/milestones/M05-parent-preloved-shop.md

## Split charge-time stock errors: unknown resource stays 400 after price lookup; over-qty is 409 and must not write stock when decrement is a later webhook.
- **ID:** 1c8b5154-f5f7-4d19-82f2-594026489e03
- **Date:** 2026-09-07T02:18:15Z
- **DocId:** 0400
- **Kind:** note
- **Status:** provisional
- **Milestone:** M05
- **Project:** uniform_order
- **Version scope:** Stripe PaymentIntent + Drizzle neon-http
- **Detail:** After assertTotalsMatch, missing/inactive ids stay unknown_variant 400. Summed qty over live on-hand is 409 insufficient_qty. neon-http has no interactive transaction; do not decrement at PaymentIntent create if fulfilment owns the write. Map 409 to human copy; do not auto-clamp the client cart.
- **Evidence:** POST /api/stripe/payment-intent; lookup key preloved:<skuId>; 409 { error: 'insufficient_qty' }; readApiError just-sold copy; M06 owns webhook decrement.
- **Links:** specs/milestones/M05-parent-preloved-shop.md

## Hiding shop UI on a feature flag is not a charge gate; leftover carts and crafted ids still hit PaymentIntent.
- **ID:** eb76717f-afa5-4577-873d-9c0b738aab51
- **Date:** 2026-09-07T02:18:16Z
- **DocId:** 0400
- **Kind:** fails
- **Status:** provisional
- **Milestone:** M05
- **Project:** uniform_order
- **Version scope:** Next.js 16.2.4 Stripe PaymentIntent feature gating
- **Detail:** Match the flag on the mint route to other feature APIs (same status and body). Checking settings only for tax, or only 404ing pages, still prices and qty-checks leftover lines. An already-created PI after a mid-checkout flag flip is a separate race.
- **Evidence:** payment-intent returns 404 { error: 'Preloved is not enabled' } when prelovedSkuIds.length > 0 and !settings.prelovedEnabled, matching donate/intake/write-off; shop pages use notFound(); no live PI request in that pair turn.
- **Links:** specs/milestones/M05-parent-preloved-shop.md

## When the server ignores a client tax flag, checkout UI and e2e still must run the same totals helper with a server-fetched setting.
- **ID:** 8b20e9bf-624d-4882-a8d7-4b1ceb22debb
- **Date:** 2026-09-07T02:18:16Z
- **DocId:** 0400
- **Kind:** note
- **Status:** provisional
- **Milestone:** M05
- **Project:** uniform_order
- **Version scope:** Next.js 16 App Router; Stripe PI assertTotalsMatch; Playwright 1.59
- **Detail:** Do not persist gstFree on the cart line. Derive it at display from RSC settings plus a live sku id. Omit the flag from the PI payload so the server stamps it. Specs should import computeTotals rather than re-coding tax math, or mixed carts 400 totals_mismatch.
- **Evidence:** checkout-screen computeTotals + toPaymentIntentLines omit gstFree; CartPage passes donatedGstFree; m05 spec imports ../../src/lib/order-totals.
- **Links:** specs/milestones/M05-parent-preloved-shop.md

## Feature-flagged catalogue chips must share one allow-list with the filter querystring.
- **ID:** 0d9717bb-c1c4-49b3-b6c6-564018935cf5
- **Date:** 2026-09-07T02:18:16Z
- **DocId:** 0600
- **Kind:** note
- **Status:** provisional
- **Milestone:** M05
- **Project:** uniform_order
- **Version scope:** Next.js 16 App Router catalogue grid
- **Detail:** Chips and activeCat must read the expanded list only when the flag is on; otherwise the base list. A stale ?cat= of the extra filter must fall back to the default category, not render an empty heading. Skip fetching overlay cards when the flag is off.
- **Evidence:** page.tsx uses SHOP_FILTERS when prelovedEnabled else CATEGORIES for chips and activeCat; listShopPrelovedSkus skipped when disabled.
- **Links:** specs/milestones/M05-parent-preloved-shop.md

## A new parent buy PDP should clone existing purchase chrome (shell, stepper, sticky add), not a sibling informational Card stack.
- **ID:** e2a0f1ec-ab6a-499c-8fac-e5795cd1ac02
- **Date:** 2026-09-07T02:18:16Z
- **DocId:** 0600
- **Kind:** note
- **Status:** provisional
- **Milestone:** M05
- **Project:** uniform_order
- **Version scope:** Next.js 16 App Router; @heroui/react ^3.1.0 OSS-only; Tailwind CSS v4
- **Detail:** Donate/info screens can use HeroUI Card/Chip. The add-to-cart path needs the same qty stepper and footer as unlimited stock. Overlay a finite cap rather than mixing unlimited and capped qty on one stepper. On a bespoke Tailwind cart, reuse the local Chip for mixed-line badges instead of a second component system. OSS-only repos still must not pull Pro.
- **Evidence:** preloved/[skuId] uses MobileShell, Btn, components/chip like item/[itemId]; donate uses HeroUI Cards; cart-screen gold Chip + disabled + at max.
- **Links:** specs/milestones/M05-parent-preloved-shop.md

## Parent-shop empty-state e2e cannot zero leftover in-stock rows when write-off is expired-only and the milestone forbids qty decrement.
- **ID:** 52b55fe2-7b6d-45e4-bdfe-b7049d115b7b
- **Date:** 2026-09-07T02:18:16Z
- **DocId:** 0100
- **Kind:** fails
- **Status:** provisional
- **Milestone:** M05
- **Project:** uniform_order
- **Version scope:** Playwright 1.59 + Next.js 16 App Router
- **Detail:** Skip the empty assertion when operator stock is not empty rather than SQL-updating qty or writing off live units. A seeded CI tenant will never prove empty copy unless it has a fresh rack or a non-destructive empty fixture.
- **Evidence:** m05-parent-preloved-shop.spec.ts test.skip(!rackEmpty); writeOffPrelovedSku isExpiredForWriteOff; M05 out: qty decrement.
- **Links:** specs/milestones/M05-parent-preloved-shop.md

## Playwright cookies for an RSC splash gate must match the production cookie name and Path.
- **ID:** 8e7f21d1-b273-4b2e-a83d-a47fee00f519
- **Date:** 2026-09-07T02:18:16Z
- **DocId:** 0100
- **Kind:** works
- **Status:** provisional
- **Milestone:** M05
- **Project:** uniform_order
- **Version scope:** Next.js 16 cookies() + Playwright 1.59
- **Detail:** cookies().get(name) only sees cookies whose Path covers the route. Set Path=/{tenant} (or click the real CTA) rather than a root-path cookie. Fall back to the landing button if the splash still renders.
- **Evidence:** Catalog RSC cookies().get(`uo:visited:${slug}`); landing-visit.client.ts Path=/${slug}; m05 setVisitedCookie.
- **Links:** specs/milestones/M05-parent-preloved-shop.md

## Playwright testDir plus testMatch *.spec.ts lets a sibling helpers.ts be imported without being collected as a test.
- **ID:** 7e3a71fa-1a07-4a71-9f47-074f25544f1b
- **Date:** 2026-09-07T02:18:16Z
- **DocId:** 0100
- **Kind:** works
- **Status:** provisional
- **Milestone:** M05
- **Project:** uniform_order
- **Version scope:** Playwright test runner; apps/web/playwright.config.ts
- **Detail:** Shared login/enable/intake helpers belong in helpers.ts next to the specs. Always-save settings helpers are a superset of skip-if-already-on and can return flags the later spec needs (tax-free, refund clause). Adding a pnpm script still requires the same command in AGENTS.md/Claude.md Commands or agents miss the gate.
- **Evidence:** apps/web/tests/preloved/helpers.ts; playwright.config.ts testDir ./tests/preloved testMatch /.*\.spec\.ts$/; ensurePrelovedEnabled always PATCH returns donatedGstFree.
- **Links:** specs/milestones/M05-parent-preloved-shop.md

## Reuse the existing add-to-cart funnel event and add optional sku/condition properties; do not fire a parallel event name.
- **ID:** 8f656df4-90e0-4115-b560-355427081511
- **Date:** 2026-09-07T02:18:16Z
- **DocId:** 0900
- **Kind:** note
- **Status:** provisional
- **Milestone:** M05
- **Project:** uniform_order
- **Version scope:** PostHog; Next.js 16 parent shop
- **Detail:** Parent analytics already keys mixed-cart adds on one event. A preloved-only event drops those adds from the funnel. Extra properties can be null/absent on new-stock captures.
- **Evidence:** PrelovedSkuInteractive.onAdd captures item_added_to_cart with the same core properties as item/[itemId]/interactive.tsx plus preloved_sku_id and condition.
- **Links:** specs/milestones/M05-parent-preloved-shop.md

## Next 16 parent-shop client islands may not hydrate in Playwright even when scripts and React load.
- **ID:** a575a28b-91ea-4215-bd7e-af75ca4b7700
- **Date:** 2026-09-07T02:18:16Z
- **DocId:** 0100
- **Kind:** fails
- **Status:** provisional
- **Milestone:** M05
- **Project:** uniform_order
- **Version scope:** Next.js 16.2.4 Turbopack; Playwright 1.59 Chromium/Chrome; nonce CSP middleware
- **Detail:** Add to cart and qty stepper stay dead SSR (no navigation, data-hydrated stays false) on both bundled Chromium and Chrome channel, including the existing /item/polo PDP. RSC copy and Links still work. Do not treat a passing RSC assertion as proof of the add-to-cart path. Prefer PATCH fixtures for admin flags. Investigate HMR websocket 400 and nonce CSP separately.
- **Evidence:** m05 spec: 3 passed (disabled UI, mobile/desktop filter+badge+PDP copy), mixed-cart tests skipped; polo Add to cart click left URL on /{tenant}/item/polo.
- **Links:** specs/milestones/M05-parent-preloved-shop.md

## Next 16 Turbopack HMR rejects Origin http://127.0.0.1 unless allowedDevOrigins includes it; client islands then never hydrate.
- **ID:** 22024edd-dc15-4a00-9819-0e6003f1e767
- **Date:** 2026-09-07T12:17:55Z
- **DocId:** 0100
- **Kind:** fails
- **Status:** verified
- **Milestone:** M05
- **Project:** uniform_order
- **Version scope:** Next.js 16.2.4 Turbopack; Playwright 1.59; Chrome
- **Detail:** localhost vs 127.0.0.1 are different origins. Chrome sends Origin on the HMR websocket; Next returns a non-HTTP handshake (ERR_INVALID_HTTP_RESPONSE). Add to cart, qty steppers, and router.refresh buttons stay dead SSR. Set allowedDevOrigins to 127.0.0.1 (and localhost). Do not treat a passing RSC snapshot as proof of client buttons.
- **Evidence:** check-hydrate.mjs: localhost hydrated=true, 127.0.0.1 hydrated=false until allowedDevOrigins; then both true. playwright-cli mixed cart $51 / GST $4.64.
- **Links:** apps/web/next.config.ts

