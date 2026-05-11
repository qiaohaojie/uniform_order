# Mobile viewport edge-cases audit — design

**Date:** 2026-05-11
**Source:** `docs/remaining_work.md` §3.9 (mobile shell viewport edge cases).
**Status:** Spec.

## Problem

`MobileShell` (`apps/web/src/components/mobile-shell.tsx`) caps the parent-flow column at 430 px and centres it on wider canvases. The shell itself is responsive, but the screens *inside* it (home, catalog, item, cart, checkout, order placed) were designed on a single mid-range phone canvas and have not been verified against narrower phones, landscape orientation, or split-view tablet layouts.

## Goal

Walk the parent-purchase critical path at three target viewports, identify **critical breakage only**, fix it, and re-verify. Cramped layouts and polish-tier issues are out of scope (logged as observations, not fixed).

## Non-goals

- A11y or aria work — tracked separately as §3.8.
- Admin or platform-portal screens — desktop-targeted, not under `MobileShell`.
- Secondary parent-flow screens (`/[tenant]/refund-policy`, `/orders`, `/orders/[orderId]`) — read-only, off the money flow.
- Real-device verification or non-Chromium browser engines. Chrome devtools-emulated viewports via Playwright only.
- Committed snapshot tests / CI integration. This is a one-shot audit.

## Viewports (3)

| Name | Pixels | Purpose |
|---|---|---|
| iPhone SE | 375 × 667 | Narrow-phone constraint. Catches anything assuming ≥ 390 px width. |
| Android landscape | 740 × 360 | Short-height. Tests sticky headers/footers consuming the fold. |
| iPad split-view (wide split) | 507 × 820 | Above `MobileShell`'s 430 px cap. Tests the centred phone-column branch on a tall canvas. |

The narrow iPad split (≤ 430 px) collapses to the same behaviour as iPhone SE, so no separate viewport is needed.

## Screens (6, in order)

1. `/` — school picker (`app/home-client.tsx`)
2. `/[tenant]` — catalog (`app/[tenant]/page.tsx`)
3. `/[tenant]/item/[itemId]` — product detail
4. `/[tenant]/cart` — cart
5. `/[tenant]/checkout` — checkout
6. `/[tenant]/order/placed` — order confirmation

3 viewports × 6 screens = **18 captures**.

## "Critical breakage" — narrow definition

A finding is ship-blocking only if it matches one of the following four:

1. **Horizontal scrollbar** appears at any viewport ≤ 740 px (excluding intentional horizontal carousels).
2. **Untappable interactive element** — a button, link, or input is clipped, hidden behind another element, or has its smallest tappable dimension below 24 px. (Threshold is 24 px — not the 44 px WCAG ideal — to keep scope on "critical only.")
3. **Content unreachable** — content is cut off and cannot be reached by scrolling (e.g., a modal whose primary action sits below the viewport with no internal scroll).
4. **Layout collapse** — a column count drops to zero where it shouldn't, text becomes unreadable (< 11 px effective size), or a card overflows its parent.

Anything else (cramped spacing, fonts that feel too large at 375 px, tap targets in 24 – 44 px range) is logged as an **observation**, not fixed.

## Methodology

Driven by the Playwright CLI skill, end-to-end:

1. Start `pnpm dev:web` (background).
2. Seed a test order so the cart / checkout / placed screens have realistic content: navigate the parent flow once on iPhone SE to add an item and proceed through Stripe test-mode payment. Reuse the same order id for the placed-screen capture across all three viewports.
3. For each viewport × screen pair (18 total): navigate, set the viewport, screenshot to `docs/superpowers/audits/2026-05-11-mobile/<screen>-<viewport>.png`, capture a DOM snapshot for `aria` / `overflow` / `position` heuristics.
4. Apply the four-rule critical-breakage filter to each capture pair.
5. Produce the breakage list (see Output below).
6. User approves the fix list.
7. Implement fixes (one commit per fix). Re-capture the same 18 screenshots. Diff before/after; attach to the PR.

## Output format

The audit produces a follow-up document `docs/superpowers/audits/2026-05-11-mobile-viewport-audit.md` with:

- **Findings table** — one row per ship-blocking issue: `severity (P0/P1) | screen | viewport | symptom | root-cause hypothesis | proposed fix (specific component + class change)`.
- **Observations** — bucket of noted-but-out-of-scope items at the bottom.
- **Screenshot index** — links to before/after artefacts under `docs/superpowers/audits/2026-05-11-mobile/`.

Both P0 and P1 are ship-blocking under the "critical only" definition. The split is severity within the blocking tier (P0 = visibly broken; P1 = functionally broken but not visually obvious).

## Risks

- **Test-mode Stripe charge for the placed screen** depends on Stripe test keys being configured locally. If they are not, fall back to navigating directly to `/[tenant]/order/placed?orderId=<known-good-id>` against the dev DB.
- **Playwright viewport emulation** is not pixel-identical to a real device. The audit may miss issues that only appear on actual mobile Safari. Documented as a known gap in non-goals.
- **Catalog state.** The audit runs against the static catalog in `lib/data.ts` (NSBH). If the audit-time catalog has very different item-name lengths than the production catalog, results may not generalize. Mitigation: spot-check the longest item names against the rendered widths after fixes land.

## Files likely to be touched (during the fix phase, not this spec)

To be determined by the audit. Likely candidates given the screens in scope:

- `apps/web/src/components/mobile-shell.tsx` — only if a structural problem is found.
- `apps/web/src/app/[tenant]/page.tsx` (catalog grid).
- `apps/web/src/app/[tenant]/item/[itemId]/page.tsx` (product detail).
- `apps/web/src/app/[tenant]/cart/page.tsx`, `…/checkout/page.tsx`, `…/order/placed/page.tsx`.
- `apps/web/src/index.css` (only if a global rule is the right fix).

Plan-phase will lock these once the audit findings exist.

## Acceptance criteria

1. The 18 baseline screenshots are captured and stored under `docs/superpowers/audits/2026-05-11-mobile/`.
2. The findings document exists with a non-empty observations bucket (proving the auditor actually looked) and a — possibly empty — findings table.
3. Every P0 / P1 finding in the findings table has a corresponding fix commit, and the post-fix re-capture confirms the symptom is gone.
4. `pnpm check-types:web` is clean after fixes.
5. The PR description links to the audit document; remaining_work.md §3.9 is collapsed to a one-line pointer to the audit + `completed.md` entry.
