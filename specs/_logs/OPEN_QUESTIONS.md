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

- [ ] **(plan)** School-fee credit as a payout option — raised: 2026-09-06, by: plan
      context: Phase 2 only. Not in M01–M06.

- [ ] **(M04)** Operators have no inbox to read `preloved_donation_notes` — raised: 2026-09-07, by: build:M04
      context: Bag notes persist without creating a SKU (AC met). Spec calls them a message to operators; M04 did not add a SELECT/admin list. Non-blocking for donate/refund copy. Resolve in a later admin slice if P&Cs need to see drop-off notes.

- [ ] **(M05)** Parent-shop client islands do not hydrate in Playwright — raised: 2026-09-07, by: build:M05
      context: Qty stepper and Add to cart stay dead SSR (`data-hydrated=false`) on Chromium and Chrome channel. Same on existing `/item/polo`. Mixed-cart + qty-cap ACs are code-complete but not runtime-proven. RSC filter/badge/PDP copy/disabled pass. Needs a hydration/HMR/CSP investigation before marking M05 complete.

- [ ] **(M05)** Empty Preloved filter e2e skipped when the rack already has stock — raised: 2026-09-07, by: build:M05
      context: Write-off is expired-only and M05 must not decrement qty. A tenant that already has stock will `test.skip`. Copy+donate link exist in `catalog-grid.tsx`. Need a fresh empty tenant or a non-destructive empty fixture.

- [x] **(M06)** Live pay + pick-slip self-ver not run — raised: 2026-09-07, by: build:M06
      context: `pnpm test:m06-preloved-fulfilment` passed on demo-academy (qty 2→1, mixed-cart Stripe `pm_card_visa`, pick slip PRELOVED on preloved line only, Kanban To prepare/Ready/Needs attention/Completed). Desktop 1920×1080 screenshots in `.dev-local/m06-verify/`. playwright-cli chrome-for-testing was still installing; used project Playwright Chromium.

- [ ] **(M06)** Concurrent last-unit is code-only — raised: 2026-09-07, by: build:M06
      context: CAS + 409 on order create is implemented; no race e2e. Loser can be charged with no order (webhook ACK 200, no auto-refund). Decide if a second API race test is required before complete.

- [x] **(M06)** Webhook snapshot decrement can drop qty with no order row — raised: 2026-09-07, by: review:M06
      context: Kept snapshot-first (decision `580c7676`). 3DS paid-without-order is ops refund, not auto-refund.

- [ ] **(M06)** Write-off retry can count sold units as written_off — raised: 2026-09-07, by: review:M06
      context: `writeOffPrelovedSku` qty=0 path still sums accepted-this-listing (M03 “no sale decrements”). Paid CAS zeros `qty_on_hand` without an intake `sold` event. Happy path with leftover qty is fine.

- [x] **(M06)** Apply drizzle 0021 on Neon — raised: 2026-09-07, by: build:M06
      context: Applied `CREATE TABLE IF NOT EXISTS preloved_paid_decrements` via neon-http (full `drizzle-orm` migrator blocked on already-applied 0019). Journaled as `manual_0021_preloved_paid_decrements`.
