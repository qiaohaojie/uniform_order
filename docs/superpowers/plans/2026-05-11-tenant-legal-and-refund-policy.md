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

---

## File map

| Path | New / Modify | Responsibility |
|---|---|---|
| `apps/web/drizzle/0010_tenant_legal_versions.sql` | New | DDL: enum, table, two FK columns |
| `apps/web/src/db/schema.ts` | Modify | Drizzle table + enum + FK cols + exported types |
| `apps/web/src/db/queries.ts` | Modify | `getTenantLegalVersion(id)` helper |
| `apps/web/src/lib/platform/schema.ts` | Modify | `tenantLegalSchema` (zod discriminated union) |
| `apps/web/src/app/platform/tenants/[id]/actions.ts` | Modify | `editTenantLegal` server action with collision-retry |
| `apps/web/src/app/[tenant]/refund-policy/page.tsx` | New | Server route: notFound / 307 / inline render |
| `apps/web/src/lib/email/index.ts` | Modify | Resolve `refundPolicyUrl` and pass into both templates |
| `apps/web/src/lib/email/templates/OrderConfirmation.tsx` | Modify | New prop + conditional footer link |
| `apps/web/src/lib/email/templates/OrderReady.tsx` | Modify | New prop + new footer line |
| `apps/web/src/app/api/orders/route.ts` | Modify | Snapshot `legalVersionId` on order insert |
| `apps/web/src/app/platform/tenants/[id]/cards/legal-card.tsx` | New | Read-only summary card (server component) |
| `apps/web/src/app/platform/tenants/[id]/cards/legal-edit-drawer.tsx` | New | Right-side form drawer (client) |
| `apps/web/src/app/platform/tenants/[id]/page.tsx` | Modify | Render banner + LegalCard inside the cards branch |

---

## Task 1: Migration + Drizzle schema

**Files:**
- Create: `apps/web/drizzle/0010_tenant_legal_versions.sql`
- Modify: `apps/web/src/db/schema.ts`

- [ ] **Step 1: Write the migration SQL**

Create `apps/web/drizzle/0010_tenant_legal_versions.sql`:

```sql
-- ─── Enum ───────────────────────────────────────────────────────────────────
CREATE TYPE "policy_mode" AS ENUM ('text', 'url');

-- ─── tenant_legal_versions ──────────────────────────────────────────────────
CREATE TABLE "tenant_legal_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "policy_mode" "policy_mode" NOT NULL,
  "policy_text" text,
  "policy_url" text,
  "acl_acknowledged" boolean NOT NULL,
  "seller_of_record_acknowledged" boolean NOT NULL,
  "declarant_name" text NOT NULL,
  "declarant_role" text NOT NULL,
  "entered_by_user_id" uuid NOT NULL REFERENCES "neon_auth"."user"("id"),
  "entered_by_email" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "tenant_legal_versions_tenant_version_unique" UNIQUE ("tenant_id", "version"),
  CONSTRAINT "tenant_legal_versions_mode_check" CHECK (
    ("policy_mode" = 'text' AND "policy_text" IS NOT NULL AND "policy_url" IS NULL)
    OR
    ("policy_mode" = 'url'  AND "policy_url"  IS NOT NULL AND "policy_text" IS NULL)
  )
);

CREATE INDEX "idx_tenant_legal_versions_tenant" ON "tenant_legal_versions" ("tenant_id");

-- ─── tenants.current_legal_version_id ───────────────────────────────────────
ALTER TABLE "tenants"
  ADD COLUMN "current_legal_version_id" uuid REFERENCES "tenant_legal_versions"("id");

-- ─── orders.legal_version_id ────────────────────────────────────────────────
ALTER TABLE "orders"
  ADD COLUMN "legal_version_id" uuid REFERENCES "tenant_legal_versions"("id");
```

- [ ] **Step 2: Update `apps/web/src/db/schema.ts`**

Add the enum near the existing `pgEnum` declarations:

