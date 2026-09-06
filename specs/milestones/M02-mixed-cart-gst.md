# Milestone M02: Mixed-cart GST

<!-- Self-contained hand-off for /gq-spec-build-grok. The build loop (and its subagents)
     should be able to act on THIS file + specs/context/ alone, without the planning chat.
     Plan must not silently redesign WHAT/WHY from the approved source spec. -->

## Status
complete            <!-- pending | in-progress | complete -->

## Wave
2

## Goal
Stop treating every dollar of an order as GST-inclusive 1/11. New lines stay taxable. Donated preloved lines are GST-free only when the tenant declared `donatedGstFree`. Order header GST and reports CSV match that split. Required before parents can check out a mixed cart.

## Source requirements
- `specs/context/plan-preloved-shop.md` §8.2 Phase 1 GST rules
- §10 Phase 1 items 7 and 10 (mixed-cart GST; reports GST-free preloved column)
- §11 P2
- §12 decision 6 (GST-free opt-in per tenant, default off, donated stock only)

## Scope
**In:**
- Change `computeTotals` / `assertTotalsMatch` so GST is 1/11 of **taxable** lines (new + shipping) only; GST-free preloved lines add to subtotal/total but not GST
- Persist `gstFree` (and later `prelovedSkuId`) on pending snapshots and `order_lines` when creating PaymentIntents / orders
- Reports CSV: columns for GST-free preloved sales vs taxable sales; header `gst` = sum of GST on taxable lines
- GST-free donated sales still counted in turnover reporting as ordinary sales amount (ATO: still count toward GST turnover) — show the GST-free amount, do not omit the sale

**Out:**
- Parent catalogue UI (M05)
- Admin intake (M03)
- Consignment taxable default (Phase 2)
- Silent auto GST-free without tenant flag
- Changing shipping to GST-free

## Dependencies
**Depends on:** M01
**Blocks:** M05

**Context from dependencies:** M01 added `order_lines.gstFree`, `order_lines.prelovedSkuId`, tenant `donatedGstFree`, and preloved SKU `gstFree` copied from the tenant rule at list time. `computeTotals` in `apps/web/src/lib/order-totals.ts` still does `gst = total / 11`. PaymentIntent route (`apps/web/src/app/api/stripe/payment-intent/route.ts`) and `POST /api/orders` call `assertTotalsMatch`. Reports live at `apps/web/src/app/admin/[tenant]/reports/` and query helpers in `apps/web/src/db/queries.ts`.

## Relevant code & entry points
- `apps/web/src/lib/order-totals.ts` — `computeTotals`, `assertTotalsMatch`
- `apps/web/src/app/api/stripe/payment-intent/route.ts`
- `apps/web/src/app/api/orders/route.ts`
- `apps/web/src/db/schema.ts` — `pending_order_snapshots.linesJson` type
- `apps/web/src/app/admin/[tenant]/reports/`
- `apps/web/src/db/queries.ts` — GST month rollups (do not also take on M03 intake queries)

## Acceptance criteria
- [x] Cart of only new items: GST still 1/11 of (subtotal + shipping), same as today
- [x] Mixed cart with `donatedGstFree = false`: preloved lines taxable; GST = 1/11 of full taxable total
- [x] Mixed cart with `donatedGstFree = true`: preloved line amounts excluded from the GST 1/11 base; order `gst` column matches
- [x] PaymentIntent creation rejects mismatched client GST/total using the new formula
- [x] Reports CSV exposes GST-free preloved sales vs taxable sales
- [x] `pnpm check-types:web` passes

## Verification
- **Commands:** not configured · `pnpm check-types:web` · no test suite
- **Strategy:** unit-level checks in `order-totals` if you add a tiny script, or curl PaymentIntent with fixture lines. Parent UI checkout proof waits for M05.

## Architectural invariants
- Stripe still charges the **total**; GST is reporting, not a separate Stripe line
- School Connect account remains the payee
- Default `donatedGstFree` false — do not infer charity status
- neon-http: `db.batch` only
- HeroUI OSS only if any UI copy on reports changes

## Manual prerequisites
- [ ] M01 migration applied

## Autonomy contract
Follow the `autonomy-contract.md` reference shipped with the `gq-spec-build-grok` skill
(`references/autonomy-contract.md` in that skill's directory, project or user scope). In short:
make reversible decisions independently and **log them** (via `log-decision.sh` → `decisions/`); for irreversible /
security / cost / scope-changing / missing-secret situations, record a blocker and stop rather than guess.
Do **not** silently change product/gameplay/architecture decisions from the approved design.

## Decision logging
Any non-trivial choice made while building this milestone must be captured to the shared decision log
(stage `build:M02`). Subagents return decisions in schema-validated workflow output; the
orchestrating skill persists them via `.gq-spec/log-decision.sh`.
