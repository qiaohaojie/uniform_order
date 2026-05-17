# Act 1 — Setup & login

## Purpose
Open the demo with the platform-admin perspective: multi-tenancy, approval gate, Stripe Connect status.

## Persona
Platform admin — `platformadmin@demo.uniformorder.online`.

## Starting URL
`http://localhost:3000/platform`

## Seed prerequisite
- Both demo tenants seeded (`pnpm --filter web demo:seed`).
- `PLATFORM_ADMIN_EMAILS` env var contains `platformadmin@demo.uniformorder.online`.

## Step-by-step

| Step | Action | Narration | Expected screen |
|---|---|---|---|
| 1 | Open `/platform` | "This is the platform console — where new schools get approved." | Console root with tenant count |
| 2 | Click "Tenants" → `/platform/tenants` | "Here are our schools. Two demo tenants today." | Tenant table, 2 rows |
| 3 | Click `demo-academy` row | "Riverside Academy was approved last week. Stripe Connect verified, payouts enabled." | Tenant detail |
| 4 | Hover Stripe status badge | "Once Stripe Connect verification clears, they can take payments." | Tooltip / status pill |

## Timing
~2:00. Pace: slow scan, deliberate hover.

## Visual success criteria
- `/platform/tenants` shows both `demo-blank` and `demo-academy` rows.
- Stripe status column shows "Charges enabled / Payouts enabled" for both.
- Approval status column shows "approved" for both.

## Possible failure modes
- **Tenants list empty** — seed not run, or DATABASE_URL points at wrong DB. Run `pnpm --filter web demo:seed:dry` to confirm.
- **Redirect to `/auth/sign-in`** — current Neon Auth session is not in `PLATFORM_ADMIN_EMAILS`. Add the email and restart `pnpm dev`.
- **`/platform` route stubby / blank** — expected. Narrate around: "The full console is in design — current sprint."

## Re-record command
```bash
npx playwright test -c GTM/product_demo/playwright/demo-recording.config.ts --grep "Act 1"
```

## Cleanup
None per-act. Final teardown via `pnpm --filter web demo:cleanup:confirm`.
