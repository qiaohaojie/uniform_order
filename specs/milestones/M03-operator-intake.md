# Milestone M03: Operator intake and write-off

<!-- Self-contained hand-off for /gq-spec-build-grok. The build loop (and its subagents)
     should be able to act on THIS file + specs/context/ alone, without the planning chat.
     Plan must not silently redesign WHAT/WHY from the approved source spec. -->

## Status
complete            <!-- pending | in-progress | complete -->

## Wave
2

## Goal
Give the P&C volunteer the paper-form intake desk: accept or reject a donated garment, pool it onto a preloved SKU, set price from the matching new variant, and write off stock past the hold period to charity. No parent listing.

## Source requirements
- `specs/context/plan-preloved-shop.md` §5.1 Intake, §5.3 Write-off
- §3 operating loop (inspect, price, list; unsold → charity)
- §10 Phase 1 items 3 and 8
- §11 P3
- §12 decisions 3–4 (pooled SKUs; shop sets price, default 50%, editable down)

## Scope
**In:**
- Admin nav **Preloved**: Intake, stock list, write-offs
- Intake: match existing **new** catalogue item + size; condition Good/Fair; optional defect note; source = donation; default price = `priceFractionOfNew` × matching new variant; operator may type lower; **warn** (not hard-block) if above the cap; accept increments pooled `qtyOnHand` for (item, size, condition); reject records reason, creates no parent listing
- Stock list of pooled SKUs with qty, price, expiry
- Write-off list: SKUs past `holdDays` from `listedAt`; action **Write off to charity** sets qty 0 + audit/intake event
- Optional one photo per pooled SKU via existing UploadThing **only if cheap**; spec says optional — skip photos if they pull in approval-gate complexity; do not block the milestone on images

**Out:**
- Parent catalogue (M05)
- Consignment lots, tickets, bank details, commission payouts
- Unique per-garment tickets (Phase 2 / Phase 3)
- Inventory on new catalogue
- Parent-set prices
- Qty decrement on sale (M06)

## Dependencies
**Depends on:** M01
**Blocks:** M05

**Context from dependencies:** M01 created settings, pooled SKU table, intake-event table. Matching new items live in `catalog_items` / `catalog_variants` with size lists. Admin shell: `apps/web/src/app/admin/[tenant]/layout.tsx`. Catalog editor is `apps/web/src/app/admin/[tenant]/catalog/` — **do not** overload `item-drawer.tsx`; new preloved routes. Keep preloved query helpers out of the reports functions M02 edits (new module or clearly separated functions in `queries.ts`).

## Relevant code & entry points
- `apps/web/src/app/admin/[tenant]/layout.tsx` — nav
- `apps/web/src/app/admin/[tenant]/preloved/` — new
- `apps/web/src/db/schema.ts` — SKUs + intake events from M01
- `apps/web/src/lib/uploadthing.ts` — only if adding optional image; catalog image route is gated on `platformApprovalStatus === 'approved'`
- `apps/web/src/index.css` — existing parchment/navy tokens

## Acceptance criteria
- [x] With preloved enabled, admin shows Preloved → Intake, stock, write-offs
- [x] Accepting a washed size-10 polo Good pools onto one SKU and increments qty
- [x] A second accept of the same item+size+Good increments the same SKU, not a second row
- [x] Default price is 50% (or configured fraction) of the matching new variant; warning shown if operator types above the cap
- [x] Reject with reason does not increase qty and does not create a parent-visible listing
- [x] Write-off of an expired SKU sets qty to 0 and records an audit/intake event; no parent payout
- [x] Consignment controls are absent
- [x] `pnpm check-types:web` passes
- [x] Playwright or equivalent: operator can complete accept → stock list shows qty (admin desktop viewport)

## Verification
- **Commands:** not configured · `pnpm check-types:web` · no test suite
- **Strategy:** `pnpm dev:web`; admin `/admin/{tenant}/preloved`; accept two of the same size; confirm pool. Screenshot/playwright-cli desktop.

## Architectural invariants
- Parents do not self-list; operator lists after inspection
- Shop sets price
- Pool by source item + size + condition
- HeroUI OSS + existing tokens; no Pro
- neon-http `db.batch`
- Seller of record remains the tenant

## Manual prerequisites
- [ ] M01 migration applied; at least one active catalog item with sizes on the demo tenant

## Autonomy contract
Follow the `autonomy-contract.md` reference shipped with the `gq-spec-build-grok` skill
(`references/autonomy-contract.md` in that skill's directory, project or user scope). In short:
make reversible decisions independently and **log them** (via `log-decision.sh` → `decisions/`); for irreversible /
security / cost / scope-changing / missing-secret situations, record a blocker and stop rather than guess.
Do **not** silently change product/gameplay/architecture decisions from the approved design.

## Decision logging
Any non-trivial choice made while building this milestone must be captured to the shared decision log
(stage `build:M03`). Subagents return decisions in schema-validated workflow output; the
orchestrating skill persists them via `.gq-spec/log-decision.sh`.