```ts
export const policyModeEnum = pgEnum("policy_mode", ["text", "url"]);
```

Add a new table block after `parentChildren` (around line 200). The check constraint is already enforced in SQL — it does not need a `pgCheck` wrapper here:

```ts
// ─── Tenant legal versions ───────────────────────────────────────────────────
export const tenantLegalVersions = pgTable(
  "tenant_legal_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    policyMode: policyModeEnum("policy_mode").notNull(),
    policyText: text("policy_text"),
    policyUrl: text("policy_url"),
    aclAcknowledged: boolean("acl_acknowledged").notNull(),
    sellerOfRecordAcknowledged: boolean("seller_of_record_acknowledged").notNull(),
    declarantName: text("declarant_name").notNull(),
    declarantRole: text("declarant_role").notNull(),
    enteredByUserId: uuid("entered_by_user_id")
      .notNull()
      .references(() => neonAuthUsers.id),
    enteredByEmail: text("entered_by_email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantVersionUnique: uniqueIndex("tenant_legal_versions_tenant_version_unique").on(
      t.tenantId,
      t.version,
    ),
    tenantIdx: index("idx_tenant_legal_versions_tenant").on(t.tenantId),
  }),
);
```

Add `currentLegalVersionId` to the `tenants` table definition. Insert this column right after `platformRejectionReason` (around line 56), before `createdAt`:

```ts
  // Current legal/refund-policy version (FK to tenant_legal_versions; null until first save)
  currentLegalVersionId: uuid("current_legal_version_id").references(
    (): any => tenantLegalVersions.id,
  ),
```

> **Note:** the `(): any =>` callback breaks the otherwise-circular type reference (`tenants` → `tenantLegalVersions` → `tenants`). Drizzle resolves the FK at runtime; the `any` is necessary because TypeScript can't infer the recursive shape. Same pattern as if you had FKs that reference back to a parent table.

Add `legalVersionId` to the `orders` table definition. Insert it right after the `userId` column (around line 125), before `createdAt`:

```ts
    // Snapshot of the policy version in force at order time (for audit)
    legalVersionId: uuid("legal_version_id").references(() => tenantLegalVersions.id),
```

At the bottom of the file, after `export type TenantRow = typeof tenants.$inferSelect;`, add:

```ts
export type TenantLegalVersionRow = typeof tenantLegalVersions.$inferSelect;
```

- [ ] **Step 3: Apply the migration to your dev DB**

Run from repo root:

```bash
pnpm --filter web exec drizzle-kit push
```

