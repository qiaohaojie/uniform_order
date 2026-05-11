# Mobile viewport audit — findings (2026-05-11)

**Spec:** `docs/superpowers/specs/2026-05-11-mobile-viewport-audit.md`
**Plan (Phase A):** `docs/superpowers/plans/2026-05-11-mobile-viewport-audit.md`
**Captured:** 2026-05-11
**Baseline screenshots:** `docs/superpowers/audits/2026-05-11-mobile/baseline/` (18 PNGs)
**DOM snapshots:** `docs/superpowers/audits/2026-05-11-mobile/dom/` (18 JSON)
**Tenant:** `nsbh` (Northbridge Boys), the catalog with the most-complete seed.

## Headline

- **Rule #1 (horizontal scrollbar):** 0 findings. `documentScrollWidth === viewportWidth` in all 18 captures.
- **Rule #2 (untappable element, smallest dimension < 24 px):** 3 distinct findings (each repeats across all 3 viewports = 9 capture rows total).
- **Rule #3 (content unreachable):** 0 findings. All primary CTAs are reachable by scroll.
- **Rule #4 (layout collapse):** 0 findings.

Net: **no P0s, 3 P1s.** All three P1s are small-tap-target issues — interactive elements that render at 19.5–22 px on their smallest dimension, below the spec's 24 px critical threshold.

## Findings

| # | Severity | Screen | Viewports | Symptom | Selector | Rendered size | Source | Proposed fix |
|---|---|---|---|---|---|---|---|---|
| F1 | P1 | cart | iphone-se, android-landscape, ipad-split | Quantity +/- buttons are 19.5 px tall on their smallest dimension. Functionally tappable inline but below the 24 px threshold for a primary control surface. | `button.w-6.text-center` | 24 × 19.5 px | `apps/web/src/app/[tenant]/cart/page.tsx` (quantity stepper, two buttons per cart line × 3 lines stubbed in the audit) | Bump the qty steppers from `w-6` to `w-7 h-7` (or `min-h-[24px]` + center alignment) so both width and height land at ≥ 24 px. Keep visual weight by leaving font size unchanged. |
| F2 | P1 | catalog | iphone-se, android-landscape, ipad-split | The header cart icon link is 22 × 22 px — a single-icon tap target below the 24 px critical threshold. | `a.relative.text-white` (cart badge in the tenant-shop top bar) | 22 × 22 px | `apps/web/src/app/[tenant]/page.tsx` topbar (look for the `Link` wrapping the cart `svg` + badge count) | Wrap the icon in a button-shaped container with `w-9 h-9` (36 × 36) and keep the existing 22 px icon centred inside. Same fix as the item-page back button — see F3. |
| F3 | P1 | item | iphone-se, android-landscape, ipad-split | The cart-icon link in the item-page topbar is 36 × 22 px. Smallest dimension 22 px, below the 24 px threshold. (Note: original audit row mislabelled this as the back arrow; verified in Phase B against `interactive.tsx:235`, the cart link — the back arrow at `:221` is already `w-9 h-9` and was never flagged.) | `a.w-9.flex` (cart link, `interactive.tsx:235`) | 36 × 22 px | `apps/web/src/app/[tenant]/item/[itemId]/interactive.tsx` | Make the Link itself 36 × 36 with `w-9 h-9 flex items-center justify-center`; nest the icon + badge in an inner `relative` span so the badge stays anchored to the icon. |

## Fixes shipped (Phase B)

All three Phase A findings are resolved. Post-fix captures live in `docs/superpowers/audits/2026-05-11-mobile/after/`; the rule-#2 jq check returns zero matches for the three flagged selectors. Rule #1 (horizontal scrollbar) is unchanged at zero matches.

