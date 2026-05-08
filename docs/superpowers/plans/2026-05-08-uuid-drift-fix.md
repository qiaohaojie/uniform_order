# UUID Drift Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile `apps/web/src/db/schema.ts` with Neon prod (`cool-wind-76972110`) by flipping 4 `user.id` reference columns from `text` to `uuid`, generating migration 0007, and attaching the missing `order_refunds.operator_user_id` FK.

**Architecture:** One PR, one commit, one new migration (`0007_fix_user_id_uuid_drift`). Schema changes are 4 single-token edits. The migration's effect is mostly no-ops at the DB level (3 columns already `uuid` in prod from PR #6's hand-applied deviations) plus one real ALTER + FK attach for `order_refunds.operator_user_id`. The migration file is hand-edited after `drizzle-kit generate` to (a) strip the foreign-managed `neon_auth.user` ALTER, (b) defensive `NULLIF` cast, (c) `DROP CONSTRAINT IF EXISTS` for a constraint that doesn't exist in prod, (d) ensure exactly one post-ALTER `ADD CONSTRAINT`.

**Tech Stack:** Drizzle ORM 0.45.x, drizzle-kit 0.31.x, PostgreSQL (Neon), pnpm workspaces, TypeScript. Apply via Neon MCP tools (`mcp__Neon__run_sql`, `mcp__Neon__run_sql_transaction`). No test suite exists in the project — the "tests" are pre-flight gates and post-apply verification queries.

**Spec:** [docs/superpowers/specs/2026-05-08-uuid-drift-fix-design.md](../specs/2026-05-08-uuid-drift-fix-design.md)

**Neon target:** project `cool-wind-76972110` (org `org-withered-dream-72376224`)

---

## File map

| File | Role |
|---|---|
| `apps/web/src/db/schema.ts` | 4 `text` → `uuid` edits at lines 21, 136, 180, 196. |
| `apps/web/drizzle/0007_fix_user_id_uuid_drift.sql` | **Generated**, then hand-edited per §5.3. |
| `apps/web/drizzle/meta/_journal.json` | **Auto-updated** by drizzle-kit generate (new entry for 0007). |
| `apps/web/drizzle/meta/0007_snapshot.json` | **Auto-generated**. Verify `prevId == 0006_snapshot.json.id`. |
| `apps/web/drizzle.config.ts` | **Untouched.** Cleanup deferred to `docs/remaining_work.md` §4.11. |
| `docs/remaining_work.md` | §4.11 entry already added in the brainstorming session — include in the same commit. |
| `docs/superpowers/specs/2026-05-08-uuid-drift-fix-design.md` | Spec — include in the same commit. |
| `docs/superpowers/plans/2026-05-08-uuid-drift-fix.md` | This plan — include in the same commit. |

---

## Task 1: Create branch and edit schema.ts

**Files:**
- Modify: `apps/web/src/db/schema.ts` (lines 21, 136, 180, 196)

- [ ] **Step 1.1: Confirm starting state and branch off main**

```bash
git status
git branch --show-current
```

The brainstorming + writing-plans + checkpoint flow committed the spec, plan, and `remaining_work.md` §4.11 entry to `main` as commit `287d467` (`docs(uuid-drift): spec and implementation plan for 0007 fix`). Expected state at Task 1 start:

- On `main`, working tree clean (modulo `docs/create-a-handoff-prompt-toasty-sutherland.md` from a prior session — leave alone, do not stage).

If the working tree is **not** clean (e.g. the checkpoint commit was skipped and the spec/plan/`remaining_work.md` are still uncommitted), carry those edits onto the new branch — they belong in the eventual fix commit. If the tree **is** clean (checkpoint was run), proceed normally; the doc changes are already on `main` and don't need re-committing on the branch. Adjust Task 9's commit/PR scope accordingly (omit those files since they're already in main's history).

```bash
git checkout -b fix/uuid-drift
```

- [ ] **Step 1.2: Edit schema.ts line 21 — `neonAuthUsers.id`**

