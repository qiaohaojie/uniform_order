# demo/ — implementation notes

This directory contains all demo / sales / recording assets for UniformOrder. The contents are additive; the only application-level changes outside `demo/` are:

## App-level changes

### `apps/web/package.json`

Four scripts route through `demo/demo_data/run.mjs` (clear error if `.env.demo` is missing):

```json
"demo:seed:dry":          "node ../../demo/demo_data/run.mjs seed --dry-run",
"demo:seed":              "node ../../demo/demo_data/run.mjs seed",
"demo:cleanup":           "node ../../demo/demo_data/run.mjs cleanup",
"demo:cleanup:confirm":   "node ../../demo/demo_data/run.mjs cleanup --confirm"
```

`tsx` is a `devDependency` for runtime TypeScript execution. Production builds are unaffected.

### Root `.gitignore`

Added:

```
demo/product_demo/recordings/output/
demo/demo_data/.env.demo
*.webm
*.mp4
```

`.env.demo` ignore is scoped to that path so application-level `.env*` rules elsewhere are unaffected.

## No changes to

- `apps/web/src/db/schema.ts`
- `apps/web/src/db/queries.ts`
- `apps/web/src/db/index.ts`
- `apps/web/src/lib/data.ts` (the static `TENANTS` / `CATALOG` maps remain untouched; demo tenants are DB-only)
- Any `apps/web/src/app/` route or component
- Any existing migration in `apps/web/drizzle/`

## Out-of-band Neon Auth step

`neonAuthUsers` lives in the `neon_auth` schema, owned by Neon Auth. The seed cannot create login users. Operators must create the three demo accounts manually (see `demo_data/operator_run_guide.md`):

- `operator@demo.uniformorder.online`
- `parent@demo.uniformorder.online`
- `platformadmin@demo.uniformorder.online`

Cleanup does not touch these users — they persist across seed cycles and are removed manually via the Neon Auth admin UI if needed.

## Fake Stripe references

Demo orders carry `stripePaymentIntentId='pi_demo_*'` and `stripeRef='ch_demo_*'`. Demo refunds carry `stripeRefundId='re_demo_*'`. These never resolve against real Stripe.

To exclude demo data from any future reconciliation query, filter by:
- `orders.stripePaymentIntentId NOT LIKE 'pi_demo_%'`, or
- `orders.tenantId NOT IN ('demo-blank', 'demo-academy')`.

The second form is preferred — it doesn't depend on Stripe ref hygiene.

## Safety guarantees

The seed and cleanup scripts both abort before opening any DB connection if:

1. `DATABASE_URL` is unset.
2. Host is not localhost and not Neon (`*.neon.tech` / `*.neon.build`), and `--allow-remote` was not passed.
3. Host matches `{prod, production, super-cell-03401356}` (the prod Neon project), and `--i-know-what-im-doing` was not passed.
4. `NODE_ENV === 'production'`, and `--i-know-what-im-doing` was not passed.

Cleanup is **strictly scoped** by `tenantId IN ('demo-blank','demo-academy')` and prints a deletion plan before any write. `--confirm` is required to execute.

## Idempotency contract

Re-running `pnpm --filter web demo:seed` against a previously seeded DB produces the same end-state. Implementation:

- `tenants`, `tenantSettings`, `catalogItems` use `ON CONFLICT DO UPDATE` on natural keys.
- `catalogVariants`, `orders`, `orderLines`, `orderEvents`, `orderNotificationEvents`, `orderRefunds` are delete-then-insert per tenant or per order — clean because they lack natural keys.
- `tenantLegalVersions` is insert-once (the first run creates version 1; subsequent runs find the existing version).

Use `--reset` to wipe selected demo tenants (same scope as cleanup) then re-seed — cleaner for fixture changes.

When `DEMO_PARENT_USER_ID` is set to a real `neon_auth."user"` UUID, the first 3 orders in each tenant that has orders get `orders.user_id` set so parent portal history works by user id as well as email.

## Schema dependencies

If `apps/web/src/db/schema.ts` changes, the seed/cleanup may need updates. Symbols referenced:

- Tables: `tenants`, `tenantSettings`, `tenantLegalVersions`, `catalogItems`, `catalogVariants`, `orders`, `orderLines`, `orderEvents`, `orderNotificationEvents`, `orderRefunds`, `auditEvents`.
- Enums: `orderFulfilmentStatusEnum`, `orderPaymentStatusEnum`, `orderCompletionTypeEnum`, `orderFulfilmentMethodEnum`, `workflowModeEnum`, `notificationTypeEnum`, `notificationStatusEnum`, `orderEventTypeEnum`, `policyModeEnum`.

If any of these symbols are renamed, the seed will fail to compile / load via tsx and the error will be obvious.

## Migration tooling note

The seed uses runtime Drizzle ORM via the same `@neondatabase/serverless` HTTP client the app uses (`db.batch`, never `transaction`). It does NOT use `drizzle-kit`, which avoids the websocket blocker documented in the `project_drizzle_kit_websocket_blocker` memory.

## Home picker

`app/page.tsx` uses `getPubliclyListedTenants()` from the DB. Seeded demo tenants set `isPubliclyListed: true`, so they appear on `/` after seed. Direct URLs (`/demo-blank`, `/demo-academy`) still work for playbooks and recordings.

## Live Stripe in Act 3 (opt-in)

Default demo runs the checkout flow up to the Stripe Payment Element render and narrates around the actual charge. For a fully working test payment:

1. Create a Stripe Connect test account via the Stripe dashboard.
2. Manually update `demo-blank` (or `demo-academy`) `tenants.stripeAccountId` to the real test-mode account ID via the platform console UI or a one-off SQL update.
3. The Element will render real test-card forms; test card `4242 4242 4242 4242` (any future expiry, any CVC) completes the order. Webhook (`/api/stripe/webhook`) handles `payment_intent.succeeded` and the operator Kanban updates within ~2 seconds.

Restore the fake account ID after the demo by re-running `pnpm --filter web demo:seed -- --reset`.
