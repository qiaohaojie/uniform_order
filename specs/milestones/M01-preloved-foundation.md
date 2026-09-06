# Milestone M01: Preloved schema and tenant settings

<!-- Self-contained hand-off for /gq-spec-build-grok. The build loop (and its subagents)
     should be able to act on THIS file + specs/context/ alone, without the planning chat.
     Plan must not silently redesign WHAT/WHY from the approved source spec. -->

## Status
complete            <!-- pending | in-progress | complete -->

## Wave
1

## Goal
Add the donation-only preloved data model and tenant opt-in settings so later milestones can list, price, tax, and sell stocked SKUs. Operators can turn the rack on and set price fraction, hold period, refuse list, and GST-free declaration. Parents cannot buy yet.

## Source requirements
- `specs/context/plan-preloved-shop.md` §3 tenant switch (opt-in, `donation_only`, 50% cap warning, 12-month hold, GST-free tenant-declared, refuse list)
- §7 Data (Phase 1 sketch): tenant settings, pooled preloved SKU, intake event table, `order_lines` extensions
- §10 Phase 1 items 1–2 (settings + SKU table + qty)
- §11 P1
- §12 decisions 2, 3, 6, 8 (donation first, pooled SKUs, GST-free opt-in default off, no inventory on new catalogue)
- Decision `e476bc31` — Phase 1 donation-only; consignment out

## Scope
**In:**
- Tenant preloved settings (new columns or `tenant_preloved_settings` row): `prelovedEnabled` default false; `intakeMode` stored as `donation_only` (do not expose consignment in UI); `priceFractionOfNew` default `0.50`; `holdDays` default `365`; `donatedGstFree` default **false**; `refuseList` default `["socks","swimwear","hats"]`; optional `commissionBps` column unused in UI (Phase 2)
- Pooled preloved SKU table as specified in §7
- Intake-event table (audit: who accepted/rejected, donation source, qty, reject reason)
- Extend `order_lines` with nullable `prelovedSkuId`, `gstFree` default false, `condition` nullable — so M02/M05 do not migrate again
- Admin settings UI on existing settings screen: opt-in, fraction, hold days, refuse list, GST-free checkbox with s 38-255 accountant copy from §8.2
- Queries to read/write settings; Drizzle migration; `db.batch` not `db.transaction`

**Out:**
- Admin intake UI (M03)
- Parent catalogue / cart (M05)
- Donate page (M04)
- GST totals formula change (M02 — columns exist, `computeTotals` stays 1/11 until M02)
- Qty decrement, pick slip (M06)
- Consignment lots, parent bank details, C2C listings, inventory on `catalog_items` / new variants

## Dependencies
**Depends on:** None
**Blocks:** M02, M03, M04, M05

**Context from dependencies:** First milestone. Existing app: `tenants`, `catalog_items`, `catalog_variants`, `orders`, `order_lines` in `apps/web/src/db/schema.ts`. New catalogue has **no qty**. Checkout uses `computeTotals` 1/11 of GST-inclusive total. Admin settings live at `apps/web/src/app/admin/[tenant]/settings/`.

## Relevant code & entry points
- `apps/web/src/db/schema.ts` — tenants, catalog, orders, order lines
- `apps/web/src/db/queries.ts` — add settings/SKU helpers without rewriting reports GST (M02)
- `apps/web/drizzle/` — new migration
- `apps/web/src/app/admin/[tenant]/settings/settings-client.tsx` — shop hours/address already saved here
- `apps/web/src/app/api/` tenant/settings routes if present; otherwise extend the existing settings save path
- `apps/web/src/lib/data.ts` — `CATEGORIES` unchanged in this milestone

## Acceptance criteria
- [x] Migration applies on Neon/Drizzle: preloved settings, pooled SKU table, intake events, `order_lines` extra columns
- [x] New tenants and existing tenants have `prelovedEnabled = false` and `donatedGstFree = false`
- [x] Operator can enable preloved and save price fraction, hold days, refuse list, GST-free flag
- [x] GST-free control shows the accountant / s 38-255 confirmation copy from the spec
- [x] Settings UI does not offer consignment intake or commission
- [x] Preloved SKU rows can be inserted in DB keyed by tenant + source catalog item + size + condition, with `qtyOnHand`
- [x] New catalogue variants still have no inventory column
- [x] `pnpm check-types:web` passes

## Verification
- **Commands:** not configured · `pnpm check-types:web` · no test suite
- **Strategy:** apply migration locally; toggle settings on `imhs` or `rgsh` in admin; confirm rows in DB. No parent-shop Playwright required yet.

## Architectural invariants
- School / P&C remains seller of record
- HeroUI OSS only (`@heroui/react`); no `@heroui-pro/*`
- neon-http: `db.batch`, never `db.transaction`
- Donation-only Phase 1; do not add consignment tables
- Qty exists only on preloved SKUs
- Default GST-free is off until the tenant ticks it

## Manual prerequisites
- [ ] Local `DATABASE_URL` and `pnpm --filter web exec` migrate as in `docs/Deployment/LOCAL_DEVELOPMENT.md`

## Autonomy contract
Follow the `autonomy-contract.md` reference shipped with the `gq-spec-build-grok` skill
(`references/autonomy-contract.md` in that skill's directory, project or user scope). In short:
make reversible decisions independently and **log them** (via `log-decision.sh` → `decisions/`); for irreversible /
security / cost / scope-changing / missing-secret situations, record a blocker and stop rather than guess.
Do **not** silently change product/gameplay/architecture decisions from the approved design.

## Decision logging
Any non-trivial choice made while building this milestone must be captured to the shared decision log
(stage `build:M01`). Subagents return decisions in schema-validated workflow output; the
orchestrating skill persists them via `.gq-spec/log-decision.sh`.