Use Edit tool to change:

```ts
  id: text("id").primaryKey(),
```

to:

```ts
  id: uuid("id").primaryKey(),
```

(The `uuid` import already exists at line 11.)

- [ ] **Step 1.3: Edit schema.ts line 136 — `orders.userId`**

```ts
    userId: text("user_id").references(() => neonAuthUsers.id, { onDelete: "set null" }),
```

→

```ts
    userId: uuid("user_id").references(() => neonAuthUsers.id, { onDelete: "set null" }),
```

- [ ] **Step 1.4: Edit schema.ts line 180 — `orderRefunds.operatorUserId`**

```ts
    operatorUserId: text("operator_user_id").references(() => neonAuthUsers.id, { onDelete: "set null" }),
```

→

```ts
    operatorUserId: uuid("operator_user_id").references(() => neonAuthUsers.id, { onDelete: "set null" }),
```

- [ ] **Step 1.5: Edit schema.ts line 196 — `parentChildren.parentId`**

```ts
    parentId: text("parent_id")
```

→

```ts
    parentId: uuid("parent_id")
```

- [ ] **Step 1.6: Type-check passes after schema edits**

Run:

```bash
pnpm check-types:web
```

Expected: exits 0 (no errors). Drizzle's `uuid` and `text` both map to TS `string`, so no call sites should break. If it fails, stop — do NOT proceed; investigate the offending call site (the change is supposed to be invisible at the TS level).

- [ ] **Step 1.7: Visual sanity check on the diff**

```bash
git diff apps/web/src/db/schema.ts
```

Expected: exactly 4 hunks, each a single-token `text(` → `uuid(` swap (so 8 changed lines total — 4 `-`, 4 `+`). No other changes.

---

## Task 2: Generate migration 0007

**Files:**
- Create: `apps/web/drizzle/0007_fix_user_id_uuid_drift.sql`
- Modify: `apps/web/drizzle/meta/_journal.json`
- Create: `apps/web/drizzle/meta/0007_snapshot.json`

- [ ] **Step 2.1: Run drizzle-kit generate**

From repo root:

```bash
pnpm --filter web exec drizzle-kit generate --name=fix_user_id_uuid_drift
```

Expected output: drizzle-kit reports 1 new migration created. Three new/modified files appear:
- `apps/web/drizzle/0007_fix_user_id_uuid_drift.sql` (new)
- `apps/web/drizzle/meta/_journal.json` (modified — new entry at index 7)
- `apps/web/drizzle/meta/0007_snapshot.json` (new)

If drizzle-kit reports "no changes detected," stop — schema edits in Task 1 didn't take, or the snapshot already includes them.

- [ ] **Step 2.2: Verify journal entry**

Read `apps/web/drizzle/meta/_journal.json`. Confirm a new entry at `idx: 7` with `tag: "0007_fix_user_id_uuid_drift"`. Note the `when` value (millis); you'll need it for Task 6.

- [ ] **Step 2.3: Verify snapshot chain integrity**

Read both snapshot files and check chain:

```bash
node -e "const a=require('./apps/web/drizzle/meta/0006_snapshot.json'); const b=require('./apps/web/drizzle/meta/0007_snapshot.json'); console.log('0006.id =', a.id); console.log('0007.prevId =', b.prevId); console.log('match:', a.id === b.prevId);"
```

Expected: `match: true`. If false, abort and investigate before continuing.

- [ ] **Step 2.4: Inventory the generated SQL — fill in this checklist**

Read `apps/web/drizzle/0007_fix_user_id_uuid_drift.sql` and answer each question with `yes` or `no`. The Task 3 hand-edits depend on these answers:

