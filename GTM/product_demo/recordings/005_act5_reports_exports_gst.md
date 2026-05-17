# Act 5 — Reports & exports

## Purpose
Show how the operator pulls a GST-itemised CSV at month-end — the compliance/accounting moment.

## Persona
School operator — signed in as `operator@demo.uniformorder.online`.

## Starting URL
`/admin/demo-academy/reports`.

## Seed prerequisite
- ~14 `completed`/`paid` orders within the last 30 days on `demo-academy` (seed default distribution).
- Spreadsheet app (Numbers / Excel / Google Sheets) ready on a second display.

## Step-by-step

| Step | Action | Narration | Expected screen |
|---|---|---|---|
| 1 | Open `/admin/demo-academy/reports` | "At month-end, the operator pulls a CSV." | Reports page with date range default |
| 2 | Confirm range = "Last 30 days" | (silent) | Range selector at 30 days |
| 3 | Note revenue + GST totals | "Revenue this month, GST collected, refunds flagged." | KPI tiles populated |
| 4 | Click "Export CSV" | "GST is broken out — Riverside's accountant pivots this straight into BAS today, and we're shipping native BAS export next quarter." | File downloads |
| 5 | Open CSV in spreadsheet app | "Every refunded line is flagged. Reconciling against the bank statement takes about an afternoon now instead of a weekend." | CSV opens with UTF-8 names intact |
| 6 | Highlight GST column | (silent — pace) | GST values = subtotal / 11 per row |

## Timing
~3:00.

## Visual success criteria
- Revenue total > $0 and approximately matches the sum of `completed` orders in the last 30 days.
- GST column in CSV equals subtotal / 11 for each row.
- Unicode parent names (`Chloë`, `José`, `李小明`, `Søren`, etc.) render correctly in the spreadsheet.

## Possible failure modes
- **"No orders in range"** — orders may have aged out of the 30-day window since the seed ran. Re-seed: `pnpm --filter web demo:seed -- --reset --only=academy`.
- **CSV shows `?` for Unicode names** — open the file as UTF-8 (Numbers/Excel may default to MacRoman/Win-1252).

## Re-record command
```bash
npx playwright test -c GTM/product_demo/playwright/demo-recording.config.ts --grep "Act 5"
```

## Cleanup
None per-act. Final teardown via `pnpm --filter web demo:cleanup:confirm`.
