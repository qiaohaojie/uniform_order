# Operator run guide — UniformOrder demo seed

Audience: the person running a live demo (founder, sales engineer). This document covers everything the `README.md` quickstart does not: which tables get touched, what the seeded data looks like, how to verify it visually, how to rotate credentials, and what NOT to do.

## What the seed creates

The seed writes two tenant rows into the `tenants` table: `demo-blank` (Hawthorn Grammar) and `demo-academy` (Riverside Academy). Both tenants are flagged as publicly listed and platform-approved. Their Stripe Connect fields are populated with `acct_demo_*` values that are internally coherent but are never submitted against the real Stripe API. Accompanying each tenant is one row in `tenant_settings` (both set to `standard` workflow mode, pickup-only) and one row in `tenant_legal_versions`; each tenant's `currentLegalVersionId` points at version 1.

The catalog contains 16 items across both tenants: 6 items in Hawthorn Grammar (`demo-blank`) and 10 items in Riverside Academy (`demo-academy`). These expand into approximately 24 catalog variants across sizes and styles.

`demo-academy` receives 40 orders in the `orders` table, with IDs `RVRA-00001` through `RVRA-00040`. `demo-blank` has 0 orders, which lets you contrast a fresh tenant with a busy one in the same demo session. The 40 orders expand into approximately 70 order lines and roughly 100 order events covering the full event taxonomy: `order_paid`, `status_changed`, `ready_email_sent`, `hold_email_sent`, and `refund_created`. Approximately 30 notification events appear in `order_notification_events` with `status='sent'` and `providerMessageId='msg_demo_*'`. Three refunds appear in `order_refunds` with `stripeRefundId='re_demo_*'`.

No rows are written to `neon_auth.users` — that schema is owned by Neon Auth and must be populated out-of-band.

## Out-of-band step: create Neon Auth demo users

This is a **one-time setup per machine**. The seed cannot create login users.

1. Visit `http://localhost:3000/auth/sign-up`.
2. Create the three accounts listed in `.env.demo.example`. Use password `DemoPass123!` for all three (or choose a different password and record it in `.env.demo`):
   - `operator@demo.uniformorder.online`
   - `parent@demo.uniformorder.online`
   - `platformadmin@demo.uniformorder.online`
3. For the platform-admin account: also add the email to your local `PLATFORM_ADMIN_EMAILS` env var. Without this, the `/platform` route will refuse access.
4. Optionally: open the Neon dashboard, navigate to the Auth tab, copy the UUID of the parent account, and paste it into `.env.demo` as `DEMO_PARENT_USER_ID`. Re-running the seed will attribute approximately 3 orders to that user so the parent portal demo shows order history. If `DEMO_PARENT_USER_ID` is left unset, those orders are created without a user association and the parent order-detail route returns 404 for them.