- [ ] **A.** Does the file contain any DDL targeting `"neon_auth"."user"` (e.g. `ALTER TABLE "neon_auth"."user" ALTER COLUMN "id" ...`)? Yes / No
- [ ] **B.** Does the file contain `ALTER TABLE "orders" ALTER COLUMN "user_id" SET DATA TYPE uuid ...`? Yes / No
- [ ] **C.** Does the file contain `DROP CONSTRAINT "orders_user_id_user_id_fk"` and a corresponding `ADD CONSTRAINT "orders_user_id_user_id_fk"`? Yes / No
- [ ] **D.** Does the file contain `ALTER TABLE "parent_children" ALTER COLUMN "parent_id" SET DATA TYPE uuid ...`? Yes / No
- [ ] **E.** Does the file contain `DROP CONSTRAINT "parent_children_parent_id_user_id_fk"` and a corresponding `ADD CONSTRAINT "parent_children_parent_id_user_id_fk"`? Yes / No
- [ ] **F.** Does the file contain `ALTER TABLE "order_refunds" ALTER COLUMN "operator_user_id" SET DATA TYPE uuid ...`? Yes / No (this MUST be Yes — otherwise drizzle-kit didn't see the schema change)
- [ ] **G.** Does the file contain `DROP CONSTRAINT "order_refunds_operator_user_id_user_id_fk"`? Yes / No
- [ ] **H.** Does the file contain `ADD CONSTRAINT "order_refunds_operator_user_id_user_id_fk"`? Yes / No

If F is No, abort — the generate didn't see the schema edits. Fix Task 1 first.

**Do not commit yet** — file is about to be hand-edited.

---

## Task 3: Apply §5.3 hand-edits to the generated SQL

**Files:**
- Modify: `apps/web/drizzle/0007_fix_user_id_uuid_drift.sql`

The four hand-edits from spec §5.3.

- [ ] **Step 3.1: Strip the `neon_auth.user.id` ALTER if drizzle emitted it (Step 2.4 answer A)**

If A = Yes: remove that statement and its `--> statement-breakpoint` separator. If A = No: skip.

After this edit, the `0007_*.sql` file contains no DDL TARGETING `neon_auth.*` (no `ALTER TABLE neon_auth.user ...`). FK statements like `ADD CONSTRAINT ... REFERENCES "neon_auth"."user"(...)` reference the schema but don't issue DDL against it — those stay. The `0007_snapshot.json` correctly retains `neon_auth.user.id` as `uuid` — this asymmetry is intentional; see spec §5.3 step 1.

- [ ] **Step 3.2: Force defensive NULLIF cast on `order_refunds.operator_user_id`**

Find the line for `order_refunds.operator_user_id`. Replace the `USING` clause with `USING NULLIF("operator_user_id", '')::uuid`. So:

```sql
ALTER TABLE "order_refunds" ALTER COLUMN "operator_user_id" SET DATA TYPE uuid USING "operator_user_id"::uuid;
```

becomes:

```sql
ALTER TABLE "order_refunds" ALTER COLUMN "operator_user_id" SET DATA TYPE uuid USING NULLIF("operator_user_id", '')::uuid;
```

- [ ] **Step 3.3: Convert `DROP CONSTRAINT order_refunds_operator_user_id_user_id_fk` to `DROP CONSTRAINT IF EXISTS` (Step 2.4 answer G)**

If G = Yes: change `DROP CONSTRAINT` to `DROP CONSTRAINT IF EXISTS` for that one constraint. Reason: snapshot[0006] declares this FK, but it doesn't exist in prod (gap we're closing) — a plain DROP would fail. If G = No, skip.

