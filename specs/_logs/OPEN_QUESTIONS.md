# Open Questions & Blockers

> Unresolved items that need the user's input. Distinct from `DECISION.md` (which records
> decisions already made). gq-spec-build appends blockers it hit during a run; gq-spec-status
> surfaces anything still open. Remove or strike through items once resolved (and, if the
> resolution is a decision, log it to `DECISION.md`).

<!-- Entry format:

- [ ] **(MNN)** <question or blocker> — raised: <YYYY-MM-DD>, by: <build:MNN | design | review>
      context: <why it blocks / what's needed to resolve>
-->

- [x] **(plan)** Phase 1 scope donation-only vs consignment-in-first-build — raised: 2026-09-06, by: design
      context: George chose A. Logged `e476bc31`. Consignment is not in this roadmap.

- [ ] **(plan)** GST-free default not separately confirmed — raised: 2026-09-06, by: plan
      context: Spec default `donatedGstFree = false` until the school ticks s 38-255. Non-blocking; briefs follow that default. Confirm only if you want a guided charity checkbox instead.

- [ ] **(plan)** Hats on the default refuse list not separately confirmed — raised: 2026-09-06, by: plan
      context: Spec default refuse list includes hats (Tara/CCGS). Some primary shops sell hats. Non-blocking; tenant can edit the list. Confirm only if hats should be allowed by default.

- [x] **(plan)** School-fee credit as a payout option — raised: 2026-09-06, by: plan
      context: Phase 2 first vertical (2026-09-12): parent consign form offers school-fee credit; operators mark lots manually. No school-finance integration. Lot→intake attribution shipped 2026-09-12 (`consignment_items`). Payout CSV / sold-line ledger shipped 2026-09-12 (`consignment_sold_lines`, treasurer CSV).

- [x] **(M04)** Operators have no inbox to read `preloved_donation_notes` — raised: 2026-09-07, by: build:M04
      context: Resolved 2026-09-12. Operator inbox at `/admin/[tenant]/preloved/inbox` lists `preloved_donation_notes` (empty / loading / error). Notes still do not create a SKU.

- [x] **(M05)** Parent-shop client islands do not hydrate in Playwright — raised: 2026-09-07, by: build:M05
      context: Resolved 2026-09-12. `allowedDevOrigins` + CSP `ws:`/`wss:` fix hydration on 127.0.0.1. Hard-fail coverage in `pnpm test:m05-parent-hydration` (preloved stepper `data-hydrated=true` + Add to cart; new catalogue Add to cart).

- [ ] **(M05)** Empty Preloved filter e2e skipped when the rack already has stock — raised: 2026-09-07, by: build:M05
      context: Write-off is expired-only and M05 must not decrement qty. A tenant that already has stock will `test.skip`. Copy+donate link exist in `catalog-grid.tsx`. Need a fresh empty tenant or a non-destructive empty fixture.

- [x] **(M06)** Live pay + pick-slip self-ver not run — raised: 2026-09-07, by: build:M06
      context: `pnpm test:m06-preloved-fulfilment` passed on demo-academy (qty 2→1, mixed-cart Stripe `pm_card_visa`, pick slip PRELOVED on preloved line only, Kanban To prepare/Ready/Needs attention/Completed). Desktop 1920×1080 screenshots in `.dev-local/m06-verify/`. playwright-cli chrome-for-testing was still installing; used project Playwright Chromium.

- [x] **(M06)** Concurrent last-unit is code-only — raised: 2026-09-07, by: build:M06
      context: Resolved 2026-09-12. `pnpm test:m06-last-unit-race` mints two last-unit PIs, confirms both, races POST /api/orders; one order + one 409 `insufficient_qty`, qty ends 0. Loser-charged-no-order stays ops refund.

- [x] **(M06)** Webhook snapshot decrement can drop qty with no order row — raised: 2026-09-07, by: review:M06
      context: Kept snapshot-first (decision `580c7676`). 3DS paid-without-order is ops refund, not auto-refund.

- [x] **(M06)** Write-off retry can count sold units as written_off — raised: 2026-09-07, by: review:M06
      context: Resolved 2026-09-12. Qty already 0 is treated as cleared (409). Write-off records leftover `qty_on_hand` only; it no longer reconstructs from accepted-this-listing.

- [x] **(M06)** Apply drizzle 0021 on Neon — raised: 2026-09-07, by: build:M06
      context: Applied `CREATE TABLE IF NOT EXISTS preloved_paid_decrements` via neon-http (full `drizzle-orm` migrator blocked on already-applied 0019). Journaled as `manual_0021_preloved_paid_decrements`.
