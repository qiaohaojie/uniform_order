# UniformOrder demo seed — quickstart

Idempotent seed for two isolated demo tenants:

- `demo-blank` — Hawthorn Grammar, empty workspace for live onboarding (Scenario A)
- `demo-academy` — Riverside Academy, ~40 orders across all states (Scenario B)

Production tenants `nsbh` and `rgsh` are never touched.

## Prerequisites

1. Local Neon dev DB up to date with all migrations applied (`apps/web/drizzle/`).
2. Node ≥20.6 (for `--env-file` support).
3. `pnpm install` has been run (adds `tsx`).
4. Three Neon Auth users created manually via the auth UI (one time, per machine):
   - `operator@demo.uniformorder.online`
   - `parent@demo.uniformorder.online`
   - `platformadmin@demo.uniformorder.online` (must also appear in `PLATFORM_ADMIN_EMAILS` env var)

   See `operator_run_guide.md` for the full procedure.

## Setup

```bash
cp GTM/demo_data/.env.demo.example GTM/demo_data/.env.demo
# Edit GTM/demo_data/.env.demo and set DATABASE_URL to your local dev DB
```

`.env.demo` is gitignored.

## Run a dry-run seed

```bash
pnpm --filter web demo:seed:dry
```

Prints the planned operations, opens no DB connection.

## Run the actual seed

```bash
pnpm --filter web demo:seed
```

Idempotent — re-running produces the same end state. Adds `--reset` to wipe existing demo data first:

```bash
pnpm --filter web demo:seed -- --reset
```

Seed only one tenant:

```bash
pnpm --filter web demo:seed -- --only=blank
pnpm --filter web demo:seed -- --only=academy
```

## Verify

After seeding, visit the local dev server:

- `http://localhost:3000/demo-academy` — parent shop with full catalog
- `http://localhost:3000/admin/demo-academy` — operator dashboard, ~40 orders
- `http://localhost:3000/demo-blank` — empty workspace for onboarding scenario

Log in as `operator@demo.uniformorder.online` (password from `.env.demo`) to reach admin routes.

## Clean up

Plan-only (default):

```bash
pnpm --filter web demo:cleanup
```

Execute:

```bash
pnpm --filter web demo:cleanup:confirm
```

Cleanup only touches rows scoped to `demo-blank` and `demo-academy`.

## Safety guards

The seed and cleanup scripts both refuse to run against non-localhost DBs by default and refuse to run against the prod Neon project (`super-cell-03401356`) under any normal circumstances. Override flags exist but are clearly named (`--allow-remote`, `--i-know-what-im-doing`). See `operator_run_guide.md` §Safety.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `DATABASE_URL is not set` | `.env.demo` missing or empty | Copy `.env.demo.example` and fill `DATABASE_URL` |
| `host 'X' is not localhost` | DATABASE_URL points to a remote DB | Use your local Neon dev DB. If you really need remote, pass `--allow-remote`. |
| `host 'X' matches prod pattern` | DATABASE_URL points to prod | Stop. Use a dev DB. |
| Orders FK violation on parent user | `DEMO_PARENT_USER_ID` is set but user doesn't exist in `neon_auth.user` | Create the Neon Auth user first, or clear `DEMO_PARENT_USER_ID`. |
| Cleanup leaves rows behind | Cascade FKs missing on a custom local schema | Re-apply migrations from `apps/web/drizzle/`. |