> **Note on the existing-FK branch (Task 5.2):** if the pre-flight in Task 5 finds the FK already attached correctly, the DROP and ADD must be removed *as a pair* in Task 6 (see Step 6.1's "FK already exists" branch). Never let DROP execute without ADD — that would destroy the working FK.

- [ ] **Step 3.4: Ensure exactly one post-ALTER `ADD CONSTRAINT` for the order_refunds FK (Step 2.4 answer H)**

If H = Yes: verify the existing ADD appears AFTER the ALTER COLUMN TYPE for `operator_user_id`, and it references `"neon_auth"."user"("id") ON DELETE set null`. Leave it.

If H = No: append this statement at the end of the file (before the final newline), as its own `--> statement-breakpoint`-separated entry:

```sql
ALTER TABLE "order_refunds" ADD CONSTRAINT "order_refunds_operator_user_id_user_id_fk" FOREIGN KEY ("operator_user_id") REFERENCES "neon_auth"."user"("id") ON DELETE set null ON UPDATE no action;
```

(Order matters: the column-type ALTER must precede any FK ADD that references it.)

- [ ] **Step 3.5: Re-read the file end-to-end**

Read `apps/web/drizzle/0007_fix_user_id_uuid_drift.sql` and confirm:

1. Zero DDL **targeting** `neon_auth.*` (no `ALTER TABLE "neon_auth"."user" ...`). FK references inside other tables' constraints (e.g. `REFERENCES "neon_auth"."user"("id")`) are allowed and required.
2. Exactly one `ALTER TABLE "order_refunds" ALTER COLUMN "operator_user_id" SET DATA TYPE uuid USING NULLIF(...)`.
3. Exactly one `ADD CONSTRAINT "order_refunds_operator_user_id_user_id_fk" ...`, with `REFERENCES "neon_auth"."user"("id") ON DELETE set null`.
4. Any DROP CONSTRAINT for that FK uses `IF EXISTS`.
5. ALTERs for `orders.user_id` and `parent_children.parent_id` are present (with whatever DROP/ADD framing drizzle emitted).

If any check fails, fix in place.

---

## Task 4: Local verification gate

**Files:**
- Read-only: `apps/web/drizzle/0007_fix_user_id_uuid_drift.sql`, `apps/web/src/db/schema.ts`

- [ ] **Step 4.1: Type-check still passes**

```bash
pnpm check-types:web
```

Expected: exits 0.

- [ ] **Step 4.2: Compute file hash**

```bash
shasum -a 256 apps/web/drizzle/0007_fix_user_id_uuid_drift.sql
```

Capture the 64-char hex hash. You'll paste this into Task 6's INSERT statement.

> **Recovery:** the hash is deterministic — if you lose the value between tasks (e.g. context turnover across subagents), simply re-run `shasum -a 256 apps/web/drizzle/0007_fix_user_id_uuid_drift.sql`. The committed file is the source of truth.

- [ ] **Step 4.3: Read the journal `when` millis**

Read `apps/web/drizzle/meta/_journal.json` and capture the `when` integer for the `idx: 7` entry. This becomes the `created_at` value in Task 6's INSERT (it's milliseconds since epoch — the `drizzle.__drizzle_migrations` table stores it as bigint).

> **Recovery:** also re-readable from `_journal.json` if you lose the value.

---

## Task 5: Pre-flight gates against Neon prod

All checks via `mcp__Neon__run_sql` against project `cool-wind-76972110`.

- [ ] **Step 5.0: Confirm the database name**

Call `mcp__Neon__describe_project` with `params.projectId = "cool-wind-76972110"` and capture the database name from the response (likely `neondb`, but verify — Neon projects can have arbitrary database names). All subsequent `mcp__Neon__run_sql` and `mcp__Neon__run_sql_transaction` calls must use this exact `databaseName`.

- [ ] **Step 5.1: Confirm `order_refunds` is empty**

Run via `mcp__Neon__run_sql`:

```sql
SELECT COUNT(*) FROM order_refunds;
```

Expected: `0`. If non-zero, **abort** — re-evaluate the `NULLIF` cast (it handles empty-string but not arbitrary text values). Surface to the user.

- [ ] **Step 5.2: Check current state of the missing FK**

Run via `mcp__Neon__run_sql`:

```sql
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'order_refunds'::regclass
  AND contype = 'f'
  AND conname = 'order_refunds_operator_user_id_user_id_fk';
```

Three possible outcomes — handle as follows:

