# Tenant Legal Capture & Refund-Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each tenant declare a refund policy (text or URL) with ACL/seller-of-record acknowledgements through the platform-admin portal, render that policy at `/[tenant]/refund-policy`, and conditionally link to it from the order-confirmation and order-ready emails.

**Architecture:** New versioned `tenant_legal_versions` table; FK column on `tenants` for the current version, FK column on `orders` for the per-order audit snapshot. New server action `editTenantLegal` mirrors the `editTenantBranding` pattern (PR #18). New `LegalCard` + `LegalEditDrawer` components on the tenant detail page; resurrected `/[tenant]/refund-policy` server route renders text inline or 307-redirects to the school's URL. Email templates accept a new `refundPolicyUrl: string | null` prop and conditionally render a link.

**Tech Stack:** Next.js 16 (App Router, RSC + server actions), Drizzle ORM on Neon Postgres (use `db.batch`, never `db.transaction`), Zod v4, React Email, PostHog (server), UploadThing (already in use for tenant logos but not used here).

**Spec:** [`docs/superpowers/specs/2026-05-11-tenant-legal-and-refund-policy-design.md`](../specs/2026-05-11-tenant-legal-and-refund-policy-design.md)

**Repo conventions to remember (project rule, no automated tests):**
- The correctness gate is `pnpm check-types:web` (run after every code change).
- All multi-statement DB writes go through `db.batch([...])`. `neon-http` does not support `db.transaction`.
- Server actions use `requirePlatformAdmin` + `parseInput` from `@/lib/platform/action-helpers` and return `{ ok: true as const } | { ok: false as const, error: string }`.
- Server-side PostHog calls use `serverCapture(user.email, "event_name", { ... })`.
- `revalidatePath` for routes that live under a layout takes a second arg `"layout"` (e.g. `revalidatePath(\`/${id}\`, "layout")`).

**Deviations from spec (deliberate, called out in self-review):**
- LegalCard is a `"use client"` component (spec §5.1 said "server component"). It owns the `editing` boolean and conditionally renders `LegalEditDrawer` — same pattern as `BrandingCard`. The summary content is still server-fed via props.
- The onboarding banner has no inline "Add policy" button (spec §5.3 specified one). Two affordances opening the same drawer is noise; the LegalCard's "Edit" link is the action affordance, the banner is purely a visibility nudge.

---

## File map

| Path | New / Modify | Responsibility |
|---|---|---|
| `apps/web/drizzle/0010_*.sql` (auto-named) | Generated | DDL: enum, table, two FK columns — produced by `drizzle-kit generate`, then hand-extended with FK + check constraints |
| `apps/web/drizzle/meta/0010_snapshot.json` + `_journal.json` | Generated | Drizzle's snapshot + journal updates |
| `apps/web/src/db/schema.ts` | Modify | Drizzle table + enum + FK cols (FK targets enforced via SQL only) + exported types |
| `apps/web/src/db/queries.ts` | Modify | `getTenantLegalVersion(id)`, `getMaxLegalVersionForTenant(tenantId)` helpers |
| `apps/web/src/lib/db/unique-constraint.ts` | New | Lifted `isUniqueConstraintError` (was module-private in `api/orders/route.ts`) |
| `apps/web/src/lib/platform/schema.ts` | Modify | `tenantLegalSchema` (zod discriminated union) |
| `apps/web/src/app/platform/tenants/[id]/actions.ts` | Modify | `editTenantLegal` server action with collision-retry |
| `apps/web/src/app/[tenant]/refund-policy/page.tsx` | New | Server route: notFound / 307 / inline render |
| `apps/web/src/lib/email/index.ts` | Modify | Resolve `refundPolicyUrl` and pass into both templates |
| `apps/web/src/lib/email/templates/OrderConfirmation.tsx` | Modify | New prop + conditional footer link |
| `apps/web/src/lib/email/templates/OrderReady.tsx` | Modify | New props (shopEmail + refundPolicyUrl) + new footer line |
| `apps/web/src/app/api/orders/route.ts` | Modify | Use lifted `isUniqueConstraintError`; snapshot `legalVersionId` |
| `apps/web/src/app/platform/tenants/[id]/cards/legal-card.tsx` | New | Read-only summary card (client — owns editing state) |
| `apps/web/src/app/platform/tenants/[id]/cards/legal-edit-drawer.tsx` | New | Right-side form drawer (client) |
| `apps/web/src/app/platform/tenants/[id]/page.tsx` | Modify | Render banner + LegalCard inside the cards branch |

---

## Task 1: Drizzle schema + generated migration

**Files:**
- Modify: `apps/web/src/db/schema.ts`
- Generated: `apps/web/drizzle/0010_*.sql`, `apps/web/drizzle/meta/0010_snapshot.json`, `apps/web/drizzle/meta/_journal.json`

> **Approach:** define the schema in TS, then `drizzle-kit generate` produces the SQL file AND updates `meta/_journal.json` + a new snapshot. Hand-extend the SQL afterwards with the FK + check constraints that Drizzle doesn't model. Hand-writing the SQL alone would skip the journal — see PR #8 / `completed.md` §4.9.

- [ ] **Step 1: Update `apps/web/src/db/schema.ts`**

Add the enum near the existing `pgEnum` declarations (top of file, around line 17):

```ts
export const policyModeEnum = pgEnum("policy_mode", ["text", "url"]);
```

Add a new table block. **Place it BEFORE the `tenants` table block** — `tenants` will hold an FK column to it. The new block goes immediately above the `// ─── Tenants ───` comment:

```ts
// ─── Tenant legal versions ───────────────────────────────────────────────────
// IMPORTANT: defined before `tenants` because `tenants.current_legal_version_id`
// needs the FK target in scope. The opposite-direction FK (tenantId → tenants.id)
// is enforced via the SQL ALTER TABLE in the migration only — the Drizzle column
// stays as plain `text("tenant_id")` with no .references() callback to avoid the
// hoisting cycle. FK integrity is preserved at the DB layer.
export const tenantLegalVersions = pgTable(
  "tenant_legal_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: text("tenant_id").notNull(), // FK enforced via SQL only — see note above
    version: integer("version").notNull(),
    policyMode: policyModeEnum("policy_mode").notNull(),
    policyText: text("policy_text"),
    policyUrl: text("policy_url"),
    aclAcknowledged: boolean("acl_acknowledged").notNull(),
    sellerOfRecordAcknowledged: boolean("seller_of_record_acknowledged").notNull(),
    declarantName: text("declarant_name").notNull(),
    declarantRole: text("declarant_role").notNull(),
    enteredByUserId: uuid("entered_by_user_id").notNull(), // FK enforced via SQL only
    enteredByEmail: text("entered_by_email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantVersionUnique: uniqueIndex("tenant_legal_versions_tenant_version_unique").on(
      t.tenantId,
      t.version,
    ),
    // No separate index on tenantId alone — the unique constraint above already
    // creates a B-tree leading on tenant_id, satisfying tenant-only lookups.
  }),
);
```

> **Why FKs are SQL-only here:** the only way to express `tenants ↔ tenantLegalVersions` mutual references in Drizzle without a hoisting cycle is the brittle `(): any =>` cast. Dropping `.references()` on these columns lets the SQL `ALTER TABLE` (added in Step 3) carry the FK. Drizzle's row types are unaffected.

Add `currentLegalVersionId` to the `tenants` table definition. Insert this column right after `platformRejectionReason` (around line 56), before `createdAt`. Note: no `.references()`.

```ts
  // Current legal/refund-policy version (FK enforced via SQL ALTER, not Drizzle)
  currentLegalVersionId: uuid("current_legal_version_id"),
```

Add `legalVersionId` to the `orders` table definition. Insert it right after the `userId` column (around line 125), before `createdAt`:

```ts
    // Snapshot of the policy version in force at order time (audit only)
    legalVersionId: uuid("legal_version_id"),
```

At the bottom of the file, after `export type TenantRow = typeof tenants.$inferSelect;`, add:

```ts
export type TenantLegalVersionRow = typeof tenantLegalVersions.$inferSelect;
```

- [ ] **Step 2: Generate the migration**

```bash
pnpm --filter web exec drizzle-kit generate
```

Expected output: a new `apps/web/drizzle/0010_<random_name>.sql` (drizzle-kit picks the random suffix, like `0009_petite_the_phantom.sql`), plus a `meta/0010_snapshot.json` and an updated `meta/_journal.json`.

The generated SQL must include, in this order:
1. `CREATE TYPE "policy_mode" AS ENUM ('text', 'url')` — must be the FIRST statement (before any column references it).
2. `CREATE TABLE "tenant_legal_versions" (...)` (uses the enum).
3. `CREATE UNIQUE INDEX "tenant_legal_versions_tenant_version_unique" ON ...`.
4. `ALTER TABLE "tenants" ADD COLUMN "current_legal_version_id" uuid`.
5. `ALTER TABLE "orders" ADD COLUMN "legal_version_id" uuid`.

**Verify ordering:** open the generated SQL and confirm `CREATE TYPE` appears before `CREATE TABLE`. drizzle-kit normally orders by dependency graph, but enums declared inline can occasionally be misordered — if `CREATE TYPE` is missing or appears after the table, manually move it to the top of the file before continuing.

- [ ] **Step 3: Hand-extend the generated SQL with FK + check constraints**

Open the generated `0010_*.sql` and append:

```sql
-- FKs (Drizzle column doesn't model these; enforced at DB layer)
ALTER TABLE "tenant_legal_versions"
  ADD CONSTRAINT "tenant_legal_versions_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;

ALTER TABLE "tenant_legal_versions"
  ADD CONSTRAINT "tenant_legal_versions_entered_by_user_id_fkey"
  FOREIGN KEY ("entered_by_user_id") REFERENCES "neon_auth"."user"("id");

ALTER TABLE "tenants"
  ADD CONSTRAINT "tenants_current_legal_version_id_fkey"
  FOREIGN KEY ("current_legal_version_id") REFERENCES "tenant_legal_versions"("id");

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_legal_version_id_fkey"
  FOREIGN KEY ("legal_version_id") REFERENCES "tenant_legal_versions"("id");

-- Check constraint enforcing text-XOR-url
ALTER TABLE "tenant_legal_versions"
  ADD CONSTRAINT "tenant_legal_versions_mode_check"
  CHECK (
    ("policy_mode" = 'text' AND "policy_text" IS NOT NULL AND "policy_url" IS NULL)
    OR
    ("policy_mode" = 'url'  AND "policy_url"  IS NOT NULL AND "policy_text" IS NULL)
  );
```

- [ ] **Step 4: Hand-edit `meta/0010_snapshot.json` (only if drizzle-kit dragged in `neon_auth.user`)**

If the snapshot includes a `neon_auth.user` table entry, remove it (same surgery PR #8 / `completed.md` §4.9 documented). If not, skip.

- [ ] **Step 5: Apply the migration to your dev DB**

```bash
pnpm --filter web exec drizzle-kit migrate
```

Expected: drizzle-kit reads the journal, applies `0010_*.sql` against your dev Neon DB, records the application in `__drizzle_migrations`.

- [ ] **Step 6: Verify types + sanity-check the schema**

```bash
pnpm check-types:web
```

Then in the Neon SQL editor:

```sql
\d tenant_legal_versions
\d tenants
\d orders
```

Confirm: table exists with the `tenant_legal_versions_mode_check` constraint; tenants has `current_legal_version_id`; orders has `legal_version_id`; FKs are present in each `\d` output.

- [ ] **Step 7: Verify Stack Auth issues UUID user IDs (cheap insurance)**

The `entered_by_user_id` column is a uuid FK to `neon_auth.user(id)`. The `SessionUser.id` from `lib/auth/authorization.ts` is typed `string` — but Stack Auth issues UUIDs in practice (PR #7 was the column-type alignment for this very reason). Probe in the Neon SQL editor:

```sql
SELECT id FROM neon_auth.user LIMIT 3;
```

Confirm the IDs look like UUIDs (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`). If they don't, stop and ask before proceeding — the action will throw at insert time when it casts a non-UUID `user.id` to the FK column.

- [ ] **Step 8: Commit**

```bash
git add apps/web/drizzle/0010_*.sql apps/web/drizzle/meta/_journal.json apps/web/drizzle/meta/0010_snapshot.json apps/web/src/db/schema.ts
git commit -m "$(cat <<'EOF'
feat(db): add tenant_legal_versions table + FK columns

New versioned table stores per-tenant refund-policy submissions with
ACL + seller-of-record acknowledgements and declarant name/role. FK on
tenants points at the current version; FK on orders snapshots which
version was in force at order time (audit trail only — no UI reads it).

FK constraints + the text-XOR-url check live in the SQL migration, not
in the Drizzle column callbacks — this avoids the brittle (): any =>
hoisting cycle when two tables FK each other. Row types are unaffected;
DB integrity is preserved by the ALTER TABLE constraints.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Lift `isUniqueConstraintError` to a shared module

**Files:**
- Create: `apps/web/src/lib/db/unique-constraint.ts`
- Modify: `apps/web/src/app/api/orders/route.ts`

> **Why a separate task:** `editTenantLegal` (Task 4) needs this helper. Importing from a route module into a server-action module is fragile — pulls a Next.js route handler into a non-route compilation graph. Lifting unconditionally now keeps the dependency direction clean.

- [ ] **Step 1: Create the shared module**

Create `apps/web/src/lib/db/unique-constraint.ts`:

```ts
/**
 * Detect Postgres unique-constraint violations (SQLSTATE 23505) from any
 * thrown error originating in the neon-http driver. Optionally narrow on a
 * specific constraint name (matches `pgError.constraint`).
 */
export function isUniqueConstraintError(error: unknown, constraintName?: string): boolean {
  const pgError = error as { code?: string; constraint?: string };
  if (pgError?.code !== "23505") return false;
  if (constraintName && pgError.constraint !== constraintName) return false;
  return true;
}
```

> If the existing helper in `api/orders/route.ts` has a slightly different shape (e.g. it inspects nested `cause` chains), copy that exact shape — the goal is byte-for-byte preservation, not a rewrite.

- [ ] **Step 2: Update `api/orders/route.ts` to import from the new module**

Open `apps/web/src/app/api/orders/route.ts`. Find the local `function isUniqueConstraintError` declaration (around line 26) and delete it. Add to the imports at the top:

```ts
import { isUniqueConstraintError } from "@/lib/db/unique-constraint";
```

The existing call sites (around lines 225 and 232) need no change.

- [ ] **Step 3: Verify types**

```bash
pnpm check-types:web
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/db/unique-constraint.ts apps/web/src/app/api/orders/route.ts
git commit -m "$(cat <<'EOF'
refactor(db): lift isUniqueConstraintError to shared module

Was module-private inside api/orders/route.ts. The upcoming
editTenantLegal action also needs collision-retry on a unique
constraint, and importing from a route handler module into a server
action would mix compilation graphs. Move to lib/db/ so both the route
and the action depend on a non-route module.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Zod schema

**Files:**
- Modify: `apps/web/src/lib/platform/schema.ts`

- [ ] **Step 1: Add the schema + exported type**

Append to `apps/web/src/lib/platform/schema.ts`:

```ts
const baseLegalFields = {
  aclAcknowledged: z.literal(true, { error: "Required" }),
  sellerOfRecordAcknowledged: z.literal(true, { error: "Required" }),
  declarantName: z.string().min(1).max(120),
  declarantRole: z.string().min(1).max(120),
};

export const tenantLegalSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("text"),
    policyText: z.string().min(50, "Policy text must be at least 50 characters").max(20000),
    policyUrl: z.undefined().optional(),
    ...baseLegalFields,
  }),
  z.object({
    mode: z.literal("url"),
    policyUrl: z
      .string()
      .url()
      .refine((u) => {
        try {
          return new URL(u).protocol === "https:";
        } catch {
          return false;
        }
      }, "Must be HTTPS"),
    policyText: z.undefined().optional(),
    ...baseLegalFields,
  }),
]);

