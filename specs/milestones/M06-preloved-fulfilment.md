# Milestone M06: Paid decrement and PRELOVED pick slip

<!-- Self-contained hand-off for /gq-spec-build-grok. The build loop (and its subagents)
     should be able to act on THIS file + specs/context/ alone, without the planning chat.
     Plan must not silently redesign WHAT/WHY from the approved source spec. -->

## Status
complete            <!-- pending | in-progress | complete -->

## Wave
4

## Goal
Close the shop loop: when a preloved line is paid, qty on hand drops. Volunteers pick from the preloved rack using a PRELOVED mark on the existing Kanban pick slip. Oversell between browse and pay fails the charge. New catalogue qty stays untracked.

## Source requirements
- `specs/context/plan-preloved-shop.md` §5.2 Fulfilment
- §4.1 step 5 (pick slip marks preloved)
- §10 Phase 1 item 6
- §11 P6
- §12 decision 8 (no inventory on new catalogue)

## Scope
**In:**
- On paid webhook / order finalise: decrement each preloved SKU by line qty using `db.batch`; never decrement new catalogue
- If qty would go negative, fail PaymentIntent creation (and/or paid finalise) consistently with missing-variant handling; item page can show “just sold”
- Pick slip: preloved lines labelled **PRELOVED** (rack location if a field exists; otherwise the label is enough)
- Existing Kanban statuses unchanged (to_prepare → ready → collected)

**Out:**
- New fulfilment statuses or a separate preloved Kanban
- Shipping-specific preloved path
- Consignment payouts
- Inventory on new items

## Dependencies
**Depends on:** M05
**Blocks:** None

**Context from dependencies:** M05 writes `prelovedSkuId` on order lines and validates qty at PI. Stripe webhook `apps/web/src/app/api/stripe/webhook/route.ts` handles `payment_intent.succeeded`. Pick slip: `apps/web/src/components/admin/pick-slip.tsx`. Kanban: `apps/web/src/app/admin/[tenant]/orders/`. Orders already have pickup as default `fulfilmentMethod`.

## Relevant code & entry points
- `apps/web/src/app/api/stripe/webhook/route.ts`
- `apps/web/src/app/api/stripe/payment-intent/route.ts` — oversell
- `apps/web/src/app/api/orders/route.ts`
- `apps/web/src/components/admin/pick-slip.tsx`
- `apps/web/src/app/admin/[tenant]/orders/`
- Preloved SKU `qtyOnHand` from M01

## Acceptance criteria
- [x] Paying for qty 1 of a SKU with 2 on hand leaves qty 1
- [x] Two concurrent checkouts for the last unit: only one paid order; the other fails PI or order create
- [x] New catalogue variants still have no qty column and are not decremented
- [x] Pick slip prints PRELOVED on preloved lines; new lines unmarked
- [x] Kanban flow for mixed orders is unchanged
- [x] `pnpm check-types:web` passes
- [x] Playwright (or webhook + admin): pay test order → stock list qty down → pick slip shows PRELOVED

## Verification
- **Commands:** not configured · `pnpm check-types:web` · no test suite
- **Strategy:** Stripe test card; webhook to local; admin stock list + print pick slip. playwright-cli desktop for pick slip / Kanban.

## Architectural invariants
- neon-http `db.batch` for decrement (no `db.transaction`)
- Seller of record and Connect payout unchanged
- HeroUI OSS if any Kanban copy changes
- Do not invent a second fulfilment pipeline

## Manual prerequisites
- [x] M05 parent checkout works with Stripe test keys and webhook forwarding to local `/api/stripe/webhook` (M05 committed at `d452b0c`; parent shop + PI qty check shipped)

## Build standing (launch constraints — not product redesign)
- HeroUI OSS only (`@heroui/react`); never install or import `@heroui-pro/*`
- neon-http: `db.batch`, never `db.transaction`
- Do not add qty to `catalog_variants`. New catalogue stays untracked
- Do not invent a second Kanban or preloved shipping path. Statuses stay `to_prepare` → `ready` → `collected`
- Preloved reads/writes stay in `apps/web/src/db/preloved-queries.ts` (keep GST/reports in `queries.ts`)
- Demo tenants are synthetic only. Listed shops: `demo-blank` (Hawthorn Grammar / HWGM), `demo-academy` (Riverside Academy / RVRA, preloved on, polo SKU in stock), `rgsh` (Ridgehaven School / RGSH). Hidden leftover id `nsbh` is unlisted — do not put it on the picker or in docs. Static fallback in `lib/data.ts` is still `imhs` / `rgsh`. Never use real school slugs, names, or `.nsw.edu.au` shop emails
- Specs: `workers: 1`, do not boot Next, `GET /api/dev/login`, `PLAYWRIGHT_BASE_URL`. Operator email must match `tenant.shopEmail`
- Self-ver: `bash .gq-spec/check-playwright-cli.sh` then `playwright-cli` against this worktree’s `pnpm dev:web`. Prefer `http://127.0.0.1:3000` or `http://localhost:3000` (`allowedDevOrigins` already includes 127.0.0.1). Process 0700/0800: playwright-cli, not a browser MCP
- Optional spec pattern: `apps/web/tests/preloved/m06-*.spec.ts` + `pnpm test:m06-…` (see M03/M05). Specs do not boot Next
- M05 already validates qty at PaymentIntent (`409 insufficient_qty`); this milestone finishes decrement on paid webhook / order finalise
- Do not commit unless the user asks

## Autonomy contract
Follow the `autonomy-contract.md` reference shipped with the `gq-spec-build-grok` skill
(`references/autonomy-contract.md` in that skill's directory, project or user scope). In short:
make reversible decisions independently and **log them** (via `log-decision.sh` → `decisions/`); for irreversible /
security / cost / scope-changing / missing-secret situations, record a blocker and stop rather than guess.
Do **not** silently change product/gameplay/architecture decisions from the approved design.

## Decision logging
Any non-trivial choice made while building this milestone must be captured to the shared decision log
(stage `build:M06`). Subagents return decisions in schema-validated workflow output; the
orchestrating skill persists them via `.gq-spec/log-decision.sh`.