These users persist in the Neon Auth database across seed runs. The cleanup script does not delete them (we don't own that schema). To remove them, use the Neon Auth admin UI directly.

## Verifying from the UI

After `pnpm --filter web demo:seed`, open the following URLs in order:

1. `http://localhost:3000/admin/demo-academy` — sign in as `operator@demo.uniformorder.online`. The dashboard summarises orders grouped by status; you should see non-zero counts across at least three status buckets.
2. `http://localhost:3000/admin/demo-academy/orders` — the Kanban board should display columns for `to_prepare`, `ready`, `completed`, and `needs_attention`. Order cards bear Unicode parent names (for example 李小明 as the parent of student Wei Liu) which signals realistic international data.
3. `http://localhost:3000/admin/demo-academy/reports` — scoped to the last 30 days, approximately 14 completed orders should appear.
4. `http://localhost:3000/admin/demo-academy/catalog` — 10 items with editable variants.
5. `http://localhost:3000/demo-academy` — the parent-facing catalog for Riverside Academy.
6. `http://localhost:3000/demo-blank/` — the parent-facing catalog for Hawthorn Grammar; 6 items, no orders in the admin view.

If any page returns an error or shows zero data unexpectedly, check the seed output for SQL errors and confirm `DATABASE_URL` in `.env.demo` is pointing at your local or dev-branch database, not production.

### Checking the operator sign-in

If the admin routes redirect you to a sign-in page after you have created the Neon Auth users, confirm that `operator@demo.uniformorder.online` is listed as the `shopEmail` on the `demo-academy` tenant row. The `isTenantOperatorEmail` helper in `lib/auth/authorization.ts` gates access by comparing the authenticated user's email against the tenant's `shopEmail` field; a mismatch causes a silent 401 redirect rather than an error page.

### Checking the platform-admin route

`/platform` will return a 403 or redirect to the home page if `platformadmin@demo.uniformorder.online` is not included in the `PLATFORM_ADMIN_EMAILS` environment variable. This variable is read at request time (not build time), so updating `.env.demo` and restarting the dev server is sufficient — no rebuild required.

## Targeting a remote demo staging DB

Strongly discouraged for routine use; the seed is designed for localhost. If you have a Neon dev branch you want to seed:

```bash
DATABASE_URL='postgresql://...your-branch-host...' \
  pnpm --filter web demo:seed -- --allow-remote
```

This bypasses the localhost guard but still refuses if the host matches any prod pattern. Always run `--dry-run` first.

## What NOT to do

- Never run with the prod `DATABASE_URL` even with `--i-know-what-im-doing`. The flag exists for edge cases (e.g. a misnamed dev branch); the production Neon project is `super-cell-03401356` and is hard-coded into the guard list.
- Never commit `.env.demo` (gitignored, but double-check before pushing).
- Never use the demo accounts for real testing of new features — they're for demo runs only. Use your real dev account.
- Never edit fixture data in `demo-scenarios.json` immediately before a demo. Test the seed first.
- Never run `cleanup` against a DB that has had real customer data seeded into demo tenants. The cleanup is namespace-scoped, but if you mixed real and demo, you'll lose real data.

## Rotating demo passwords

1. Update Neon Auth user passwords via the auth UI.
2. Update `.env.demo` to match.
3. Commit a `.env.demo.example` change if the canonical password changes.

The default password `DemoPass123!` is documented in `.env.demo.example`. If you change it for a persistent demo environment (for example a shared staging branch), make sure every team member who runs demos has the updated `.env.demo` before the next session.

Note that rotating the password does not require re-running the seed. The Neon Auth user record and the tenant operator mapping are independent: the seed controls tenant rows, the auth UI controls credentials. You can update one without touching the other.

## Regenerating data before a demo

Run both commands sequentially before every demo session to start from a known-good state:

```bash
pnpm --filter web demo:cleanup:confirm && pnpm --filter web demo:seed
```

Allow roughly 10–15 seconds for the seed to complete; it performs several batch inserts and waits for each to settle. The seed is deterministic — re-running produces identical names, totals, and dates relative to "now". This matters for reproducible recordings: if you screen-record the same demo flow twice, the order IDs and parent names will match. The `cleanup:confirm` step removes all previously seeded rows from the demo tenants before re-inserting, so there is no risk of duplicate IDs.

## Safety guards (full list)

The seed/cleanup scripts abort if:

1. `DATABASE_URL` is unset.
2. Host is not localhost AND `--allow-remote` was not passed.
3. Host matches `{prod, production, super-cell-03401356}` AND `--i-know-what-im-doing` was not passed.
4. `NODE_ENV === 'production'` AND `--i-know-what-im-doing` was not passed.

Guard 3 is the most important one for this project: the production Neon project `super-cell-03401356` is hard-coded, so even a misconfigured `DATABASE_URL` that accidentally points at production will be caught before a single write is attempted. Guards 2 and 4 serve as belt-and-suspenders for CI environments where `NODE_ENV` may differ from what you expect on a local machine.

All four guards are checked at startup, before any tenant rows are read or written, so a failed run leaves the database unchanged.