export type TenantLegal = z.infer<typeof tenantLegalSchema>;
```

> **Why `policyUrl: z.undefined().optional()` on the text branch (and vice-versa):** marks the *other* branch's field as `undefined` so TypeScript's discriminated narrowing only suggests the right field per `mode`.

- [ ] **Step 2: Verify types**

```bash
pnpm check-types:web
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/platform/schema.ts
git commit -m "$(cat <<'EOF'
feat(platform): add tenantLegalSchema (zod discriminated union)

text vs url modes, with HTTPS-only refinement on URL mode and a 50-char
floor on text mode. Both branches require both ACL and seller-of-record
acknowledgements + declarant name + role. Uses zod v4's `error:` parameter
(not v3's `errorMap`).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `editTenantLegal` server action + helper queries

**Files:**
- Modify: `apps/web/src/db/queries.ts`
- Modify: `apps/web/src/app/platform/tenants/[id]/actions.ts`

- [ ] **Step 1: Add helper queries**

Append to `apps/web/src/db/queries.ts`:

```ts
import { tenantLegalVersions } from "./schema";
// ↑ if not already imported; same for `eq`, `sql`, `tenants` if missing

export async function getTenantLegalVersion(id: string) {
  const [row] = await db
    .select()
    .from(tenantLegalVersions)
    .where(eq(tenantLegalVersions.id, id))
    .limit(1);
  return row ?? null;
}

export async function getMaxLegalVersionForTenant(tenantId: string): Promise<number> {
  const [row] = await db
    .select({ max: sql<number>`COALESCE(MAX(${tenantLegalVersions.version}), 0)` })
    .from(tenantLegalVersions)
    .where(eq(tenantLegalVersions.tenantId, tenantId));
  return row?.max ?? 0;
}
```

> **Race window note:** `SELECT max() + INSERT` is not atomic. Two concurrent saves for the same tenant could both compute `version = N+1` and one would lose the unique-constraint race. The 3-retry loop in the action narrows but does not eliminate this. Acceptable in practice — typically a single platform admin per tenant — and the unique constraint guarantees we never persist duplicate versions. A fully atomic solution would use `INSERT … SELECT MAX+1 …` in one statement; out of scope.

Confirm imports at the top of `queries.ts` include: `import { eq, sql } from "drizzle-orm";` and `import { tenants, tenantLegalVersions } from "./schema";`. Add anything missing.

> **No `getCurrentLegalVersionForTenant` helper** — both call sites (Task 5 route, Task 11 page) already load the tenant row, so they can do `tenant.currentLegalVersionId ? getTenantLegalVersion(tenant.currentLegalVersionId) : null` directly. One round-trip instead of two.

- [ ] **Step 2: Add the server action**

Append to `apps/web/src/app/platform/tenants/[id]/actions.ts`:

```ts
import { tenantLegalVersions } from "@/db/schema";
import { tenantLegalSchema } from "@/lib/platform/schema";
import { getTenantLegalVersion, getMaxLegalVersionForTenant } from "@/db/queries";
import { isUniqueConstraintError } from "@/lib/db/unique-constraint";

export async function editTenantLegal(id: string, input: unknown) {
  const user = await requirePlatformAdmin();
  const parsed = parseInput(tenantLegalSchema, input);
  if (!parsed.ok) return { ok: false as const, error: parsed.error };

  const [tenant] = await db
    .select({ id: tenants.id, currentLegalVersionId: tenants.currentLegalVersionId })
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1);
  if (!tenant) return { ok: false as const, error: "Tenant not found" };

  const current = tenant.currentLegalVersionId
    ? await getTenantLegalVersion(tenant.currentLegalVersionId)
    : null;
  const next = parsed.data;

  // Diff against current to short-circuit no-op saves (mirrors editTenantBranding).
  const sameMode = current?.policyMode === next.mode;
  const sameContent =
    sameMode &&
    (next.mode === "text"
      ? current?.policyText === next.policyText
      : current?.policyUrl === next.policyUrl);
  const sameDeclarant =
    current?.declarantName === next.declarantName &&
    current?.declarantRole === next.declarantRole;

  if (current && sameContent && sameDeclarant) {
    return { ok: true as const };
  }

  const changedFields: string[] = [];
  if (!current) changedFields.push("initial");
  if (!sameMode) changedFields.push("mode");
  if (!sameContent) changedFields.push("policy");
  if (!sameDeclarant) changedFields.push("declarant");

  // Insert new version with retry on (tenant_id, version) collision.
  let inserted: { id: string; version: number } | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const nextVersion = (await getMaxLegalVersionForTenant(id)) + 1;
    try {
      const [row] = await db
        .insert(tenantLegalVersions)
        .values({
          tenantId: id,
          version: nextVersion,
          policyMode: next.mode,
          policyText: next.mode === "text" ? next.policyText : null,
          policyUrl: next.mode === "url" ? next.policyUrl : null,
          aclAcknowledged: next.aclAcknowledged,
          sellerOfRecordAcknowledged: next.sellerOfRecordAcknowledged,
          declarantName: next.declarantName,
          declarantRole: next.declarantRole,
          enteredByUserId: user.id,
          enteredByEmail: user.email,
        })
        .returning({ id: tenantLegalVersions.id, version: tenantLegalVersions.version });
      inserted = row;
      break;
    } catch (e) {
      if (isUniqueConstraintError(e, "tenant_legal_versions_tenant_version_unique")) {
        if (attempt === 2) throw e;
        continue;
      }
      throw e;
    }
  }
  if (!inserted) {
    return { ok: false as const, error: "Could not allocate a version number; please retry" };
  }

  await db
    .update(tenants)
    .set({ currentLegalVersionId: inserted.id, updatedAt: new Date() })
    .where(eq(tenants.id, id));

  await serverCapture(user.email, "tenant_legal_edited", {
    tenantId: id,
    mode: next.mode,
    version: inserted.version,
    changedFields,
  });

  revalidatePath(`/platform/tenants/${id}`);
  // The "layout" flag cascades to all routes under /[tenant]/, including
  // /[tenant]/refund-policy. Matches editTenantBranding's pattern (actions.ts:14).
  revalidatePath(`/${id}`, "layout");

  return { ok: true as const, version: inserted.version };
}
```

- [ ] **Step 3: Verify types**

```bash
pnpm check-types:web
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/platform/tenants/[id]/actions.ts apps/web/src/db/queries.ts
git commit -m "$(cat <<'EOF'
feat(platform): editTenantLegal server action

Mints a new tenant_legal_versions row + bumps tenants.current_legal_
version_id (with a 3-try retry on the unique (tenant_id, version)
constraint, mirroring orders_pkey retry in api/orders/route.ts).
Diffs against the prior version to short-circuit no-op saves, returning
the same { ok: true as const } shape as editTenantBranding. PostHog
event fires server-side with computed changedFields (initial, mode,
policy, declarant). Revalidates tenant detail page + parent-shop layout
(layout flag cascades to the resurrected /[tenant]/refund-policy route).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `/[tenant]/refund-policy` route

**Files:**
- Create: `apps/web/src/app/[tenant]/refund-policy/page.tsx`

> **No off-origin-redirect smoke test:** Next.js's `redirect()` from `next/navigation` has supported absolute URLs since 13.4. We trust the API.
>
> **MobileShell signature** (verified at `apps/web/src/components/mobile-shell.tsx:7`): `MobileShell({ children, bg })` — accepts `children` and an optional `bg` colour string only, does NOT take a `tenant` prop. The tenant-themed header is rendered inline in the route body (already does so via the `border-b-2` styled with `tenant.accent`).

- [ ] **Step 1: Write the route**

Create `apps/web/src/app/[tenant]/refund-policy/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation";
import { getTenant, getTenantLegalVersion } from "@/db/queries";
import { MobileShell } from "@/components/mobile-shell";

export default async function RefundPolicyPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  // The [tenant] route param is the tenant id (slug == id in this codebase —
  // see TENANTS in lib/data.ts and getTenant's signature in db/queries.ts:712).
  const { tenant: tenantId } = await params;
  const tenant = await getTenant(tenantId);
  if (!tenant) notFound();

  const version = tenant.currentLegalVersionId
    ? await getTenantLegalVersion(tenant.currentLegalVersionId)
    : null;
  if (!version) notFound();

  if (version.policyMode === "url") {
    if (!version.policyUrl) notFound(); // belt-and-braces; check constraint guarantees this
    redirect(version.policyUrl);
  }

  return (
    <MobileShell>
      <div className="px-5 py-6">
        <h1
          className="font-serif text-2xl font-semibold pb-2 mb-4 border-b-2"
          style={{ borderColor: tenant.accent }}
        >
          Refund policy
        </h1>
        <div className="text-sm leading-6 text-ink whitespace-pre-wrap">
          {version.policyText}
        </div>
        <div className="mt-6 pt-4 border-t border-rule text-xs text-ink-dim">
          Declared by {version.declarantName}, {version.declarantRole} ·{" "}
          {new Date(version.createdAt).toLocaleDateString("en-AU", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </div>
      </div>
    </MobileShell>
  );
}
```

- [ ] **Step 2: Verify types**

```bash
pnpm check-types:web
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/[tenant]/refund-policy/page.tsx
git commit -m "$(cat <<'EOF'
feat(parent): resurrect /[tenant]/refund-policy route

Server component. notFound() when the tenant has no current legal
version (parents shouldn't see a half-broken page; the platform-admin
banner is the affordance to fix it). Next's redirect() to the school's
external URL in url-mode (HTTP 307); renders inline plain-text in
text-mode (whitespace-pre-wrap, no markdown), with declarant attribution
at the bottom. Reuses MobileShell + tenant accent for parent-surface
consistency.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Email templates + lib/email/index.ts

**Files:**
- Modify: `apps/web/src/lib/email/index.ts`
- Modify: `apps/web/src/lib/email/templates/OrderConfirmation.tsx`
- Modify: `apps/web/src/lib/email/templates/OrderReady.tsx`

- [ ] **Step 1: Update `OrderConfirmation.tsx` props + footer**

In `apps/web/src/lib/email/templates/OrderConfirmation.tsx`, add `refundPolicyUrl` to the interface (around line 35, alongside `orderUrl`):

```ts
  orderUrl: string;
  refundPolicyUrl: string | null;
```

Update the destructuring defaults (around line 48):

```ts
  orderUrl = "#",
  refundPolicyUrl = null,
```

The current footer-text IIFE (lines ~110–131) looks exactly like this — confirm before editing:

```tsx
            <Text style={footerText}>
              {(() => {
                const safeName = tenantName?.trim();
                const safeEmail = shopEmail?.trim();
                const validEmail = safeEmail && safeEmail.includes("@") ? safeEmail : null;
                if (!safeName) {
                  return "For refund or exchange questions, please contact your school directly.";
                }
                if (validEmail) {
                  return (
                    <>
                      For refund or exchange questions, contact {safeName} at{" "}
                      <Link href={`mailto:${validEmail}`} style={link}>
                        {validEmail}
                      </Link>
                      .
                    </>
                  );
                }
                return `For refund or exchange questions, contact ${safeName} directly.`;
              })()}
            </Text>
```

Replace it with this block:

```tsx
            <Text style={footerText}>
              {(() => {
                const safeName = tenantName?.trim() || "your school";
                const safeEmail = shopEmail?.trim();
                const validEmail = safeEmail && safeEmail.includes("@") ? safeEmail : null;

                if (refundPolicyUrl) {
                  return (
                    <>
                      See {safeName}'s{" "}
                      <Link href={refundPolicyUrl} style={{ ...link, color: tenantAccent }}>
                        refund policy
                      </Link>
                      {validEmail ? (
                        <>
                          , or contact{" "}
                          <Link href={`mailto:${validEmail}`} style={link}>
                            {validEmail}
                          </Link>
                        </>
                      ) : null}
                      .
                    </>
                  );
                }

                if (validEmail) {
                  return (
                    <>
                      Contact {safeName} for refund policy questions:{" "}
                      <Link href={`mailto:${validEmail}`} style={link}>
                        {validEmail}
                      </Link>
                      .
                    </>
                  );
                }
                return `Contact ${safeName} for refund policy questions.`;
              })()}
            </Text>
```

> Wording shift from "refund or exchange questions" to "refund policy questions" matches the route name.

- [ ] **Step 2: Update `OrderReady.tsx` props + footer**

In `apps/web/src/lib/email/templates/OrderReady.tsx`, extend the interface (around line 22):

```ts
  orderUrl: string;
  shopEmail: string | null;
  refundPolicyUrl: string | null;
```

Add to the destructuring defaults (around line 32):

```ts
  orderUrl = "#",
  shopEmail = null,
  refundPolicyUrl = null,
```

Insert a new footer block immediately *before* the corporate `<Hr style={footerHr} />` (around line 69):

```tsx
            <Text style={footerText}>
              {(() => {
                const safeName = tenantName?.trim() || "your school";
                const safeEmail = shopEmail?.trim();
                const validEmail = safeEmail && safeEmail.includes("@") ? safeEmail : null;

                if (refundPolicyUrl) {
                  return (
                    <>
                      Need a refund or exchange? See {safeName}'s{" "}
                      <Link href={refundPolicyUrl} style={{ ...link, color: tenantAccent }}>
                        refund policy
                      </Link>
                      {validEmail ? (
                        <>
                          {" "}or contact{" "}
                          <Link href={`mailto:${validEmail}`} style={link}>
                            {validEmail}
                          </Link>
                        </>
                      ) : null}
                      .
                    </>
                  );
                }

                if (validEmail) {
                  return (
                    <>
                      Contact {safeName} for refund policy questions:{" "}
                      <Link href={`mailto:${validEmail}`} style={link}>
                        {validEmail}
                      </Link>
                      .
                    </>
                  );
                }
                return `Contact ${safeName} for refund policy questions.`;
              })()}
            </Text>
```

`OrderReady.tsx` doesn't currently define `link` and `footerText` style consts. Append them at the bottom of the file (copy the values from `OrderConfirmation.tsx`):

```ts
const link = {
  color: "#556cd6",
  textDecoration: "underline",
};

const footerText = {
  color: "#8898aa",
  fontSize: "14px",
  lineHeight: "22px",
  marginTop: "32px",
};
```

- [ ] **Step 3: Update `lib/email/index.ts`**

In both `sendOrderConfirmationEmail` and `sendOrderReadyEmail`, just above each `props` literal, add:

```ts
const refundPolicyUrl = tenant.currentLegalVersionId
  ? `${requireAppUrl()}/${tenant.id}/refund-policy`
  : null;
```

Then add `refundPolicyUrl` to each `props` object. For `sendOrderReadyEmail`, also add `shopEmail: tenant.shopEmail` (the column exists at `schema.ts:43` as `shopEmail: text("shop_email")`).

`sendOrderConfirmationEmail`'s `props` becomes:

```ts
const refundPolicyUrl = tenant.currentLegalVersionId
  ? `${requireAppUrl()}/${tenant.id}/refund-policy`
  : null;

const props = {
  tenantName: tenant.name,
  tenantAccent: tenant.accent,
  orderId: order.id,
  parentName: order.parentName,
  studentName: order.studentName,
  studentYear: order.studentYear,
  items: lines.map((line) => ({
    itemName: line.itemName,
    variantLabel: line.variantLabel,
    qty: line.qty,
    unitPrice: Number(line.unitPrice),
    lineTotal: Number(line.lineTotal),
  })),
  totalAmount: Number(order.total),
  shopEmail: tenant.shopEmail,
  orderUrl: `${requireAppUrl()}/orders/${order.id}`,
  refundPolicyUrl,
};
```

`sendOrderReadyEmail`'s `props`:

```ts
const refundPolicyUrl = tenant.currentLegalVersionId
  ? `${requireAppUrl()}/${tenant.id}/refund-policy`
  : null;

const props = {
  tenantName: tenant.name,
  tenantAccent: tenant.accent,
  orderId: order.id,
  studentName: order.studentName,
  collectionInstructions:
    tenant.collectionInstructions || "Please collect from the school office.",
  shopHours: tenant.shopHours || "Mon-Fri, 8:30am - 4:00pm",
  orderUrl: `${requireAppUrl()}/orders/${order.id}`,
  shopEmail: tenant.shopEmail,
  refundPolicyUrl,
};
```

- [ ] **Step 4: Verify types**

```bash
pnpm check-types:web
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/email/index.ts apps/web/src/lib/email/templates/OrderConfirmation.tsx apps/web/src/lib/email/templates/OrderReady.tsx
git commit -m "$(cat <<'EOF'
feat(email): conditional refund-policy link in order emails

Both OrderConfirmation and OrderReady accept refundPolicyUrl: string |
null. When the tenant has a current legal version, the footer renders a
"refund policy" link (styled with the tenant accent) plus the contact
line as backup. When no policy is set, the footer falls back to the
existing contact-only line. OrderReady previously had no refund footer
at all — added one here for parity (parents at the "ready for pickup"
stage are about to receive product and might genuinely need it).

Wording tweaked to "refund policy questions" to match the route name.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Order snapshot — `legalVersionId` on `POST /api/orders`

**Files:**
- Modify: `apps/web/src/app/api/orders/route.ts`

- [ ] **Step 1: Read the tenant's `currentLegalVersionId` in the outer POST scope**

Open `apps/web/src/app/api/orders/route.ts`. If `tenants` isn't already in the imports, add it (mirror `lib/email/index.ts`):

```ts
import { db, orders, orderLines, tenants } from "@/db";
```

**First, scan for an upstream tenant SELECT.** Search the POST handler for any `db.select(...).from(tenants)` that runs before the `insertOrder` block:

```bash
grep -n "from(tenants)" apps/web/src/app/api/orders/route.ts
```

**If you find one, EXTEND it** to include `currentLegalVersionId` in its column list and read the value from that row. Do not add a second SELECT.

**Only if no upstream SELECT exists**, add this snippet just before `insertOrder` is declared (around line 178):

```ts
// Snapshot the policy version in force at order time (audit trail).
// Read in the outer scope so insertOrder's closure captures it.
const [tenantRow] = await db
  .select({ currentLegalVersionId: tenants.currentLegalVersionId })
  .from(tenants)
  .where(eq(tenants.id, tenantId))
  .limit(1);
const legalVersionId = tenantRow?.currentLegalVersionId ?? null;
```

- [ ] **Step 2: Add `legalVersionId` to the `insertOrder` insert payload**

`insertOrder` is an arrow function declared in the same outer scope. Its body closes over `legalVersionId` from Step 1 — no need to pass it as a parameter.

Inside the existing `db.insert(orders).values({ ... })` literal (around line 200), add the field after `parentNote`:

```ts
        userId: authResult.user.id,
        parentNote: normalizedParentNote,
        legalVersionId,
```

> **Closure capture:** `legalVersionId` is captured from the outer POST scope. JavaScript handles this normally — no special wiring needed.

- [ ] **Step 3: Verify types**

```bash
pnpm check-types:web
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/orders/route.ts
git commit -m "$(cat <<'EOF'
feat(orders): snapshot legalVersionId on order insert

Reads tenant.currentLegalVersionId at insert time and writes it onto the
new order row. Null when the tenant hasn't authored a policy yet (legacy
+ pre-policy state). Audit-only — no UI surface reads this column;
exists for SQL-level dispute lookup ("which policy was in force when
order X was placed?").

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `LegalCard` (read-only summary) + `LegalEditDrawer` skeleton

**Files:**
- Create: `apps/web/src/app/platform/tenants/[id]/cards/legal-card.tsx`
- Create: `apps/web/src/app/platform/tenants/[id]/cards/legal-edit-drawer.tsx` (placeholder; full body in Task 9)

> **Why both files in one task:** LegalCard imports LegalEditDrawer. The previous plan structure split them and produced an unavoidable type-check failure mid-task. Bundling avoids that.

- [ ] **Step 1: Create the drawer placeholder**

Create `apps/web/src/app/platform/tenants/[id]/cards/legal-edit-drawer.tsx` with a stub so LegalCard's import resolves:

```tsx
"use client";
import type { TenantRow, TenantLegalVersionRow } from "@/db/schema";

// TODO(plan-task-9): replace with the full drawer in the next commit.
// This stub exists only so LegalCard (shipped in this commit) type-checks
// against an importable LegalEditDrawer; clicking Edit on the card would
// render nothing until Task 9 lands.
export function LegalEditDrawer(_: {
  tenant: TenantRow;
  currentVersion: TenantLegalVersionRow | null;
  onClose: () => void;
}) {
  return null;
}
```

This will be replaced in Task 9.

- [ ] **Step 2: Create the LegalCard**

Create `apps/web/src/app/platform/tenants/[id]/cards/legal-card.tsx`:

```tsx
"use client";
import { useState } from "react";
import type { TenantRow, TenantLegalVersionRow } from "@/db/schema";
import { LegalEditDrawer } from "./legal-edit-drawer";

export function LegalCard({
  tenant,
  currentVersion,
}: {
  tenant: TenantRow;
  currentVersion: TenantLegalVersionRow | null;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <>
      <section className="bg-paper rounded-[10px] border border-rule p-5">
        <header className="flex items-start justify-between mb-4">
          <h2 className="font-serif text-lg font-semibold">Legal &amp; refund policy</h2>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm text-ink-dim hover:text-ink underline"
          >
            Edit
          </button>
        </header>

        {currentVersion ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-full bg-rule/40 font-semibold uppercase tracking-wide">
                {currentVersion.policyMode === "text" ? "Text" : "URL"}
              </span>
              <span className="text-ink-dim">v{currentVersion.version}</span>
            </div>
            <div className="text-sm text-ink whitespace-pre-wrap">
              {currentVersion.policyMode === "text"
                ? truncate(currentVersion.policyText ?? "", 200)
                : (() => {
                    try {
                      return new URL(currentVersion.policyUrl ?? "").host;
                    } catch {
                      return currentVersion.policyUrl ?? "";
                    }
                  })()}
            </div>
            <div className="text-xs text-ink-dim border-t border-rule pt-3">
              Declared by {currentVersion.declarantName}, {currentVersion.declarantRole} ·{" "}
              {new Date(currentVersion.createdAt).toLocaleDateString("en-AU", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <span className="inline-block px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-900 text-xs font-semibold uppercase tracking-wide">
              Not set
            </span>
            <p className="text-sm text-ink-dim">
              No refund policy on file. Order confirmation emails fall back to the contact line until a policy is added.
            </p>
          </div>
        )}
      </section>

      {editing ? (
        <LegalEditDrawer
          tenant={tenant}
          currentVersion={currentVersion}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </>
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n).trimEnd() + "…";
}
```

> **Deviation from spec §5.1:** spec called LegalCard a "server component"; in practice it owns the `editing` boolean and conditionally renders the drawer, so it has to be `"use client"`. Same pattern as `BrandingCard`. Summary content is server-fed via props.

- [ ] **Step 3: Verify types**

```bash
pnpm check-types:web
```

Expected: clean (drawer is a stub, but the type signature satisfies the import).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/platform/tenants/[id]/cards/legal-card.tsx apps/web/src/app/platform/tenants/[id]/cards/legal-edit-drawer.tsx
git commit -m "$(cat <<'EOF'
feat(platform): LegalCard summary + LegalEditDrawer stub

Read-only summary card mirrors BrandingCard's structure: header with
Edit link, mode badge + version, content preview (200-char truncated
text or hostname), declarant attribution. Drawer is a typed stub that
satisfies LegalCard's import; full form lands in the next commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Flesh out `LegalEditDrawer`

**Files:**
- Modify: `apps/web/src/app/platform/tenants/[id]/cards/legal-edit-drawer.tsx`

- [ ] **Step 1: Replace the stub with the full drawer**

Replace the entire contents of `apps/web/src/app/platform/tenants/[id]/cards/legal-edit-drawer.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { TenantRow, TenantLegalVersionRow } from "@/db/schema";
import { editTenantLegal } from "../actions";

type Mode = "text" | "url";

export function LegalEditDrawer({
  tenant,
  currentVersion,
  onClose,
}: {
  tenant: TenantRow;
  currentVersion: TenantLegalVersionRow | null;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>(currentVersion?.policyMode ?? "text");
  const [policyText, setPolicyText] = useState<string>(currentVersion?.policyText ?? "");
  const [policyUrl, setPolicyUrl] = useState<string>(currentVersion?.policyUrl ?? "");
  const [aclAck, setAclAck] = useState<boolean>(currentVersion?.aclAcknowledged ?? false);
  const [sorAck, setSorAck] = useState<boolean>(
    currentVersion?.sellerOfRecordAcknowledged ?? false,
  );
  const [declarantName, setDeclarantName] = useState<string>(
    currentVersion?.declarantName ?? "",
  );
  const [declarantRole, setDeclarantRole] = useState<string>(
    currentVersion?.declarantRole ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Stable refs so the keydown listener isn't re-registered on every parent
  // render (parents typically pass an inline `() => setEditing(false)`), and
  // so async post-await setters can no-op once the drawer has unmounted.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const mountedRef = useRef(true);
  // Read pending via a ref inside the keydown closure so the effect's deps can
  // stay [] — depending on [pending] would trip mountedRef.current = false on
  // every pending toggle, which is a real bug (mid-save state would silently
  // no-op the post-await setters).
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pendingRef.current) onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      mountedRef.current = false;
    };
  }, []);

  async function save() {
    setError(null);
    setPending(true);

    const payload =
      mode === "text"
        ? {
            mode: "text" as const,
            policyText,
            aclAcknowledged: aclAck,
            sellerOfRecordAcknowledged: sorAck,
            declarantName: declarantName.trim(),
            declarantRole: declarantRole.trim(),
          }
        : {
            mode: "url" as const,
            policyUrl: policyUrl.trim(),
            aclAcknowledged: aclAck,
            sellerOfRecordAcknowledged: sorAck,
            declarantName: declarantName.trim(),
            declarantRole: declarantRole.trim(),
          };

    const r = await editTenantLegal(tenant.id, payload);
    if (!mountedRef.current) return;
    setPending(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    onClose();
  }

  const contentValid =
    mode === "text"
      ? policyText.trim().length >= 50
      : policyUrl.trim().length > 0 && /^https:\/\//i.test(policyUrl.trim());
  const declarantValid = declarantName.trim().length > 0 && declarantRole.trim().length > 0;
  const saveDisabled = pending || !contentValid || !aclAck || !sorAck || !declarantValid;

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Close drawer"
        onClick={onClose}
        disabled={pending}
        className="absolute inset-0 bg-black/40 disabled:cursor-not-allowed"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Edit legal & refund policy"
        className="absolute right-0 top-0 h-full w-full max-w-[640px] bg-paper shadow-xl flex flex-col"
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-rule">
          <h2 className="font-serif text-lg font-semibold">Edit legal &amp; refund policy</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="Close"
            className="text-ink-dim hover:text-ink text-xl leading-none disabled:opacity-40"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <fieldset>
            <legend className="text-[11px] font-bold uppercase tracking-[0.6px] mb-2">
              Policy source
            </legend>
            <div className="flex gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="legal-mode"
                  value="text"
                  checked={mode === "text"}
                  onChange={() => setMode("text")}
                />
                Write policy text
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="legal-mode"
                  value="url"
                  checked={mode === "url"}
                  onChange={() => setMode("url")}
                />
                Link to external URL
              </label>
            </div>
          </fieldset>

          {mode === "text" ? (
            <div>
              <label
                htmlFor="legal-text-input"
                className="text-[11px] font-bold uppercase tracking-[0.6px] mb-2 block"
              >
                Policy text <span className="font-normal opacity-60">(min 50 chars)</span>
              </label>
              <textarea
                id="legal-text-input"
                rows={14}
                value={policyText}
                onChange={(e) => setPolicyText(e.target.value)}
                className="w-full px-2 py-2 border border-rule rounded-md text-sm font-mono"
                placeholder="Paste or type your refund / exchange policy here…"
              />
            </div>
          ) : (
            <div>
              <label
                htmlFor="legal-url-input"
                className="text-[11px] font-bold uppercase tracking-[0.6px] mb-2 block"
              >
                Policy URL <span className="font-normal opacity-60">(must be HTTPS)</span>
              </label>
              <input
                id="legal-url-input"
                type="url"
                value={policyUrl}
                onChange={(e) => setPolicyUrl(e.target.value)}
                className="w-full h-9 px-2 border border-rule rounded-md text-sm"
                placeholder="https://example.school.nsw.edu.au/refund-policy"
              />
            </div>
          )}

          <div className="space-y-3 border-t border-rule pt-4">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={aclAck}
                onChange={(e) => setAclAck(e.target.checked)}
                className="mt-1"
              />
              <span>
                We confirm this refund policy complies with Australian Consumer Law and we accept
                responsibility for honoring it for purchases via uniformorder.online.
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={sorAck}
                onChange={(e) => setSorAck(e.target.checked)}
                className="mt-1"
              />
              <span>
                We acknowledge we are seller of record under Stripe Connect for purchases via
                uniformorder.online.
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-rule pt-4">
            <div>
              <label
                htmlFor="legal-declarant-name"
                className="text-[11px] font-bold uppercase tracking-[0.6px] mb-2 block"
              >
                Declarant name
              </label>
              <input
                id="legal-declarant-name"
                type="text"
                maxLength={120}
                value={declarantName}
                onChange={(e) => setDeclarantName(e.target.value)}
                className="w-full h-9 px-2 border border-rule rounded-md text-sm"
                placeholder="e.g. Jane Smith"
              />
            </div>
            <div>
              <label
                htmlFor="legal-declarant-role"
                className="text-[11px] font-bold uppercase tracking-[0.6px] mb-2 block"
              >
                Declarant role
              </label>
              <input
                id="legal-declarant-role"
                type="text"
                maxLength={120}
                value={declarantRole}
                onChange={(e) => setDeclarantRole(e.target.value)}
                className="w-full h-9 px-2 border border-rule rounded-md text-sm"
                placeholder="e.g. Bursar"
              />
            </div>
          </div>
        </div>

        <footer className="px-5 py-4 border-t border-rule flex flex-col gap-2">
          {error ? <div className="text-sm text-alert">{error}</div> : null}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="h-10 px-4 rounded-md border border-rule text-ink disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saveDisabled}
              className="h-10 px-5 rounded-md bg-navy-deep text-white font-semibold disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save policy"}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
```

- [ ] **Step 2: Verify types**

```bash
pnpm check-types:web
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/platform/tenants/[id]/cards/legal-edit-drawer.tsx
git commit -m "$(cat <<'EOF'
feat(platform): flesh out LegalEditDrawer

Right-side drawer with: text-vs-URL radio + conditional input, two
ACL/seller-of-record acknowledgement checkboxes (full sentence labels),
declarant name + role inputs. Save disabled until: content valid (text
≥50 chars OR HTTPS URL) + both acks ticked + name/role non-empty.

A11y mirrors BrandingEditDrawer: aria-modal, Esc-to-close (gated on
!pending via a ref so the effect deps stay []), body-scroll-lock,
isMounted guard on post-await setters, Cancel/X/scrim disabled while
pending. The pendingRef pattern avoids the bug where [pending] in the
effect deps would fire mountedRef.current=false on every pending toggle.

Acks pre-tick from prior version so a Save with no other change becomes
a true noop end-to-end (server diff returns { ok: true as const }).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Wire banner + LegalCard into tenant detail page

**Files:**
- Modify: `apps/web/src/app/platform/tenants/[id]/page.tsx`

- [ ] **Step 1: Add the imports**

At the top of `apps/web/src/app/platform/tenants/[id]/page.tsx`:

```ts
import { LegalCard } from "./cards/legal-card";
import { getTenantLegalVersion } from "@/db/queries";
```

- [ ] **Step 2: Fetch the current legal version**

After `const tenant = await getTenant(id);`, add:

```ts
const currentLegalVersion = tenant.currentLegalVersionId
  ? await getTenantLegalVersion(tenant.currentLegalVersionId)
  : null;
```

- [ ] **Step 3: Render the banner + card inside the cards branch**

Inside the `<>` branch after `status === "setup" ? (... ) : (`, add the banner above and the card between Branding and Operator:

```tsx
          <>
            {!currentLegalVersion ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-[10px] px-5 py-4 flex items-start justify-between gap-4">
                <div className="text-sm">
                  <strong className="font-semibold text-yellow-900">Refund policy not set.</strong>{" "}
                  <span className="text-yellow-900/90">
                    Add it to enable a per-tenant refund-policy link in confirmation emails.
                  </span>
                </div>
              </div>
            ) : null}
            <BrandingCard tenant={tenant} />
            <LegalCard tenant={tenant} currentVersion={currentLegalVersion} />
            <OperatorCard tenant={tenant} />
            <StripeCard tenant={tenant} />
            <DangerCard tenant={tenant} status={status} />
          </>
```

> **Deviation from spec §5.3:** banner has no inline "Add policy" button. The LegalCard's "Edit" link already opens the same drawer; two affordances pointing at one modal is noise. Banner = visibility nudge, LegalCard = action.

- [ ] **Step 4: Verify types**

```bash
pnpm check-types:web
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/platform/tenants/[id]/page.tsx
git commit -m "$(cat <<'EOF'
feat(platform): wire LegalCard + onboarding banner into tenant detail

Tenant detail page renders the LegalCard between Branding and Operator
cards. When tenant.currentLegalVersionId is null, an amber banner sits
above the card grid telling the admin the policy is missing. The card's
Edit link is the action affordance — banner is purely a visibility nudge,
no duplicate button.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Manual smoke verification

**Files:** none

Checklist of manual verifications. Stop on any failure and fix the relevant earlier task.

- [ ] **Step 1: Boot the dev server**

```bash
pnpm dev:web
```

- [ ] **Step 2: Confirm the banner shows for a policyless tenant**

Sign in as a platform admin. Visit `/platform/tenants/nsbh`. Expected: amber banner above the cards. LegalCard shows "Not set" badge.

- [ ] **Step 3: Save a text-mode policy**

Click LegalCard's "Edit". Drawer opens with mode=text radio, both acks unchecked, name/role empty. Save disabled. Paste a >50-char policy text, tick both acks, type a declarant name + role. Save enables. Click Save.

Expected: drawer closes; banner disappears; LegalCard now shows "Text" badge, v1, truncated preview, declarant attribution. Confirm PostHog `tenant_legal_edited` event fired.

- [ ] **Step 4: Save a no-op edit (verify short-circuit)**

Re-open drawer. Acks pre-tick (loaded from current version). Click Save without changing anything. Expected: drawer closes, no new version row in DB:

```sql
SELECT count(*) FROM tenant_legal_versions WHERE tenant_id = 'nsbh';
-- expect: 1
```

- [ ] **Step 5: Save a real edit (verify version increment)**

Open drawer, change declarant role from "Bursar" → "Acting Bursar", Save. Expected: LegalCard now shows v2. Re-query: 2 rows for nsbh.

- [ ] **Step 6: Switch mode, save**

Open drawer, switch to URL mode, paste a valid HTTPS URL, ensure acks/name/role still ticked. Save. Expected: v3 with `policy_mode='url'`, `policy_text=null`, `policy_url=<your url>`.

- [ ] **Step 7: Visit `/[tenant]/refund-policy` in URL mode**

In a new tab: `http://localhost:3000/nsbh/refund-policy`. DevTools Network tab: status 307, `Location` header matches the saved URL. Browser follows the redirect to the external host (page won't render in your domain — correct).

- [ ] **Step 8: Switch back to text mode, visit `/refund-policy` again**

Expected: page renders inline with serif heading, accent-coloured underline, plain-text body (whitespace preserved), declarant footer.

**Layout-cascade verification:** the action revalidates `/${id}` with the `"layout"` flag. Confirm the cascade reached `/refund-policy` by checking that the page shows the *new* (text-mode v4 or whatever you just saved) content, not stale URL-mode v3 content from the prior step. If you see stale content, the layout-flag cascade isn't doing what we expect — investigate before continuing.

- [ ] **Step 9: Place a real order against NSBH**

Use the parent flow (`/nsbh` → add to cart → checkout → pay with Stripe test card `4242 4242 4242 4242`). Then:

```sql
SELECT id, legal_version_id FROM orders WHERE tenant_id = 'nsbh' ORDER BY created_at DESC LIMIT 1;
```

Expected: `legal_version_id` non-null, matches the current version.

- [ ] **Step 10: Inspect the confirmation email**

If email send is wired in dev, check the rendered email. Footer should include "See {tenant}'s refund policy" link to `/{tenantId}/refund-policy`. Click it — confirms end-to-end.

If you don't want to send a real email, render manually with `pnpm exec react-email dev` (from `apps/web` if that script is set up) or temporarily log the rendered HTML in `sendOrderConfirmationEmail`.

- [ ] **Step 11: Test policyless-tenant fallback**

```sql
UPDATE tenants SET current_legal_version_id = NULL WHERE id = 'rgsh';
```

Place an order against rgsh. Inspect the email footer: should be the static "Contact {tenantName} for refund policy questions: {email}" line, no policy link.

- [ ] **Step 12: Final type-check**

```bash
pnpm check-types:web
```

Expected: clean.

- [ ] **Step 13: No commit** — verification only.

---

## Self-review checklist (run after Task 11)

Before opening the PR:

1. **Spec coverage:** every numbered §-section in the spec maps to at least one task above.
2. **No-op contract symmetry:** `editTenantLegal` returns `{ ok: true as const }` — no `noop` flag — matching `editTenantBranding`.
3. **Server-action signature:** `serverCapture(user.email, "tenant_legal_edited", {...})` — email is the first arg.
4. **Migration:** `0010_*.sql` exists, `meta/_journal.json` updated, `meta/0010_snapshot.json` exists. Generated via `drizzle-kit generate`, then hand-extended with FK + check constraints.
5. **`db.batch` only:** any multi-statement DB writes use `db.batch`, never `db.transaction`.
6. **Acks pre-tick from prior version:** drawer initial state shows checked boxes when `currentVersion?.aclAcknowledged === true`.
7. **`revalidatePath` layout flag:** `/${id}` revalidation uses `"layout"` second argument; this cascades to `/${id}/refund-policy`.
8. **`tenant_legal_versions.entered_by_user_id` is `uuid`** in the SQL ALTER (Task 1 Step 3) and as `uuid("entered_by_user_id")` in Drizzle.
9. **`isUniqueConstraintError` lifted** to `lib/db/unique-constraint.ts`; both `actions.ts` and `api/orders/route.ts` import from there.
10. **Drawer `useEffect` deps are `[]`** — pending state read via `pendingRef.current` to avoid mid-save mountedRef teardown.
11. **Deviations from spec called out:** see the "Deviations from spec" block at the top of this plan. Both items (LegalCard is `"use client"`; banner has no inline button) have already been backported into the spec at `docs/superpowers/specs/2026-05-11-tenant-legal-and-refund-policy-design.md` §5.1 and §5.3.

If any check fails, fix in place; no separate review pass.

---

## PR description (suggested)

Title: `feat: tenant legal capture & per-tenant refund-policy route`

Body:

> Closes `docs/remaining_work.md` §3.10 follow-up #1 + #2. Adds versioned `tenant_legal_versions` table, `editTenantLegal` server action (mirrors PR #18's branding pattern), `LegalCard` + `LegalEditDrawer` on `/platform/tenants/[id]` with a post-provision banner, resurrected `/[tenant]/refund-policy` route (text-inline or 307-redirect), conditional `refundPolicyUrl` link in both order emails, and `orders.legal_version_id` audit snapshot. Lifts `isUniqueConstraintError` to a shared module so the new action and the orders route share one helper.
>
> Spec: `docs/superpowers/specs/2026-05-11-tenant-legal-and-refund-policy-design.md`
> Plan: `docs/superpowers/plans/2026-05-11-tenant-legal-and-refund-policy.md`
