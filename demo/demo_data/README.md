# UniformOrder demo seed — quickstart

Idempotent seed for two isolated demo tenants:

- `demo-blank` — Hawthorn Grammar, empty workspace for live onboarding (Scenario A)
- `demo-academy` — Riverside Academy, ~40 orders across all states (Scenario B)

Production tenants `imhs` and `rgsh` are never touched.

> **Two seeders exist.** This pack (`demo:seed`) is for sales/QA demo tenants.
> `apps/web/scripts/seed.mjs` seeds the product tenants `imhs` / `rgsh` — different purpose.

## Prerequisites

1. Local Neon (or Neon cloud) DB up to date with all migrations applied (`apps/web/drizzle/`).
2. Node ≥20.6 (for `--env-file` support).
3. `pnpm install` has been run (adds `tsx`).
4. At least one Neon Auth user exists (legal-version FK). Ideally create three via the auth UI:
   - `operator@demo.uniformorder.online`
   - `parent@demo.uniformorder.online`
   - `platformadmin@demo.uniformorder.online` (must also appear in `PLATFORM_ADMIN_EMAILS` in `apps/web/.env.local`)

   See `operator_run_guide.md` for the full procedure.

## Setup

```bash
cp demo/demo_data/.env.demo.example demo/demo_data/.env.demo
# Edit demo/demo_data/.env.demo — set DATABASE_URL to the same value as apps/web/.env.local
```

`.env.demo` is gitignored. Scripts refuse to start without it and print copy instructions.

## Run a dry-run seed

```bash
pnpm --filter web demo:seed:dry
```

Prints the planned operations, opens no DB connection.

## Run the actual seed

```bash
pnpm --filter web demo:seed
```

Idempotent — re-running produces the same end state. Wipe first with `--reset`:

```bash
pnpm --filter web demo:seed -- --reset
```

Seed only one tenant:

```bash
pnpm --filter web demo:seed -- --only=blank
pnpm --filter web demo:seed -- --only=academy
```

## Verify

After seeding, start the app (`pnpm dev:web`) and visit:

- `http://localhost:3000/` — school picker (demo tenants are publicly listed)
- `http://localhost:3000/demo-academy` — parent shop with full catalog
- `http://localhost:3000/admin/demo-academy` — operator dashboard, ~40 orders
- `http://localhost:3000/demo-blank` — empty workspace for onboarding scenario

### Fastest local operator login (dev only)

Skip Neon Auth UI for operator testing:

```
http://localhost:3000/api/dev/login?email=operator@demo.uniformorder.online&callbackURL=/admin/demo-academy
```

(Requires `NODE_ENV=development`. Does not create Neon Auth rows — seed still needs ≥1 real auth user for legal versions.)

For real parent/operator sessions, sign in as the accounts in `.env.demo`.

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

The seed and cleanup scripts allow:

- localhost / `127.0.0.1`
- Neon cloud hosts (`*.neon.tech`, `*.neon.build`)

They refuse the production Neon project (`super-cell-03401356`) and other non-Neon remotes unless you pass explicit override flags (`--allow-remote`, `--i-know-what-im-doing`). See `operator_run_guide.md` §Safety.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Missing demo/demo_data/.env.demo` | Env file not copied | `cp demo/demo_data/.env.demo.example demo/demo_data/.env.demo` |
| `DATABASE_URL is not set` | `.env.demo` empty | Set `DATABASE_URL` (same as `apps/web/.env.local`) |
| `host 'X' is not localhost or Neon` | Non-Neon remote host | Use Neon, or pass `--allow-remote` |
| `host 'X' matches prod pattern` | DATABASE_URL points to prod | Stop. Use a dev DB. |
| `neon_auth."user" is empty` | No auth users yet | Sign up once via `/auth/sign-up` |
| Orders FK violation on parent user | `DEMO_PARENT_USER_ID` set but user missing | Create the Neon Auth user, or clear the env var |
| Cleanup leaves rows behind | Cascade FKs missing on a custom local schema | Re-apply migrations from `apps/web/drizzle/` |