- **Zero rows** (expected): proceed. The FK does not exist; the §5.3-step-4 `ADD CONSTRAINT` must end up applied in Task 6.
- **One row, `def` = `FOREIGN KEY (operator_user_id) REFERENCES neon_auth."user"(id) ON DELETE SET NULL`**: FK already attached correctly. **Strip BOTH the DROP CONSTRAINT IF EXISTS and the ADD CONSTRAINT for this FK** from the apply transaction in Task 6 — keep them as a pair, never split. (Letting the DROP execute alone would destroy the existing valid FK; letting the ADD execute alone would error on duplicate.) Note this in the plan checklist for Step 6.1.
- **One row, `def` differs**: **abort**. Surface to the user — a wrong-shaped FK is in place and needs human decision before continuing.

- [ ] **Step 5.3: Re-confirm DB column types still match spec's "DB type today"**

This is a re-confirmation, not a new check — the spec was written assuming these states. If anything has shifted since the spec was written, the apply plan needs revisiting.

Run via `mcp__Neon__run_sql`:

```sql
SELECT table_schema, table_name, column_name, data_type
FROM information_schema.columns
WHERE (table_name = 'order_refunds'   AND column_name = 'operator_user_id')
   OR (table_name = 'orders'          AND column_name = 'user_id')
   OR (table_name = 'parent_children' AND column_name = 'parent_id')
   OR (table_schema = 'neon_auth' AND table_name = 'user' AND column_name = 'id');
```

Expected (per spec §1):

| table | column | data_type |
|---|---|---|
| `neon_auth.user` | `id` | `uuid` |
| `orders` | `user_id` | `uuid` |
| `parent_children` | `parent_id` | `uuid` |
| `order_refunds` | `operator_user_id` | `text` |

If anything differs, abort and surface to the user — the world has shifted since the spec was written.

---

## Task 6: Apply the migration to Neon prod

Use `mcp__Neon__run_sql_transaction` against project `cool-wind-76972110`.

- [ ] **Step 6.1: Build the statement array from the post-hand-edit `0007_*.sql`**

Read `apps/web/drizzle/0007_fix_user_id_uuid_drift.sql`. Each statement separated by `--> statement-breakpoint` becomes one element of the `sqlStatements` array passed to `mcp__Neon__run_sql_transaction`.

Append one final element — the migration-row INSERT — using the hash from Step 4.2 and the `when` millis from Step 4.3:

```sql
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
VALUES ('<sha256-from-step-4.2>', <when-millis-from-step-4.3>);
```

**Branch on Step 5.2's outcome:**

- If Step 5.2 returned **zero rows** (FK absent — expected case): use the array as-is.
- If Step 5.2 returned the **"FK already attached" outcome**: omit BOTH the `DROP CONSTRAINT IF EXISTS "order_refunds_operator_user_id_user_id_fk"` and `ADD CONSTRAINT "order_refunds_operator_user_id_user_id_fk" ...` elements from the array — they form a pair, drop them together. The column-type ALTER stays. (Letting DROP run alone would destroy the existing valid FK.)

- [ ] **Step 6.2: Apply atomic transaction**

Call `mcp__Neon__run_sql_transaction`:
- `params.projectId`: `cool-wind-76972110`
- `params.databaseName`: the value captured in Step 5.0
- `params.sqlStatements`: the array from Step 6.1

Expected: success, with each statement reporting either rowsAffected or "Command completed successfully." If any statement fails, the whole transaction rolls back. Surface errors to the user — do NOT retry blindly.

---

## Task 7: Post-apply verification

All checks via `mcp__Neon__run_sql` against project `cool-wind-76972110`.

- [ ] **Step 7.1: All 4 columns are `uuid`**

```sql
SELECT table_schema, table_name, column_name, data_type
FROM information_schema.columns
WHERE (table_name = 'order_refunds'   AND column_name = 'operator_user_id')
   OR (table_name = 'orders'          AND column_name = 'user_id')
   OR (table_name = 'parent_children' AND column_name = 'parent_id')
   OR (table_schema = 'neon_auth' AND table_name = 'user' AND column_name = 'id');
```

