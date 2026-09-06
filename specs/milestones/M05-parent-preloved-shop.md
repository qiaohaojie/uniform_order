# Milestone M05: Parent preloved catalogue and cart

<!-- Self-contained hand-off for /gq-spec-build-grok. The build loop (and its subagents)
     should be able to act on THIS file + specs/context/ alone, without the planning chat.
     Plan must not silently redesign WHAT/WHY from the approved source spec. -->

## Status
pending            <!-- pending | in-progress | complete -->

## Wave
3

## Goal
Parents browse preloved next to new, see condition and stock, add a mixed cart capped at qty on hand, and check out with the M02 GST rules. Empty sizes point at donate. Pickup stays the fulfilment method.

## Source requirements
- `specs/context/plan-preloved-shop.md` §4.1 Buy preloved
- §6 Parent catalogue, item, cart/checkout
- §10 Phase 1 items 4 and 7 (browse/cart; mixed GST — formula from M02)
- §11 P4
- §12 decisions 1, 4, 5 (shop lists; shop price; Stripe pays the school)

## Scope
**In:**
- Catalogue: **Preloved** filter beside existing categories; preloved cards also in the matching garment category with a Preloved badge; card shows size, price, remaining qty, condition Good/Fair; image = optional SKU photo or existing `GarmentVector`
- Item page: condition, known defects, sold-as-worn + ACL sentence, qty stepper limited to `qtyOnHand`
- Cart: mix new + preloved; cannot exceed stock
- Checkout uses M02 totals; PaymentIntent must bind `prelovedSkuId` and fail if qty insufficient (oversell at pay time is finished in M06 — this milestone must still validate qty at PI creation)
- Empty state: “No preloved in this size right now. Donate outgrown items, or buy new.” Link to M04 donate page
- Hide preloved UI when tenant has preloved disabled

**Out:**
- Qty decrement on webhook and pick-slip PRELOVED label (M06) — still validate qty at PI so you cannot pay for more than on hand
- Parent listings, parent-set prices, shipping-specific preloved path
- “Buy before you buy new” prompt on the new item page (Phase 3)
- Unique photo-per-garment requirement

## Dependencies
**Depends on:** M01, M02, M03, M04
**Blocks:** M06

**Context from dependencies:** M01 SKUs + settings. M02 mixed-cart GST in `computeTotals` and PaymentIntent. M03 operators can create pooled qty (or tests seed SKUs). M04 donate page URL and refund paragraph. Parent surfaces: `catalog-grid.tsx`, `item/[itemId]/interactive.tsx`, `lib/cart-store.ts` (`uo:cart:v1`), checkout screens, `CATEGORIES` in `lib/data.ts`. Cart lines today have `itemId`, `variantLabel`, `size`, `qty`, `price`, `name` — extend for preloved SKU id / condition without breaking existing new-item lines.

## Relevant code & entry points
- `apps/web/src/app/[tenant]/catalog-grid.tsx`
- `apps/web/src/app/[tenant]/item/[itemId]/`
- `apps/web/src/app/[tenant]/cart/`
- `apps/web/src/app/[tenant]/checkout/`
- `apps/web/src/lib/cart-store.ts`
- `apps/web/src/lib/data.ts` — `CartLine`, `CATEGORIES`
- `apps/web/src/app/api/stripe/payment-intent/route.ts` — qty + gstFree from M02
- `apps/web/src/components/garment.tsx`

## Acceptance criteria
- [ ] Preloved filter lists only in-stock preloved SKUs for that tenant
- [ ] Preloved badge appears on cards in the matching new category
- [ ] Item page shows condition, defects, ACL sentence; qty cannot exceed `qtyOnHand`
- [ ] Mixed cart of new polo + preloved jumper checks out; Stripe total is the sum; GST follows M02
- [ ] Adding qty above stock is impossible in UI
- [ ] Empty preloved filter shows donate + buy-new copy linking to `/{tenant}/preloved/donate`
- [ ] With preloved disabled, no preloved filter or SKUs
- [ ] `pnpm check-types:web` passes
- [ ] Playwright mobile (~430px) and desktop: browse → add preloved → mixed cart → checkout page totals

## Verification
- **Commands:** not configured · `pnpm check-types:web` · no test suite
- **Strategy:** seed or intake one SKU via M03; `pnpm dev:web`; playwright-cli parent flow mobile + desktop.

## Architectural invariants
- Same Stripe Connect destination as new stock
- Pickup default; no new preloved shipping path
- HeroUI OSS + MobileShell max 430px parent shop
- Do not add inventory to new catalogue items
- Path alias `@/*` → `apps/web/src/*`; await Next 16 `params`

## Manual prerequisites
- [ ] M01–M04 complete; Stripe test keys; at least one preloved SKU with qty ≥ 1

## Autonomy contract
Follow the `autonomy-contract.md` reference shipped with the `gq-spec-build-grok` skill
(`references/autonomy-contract.md` in that skill's directory, project or user scope). In short:
make reversible decisions independently and **log them** (via `log-decision.sh` → `decisions/`); for irreversible /
security / cost / scope-changing / missing-secret situations, record a blocker and stop rather than guess.
Do **not** silently change product/gameplay/architecture decisions from the approved design.

## Decision logging
Any non-trivial choice made while building this milestone must be captured to the shared decision log
(stage `build:M05`). Subagents return decisions in schema-validated workflow output; the
orchestrating skill persists them via `.gq-spec/log-decision.sh`.
