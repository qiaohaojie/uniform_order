# Act 4 — Order management

## Purpose
Show the operator's one-click order workflow: transition to Ready, print a pick slip, then review a refund on a completed order.

## Persona
School operator — signed in as `operator@demo.uniformorder.online`.

## Starting URL
`/admin/demo-academy/orders` (Kanban). Drill into `RVRA-00003` for transition demo, then `RVRA-00038` for refund demo.

## Seed prerequisite
- 40 orders seeded on `demo-academy`.
- `RVRA-00003` must be in `to_prepare` / `paid` state (seed default).
- `RVRA-00038` must be `completed` / `partially_refunded` with a refund row.
- Operator Neon Auth user exists and `tenants.shopEmail = 'operator@demo.uniformorder.online'` for `demo-academy`.

## Step-by-step

| Step | Action | Narration | Expected screen |
|---|---|---|---|
| 1 | Click `RVRA-00003` from Kanban | "Søren Müller's order — trousers and tie, picked this morning." | Order detail |
| 2 | Click "Mark Ready" → confirm | "When the order's picked, one click marks it Ready." | Status pill changes to Ready; audit pane shows new event |
| 3 | Hover audit pane | "The parent gets the collection email and the audit log captures who clicked, when, from what IP." | `order_events` row visible: status_changed |
| 4 | Click "Print Pick Slip" | "Pick slip prints to the shop printer." | Print preview opens |
| 5 | Close preview → back to Kanban | (silent — pace) | Kanban refreshed |
| 6 | Click `RVRA-00038` | "And here's how refunds work." | Completed order, partially refunded |
| 7 | Show refund history pane | "Refunds work the same — one click on a line, type a reason, the Stripe Connect refund fires, the customer gets a refund email. Reconciliation is automatic." | Refund row with reason + amount |

## Timing
~4:00.

## Visual success criteria
- After step 2: order status pill updates to Ready; a new `order_events` row appears with `eventType=status_changed`, `fromStatus=to_prepare`, `toStatus=ready`.
- Step 4 print preview renders the student name (Anika Müller) and the line items (trousers, tie).
- Step 7 refund row shows the seeded reason and amount.

## Possible failure modes
- **"Mark Ready" button disabled** — the order may not be `to_prepare` (re-seed with `pnpm --filter web demo:seed -- --reset --only=academy`) or operator email mismatches `tenants.shopEmail`.
- **Print preview blocked** — browser print restrictions. Narrate around and skip to step 5.
- **Refund history empty on `RVRA-00038`** — re-run the seed; the refund row should appear with reason "Polo shirt returned — wrong size, exchanged for size 14 in-store".

## Re-record command
```bash
npx playwright test -c demo/product_demo/playwright/demo-recording.config.ts --grep "Act 4"
```

## Cleanup
None per-act. Final teardown via `pnpm --filter web demo:cleanup:confirm`.
