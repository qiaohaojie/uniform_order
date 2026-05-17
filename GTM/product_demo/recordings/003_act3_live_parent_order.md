# Act 3 — Live parent order

## Purpose
Demonstrate the parent-side mobile shopping flow to show buyers/investors how short and painless the checkout is. Optionally let the prospect place the order from their own phone.

## Persona
Parent — phone viewport preferred (no auth required; cart is `localStorage`-backed).

## Starting URL
`http://localhost:3000/demo-academy` opened in a 390×844 mobile viewport (Chrome devtools → iPhone 13 / Pixel 5).

## Seed prerequisite
- `demo-academy` catalog seeded (10 items, variants present).
- Cart localStorage clear: in console, `localStorage.removeItem('uo:cart:v1')`.

## Step-by-step

| Step | Action | Narration | Expected screen |
|---|---|---|---|
| 1 | Open `/demo-academy` on phone viewport | "From a parent's perspective: it's a phone-shaped shop." | Mobile catalog, 10 items |
| 2 | Tap "Polo Shirt — Short Sleeve" | "They pick the polo, …" | Item detail |
| 3 | Select size 10 → Add to cart | (silent — pace) | Cart count badge increments |
| 4 | Back, tap "Winter Jumper" → size 12 → Add to cart | "… add the jumper, …" | Cart now has 2 items |
| 5 | Tap cart icon | "… tap checkout, …" | Cart review with 2 lines, subtotal + GST |
| 6 | Tap "Checkout" | "… accept the refund policy." | Checkout form |
| 7 | Fill student info (any) + tick refund policy | (silent) | Form valid; Stripe Element loads |
| 8 | Stop at Payment Element | "Stripe handles payment. We never see card details. Apple Pay and Google Pay are first-class — most parents finish checkout in under 90 seconds end-to-end." | Stripe Payment Element rendered |

## Timing
~3:00.

## Visual success criteria
- Cart shows 2 line items with quantities and prices.
- Subtotal and GST visible on the cart and checkout screens (GST = subtotal / 11).
- Stripe Payment Element renders (even if the underlying `acct_demo_blank` cannot accept a real charge).

## Possible failure modes
- **Stripe Element fails to load** — expected in default mode with `acct_demo_blank`. Narrate around: "this is where the parent enters their card." For the Live-Stripe opt-in (operator manually swapped in a real Connect test account ID before the demo), use test card `4242 4242 4242 4242`, any future expiry, any CVC.
- **Cart not persisting between page navigations** — clear localStorage: `localStorage.removeItem('uo:cart:v1')` then re-add.
- **Prospect participation:** if the prospect is on the same wifi and has their phone, hand them the URL (see `demo-playbook.md` participation script). Otherwise drive from your own device.

## Re-record command
```bash
npx playwright test -c GTM/product_demo/playwright/demo-recording.config.ts --grep "Act 3"
```

## Cleanup
None per-act. Final teardown via `pnpm --filter web demo:cleanup:confirm`.
