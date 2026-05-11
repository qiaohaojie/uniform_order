# §3.8 Phase B — Keyboard walkthrough (2026-05-12)

**Spec:** `docs/superpowers/specs/2026-05-11-a11y-audit-phase-b-design.md`
**Findings:** `docs/superpowers/audits/2026-05-11-a11y/findings.md`
**Method:** Playwright-assisted automated walk + per-screen JSON in `keyboard/`. Viewport 375 × 667, tenant `nsbh`. Anonymous screens captured programmatically; /checkout deferred (auth-storage.json absent from this worktree).

## What the automated walk verifies

- ✅ Tab order is captured deterministically (focus chain + accessible names where available)
- ✅ Keyboard traps detected (Tab eventually exits the page or fails to within 50 presses)
- ✅ Total focusable count per screen (sanity vs visual count)

## What the automated walk cannot verify (still requires human spot-check)

- ⚠️ Visible focus ring quality (axe doesn't measure this; need eyeballs)
- ⚠️ Esc dismissal sensibility on any overlays/drawers (state-change detection is heuristic, not authoritative — no Esc state changes observed because no overlays were open during the walk)
- ⚠️ Enter / Space activation parity with mouse click for every interactive element
- ⚠️ /checkout authenticated form (auth-storage.json missing — see /checkout section)

These are flagged as follow-up; see "Manual follow-up needed" at the bottom.

## /

- **Focusable count:** 4
- **Tab order escapes page after:** 4 presses (exits to body)
- **Trap detected:** no
- **Focus chain:** NSBH school card → RGHS school card → "Sign in to save your children" link → `<nextjs-portal>` dev-overlay element
- **Notes:** The final focus stop on each anonymous screen is a `<nextjs-portal>` element. This is the **Next.js dev-mode error/route-announcer overlay** and will not be present in a production build. The school-card accessible name duplicates the badge text ("NSBHNSBHNorth Sydney Boys High School") — minor concern that SR users will hear "NSBH NSBH North Sydney…" — worth a tweak but not a blocker.

## /nsbh (catalog)

- **Focusable count:** 21
- **Tab order escapes page after:** 21 presses (exits to body)
- **Trap detected:** no
- **Focus chain (first 10):** Cart link → 6 category chips (Summer, Winter, Sports, Formal, Bags, Stationery) → 3 product cards
- **Notes:** Order is intuitive: header nav → filters → product grid. Each product link's accessible name concatenates title + price ("White Shirt — Long Sleeves$28") with no separator — SR users may hear "twenty-eight" pressed against the title. Cosmetic; not a Phase B blocker but worth noting alongside the school-card duplicate above as a Phase C label-hygiene pass.

## /nsbh/item/shirt-ls (item)

- **Focusable count:** 15
- **Tab order escapes page after:** 15 presses (exits to body)
- **Trap detected:** no
- **Focus chain (first 10):** Back → Cart → variant button "10–24$28" → 7 size buttons (10, 12, 14, 16, 18, 20, 22) → …
- **Notes:** Order is intuitive: nav → variant → sizes → quantity → Add. No trap; all interactives reachable. Variant button's accessible name again concatenates label + price without separator (see catalog).

## /nsbh/cart (cart)

- **Focusable count:** 10
- **Tab order escapes page after:** 10 presses (exits to body)
- **Trap detected:** no
- **Focus chain:** Back → 3 × (Decrease, Increase) row controls → Checkout link → Checkout button → `<nextjs-portal>`
- **Notes:** **Anomaly worth surfacing:** "Checkout" appears in the focus chain as both an `<a>` and a separate `<button>` immediately after — likely a link-wrapping-a-button or a button-shaped link sibling. Two Tab stops for a single visual control means keyboard users press Tab twice to skip past the same CTA. Recommend reviewing `apps/web/src/app/[tenant]/cart/cart-screen.tsx` (or wherever the cart CTA lives) and collapsing to a single interactive. **Filing as a supplemental Phase B finding** — see follow-up.

  The "Remove" affordance for each cart row was not in the focus chain — confirm whether it's keyboard-reachable (e.g. via long-press only on touch, or hidden behind a menu). If removal is mouse-only, that's a P1 keyboard-parity issue.

## /nsbh/checkout

**Status:** Deferred. `auth-storage.json` not present in this worktree (Phase A's session lived in the deleted `a11y-audit` worktree). Programmatic coverage of the authenticated form is gated on re-running `setup-auth.mjs`; recommend bundling into the manual-follow-up step before Phase B's closing re-audit (which also needs the session).

The deferred-state stub is recorded in `keyboard/checkout.json` with `status: "deferred"`.

## /nsbh/order/placed

- **Focusable count:** 5
- **Tab order escapes page after:** 5 presses (exits to body)
- **Trap detected:** no
- **Focus chain:** "View order details" link → "View order details" button → "Back to home" link → "Back to home" button → `<nextjs-portal>`
- **Notes:** **Same anomaly as /cart:** the two confirmation CTAs each appear twice in the focus chain — once as `<a>`, once as `<button>`. Two Tab stops per CTA. Same recommended fix; same supplemental finding.

## Manual follow-up needed

Before/alongside the Phase B closing re-audit:

1. **Focus-ring eyeball pass:** Open each of the 5 anonymous screens at 375 × 667 and Tab through; confirm the visible ring is high-contrast on the parchment background (no near-invisible browser-default outlines, no rings that disappear into the gold accent).
2. **Esc on overlays:** No overlays were open during the automated walk, so the heuristic registered zero state changes. Manually open any mobile-shell menus / drawers / variant pickers / size sheets, Tab inside, press Esc, confirm dismissal returns focus to the trigger.
3. **Enter / Space activation:** Press Enter on a representative `<a>` and Space on a representative `<button>` on each screen and confirm activation parity with mouse click.
4. **/checkout walk:** Re-run `setup-auth.mjs` to refresh `auth-storage.json`, then re-execute `node docs/superpowers/audits/2026-05-11-a11y/keyboard-walkthrough.mjs checkout` (or do the /checkout walk by hand). The Stripe Payment Element iframe is upstream and carved out of Phase B coverage — confirm only the outer form fields are reachable and labelled.
5. **Cart row "Remove" reachability:** Confirm there is a keyboard-reachable way to remove a line from the cart, not just a mouse/touch gesture.

## Summary

- **Automated coverage:** 5 / 6 screens (checkout deferred)
- **Traps detected:** 0
- **Anomalies in focus order:** 2 — duplicate `<a>` + `<button>` CTAs on /cart ("Checkout") and /placed ("View order details", "Back to home"). Two Tab stops per visual control; recommend collapsing to a single interactive. **Supplemental Phase B finding.**
- **Label-hygiene observations:** 2 — duplicated badge+name on school cards (home), and price concatenated to product/variant titles with no separator (catalog, item). Cosmetic; suggest Phase C label-hygiene pass.
- **Manual follow-up items:** 5 (focus-ring eyeball, Esc on overlays, Enter/Space activation, /checkout once auth refreshed, cart remove reachability)