Expected: all 4 rows report `data_type = 'uuid'`. If any row is `text`, the migration didn't apply that ALTER — abort and investigate.

- [ ] **Step 7.2: `order_refunds` FK now exists with correct definition**

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'order_refunds'::regclass AND contype = 'f';
```

Expected output must include a row:
- `conname` = `order_refunds_operator_user_id_user_id_fk`
- definition contains `FOREIGN KEY (operator_user_id) REFERENCES neon_auth."user"(id) ON DELETE SET NULL`

Other FKs on the table (e.g. `order_id` → `orders.id`, `line_id` → `order_lines.id`) should also still be present.

- [ ] **Step 7.3: Migration row recorded in `drizzle.__drizzle_migrations`**

```sql
SELECT hash, created_at
FROM drizzle.__drizzle_migrations
ORDER BY created_at DESC
LIMIT 3;
```

Top row's `hash` must equal the SHA-256 captured in Step 4.2. If it doesn't, the INSERT either ran twice or used a wrong hash — investigate.

- [ ] **Step 7.4: Local type-check still passes**

```bash
pnpm check-types:web
```

Expected: exits 0. (Identical to Step 4.1; the apply doesn't touch local code, but re-running confirms nothing was inadvertently changed during hand-edits.)

---

## Task 8: Clean-tree generate (acceptance gate)

This proves "schema and snapshot now agree, and snapshot now agrees with reality (modulo the documented `neon_auth.*` asymmetry)."

- [ ] **Step 8.1: Run drizzle-kit generate again**

Snapshot expected uncommitted state before running (the 7 files from the file map): `apps/web/src/db/schema.ts`, `apps/web/drizzle/0007_fix_user_id_uuid_drift.sql`, `apps/web/drizzle/meta/_journal.json`, `apps/web/drizzle/meta/0007_snapshot.json`, `docs/remaining_work.md`, the spec, and this plan.

```bash
git status
```

Confirm only those 7 files are uncommitted (modified or untracked). Then:

```bash
pnpm --filter web exec drizzle-kit generate
```

Expected output: `No schema changes, nothing to migrate 😴` (or equivalent — whatever drizzle-kit 0.31 prints when there's nothing to do). No new file under `apps/web/drizzle/`.

- [ ] **Step 8.2: Confirm no new files appeared**

```bash
git status
```

Expected: same files as before Step 8.1 — no new `0008_*.sql` or `0008_snapshot.json`. If a new migration file did appear, drizzle-kit sees a discrepancy somewhere; abort and read the generated SQL to diagnose.

---

## Task 9: Commit and PR

- [ ] **Step 9.1: Inspect what's about to be committed**

```bash
git status
git diff --stat
```

Expected files (the four code/migration changes are always required; the three doc files are required ONLY if the Step 1.1 checkpoint commit was skipped):

- `apps/web/src/db/schema.ts` (modified)
- `apps/web/drizzle/0007_fix_user_id_uuid_drift.sql` (new)
- `apps/web/drizzle/meta/_journal.json` (modified)
- `apps/web/drizzle/meta/0007_snapshot.json` (new)
- (only if checkpoint was skipped): `docs/remaining_work.md` (modified)
- (only if checkpoint was skipped): `docs/superpowers/specs/2026-05-08-uuid-drift-fix-design.md` (new)
- (only if checkpoint was skipped): `docs/superpowers/plans/2026-05-08-uuid-drift-fix.md` (new)

Anything else (e.g. stray edits to other files) → unstage and re-evaluate before continuing.

- [ ] **Step 9.2: Stage exactly the expected files**

If the checkpoint commit was run:

```bash
git add apps/web/src/db/schema.ts \
        apps/web/drizzle/0007_fix_user_id_uuid_drift.sql \
        apps/web/drizzle/meta/_journal.json \
        apps/web/drizzle/meta/0007_snapshot.json
