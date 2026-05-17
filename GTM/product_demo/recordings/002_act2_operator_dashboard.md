# Act 2 — Operator dashboard

## Purpose
Show what the uniform shop coordinator sees on a working morning: realistic mix of orders, status distribution, Unicode parent names.

## Persona
School operator — `operator@demo.uniformorder.online`.

## Starting URL
`/auth/sign-in` (signed out) → `/admin/demo-academy` after sign-in.

## Seed prerequisite
- `demo-academy` seeded with 40 orders.
- Operator Neon Auth user exists (`operator@demo.uniformorder.online`).
- `tenants.shopEmail` for `demo-academy` matches the operator's email (seeded as such).

## Step-by-step

| Step | Action | Narration | Expected screen |
|---|---|---|---|
| 1 | Sign in as operator | "This is the shop coordinator signing in for the day." | Dashboard |
| 2 | Read KPI tiles | "Eight to prepare, six ready for collection, three on hold." | KPI tiles populated |
| 3 | Click "Orders" sidebar item | "Their Monday-morning work plan." | Kanban board |
| 4 | Scan to_prepare column | "Names render in any script — we've got Chloë Nguyen, José O'Connor, 李小明." | 8 cards |
| 5 | Hover "Needs Attention" column | "Three orders waiting on stock." | 3 cards |
| 6 | Click `RVRA-00015` | "Year 9 jumper, size 16. Stock comes in next week. Parent already got the hold email." | Order detail with hold reason |

## Timing
~3:00. Pace: emphasise the Unicode moment (~5s pause on the name).

## Visual success criteria
- Dashboard KPIs sum to 40.
- Kanban shows correct status distribution (8/6/14+3 needs_attention/14 completed in current view, depending on filters).
- Unicode parent names render without `?` boxes or `[object Object]`.
- Order detail shows the hold reason text.

## Possible failure modes
- **Kanban shows 0 cards** — order seed step failed. Re-run `pnpm --filter web demo:seed -- --reset --only=academy`.
- **Unicode names show as `?`** — DB collation issue on local Postgres. Confirm Neon uses UTF8 (it does by default).
- **Sign-in redirects back to sign-in** — operator email mismatch between Neon Auth user and `tenants.shopEmail`. Check `.env.demo` and the operator Neon Auth user email match.

## Re-record command
```bash
npx playwright test -c GTM/product_demo/playwright/demo-recording.config.ts --grep "Act 2"
```

## Cleanup
None per-act.