| # | Fix commit | Element | Before (smallest dim) | After (smallest dim) | Class change |
|---|---|---|---|---|---|
| F1 | `bb90fc1` | Cart qty steppers (`apps/web/src/app/[tenant]/cart/cart-screen.tsx`) | 24 × 19.5 px | 28 × 28 px | parent `h-[26px]` → `h-7`; buttons `w-6` → `w-7 h-full` |
| F2 | `d7f0aff` | Catalog header cart link (`apps/web/src/app/[tenant]/page.tsx`) | 22 × 22 px | 36 × 36 px | Link → `w-9 h-9 flex items-center justify-center text-white`; icon + badge nested in inner `relative` span so badge stays anchored to icon (no visual shift) |
| F3 | `b730399` | Item header **cart** link — corrected from "back link" (`apps/web/src/app/[tenant]/item/[itemId]/interactive.tsx`) | 36 × 22 px | 36 × 36 px | Link → `w-9 h-9 flex items-center justify-center`; icon + badge wrapped in inner `relative` span; badge `right-0` → `-right-1` to match new wrapper |

## Observations (out of scope per the spec; recorded for future polish)

- **Wide text links sit at 20 px height.** `Back to home` link on the placed screen (~335 × 20 px on iPhone SE), `Forgot password` and the "Sign Up" inline link on the sign-in page (visible because the audit hit the auth wall on checkout — see below). These are wide enough that thumb taps land reliably, so they fail rule #2 only on the strict-numeric reading; not visually broken.
- **Catalog category-tab row clips "Stationery" at landscape.** Implemented via `overflow-x-auto` + hidden scrollbar (`apps/web/src/app/[tenant]/page.tsx:87`). Intentional horizontal-carousel behaviour, explicitly outside rule #1. UX concern: no visible scroll affordance and "Statio…" looks broken at first glance. Worth a separate polish pass to add a right-edge fade or a swipe-indicator dot, but not ship-blocking.
- **Checkout captures show the sign-in page, not the actual checkout form.** `/[tenant]/checkout` is gated by auth (Better-Auth login wall renders for anonymous sessions). The audit ran anonymously and so could not exercise the real checkout layout at the three viewports. Layout of the **sign-in page itself** is sound (Better-Auth's defaults render in a centred card across all viewports), but the *checkout* layout proper remains unaudited. A follow-on capture pass with an authenticated Playwright context would close this gap.
- **Dev-mode Next.js error overlay appears as a "1 Issue" toast** in the sign-in (checkout) captures. Dev-only; won't appear in production builds.
- **Cart quantity steppers visually look fine** in the screenshots despite the rule-#2 finding (F1). The 19.5 px height is sub-pixel rounded down — actual rendered glyph still reads clearly. Fix is recommended for tap reliability under a thumb, not visual correctness.

## How to read this

- **P0** = visibly broken on screen (clear layout failure, missing content, horizontal scroll).
- **P1** = functionally broken but not visually obvious (e.g., a button is < 24 px on its smallest dimension and risks fat-finger misses).
- Both P0 and P1 are ship-blocking under the spec's "critical only" definition.
- Anything outside the four-rule filter is in **Observations**, not **Findings**.

## Notes on the methodology

- The audit ran against `pnpm dev:web` (Next.js 16 dev server, Turbopack, dev-mode runtime). Production builds (`next build && next start`) may layout fonts and certain images slightly differently, but the rule-#1 / rule-#2 checks are typography-invariant and should hold.
- Captures are full-page screenshots (`fullPage: true`); the rule-#1 horizontal-scroll check uses `documentElement.scrollWidth` vs `window.innerWidth` at the viewport's pixel width, so it correctly flags overflow regardless of where the user has scrolled.
- The Stripe Payment Element on `/checkout` is iframed and was not exercised in this audit (auth wall + iframe automation cost). If the placed-screen capture revealed anything alarming, it would be re-investigated via an authenticated capture pass.
- Capture script: `docs/superpowers/audits/2026-05-11-mobile/capture.mjs` (kept in the repo for future re-runs / Phase B's diff).