```

If the checkpoint commit was skipped (doc files still uncommitted):

```bash
git add apps/web/src/db/schema.ts \
        apps/web/drizzle/0007_fix_user_id_uuid_drift.sql \
        apps/web/drizzle/meta/_journal.json \
        apps/web/drizzle/meta/0007_snapshot.json \
        docs/remaining_work.md \
        docs/superpowers/specs/2026-05-08-uuid-drift-fix-design.md \
        docs/superpowers/plans/2026-05-08-uuid-drift-fix.md
```

- [ ] **Step 9.3: Commit**

```bash
git commit -m "$(cat <<'EOF'
fix(schema): reconcile user.id text→uuid drift across 4 FK columns

PR #6 hand-applied ALTERs to make its migration succeed against the
foreign-managed neon_auth.user.id (uuid). schema.ts still declared
those FK columns as text, leaving order_refunds.operator_user_id
without a working FK.

This migration (0007) flips schema.ts and snapshot to uuid and
attaches the missing FK. order_refunds is empty in prod (verified),
so the cast is trivial; defensive NULLIF guards against any
empty-string row arriving between verify and apply.

drizzle.config.ts is deliberately unchanged. tablesFilter cleanup
to lock drizzle-kit out of neon_auth.* is tracked at
docs/remaining_work.md §4.11.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 9.4: Push branch**

```bash
git push -u origin fix/uuid-drift
```

- [ ] **Step 9.5: Open PR**

```bash
gh pr create --title "fix(schema): user.id type drift (text → uuid) across orders, parent_children, order_refunds" --body "$(cat <<'EOF'
## Summary

- Reconciles `apps/web/src/db/schema.ts` with Neon prod reality: 4 user.id reference columns flipped from `text` → `uuid`.
- Attaches the missing FK on `order_refunds.operator_user_id` → `neon_auth.user(id) ON DELETE SET NULL` (silently failed in PR #6 due to type mismatch).
- Generated migration `0007_fix_user_id_uuid_drift` already applied to prod (`cool-wind-76972110`); migrations table records the hash.

## Why this is a fix, not a feature

PR #6 (`feat-parent-account`) deviated during apply because `neon_auth.user.id` is `uuid` in Neon Auth's provisioning but `text` in our schema. The deviation patched prod for `orders.user_id` and `parent_children.parent_id` but left `order_refunds.operator_user_id` mismatched (still `text`, still no FK). This PR closes that gap and brings schema.ts/snapshot in line.

## Files

- `apps/web/src/db/schema.ts` — 4 single-token edits
- `apps/web/drizzle/0007_*.sql` — generated, hand-edited per spec §5.3 (NULLIF cast, IF EXISTS DROP, single ADD CONSTRAINT, no neon_auth DDL)
- `apps/web/drizzle/meta/_journal.json` + `0007_snapshot.json` — auto-generated
- `docs/remaining_work.md` §4.11 — defers `tablesFilter`/`schemaFilter` cleanup

## Out of scope

- `tablesFilter: ["public.*"]` to lock drizzle-kit out of `neon_auth.*` — see §4.11. Not in this PR because the failure mode (drizzle emitting `DROP TABLE neon_auth.user` if mishandled) deserves its own carefully-verified PR.

## Test plan

- [x] `pnpm check-types:web` passes
- [x] `pnpm --filter web exec drizzle-kit generate` on a clean tree produces no new migration
- [x] Pre-flight: `order_refunds` empty in prod; missing FK confirmed absent
- [x] Apply succeeded atomically via Neon MCP
- [x] All 4 columns `uuid` in `information_schema.columns`
- [x] `order_refunds_operator_user_id_user_id_fk` exists with `ON DELETE SET NULL`
- [x] Migration row in `drizzle.__drizzle_migrations` matches SHA-256 of committed `.sql`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Capture the printed PR URL and report it back.

---

## Done

After Task 9.5, the PR is open and the migration is applied. No further action — wait for review/merge.