Expected: drizzle-kit detects the new table + 2 columns, asks for confirmation, applies. If it tries to also generate ALTER for `neon_auth."user"` rows, decline (those are external — see `external-schema.ts` and PR #8 / `completed.md` §4.9 for the exclusion mechanism).

- [ ] **Step 4: Verify types**

Run:

```bash
pnpm check-types:web
```

Expected: clean (zero errors).

- [ ] **Step 5: Commit**

```bash
git add apps/web/drizzle/0010_tenant_legal_versions.sql apps/web/src/db/schema.ts
git commit -m "$(cat <<'EOF'
feat(db): add tenant_legal_versions table + FK columns

New versioned table stores per-tenant refund-policy submissions with
ACL + seller-of-record acknowledgements and declarant name/role. FK on
tenants points at the current version; FK on orders snapshots which
version was in force at order time (audit trail only — no UI reads it).
Check constraint enforces text-XOR-url at the DB layer; zod will mirror
it at the action layer.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Zod schema

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

> **Why `policyUrl: z.undefined().optional()` on the text branch (and vice-versa):** the discriminated union otherwise has no opinion on the *other* branch's field. Marking it `undefined` makes the type narrow correctly at use sites — TypeScript will only suggest `policyText` when `mode === "text"`.

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

## Task 3: `editTenantLegal` server action + collision-retry

**Files:**
- Modify: `apps/web/src/app/platform/tenants/[id]/actions.ts`
- Modify: `apps/web/src/db/queries.ts`

- [ ] **Step 1: Add a helper query**

Append to `apps/web/src/db/queries.ts` (anywhere — they're loose helpers):

```ts
import { tenantLegalVersions } from "./schema";
// ↑ if not already imported at the top of the file

export async function getTenantLegalVersion(id: string) {
  const [row] = await db
    .select()
    .from(tenantLegalVersions)
    .where(eq(tenantLegalVersions.id, id))
    .limit(1);
  return row ?? null;
}

export async function getCurrentLegalVersionForTenant(tenantId: string) {
  const [tenant] = await db
    .select({ currentLegalVersionId: tenants.currentLegalVersionId })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  if (!tenant?.currentLegalVersionId) return null;
  return getTenantLegalVersion(tenant.currentLegalVersionId);
}

export async function getMaxLegalVersionForTenant(tenantId: string): Promise<number> {
  const [row] = await db
    .select({ max: sql<number>`COALESCE(MAX(${tenantLegalVersions.version}), 0)` })
    .from(tenantLegalVersions)
    .where(eq(tenantLegalVersions.tenantId, tenantId));
  return row?.max ?? 0;
}
```

> If `sql` and `eq` are not already imported at the top of `queries.ts`, add them: `import { eq, sql } from "drizzle-orm";`. Same for `tenants`.

- [ ] **Step 2: Add the server action**

Append to `apps/web/src/app/platform/tenants/[id]/actions.ts`:

```ts
import { tenantLegalVersions } from "@/db/schema";
import { tenantLegalSchema } from "@/lib/platform/schema";
import { getCurrentLegalVersionForTenant, getMaxLegalVersionForTenant } from "@/db/queries";
import { isUniqueConstraintError } from "@/app/api/orders/route";

// ↑ if isUniqueConstraintError isn't exported from that route file yet, see Step 3 below.

export async function editTenantLegal(id: string, input: unknown) {
  const user = await requirePlatformAdmin();
  const parsed = parseInput(tenantLegalSchema, input);
  if (!parsed.ok) return { ok: false as const, error: parsed.error };

  const [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1);
  if (!tenant) return { ok: false as const, error: "Tenant not found" };

  // Diff against the current version (if any) to short-circuit no-op saves.
  const current = await getCurrentLegalVersionForTenant(id);
  const next = parsed.data;

  const sameMode = current?.policyMode === next.mode;
  const sameContent =
    sameMode &&
    (next.mode === "text"
      ? current?.policyText === next.policyText
      : current?.policyUrl === next.policyUrl);
  const sameDeclarant =
    current?.declarantName === next.declarantName &&
    current?.declarantRole === next.declarantRole;
  // Acks come pre-ticked from the prior version; they're always === true here.
  // No-op when policy + declarant unchanged.
  if (current && sameContent && sameDeclarant) {
    return { ok: true as const };
  }

  const changedFields: string[] = [];
  if (!sameMode) changedFields.push("mode");
  if (!sameContent) changedFields.push("policy");
  if (!sameDeclarant) changedFields.push("declarant");
  if (!current) changedFields.push("initial");

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

  // Point the tenant at the new version + bump updatedAt for cache busting.
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
  revalidatePath(`/${id}`, "layout");

  return { ok: true as const, version: inserted.version };
}
```

- [ ] **Step 3: Export `isUniqueConstraintError` from the orders route (so it's reusable)**

Open `apps/web/src/app/api/orders/route.ts`. Find the existing `isUniqueConstraintError` declaration (around line 25). Change `function isUniqueConstraintError(...)` to `export function isUniqueConstraintError(...)`. No other change.

If for any reason that helper is locally scoped (i.e. inside another function), instead lift it into a new file `apps/web/src/lib/db/unique-constraint.ts` containing only that function, and update both `route.ts` and `actions.ts` to import from there.

- [ ] **Step 4: Verify types**

```bash
pnpm check-types:web
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/platform/tenants/[id]/actions.ts apps/web/src/db/queries.ts apps/web/src/app/api/orders/route.ts
git commit -m "$(cat <<'EOF'
feat(platform): editTenantLegal server action

Mints a new tenant_legal_versions row + bumps tenants.current_legal_
version_id atomically (with a 3-try retry on the unique (tenant_id,
version) constraint, mirroring the orders_pkey retry pattern). Diffs
against the prior version to short-circuit no-op saves, returning the
same { ok: true as const } shape as editTenantBranding. PostHog event
fires server-side with computed changedFields (mode, policy, declarant,
initial). Revalidates both the tenant detail page and the parent-shop
layout.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `/[tenant]/refund-policy` route

**Files:**
- Create: `apps/web/src/app/[tenant]/refund-policy/page.tsx`

- [ ] **Step 1: Verify Next.js `redirect()` accepts off-origin URLs**

Quick check before writing the route. Grep for any existing off-origin `redirect()` usage:

```bash
rg "redirect\(\"https?://" apps/web/src --type ts -l
```

If you find one (e.g. inside the Stripe Connect onboarding flow), the API works. If not, run a smoke test in dev: temporarily edit any server component to `import { redirect } from "next/navigation"; redirect("https://example.com");`, hit the route, confirm a 307 to example.com with no error. Revert the smoke change. (If it errors with "Invalid URL" or "External URLs not supported", fall back to a route-handler `Response.redirect(url, 307)` — see fallback below.)

- [ ] **Step 2: Write the route**

Create `apps/web/src/app/[tenant]/refund-policy/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation";
import { getTenant } from "@/db/queries";
import { getCurrentLegalVersionForTenant } from "@/db/queries";
import { MobileShell } from "@/components/mobile-shell";

export default async function RefundPolicyPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: tenantSlug } = await params;
  const tenant = await getTenant(tenantSlug);
  if (!tenant) notFound();

  const version = await getCurrentLegalVersionForTenant(tenant.id);
  if (!version) notFound();

  if (version.policyMode === "url") {
    if (!version.policyUrl) notFound(); // belt-and-braces; check constraint guarantees this
    redirect(version.policyUrl);
  }

  return (
    <MobileShell tenant={tenant}>
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

> **If the off-origin `redirect()` smoke test failed**, replace this `page.tsx` with a route handler `apps/web/src/app/[tenant]/refund-policy/route.ts` that returns `Response.redirect(version.policyUrl, 307)` for url-mode and renders the text-mode HTML manually. Most installs of Next 15+/16 support off-origin `redirect()`, so try the simpler approach first.

> **`MobileShell` import path:** confirm it's `@/components/mobile-shell` by grepping. If it lives at a different path (e.g. `@/components/MobileShell`), use that.

- [ ] **Step 3: Verify types**

```bash
pnpm check-types:web
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/[tenant]/refund-policy/page.tsx
git commit -m "$(cat <<'EOF'
feat(parent): resurrect /[tenant]/refund-policy route

Server component. notFound() when the tenant has no current legal
version (parents shouldn't see a half-broken page; the platform-admin
banner is the affordance to fix it). 307-redirects to the school's URL
in url-mode, renders inline plain-text in text-mode (whitespace-pre-wrap,
no markdown), with declarant attribution at the bottom. Reuses
MobileShell + tenant accent for consistency with the rest of the parent
surface.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Email templates + lib/email/index.ts

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

Replace the existing footer-text IIFE (lines ~110–131) with this conditional:

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

> Wording tweak from "refund or exchange questions" to "refund policy questions" matches the route name and the spec §5.5.

- [ ] **Step 2: Update `OrderReady.tsx` props + footer**

In `apps/web/src/lib/email/templates/OrderReady.tsx`, add to the interface (around line 22):

```ts
  orderUrl: string;
  shopEmail: string | null;
  refundPolicyUrl: string | null;
```

Add `shopEmail` to the destructuring defaults (around line 32) — it's currently passed neither as a prop nor a default; add both:

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

Also append the `link` and `footerText` style consts at the bottom of `OrderReady.tsx` (this template doesn't currently define them — copy from `OrderConfirmation.tsx`):

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

- [ ] **Step 3: Update `lib/email/index.ts` to resolve `refundPolicyUrl` and pass it through**

Find both `props` constructions (around lines 70–87 and 138–147). In both, add the resolved URL:

```ts
const refundPolicyUrl = tenant.currentLegalVersionId
  ? `${requireAppUrl()}/${tenant.id}/refund-policy`
  : null;
```

Compute it once just above each `props` literal, then add `refundPolicyUrl` (and for `OrderReady`, also `shopEmail: tenant.shopEmail`) to each `props` object.

So `sendOrderConfirmationEmail`'s `props` becomes:

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

And `sendOrderReadyEmail`'s `props`:

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
at all — this adds one for parity (parents at the "ready for pickup"
stage are about to receive product and might genuinely need it).

Wording tweaked to "refund policy questions" to match the route name.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Order snapshot — `legalVersionId` on `POST /api/orders`

**Files:**
- Modify: `apps/web/src/app/api/orders/route.ts`

- [ ] **Step 1: Read the tenant's `currentLegalVersionId` before insert**

Find the existing `tenant` lookup near the top of the POST handler (it's the same `tenant` row used to validate the tenant exists / Stripe is connected). If it doesn't currently select `currentLegalVersionId`, extend the SELECT to include it.

If you can't find an existing tenant lookup that returns the column you need, add this just before the `insertOrder` declaration (around line 178):

```ts
const [tenantRow] = await db
  .select({ currentLegalVersionId: tenants.currentLegalVersionId })
  .from(tenants)
  .where(eq(tenants.id, tenantId))
  .limit(1);
const legalVersionId = tenantRow?.currentLegalVersionId ?? null;
```

> If the file doesn't already import `tenants` from `@/db`, add it: `import { db, orders, orderLines, tenants } from "@/db";` (mirroring `lib/email/index.ts`).

- [ ] **Step 2: Add `legalVersionId` to the insert**

Inside the `insertOrder` function (around line 200), add the field to the `db.insert(orders).values({ ... })` payload:

```ts
        userId: authResult.user.id,
        parentNote: normalizedParentNote,
        legalVersionId,
```

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

## Task 7: `LegalCard` (read-only summary)

**Files:**
- Create: `apps/web/src/app/platform/tenants/[id]/cards/legal-card.tsx`

- [ ] **Step 1: Write the card**

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

> **Why this is a `"use client"` component despite being read-only:** because it owns the `editing` boolean and conditionally renders `LegalEditDrawer`. Same pattern as `BrandingCard`. The summary content itself is server-rendered output passed in via props.

- [ ] **Step 2: Verify types**

```bash
pnpm check-types:web
```

Expected: error pointing at `LegalEditDrawer` (not yet created). That's expected — the next task creates it. **Do not commit yet.**

If you see other errors (e.g. `truncate` typing, `TenantLegalVersionRow` import), fix those before continuing.

> If you'd rather have a clean type-check before committing, skip Step 3's commit and bundle Tasks 7 + 8 into a single commit. The plan's default is to commit per task; this is one of two natural exceptions.

- [ ] **Step 3: Hold the commit** until Task 8 lands the drawer.

---

## Task 8: `LegalEditDrawer` (form drawer)

**Files:**
- Create: `apps/web/src/app/platform/tenants/[id]/cards/legal-edit-drawer.tsx`

- [ ] **Step 1: Write the drawer**

Create `apps/web/src/app/platform/tenants/[id]/cards/legal-edit-drawer.tsx`:

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

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const mountedRef = useRef(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      mountedRef.current = false;
    };
  }, [pending]);

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

- [ ] **Step 3: Commit (bundles Tasks 7 + 8)**

```bash
git add apps/web/src/app/platform/tenants/[id]/cards/legal-card.tsx apps/web/src/app/platform/tenants/[id]/cards/legal-edit-drawer.tsx
git commit -m "$(cat <<'EOF'
feat(platform): LegalCard + LegalEditDrawer for tenant detail page

Read-only summary card mirrors BrandingCard's structure: header with
Edit link, mode badge + version, content preview (200-char truncated
text or hostname), declarant attribution. Drawer hosts the full form:
text-vs-URL radio with conditional input, two ACL/seller-of-record
acknowledgement checkboxes (full sentence labels), declarant name + role.
Save disabled until: content valid (text ≥50 chars or HTTPS URL) + both
acks ticked + name/role non-empty.

A11y mirrors BrandingEditDrawer: aria-modal, Esc-to-close (gated on
!pending), body-scroll-lock, isMounted guard on post-await setters,
Cancel/X/scrim disabled while pending. Acks pre-tick from prior
version so a Save with no other change becomes a true noop.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Wire banner + LegalCard into tenant detail page

**Files:**
- Modify: `apps/web/src/app/platform/tenants/[id]/page.tsx`

- [ ] **Step 1: Add the import**

At the top of `apps/web/src/app/platform/tenants/[id]/page.tsx`:

```ts
import { LegalCard } from "./cards/legal-card";
import { getCurrentLegalVersionForTenant } from "@/db/queries";
```

- [ ] **Step 2: Fetch the current legal version**

Inside the page component, after `const tenant = await getTenant(id);`, add:

```ts
const currentLegalVersion = await getCurrentLegalVersionForTenant(tenant.id);
```

- [ ] **Step 3: Render the banner + card**

Inside the cards branch (the `<>` after `status === "setup" ? (... ) : (`), add the banner above and the card below the existing cards:

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

> **Why no "Add policy" button on the banner:** the LegalCard's "Edit" link already opens the same drawer. Two affordances pointing at the same modal is noise. The banner's job is to call attention to the missing state; the card's job is to expose the action.

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

## Task 10: Manual smoke verification

**Files:** none

This task is a checklist of manual verifications. Do them in order. Stop if anything fails — go back and fix the relevant earlier task.

- [ ] **Step 1: Boot the dev server**

```bash
pnpm dev:web
```

Wait for "Ready on http://localhost:3000" (or the configured port).

- [ ] **Step 2: Confirm the banner shows for a policyless tenant**

Sign in as a platform admin. Visit `/platform/tenants/nsbh`. Expected: amber banner "Refund policy not set" sits above the BrandingCard. LegalCard shows the "Not set" badge.

- [ ] **Step 3: Save a text-mode policy**

Click LegalCard's "Edit". Drawer opens with mode=text radio, both acks unchecked, name/role empty. Save button disabled. Paste a >50-char policy text, tick both acks, type a declarant name + role. Save button enables. Click Save.

Expected: drawer closes; banner disappears; LegalCard now shows mode badge "Text", v1, truncated preview, declarant attribution. PostHog event `tenant_legal_edited` fired (check via the PostHog Insight or directly in the dashboard if convenient).

- [ ] **Step 4: Save a no-op edit (verify short-circuit)**

Re-open the drawer. All fields including acks pre-tick. Click Save without changing anything. Expected: drawer closes, no new version row in DB (run `select count(*) from tenant_legal_versions where tenant_id='nsbh';` in your Neon SQL editor — should still be 1).

- [ ] **Step 5: Save a real edit (verify version increment)**

Open drawer, change declarant role from "Bursar" → "Acting Bursar", Save. Expected: LegalCard now shows v2. Re-query the table — 2 rows for nsbh, versions 1 and 2.

- [ ] **Step 6: Switch mode, save**

Open drawer, switch to URL mode, paste a valid HTTPS URL, ensure acks/name/role still ticked. Save. Expected: v3 with `policy_mode='url'`, `policy_text=null`, `policy_url=<your url>`.

- [ ] **Step 7: Visit `/[tenant]/refund-policy` in URL mode**

In a new tab, navigate to `http://localhost:3000/nsbh/refund-policy`. DevTools Network tab: status 307, `Location` header matches the URL you saved. Browser follows the redirect to the external host (page won't render in your domain — that's correct).

- [ ] **Step 8: Switch back to text mode, visit `/refund-policy` again**

Expected: page renders inline with serif heading, accent-coloured underline, plain-text body (whitespace preserved), declarant footer.

- [ ] **Step 9: Place a real order against NSBH**

Use the parent flow (`/nsbh` → add to cart → checkout → pay with Stripe test card `4242 4242 4242 4242`). After the order completes, query Neon:

```sql
SELECT id, legal_version_id FROM orders WHERE tenant_id = 'nsbh' ORDER BY created_at DESC LIMIT 1;
```

Expected: `legal_version_id` is non-null and matches the current version.

- [ ] **Step 10: Inspect the confirmation email**

If you have email send wired in dev (Resend/Emailit), check the rendered email or use the React Email preview. Footer should include "See {tenant}'s refund policy" link to `/{tenantId}/refund-policy`. Click it — confirms the link works end-to-end.

If you don't want to send a real email, render manually with `pnpm exec react-email dev` (from `apps/web` if that script is set up) or temporarily log the rendered HTML in `sendOrderConfirmationEmail`.

- [ ] **Step 11: Test policyless-tenant fallback**

Open Neon SQL: `UPDATE tenants SET current_legal_version_id = NULL WHERE id = 'rgsh';` (or any tenant you can place a test order against). Place an order against that tenant. Inspect the email footer: should be the static "Contact {tenantName} for refund policy questions: {email}" line, no policy link.

- [ ] **Step 12: Final type-check**

```bash
pnpm check-types:web
```

Expected: clean.

- [ ] **Step 13: No commit** — this task only verifies; no code changes.

---

## Self-review checklist (run after Task 10)

Before opening the PR:

1. **Spec coverage:** Cross-reference every section in the spec against the tasks above. Every numbered §-section should map to at least one task.
2. **No-op contract symmetry:** confirm `editTenantLegal` returns `{ ok: true as const }` — no `noop` flag — matching `editTenantBranding`.
3. **Server-action signature:** `serverCapture(user.email, "tenant_legal_edited", {...})` — email is the first arg, not the event.
4. **Migration number:** file is `0010_…`, journal updates correctly.
5. **`db.batch` only:** if you added any multi-statement DB writes, confirm none use `db.transaction`.
6. **Acks pre-tick from prior version:** drawer initial state shows checked boxes when `currentVersion?.aclAcknowledged === true`.
7. **revalidatePath layout flag:** the `/${id}` revalidation uses `"layout"` second argument.
8. **`tenant_legal_versions.entered_by_user_id` is `uuid`** in both SQL and Drizzle table definition.

If any check fails, fix in place; no need for a separate review pass.

---

## PR description (suggested)

Title: `feat: tenant legal capture & per-tenant refund-policy route`

Body:

> Closes `docs/remaining_work.md` §3.10 follow-up #1 + #2. Adds versioned `tenant_legal_versions` table, `editTenantLegal` server action (mirrors PR #18's branding pattern), `LegalCard` + `LegalEditDrawer` on `/platform/tenants/[id]` with a post-provision banner, resurrected `/[tenant]/refund-policy` route (text-inline or 307-redirect), conditional `refundPolicyUrl` link in both order emails, and `orders.legal_version_id` audit snapshot.
>
> Spec: `docs/superpowers/specs/2026-05-11-tenant-legal-and-refund-policy-design.md`
> Plan: `docs/superpowers/plans/2026-05-11-tenant-legal-and-refund-policy.md`
