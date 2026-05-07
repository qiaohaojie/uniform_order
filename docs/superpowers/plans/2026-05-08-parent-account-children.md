# Parent Account: Saved Children + Order Note — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded `PARENT` mock with a DB-backed list of saved "shopping profiles" scoped to the authenticated Neon Auth user. Add CRUD UI on the picker. Add an order-level "note for the school" field captured at checkout and surfaced on operator detail / pick slip / parent receipt. Expand `/privacy`. Bundle the `orders.userId` `ON DELETE SET NULL` FK fix so account deletion works.

**Architecture:** Server components + thin client islands. New table `parent_children` references `neon_auth.user(id)` (CASCADE) and `tenants(id)` (RESTRICT). New `is_publicly_listed` boolean on `tenants` controls picker chooser visibility. An `uo:active-child` cookie carries which saved profile is currently being shopped for; server components read it via `cookies()` from `next/headers`. Five new API routes under `/api/parent/children`. Hand-written modal UI follows the inline pattern at `admin/[tenant]/catalog/catalog-table.tsx:119`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Drizzle ORM 0.45 + drizzle-kit 0.31, Neon Postgres + Neon Auth (`@neondatabase/auth` 0.3.0-beta).

**Project conventions** (per the prior plan `2026-05-07-parent-order-detail.md` and CLAUDE.md):
- **No test suite.** `pnpm check-types:web` is the correctness gate after every task. Behavioural verification is manual via `pnpm dev:web`.
- Server/client split: thin server `page.tsx` → `"use client"` companion (`*-client.tsx` or co-located).
- Path alias `@/*` → `apps/web/src/*`.
- Bespoke Tailwind components; design tokens in `apps/web/src/index.css` (`--color-parchment`, `--color-paper`, `--color-rule`, `--color-gold`, `--color-ink`, `--color-ink-dim`, `--color-navy`, `.tnum`).
- Each task ends with `pnpm check-types:web` and a commit. Frequent commits.
- Migrations live under `apps/web/drizzle/NNNN_<name>.sql` with `meta/_journal.json` updated automatically by `drizzle-kit generate`.

**Spec:** `docs/superpowers/specs/2026-05-08-parent-account-children-design.md` (latest revision `20c46c8`)
**Legal posture:** `my_doc/Legal/Parent_Children_Onboarding/2026-05-07-parent-school-linking.md`

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `apps/web/src/db/schema.ts` | Add `tenants.isPubliclyListed` column. Add `parentChildren` table. Add `orders.parentNote` column. Tighten `orders.userId` FK to `ON DELETE SET NULL`. | Modify |
| `apps/web/drizzle/0006_parent_children_and_parent_note.sql` | Generated migration. Manually adjust the FK-replacement section to match the spec's `DROP CONSTRAINT IF EXISTS` + recreate pattern. | Create |
| `apps/web/drizzle/meta/_journal.json` | Drizzle-kit appends entry. | Modify (auto) |
| `apps/web/drizzle/meta/0006_snapshot.json` | Drizzle-kit creates. | Create (auto) |
| `apps/web/src/db/queries.ts` | New: `getChildrenForParent`, `createChild`, `updateChild`, `deleteChild`, `confirmChild`, `getPubliclyListedTenants`, `getOrderForReceipt`. | Modify |
| `apps/web/src/lib/active-child.ts` | New module. Cookie reader/writer/clearer + `getActiveChild()` server helper that joins cookie value → DB row → ownership check. | Create |
| `apps/web/src/app/api/parent/children/route.ts` | GET (list) + POST (create). Validation, ownership, rate-limit. | Create |
| `apps/web/src/app/api/parent/children/[id]/route.ts` | PATCH (edit) + DELETE (remove). | Create |
| `apps/web/src/app/api/parent/children/[id]/confirm/route.ts` | POST → updates `last_confirmed_at`. | Create |
| `apps/web/src/app/page.tsx` | Server component. Convert from `PARENT` mock to `getSessionUser` + `getChildrenForParent` / `getPubliclyListedTenants`. Pass props to `home-client.tsx`. | Modify |
| `apps/web/src/app/home-client.tsx` | New `"use client"` component. Logged-out chooser + logged-in list. Owns the add/edit/remove modals and the `?action=add-child` query handling. Sets `uo:active-child` cookie on tap. | Create |
| `apps/web/src/app/child-form-modal.tsx` | New `"use client"` reusable modal. Used by add and edit flows. | Create |
| `apps/web/src/app/[tenant]/page.tsx` | Replace `PARENT.kids.find(...)` with `getActiveChild()` + tenant guard. | Modify |
| `apps/web/src/app/[tenant]/cart/page.tsx` | Read `getActiveChild()` server-side; pass `activeChildName / activeChildYear` to `<CartScreen>` as props. | Modify |
| `apps/web/src/app/[tenant]/cart/cart-screen.tsx` | Drop `PARENT` import; consume new props. | Modify |
| `apps/web/src/app/[tenant]/order/placed/page.tsx` | Replace `PARENT.email` with email from the order row (looked up by `orderId`). | Modify |
| `apps/web/src/app/[tenant]/checkout/checkout-screen.tsx` | Add `parentNote` textarea (≤500 chars, char counter). Send in POST body. Active-child prefill: read cookie via a new server-side `prefill` prop on the wrapping `page.tsx`. | Modify |
| `apps/web/src/app/[tenant]/checkout/page.tsx` | Read `getActiveChild()`; pass `activeChild` prop to `<CheckoutScreen>`. | Modify |
| `apps/web/src/app/api/orders/route.ts` | Accept `parentNote` in POST body; trim/cap/null at server. Insert into `orders.parentNote`. | Modify |
| `apps/web/src/app/admin/[tenant]/orders/[orderId]/page.tsx` | Render "Note from parent" callout above line items if `parent_note` present. | Modify |
| `apps/web/src/app/admin/[tenant]/orders/[orderId]/order-detail-actions.tsx` *(or pick-slip surface)* | Add note to printable pick slip. Verify file location during Task 13. | Modify |
| `apps/web/src/app/orders/[orderId]/order-detail-client.tsx` | Echo `parent_note` back to parent on receipt page. | Modify |
| `apps/web/src/app/privacy/page.tsx` | Replace stub with full notice (collection / why / where / how long / rights / contact). | Modify |
| `apps/web/src/components/admin-shell.tsx` | Sign-out: call `clearActiveChildCookie()` before redirect. | Modify |
| `apps/web/src/lib/data.ts` | Delete `PARENT` constant and `Kid` type once all consumers are migrated. | Modify |

---

## Reused (no changes)

| Symbol | Path | Purpose |
|---|---|---|
| `getSessionUser` | `@/lib/auth/authorization` | Page-side auth resolution. Returns `{id,email,name} \| null`. |
| `requireSessionUser` | `@/lib/auth/authorization` | API-route auth resolution. Returns `{response} \| {user}`. |
| `applyRateLimit` | `@/lib/rate-limit` | Per-user, in-memory bucket. Use for write API routes. |
| `db`, `tenants`, `orders`, `neonAuthUsers` | `@/db` | Drizzle re-exports from `schema.ts`. |
| `getTenant`, `getOrderById` | `@/db/queries` | Existing — wired through Tasks 7, 9, 14. |
| `MobileShell`, `Crest`, `PlatformMark`, `BottomNav` | `@/components/...` | Picker / catalog chrome. |
| `PlusIcon`, `ChevronRightIcon`, `BackIcon` | `@/components/icons` | Inline icons. |
| `Btn` | `@/components/btn` | Buttons. |
| Inline modal pattern | `apps/web/src/app/admin/[tenant]/catalog/catalog-table.tsx:119` | Shape we copy for the add/edit-child modal. |

---

## Task 1: Schema additions in Drizzle

**Files:**
- Modify: `apps/web/src/db/schema.ts`

- [ ] **Step 1: Add `index` to the drizzle-orm imports**

In `apps/web/src/db/schema.ts:1-14`, add `index` to the import list:

```ts
import {
  pgTable,
  pgSchema,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  jsonb,
  uuid,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
```

- [ ] **Step 2: Add `isPubliclyListed` to `tenants`**

In the `tenants` block at `schema.ts:46-67`, add the column right after `collectionInstructions`:

```ts
  collectionInstructions: text("collection_instructions"),
  // Marketplace visibility
  isPubliclyListed: boolean("is_publicly_listed").notNull().default(false),
  // Stripe Connect
  stripeAccountId: text("stripe_account_id"),
```

- [ ] **Step 3: Tighten `orders.userId` FK action to `set null`**

Replace line 131 in `schema.ts`:

```ts
    userId: text("user_id").references(() => neonAuthUsers.id, { onDelete: "set null" }),
```

- [ ] **Step 4: Add `parentNote` column to `orders`**

In the `orders` table block, immediately after `refundPolicyAcceptedAt`:

```ts
    refundPolicyAcceptedAt: timestamp("refund_policy_accepted_at"),
    // Optional note from parent to school
    parentNote: text("parent_note"),
    // Status
```

- [ ] **Step 5: Add the `parentChildren` table**

After the `orderRefunds` block at `schema.ts:178`, append:

```ts
// ─── Parent's saved children ─────────────────────────────────────────────────
export const parentChildren = pgTable(
  "parent_children",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentId: text("parent_id")
      .notNull()
      .references(() => neonAuthUsers.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    year: text("year").notNull(),                  // canonical short form: "7".."12"
    rollClass: text("roll_class"),
    lastConfirmedAt: timestamp("last_confirmed_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    parentIdx: index("parent_children_parent_idx").on(t.parentId),
  })
);
```

- [ ] **Step 6: Run type-check**

```bash
pnpm check-types:web
```

Expected: passes. If `index` is missing from the import, fix Step 1 and re-run.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/db/schema.ts
git commit -m "feat(schema): parent_children table, parent_note, is_publicly_listed, FK fix"
```

---

## Task 2: Generate and apply the migration

**Files:**
- Create: `apps/web/drizzle/0006_parent_children_and_parent_note.sql`
- Modify: `apps/web/drizzle/meta/_journal.json` (auto)
- Create: `apps/web/drizzle/meta/0006_snapshot.json` (auto)

- [ ] **Step 1: Generate the migration**

```bash
cd apps/web
pnpm drizzle-kit generate --name=parent_children_and_parent_note
cd ../..
```

Expected output: a new file at `apps/web/drizzle/0006_parent_children_and_parent_note.sql` and matching meta entries.

- [ ] **Step 2: Inspect the generated SQL**

```bash
cat apps/web/drizzle/0006_parent_children_and_parent_note.sql
```

Expected contents (drizzle-kit emits roughly):

```sql
ALTER TABLE "tenants" ADD COLUMN "is_publicly_listed" boolean DEFAULT false NOT NULL;
ALTER TABLE "orders" ADD COLUMN "parent_note" text;
CREATE TABLE "parent_children" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "parent_id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "name" text NOT NULL,
  "year" text NOT NULL,
  "roll_class" text,
  "last_confirmed_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "parent_children_parent_id_user_id_fk" FOREIGN KEY ("parent_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "parent_children_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action
);
CREATE INDEX "parent_children_parent_idx" ON "parent_children" ("parent_id");
-- and an FK swap for orders.user_id
```

If drizzle-kit's output for the `orders.user_id` FK swap uses a different constraint name than `orders_user_id_user_id_fk` (the existing convention seen in `db/schema.ts:131` patterns), pass through; just verify the new constraint has `ON DELETE SET NULL`.

- [ ] **Step 3: Append the seed update**

Open `apps/web/drizzle/0006_parent_children_and_parent_note.sql` and append at the end:

```sql
-- Seed v1 launch tenants as publicly listed.
UPDATE "tenants" SET "is_publicly_listed" = true WHERE "id" IN ('nsbh', 'rgsh');
```

- [ ] **Step 4: Apply the migration to the dev database**

```bash
cd apps/web
pnpm drizzle-kit migrate
cd ../..
```

Expected: "0 → 1 migrations applied" or similar. If `migrate` is not the canonical command in this repo, check `package.json` and adjust (likely `pnpm drizzle-kit push` for dev). Apply against the `DATABASE_URL` already set in `.env.local`.

- [ ] **Step 5: Verify the new shape via psql**

```bash
psql "$DATABASE_URL" -c "\d parent_children"
psql "$DATABASE_URL" -c "\d+ tenants" | grep -i public
psql "$DATABASE_URL" -c "\d orders" | grep -E "parent_note|user_id"
psql "$DATABASE_URL" -c "SELECT id, is_publicly_listed FROM tenants;"
```

Expected:
- `parent_children` table exists with index `parent_children_parent_idx`.
- `tenants.is_publicly_listed` exists, `nsbh` and `rgsh` rows have `true`.
- `orders.parent_note` exists; `orders.user_id` FK action is `ON DELETE SET NULL` (look for `set null` in the FK definition output).

- [ ] **Step 6: Commit**

```bash
git add apps/web/drizzle/0006_parent_children_and_parent_note.sql apps/web/drizzle/meta/
git commit -m "feat(db): add parent_children migration + seed publicly-listed flag"
```

---

## Task 3: DB queries module additions

**Files:**
- Modify: `apps/web/src/db/queries.ts`

- [ ] **Step 1: Add the `parentChildren` import**

Find the existing import block at the top of `apps/web/src/db/queries.ts`. Wherever `tenants`, `orders`, `orderLines` are imported from `@/db/schema` (or `./schema` — match the file's existing style), add `parentChildren` to the same import.

- [ ] **Step 2: Add the children CRUD queries**

Append to the bottom of `apps/web/src/db/queries.ts`:

```ts
// ─── Parent saved children ───────────────────────────────────────────────────
export type ParentChildRow = {
  id: string;
  tenantId: string;
  name: string;
  year: string;
  rollClass: string | null;
  lastConfirmedAt: Date;
  createdAt: Date;
};

export async function getChildrenForParent(parentId: string): Promise<ParentChildRow[]> {
  return db
    .select({
      id: parentChildren.id,
      tenantId: parentChildren.tenantId,
      name: parentChildren.name,
      year: parentChildren.year,
      rollClass: parentChildren.rollClass,
      lastConfirmedAt: parentChildren.lastConfirmedAt,
      createdAt: parentChildren.createdAt,
    })
    .from(parentChildren)
    .where(eq(parentChildren.parentId, parentId))
    .orderBy(parentChildren.createdAt);
}

export async function getChildById(id: string): Promise<ParentChildRow & { parentId: string } | null> {
  const [row] = await db
    .select({
      id: parentChildren.id,
      parentId: parentChildren.parentId,
      tenantId: parentChildren.tenantId,
      name: parentChildren.name,
      year: parentChildren.year,
      rollClass: parentChildren.rollClass,
      lastConfirmedAt: parentChildren.lastConfirmedAt,
      createdAt: parentChildren.createdAt,
    })
    .from(parentChildren)
    .where(eq(parentChildren.id, id))
    .limit(1);
  return row ?? null;
}

export async function createChild(data: {
  parentId: string;
  tenantId: string;
  name: string;
  year: string;
  rollClass: string | null;
}): Promise<ParentChildRow> {
  const [row] = await db
    .insert(parentChildren)
    .values(data)
    .returning({
      id: parentChildren.id,
      tenantId: parentChildren.tenantId,
      name: parentChildren.name,
      year: parentChildren.year,
      rollClass: parentChildren.rollClass,
      lastConfirmedAt: parentChildren.lastConfirmedAt,
      createdAt: parentChildren.createdAt,
    });
  return row;
}

export async function updateChild(
  id: string,
  patch: { name?: string; year?: string; rollClass?: string | null }
): Promise<ParentChildRow | null> {
  const [row] = await db
    .update(parentChildren)
    .set({ ...patch, lastConfirmedAt: new Date() })
    .where(eq(parentChildren.id, id))
    .returning({
      id: parentChildren.id,
      tenantId: parentChildren.tenantId,
      name: parentChildren.name,
      year: parentChildren.year,
      rollClass: parentChildren.rollClass,
      lastConfirmedAt: parentChildren.lastConfirmedAt,
      createdAt: parentChildren.createdAt,
    });
  return row ?? null;
}

export async function deleteChild(id: string): Promise<void> {
  await db.delete(parentChildren).where(eq(parentChildren.id, id));
}

export async function confirmChild(id: string): Promise<ParentChildRow | null> {
  const [row] = await db
    .update(parentChildren)
    .set({ lastConfirmedAt: new Date() })
    .where(eq(parentChildren.id, id))
    .returning({
      id: parentChildren.id,
      tenantId: parentChildren.tenantId,
      name: parentChildren.name,
      year: parentChildren.year,
      rollClass: parentChildren.rollClass,
      lastConfirmedAt: parentChildren.lastConfirmedAt,
      createdAt: parentChildren.createdAt,
    });
  return row ?? null;
}

export async function getPubliclyListedTenants() {
  return db
    .select()
    .from(tenants)
    .where(eq(tenants.isPubliclyListed, true))
    .orderBy(tenants.name);
}
```

- [ ] **Step 3: Add `getOrderForReceipt` for the placed page**

Append:

```ts
export async function getOrderForReceipt(orderId: string) {
  const [row] = await db
    .select({
      id: orders.id,
      tenantId: orders.tenantId,
      parentEmail: orders.parentEmail,
      studentName: orders.studentName,
      studentYear: orders.studentYear,
      total: orders.total,
      delivery: orders.delivery,
      parentNote: orders.parentNote,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  return row ?? null;
}
```

- [ ] **Step 4: Type-check**

```bash
pnpm check-types:web
```

Expected: passes. Likely failures: missing `eq` import (already present elsewhere in the file — verify), missing `parentChildren` import (Step 1).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/db/queries.ts
git commit -m "feat(db): queries for parent_children + getOrderForReceipt"
```

---

## Task 4: Active-child cookie helpers

**Files:**
- Create: `apps/web/src/lib/active-child.ts`

- [ ] **Step 1: Create the module**

Write `apps/web/src/lib/active-child.ts`:

```ts
import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/auth/authorization";
import { getChildById } from "@/db/queries";

const COOKIE_NAME = "uo:active-child";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type ActiveChild = {
  id: string;
  tenantId: string;
  name: string;
  year: string;            // canonical short form, e.g. "9"
  rollClass: string | null;
};

/**
 * Server-side reader. Resolves the cookie's child UUID, ownership-checks
 * against the current session, and returns the child or null.
 *
 * Returns null when:
 * - No cookie present
 * - No session (not signed in)
 * - Cookie value does not match a child row
 * - Child's parentId does not match session user (stale cookie after sign-out / account switch)
 */
export async function getActiveChild(): Promise<ActiveChild | null> {
  const cookieStore = await cookies();
  const childId = cookieStore.get(COOKIE_NAME)?.value;
  if (!childId) return null;

  const user = await getSessionUser();
  if (!user) return null;

  const child = await getChildById(childId);
  if (!child) return null;
  if (child.parentId !== user.id) return null;

  return {
    id: child.id,
    tenantId: child.tenantId,
    name: child.name,
    year: child.year,
    rollClass: child.rollClass,
  };
}

/**
 * Server-side mutator. Writes the cookie. Used by API routes and server actions.
 * Client code should use the response cookie pattern via a small fetch endpoint.
 */
export async function setActiveChildCookieServer(childId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, childId, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export async function clearActiveChildCookieServer(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Client-side cookie name + helpers. Used by the picker tap handler.
 * httpOnly is false on this cookie because we set it from the client.
 */
export const ACTIVE_CHILD_COOKIE_NAME = COOKIE_NAME;

export function setActiveChildCookieClient(childId: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(
    childId
  )}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function readActiveChildCookieClient(): string | null {
  if (typeof document === "undefined") return null;
  const escaped = COOKIE_NAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function clearActiveChildCookieClient(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm check-types:web
```

Expected: passes. If `cookies()` typing complains about `await`, confirm Next 16 returns `Promise<ReadonlyRequestCookies>` (it does in v15+). If a older type expects sync, drop the `await` — but verify by reading `apps/web/src/app/orders/[orderId]/page.tsx` for a precedent of cookies() usage if present.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/active-child.ts
git commit -m "feat(active-child): server + client cookie helpers with ownership check"
```

---

## Task 5: API route — list & create children

**Files:**
- Create: `apps/web/src/app/api/parent/children/route.ts`

- [ ] **Step 1: Create the route**

Write `apps/web/src/app/api/parent/children/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/authorization";
import { applyRateLimit } from "@/lib/rate-limit";
import { createChild, getChildrenForParent, getPubliclyListedTenants } from "@/db/queries";

const ALLOWED_YEARS = new Set(["7", "8", "9", "10", "11", "12"]);

function validateName(value: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof value !== "string") return { ok: false, error: "name must be a string" };
  const trimmed = value.trim();
  if (trimmed.length < 1) return { ok: false, error: "name is required" };
  if (trimmed.length > 60) return { ok: false, error: "name must be 60 characters or fewer" };
  return { ok: true, value: trimmed };
}

function validateYear(value: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof value !== "string") return { ok: false, error: "year must be a string" };
  const trimmed = value.trim();
  if (!ALLOWED_YEARS.has(trimmed)) return { ok: false, error: "year must be one of 7..12" };
  return { ok: true, value: trimmed };
}

function validateRollClass(value: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, error: "rollClass must be a string" };
  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: true, value: null };
  if (trimmed.length > 20) return { ok: false, error: "rollClass must be 20 characters or fewer" };
  return { ok: true, value: trimmed };
}

// GET /api/parent/children — list children for the current user.
export async function GET(req: NextRequest) {
  const auth = await requireSessionUser();
  if ("response" in auth) return auth.response;

  const rl = applyRateLimit(req, `parent-children:get:${auth.user.id}`, { limit: 60, windowMs: 60_000 });
  if (rl) return rl;

  const children = await getChildrenForParent(auth.user.id);
  return NextResponse.json({ children });
}

// POST /api/parent/children — create a new saved child.
export async function POST(req: NextRequest) {
  const auth = await requireSessionUser();
  if ("response" in auth) return auth.response;

  const rl = applyRateLimit(req, `parent-children:post:${auth.user.id}`, { limit: 20, windowMs: 60_000 });
  if (rl) return rl;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const nameRes = validateName((body as Record<string, unknown>).name);
  if (!nameRes.ok) return NextResponse.json({ error: nameRes.error }, { status: 400 });

  const yearRes = validateYear((body as Record<string, unknown>).year);
  if (!yearRes.ok) return NextResponse.json({ error: yearRes.error }, { status: 400 });

  const rollRes = validateRollClass((body as Record<string, unknown>).rollClass);
  if (!rollRes.ok) return NextResponse.json({ error: rollRes.error }, { status: 400 });

  const tenantId = (body as Record<string, unknown>).tenantId;
  if (typeof tenantId !== "string" || tenantId.length === 0) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }

  const allowedTenants = await getPubliclyListedTenants();
  if (!allowedTenants.some((t) => t.id === tenantId)) {
    return NextResponse.json({ error: "tenantId must be a publicly-listed tenant" }, { status: 400 });
  }

  const child = await createChild({
    parentId: auth.user.id,
    tenantId,
    name: nameRes.value,
    year: yearRes.value,
    rollClass: rollRes.value,
  });

  return NextResponse.json({ child }, { status: 201 });
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm check-types:web
```

- [ ] **Step 3: Smoke test the route**

```bash
pnpm dev:web
```

In another shell, sign in to a test parent at `http://localhost:3000/auth/sign-in`, then check the cookie name from devtools (used by Neon Auth — typically a session cookie). With that session cookie set, run:

```bash
curl -i 'http://localhost:3000/api/parent/children' -H 'cookie: <paste session cookie>'
```

Expected: `200 {"children":[]}`.

```bash
curl -i 'http://localhost:3000/api/parent/children' \
  -H 'content-type: application/json' \
  -H 'cookie: <paste session cookie>' \
  -d '{"tenantId":"nsbh","name":"Riley","year":"9","rollClass":"9C"}'
```

Expected: `201 {"child":{...}}`. Re-run GET to see the new row.

Stop dev server with Ctrl-C.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/parent/children/route.ts
git commit -m "feat(api): GET/POST /api/parent/children with auth + validation"
```

---

## Task 6: API route — patch & delete

**Files:**
- Create: `apps/web/src/app/api/parent/children/[id]/route.ts`

- [ ] **Step 1: Create the route**

Write `apps/web/src/app/api/parent/children/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/authorization";
import { applyRateLimit } from "@/lib/rate-limit";
import { deleteChild, getChildById, updateChild } from "@/db/queries";

const ALLOWED_YEARS = new Set(["7", "8", "9", "10", "11", "12"]);

type RouteContext = { params: Promise<{ id: string }> };

async function loadOwnedChild(id: string, parentId: string) {
  const child = await getChildById(id);
  if (!child) return null;
  if (child.parentId !== parentId) return null;
  return child;
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const auth = await requireSessionUser();
  if ("response" in auth) return auth.response;

  const rl = applyRateLimit(req, `parent-children:patch:${auth.user.id}`, { limit: 30, windowMs: 60_000 });
  if (rl) return rl;

  const { id } = await ctx.params;
  const child = await loadOwnedChild(id, auth.user.id);
  if (!child) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: { name?: string; year?: string; rollClass?: string | null } = {};
  const b = body as Record<string, unknown>;

  if (b.name !== undefined) {
    if (typeof b.name !== "string") return NextResponse.json({ error: "name must be a string" }, { status: 400 });
    const trimmed = b.name.trim();
    if (trimmed.length < 1 || trimmed.length > 60) {
      return NextResponse.json({ error: "name must be 1-60 characters" }, { status: 400 });
    }
    patch.name = trimmed;
  }

  if (b.year !== undefined) {
    if (typeof b.year !== "string" || !ALLOWED_YEARS.has(b.year.trim())) {
      return NextResponse.json({ error: "year must be one of 7..12" }, { status: 400 });
    }
    patch.year = b.year.trim();
  }

  if (b.rollClass !== undefined) {
    if (b.rollClass === null || (typeof b.rollClass === "string" && b.rollClass.trim().length === 0)) {
      patch.rollClass = null;
    } else if (typeof b.rollClass === "string" && b.rollClass.trim().length <= 20) {
      patch.rollClass = b.rollClass.trim();
    } else {
      return NextResponse.json({ error: "rollClass must be 0-20 characters" }, { status: 400 });
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
  }

  const updated = await updateChild(id, patch);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ child: updated });
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const auth = await requireSessionUser();
  if ("response" in auth) return auth.response;

  const rl = applyRateLimit(req, `parent-children:delete:${auth.user.id}`, { limit: 30, windowMs: 60_000 });
  if (rl) return rl;

  const { id } = await ctx.params;
  const child = await loadOwnedChild(id, auth.user.id);
  if (!child) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deleteChild(id);
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm check-types:web
```

- [ ] **Step 3: Smoke test PATCH and DELETE**

Boot the dev server (`pnpm dev:web`). Using the child id from Task 5's smoke test:

```bash
curl -i -X PATCH 'http://localhost:3000/api/parent/children/<CHILD_UUID>' \
  -H 'content-type: application/json' -H 'cookie: <session cookie>' \
  -d '{"name":"Riley J","rollClass":"9D"}'
```

Expected: `200`, response includes updated `name` and `rollClass`.

```bash
curl -i -X DELETE 'http://localhost:3000/api/parent/children/<CHILD_UUID>' \
  -H 'cookie: <session cookie>'
```

Expected: `204` no body. Re-run GET to confirm row is gone.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/parent/children/\[id\]/route.ts
git commit -m "feat(api): PATCH/DELETE /api/parent/children/[id]"
```

---

## Task 7: API route — confirm (stale-year acknowledge)

**Files:**
- Create: `apps/web/src/app/api/parent/children/[id]/confirm/route.ts`

- [ ] **Step 1: Create the route**

Write `apps/web/src/app/api/parent/children/[id]/confirm/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/authorization";
import { applyRateLimit } from "@/lib/rate-limit";
import { confirmChild, getChildById } from "@/db/queries";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
  const auth = await requireSessionUser();
  if ("response" in auth) return auth.response;

  const rl = applyRateLimit(req, `parent-children:confirm:${auth.user.id}`, { limit: 30, windowMs: 60_000 });
  if (rl) return rl;

  const { id } = await ctx.params;
  const child = await getChildById(id);
  if (!child || child.parentId !== auth.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await confirmChild(id);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ child: updated });
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm check-types:web
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/parent/children/\[id\]/confirm/route.ts
git commit -m "feat(api): POST /api/parent/children/[id]/confirm (stale-year ack)"
```

---

## Task 8: Add/edit child modal component

**Files:**
- Create: `apps/web/src/app/child-form-modal.tsx`

- [ ] **Step 1: Create the modal**

Write `apps/web/src/app/child-form-modal.tsx`. This is a `"use client"` component that is rendered by the picker (Task 9). Tenant select options come from props because the parent component already fetches them server-side.

```tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const YEAR_VALUES = ["7", "8", "9", "10", "11", "12"];

export type TenantOption = { id: string; name: string };

export type ChildFormInitial = {
  id?: string;
  tenantId?: string;
  name?: string;
  year?: string;        // canonical short form
  rollClass?: string | null;
};

export function ChildFormModal({
  mode,
  open,
  initial,
  tenants,
  onClose,
  onSaved,
}: {
  mode: "add" | "edit";
  open: boolean;
  initial: ChildFormInitial;
  tenants: TenantOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tenantId, setTenantId] = useState<string>(initial.tenantId ?? tenants[0]?.id ?? "");
  const [name, setName] = useState<string>(initial.name ?? "");
  const [year, setYear] = useState<string>(initial.year ?? "9");
  const [rollClass, setRollClass] = useState<string>(initial.rollClass ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTenantId(initial.tenantId ?? tenants[0]?.id ?? "");
    setName(initial.name ?? "");
    setYear(initial.year ?? "9");
    setRollClass(initial.rollClass ?? "");
    setError(null);
  }, [open, initial.id]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const url =
        mode === "add"
          ? "/api/parent/children"
          : `/api/parent/children/${initial.id}`;
      const method = mode === "add" ? "POST" : "PATCH";
      const body =
        mode === "add"
          ? { tenantId, name: name.trim(), year, rollClass: rollClass.trim() || null }
          : { name: name.trim(), year, rollClass: rollClass.trim() || null };

      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Save failed");
        return;
      }
      onSaved();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.4)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="child-form-title"
    >
      <div
        className="bg-white rounded-xl border shadow-xl w-full max-w-md mx-4 overflow-hidden"
        style={{ borderColor: "var(--color-rule)" }}
      >
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--color-rule)" }}
        >
          <h2 id="child-form-title" className="font-serif text-[18px] font-semibold" style={{ color: "var(--color-ink)" }}>
            {mode === "add" ? "Add a child" : "Edit child"}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-[16px]"
            style={{ color: "var(--color-ink-dim)", background: "var(--color-parchment)" }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          {error && (
            <div className="text-[12.5px] px-3 py-2 rounded" style={{ background: "#FEF2F2", color: "#B91C1C" }}>
              {error}
            </div>
          )}

          <div>
            <label className="type-label block mb-1" style={{ color: "var(--color-ink-dim)" }}>School *</label>
            <select
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              disabled={mode === "edit"}
              className="w-full h-9 border rounded-md px-3 text-[13px] outline-none bg-white disabled:opacity-60"
              style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {mode === "edit" && (
              <div className="text-[11px] mt-1" style={{ color: "var(--color-ink-dim)" }}>
                Remove and re-add to change school.
              </div>
            )}
          </div>

          <div>
            <label className="type-label block mb-1" style={{ color: "var(--color-ink-dim)" }}>Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="e.g. Riley"
              className="w-full h-9 border rounded-md px-3 text-[13px] outline-none"
              style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="type-label block mb-1" style={{ color: "var(--color-ink-dim)" }}>Year *</label>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full h-9 border rounded-md px-3 text-[13px] outline-none bg-white"
                style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
              >
                {YEAR_VALUES.map((y) => (
                  <option key={y} value={y}>Year {y}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="type-label block mb-1" style={{ color: "var(--color-ink-dim)" }}>Roll class</label>
              <input
                value={rollClass}
                onChange={(e) => setRollClass(e.target.value)}
                maxLength={20}
                placeholder="optional"
                className="w-full h-9 border rounded-md px-3 text-[13px] outline-none"
                style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
              />
            </div>
          </div>

          <div className="text-[11.5px] leading-[1.5]" style={{ color: "var(--color-ink-dim)" }}>
            We save this so you can re-order quickly. Edit or remove anytime.{" "}
            <Link href="/privacy" className="underline">Privacy notice</Link>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 h-9 rounded-md text-[13px]"
              style={{ background: "var(--color-parchment)", color: "var(--color-ink)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || name.trim().length === 0}
              className="px-4 h-9 rounded-md text-[13px] text-white disabled:opacity-50"
              style={{ background: "var(--color-navy)" }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm check-types:web
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/child-form-modal.tsx
git commit -m "feat(picker): child add/edit modal component"
```

---

## Task 9: Picker rewrite (server + client)

**Files:**
- Create: `apps/web/src/app/home-client.tsx`
- Modify: `apps/web/src/app/page.tsx`

This is the largest task. It replaces the `PARENT` mock-driven picker with the real one. We deliberately *do not* delete the `PARENT` constant yet — Task 14 cleans it up after all four consumer files are migrated.

- [ ] **Step 1: Write the client component**

Write `apps/web/src/app/home-client.tsx`:

```tsx
"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { ParentChildRow } from "@/db/queries";
import { Crest } from "@/components/crest";
import { PlatformMark } from "@/components/platform-mark";
import { ChevronRightIcon, PlusIcon } from "@/components/icons";
import { MobileShell } from "@/components/mobile-shell";
import { ChildFormModal, type TenantOption } from "./child-form-modal";
import {
  setActiveChildCookieClient,
  readActiveChildCookieClient,
  clearActiveChildCookieClient,
} from "@/lib/active-child";

type TenantBrandRow = {
  id: string;
  name: string;
  short: string;
  accent: string;
  // Crest expects extra fields from the mock; pass-through anything brand-related the server fetches.
  motto: string | null;
};

type Props =
  | {
      mode: "logged-out";
      tenants: TenantBrandRow[];
    }
  | {
      mode: "logged-in";
      userFirstName: string;
      tenants: TenantBrandRow[];           // for the add-child modal
      children: (ParentChildRow & { needsYearConfirm: boolean })[];
      tenantById: Record<string, TenantBrandRow>;
    };

function tenantToBrand(t: TenantBrandRow) {
  // Match the shape `<Crest>` requires from the mock `Tenant` type.
  return {
    id: t.id,
    name: t.name,
    short: t.short,
    accent: t.accent,
    accentInk: "#FFFFFF",
    motto: t.motto ?? "",
    address: "",
    shopHours: "",
    shopEmail: "",
  };
}

export function HomeClient(props: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [_, startTransition] = useTransition();
  const [modal, setModal] = useState<
    | { open: false }
    | { open: true; mode: "add" }
    | { open: true; mode: "edit"; child: ParentChildRow }
  >({ open: false });
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Open the add-child modal automatically when ?action=add-child is set
  // (used after sign-in callback from the logged-out CTA).
  useEffect(() => {
    if (props.mode !== "logged-in") return;
    if (searchParams.get("action") === "add-child") {
      setModal({ open: true, mode: "add" });
    }
  }, [props.mode, searchParams]);

  const refresh = () => startTransition(() => router.refresh());

  if (props.mode === "logged-out") {
    return (
      <MobileShell bg="var(--color-parchment)">
        <div className="px-6 pt-6 pb-2">
          <PlatformMark size={26} />
        </div>

        <div className="px-6 pt-6 pb-2">
          <div className="text-[11px] font-bold tracking-[1.4px] uppercase" style={{ color: "var(--color-gold)" }}>
            Welcome
          </div>
          <h1 className="font-serif text-[28px] font-medium mt-2 mb-1.5 leading-[1.15] tracking-[-0.4px]">
            Find your school.
          </h1>
          <p className="text-[14px] leading-[1.5] m-0" style={{ color: "var(--color-ink-dim)" }}>
            Tap a school to start shopping. Sign in to save your children for next time.
          </p>
        </div>

        <div className="px-5 py-6 flex flex-col gap-3.5 flex-1">
          {props.tenants.map((t) => (
            <Link
              key={t.id}
              href={`/${t.id}`}
              className="bg-white rounded-[14px] border p-4 flex items-center gap-4 transition-all hover:shadow-md"
              style={{
                borderColor: "var(--color-rule)",
                boxShadow: "0 1px 0 rgba(15,30,50,0.04), 0 8px 24px -16px rgba(15,30,50,0.18)",
              }}
            >
              <Crest tenant={tenantToBrand(t)} size={56} />
              <div className="flex-1 min-w-0">
                <div className="font-serif text-[18px] font-semibold leading-[1.15] mb-1" style={{ color: "var(--color-ink)" }}>
                  {t.short}
                </div>
                <div className="text-[12px] leading-[1.4]" style={{ color: "var(--color-ink-dim)" }}>
                  {t.name}
                </div>
              </div>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                style={{ background: "var(--color-navy)" }}
              >
                <ChevronRightIcon size={14} />
              </div>
            </Link>
          ))}
        </div>

        <div className="px-6 pb-6">
          <Link
            href="/auth/sign-in?callbackURL=%2F%3Faction%3Dadd-child"
            className="block w-full text-center bg-transparent border border-dashed rounded-[14px] p-4 text-[13px] font-medium"
            style={{ borderColor: "var(--color-rule)", color: "var(--color-ink-dim)" }}
          >
            Sign in to save your children
          </Link>
        </div>
      </MobileShell>
    );
  }

  // logged-in
  const onTapChild = (c: ParentChildRow) => {
    setActiveChildCookieClient(c.id);
    router.push(`/${c.tenantId}`);
  };

  const onConfirmYear = async (id: string) => {
    await fetch(`/api/parent/children/${id}/confirm`, { method: "POST" });
    refresh();
  };

  const onRemove = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from your saved children? Past orders are not affected.`)) return;
    setRemovingId(id);
    try {
      await fetch(`/api/parent/children/${id}`, { method: "DELETE" });
      // Per spec: clear uo:active-child if the removed profile was the active one.
      // Otherwise stale cookie state would persist client-side until next sign-out.
      if (readActiveChildCookieClient() === id) {
        clearActiveChildCookieClient();
      }
      refresh();
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <MobileShell bg="var(--color-parchment)">
      <div className="px-6 pt-6 pb-2">
        <PlatformMark size={26} />
      </div>

      <div className="px-6 pt-6 pb-2">
        <div className="text-[11px] font-bold tracking-[1.4px] uppercase" style={{ color: "var(--color-gold)" }}>
          Welcome back
        </div>
        <h1 className="font-serif text-[30px] font-medium mt-2 mb-1.5 leading-[1.15] tracking-[-0.4px]">
          Good morning,
          <br />
          {props.userFirstName}.
        </h1>
        <p className="text-[14px] leading-[1.5] m-0" style={{ color: "var(--color-ink-dim)" }}>
          Whose uniform are we shopping for today?
        </p>
      </div>

      <div className="px-5 py-6 flex flex-col gap-3.5 flex-1">
        {props.children.map((c) => {
          const tenant = props.tenantById[c.tenantId];
          if (!tenant) return null;
          return (
            <div
              key={c.id}
              className="bg-white rounded-[14px] border p-4 flex flex-col gap-2"
              style={{
                borderColor: "var(--color-rule)",
                boxShadow: "0 1px 0 rgba(15,30,50,0.04), 0 8px 24px -16px rgba(15,30,50,0.18)",
              }}
            >
              <button
                type="button"
                className="flex items-center gap-4 w-full text-left"
                onClick={() => onTapChild(c)}
              >
                <Crest tenant={tenantToBrand(tenant)} size={56} />
                <div className="flex-1 min-w-0">
                  <div className="font-serif text-[18px] font-semibold leading-[1.15] mb-1" style={{ color: "var(--color-ink)" }}>
                    {c.name}
                  </div>
                  <div className="text-[12px] leading-[1.4]" style={{ color: "var(--color-ink-dim)" }}>
                    {tenant.name}
                  </div>
                  <div className="text-[11px] mt-0.5 font-medium" style={{ color: "var(--color-ink-dim)" }}>
                    Year {c.year}
                  </div>
                </div>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0"
                  style={{ background: "var(--color-navy)" }}
                >
                  <ChevronRightIcon size={14} />
                </div>
              </button>

              {c.needsYearConfirm && (
                <div className="flex items-center gap-2 text-[11.5px] pt-2" style={{ borderTop: "1px solid var(--color-rule)", color: "var(--color-ink-dim)" }}>
                  <span>Still in Year {c.year} this year?</span>
                  <button
                    onClick={() => onConfirmYear(c.id)}
                    className="px-2 h-6 rounded text-white text-[11px]"
                    style={{ background: "var(--color-navy)" }}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setModal({ open: true, mode: "edit", child: c })}
                    className="px-2 h-6 rounded text-[11px]"
                    style={{ background: "var(--color-parchment)", color: "var(--color-ink)" }}
                  >
                    Edit
                  </button>
                </div>
              )}

              <div className="flex justify-end gap-3 text-[11px]" style={{ color: "var(--color-ink-dim)" }}>
                <button onClick={() => setModal({ open: true, mode: "edit", child: c })}>Edit</button>
                <button
                  onClick={() => onRemove(c.id, c.name)}
                  disabled={removingId === c.id}
                  style={{ color: "#B91C1C" }}
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}

        <button
          onClick={() => setModal({ open: true, mode: "add" })}
          className="bg-transparent border border-dashed rounded-[14px] p-4 text-[13px] font-medium flex items-center justify-center gap-2"
          style={{ borderColor: "var(--color-rule)", color: "var(--color-ink-dim)" }}
        >
          <PlusIcon size={16} />
          Add another child
        </button>
      </div>

      <div className="px-6 pb-6 text-[11px] text-center" style={{ color: "var(--color-ink-dim)" }}>
        <Link href="/privacy" className="underline">Privacy notice</Link>
      </div>

      {modal.open && (
        <ChildFormModal
          open
          mode={modal.mode}
          initial={
            modal.mode === "edit"
              ? {
                  id: modal.child.id,
                  tenantId: modal.child.tenantId,
                  name: modal.child.name,
                  year: modal.child.year,
                  rollClass: modal.child.rollClass,
                }
              : {}
          }
          tenants={props.tenants.map((t) => ({ id: t.id, name: t.short })) satisfies TenantOption[]}
          onClose={() => setModal({ open: false })}
          onSaved={() => {
            setModal({ open: false });
            refresh();
          }}
        />
      )}
    </MobileShell>
  );
}
```

- [ ] **Step 2: Rewrite the picker server component**

Replace `apps/web/src/app/page.tsx` entirely with:

```tsx
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/authorization";
import { getChildrenForParent, getPubliclyListedTenants } from "@/db/queries";
import { HomeClient } from "./home-client";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const sp = await searchParams;
  const user = await getSessionUser();
  const tenants = await getPubliclyListedTenants();

  const tenantBrandRows = tenants.map((t) => ({
    id: t.id,
    name: t.name,
    short: t.short,
    accent: t.accent,
    motto: t.motto ?? null,
  }));

  if (!user) {
    return <HomeClient mode="logged-out" tenants={tenantBrandRows} />;
  }

  const children = await getChildrenForParent(user.id);

  // Single-child convenience: jump straight into that school's catalog.
  // Skip when the user explicitly came here to manage children
  // (?action=add-child from the post-sign-in callback or a Manage Children link),
  // otherwise the user could never reach the picker to add a second child.
  if (children.length === 1 && sp.action !== "add-child") {
    redirect(`/${children[0].tenantId}`);
  }

  const currentYearStart = new Date(new Date().getFullYear(), 0, 1);
  const now = new Date();
  const decorated = children.map((c) => ({
    ...c,
    needsYearConfirm: c.lastConfirmedAt < currentYearStart && now >= currentYearStart,
  }));

  const tenantById = Object.fromEntries(tenantBrandRows.map((t) => [t.id, t]));

  const firstName = (user.name ?? user.email).split(" ")[0].split("@")[0];

  return (
    <HomeClient
      mode="logged-in"
      userFirstName={firstName}
      children={decorated}
      tenants={tenantBrandRows}
      tenantById={tenantById}
    />
  );
}
```

- [ ] **Step 3: Type-check**

```bash
pnpm check-types:web
```

If `<Crest>` complains about the brand-row shape, peek at `apps/web/src/components/crest.tsx` to see which fields are required and adjust `tenantToBrand()` accordingly. Pass empty strings for any required-but-unused string fields.

- [ ] **Step 4: Wire the bottom-nav `kids` tab to the picker**

The `?action=add-child` bypass on the auto-redirect is dead code unless something in the signed-in app actually links there. Without this, a parent who has saved exactly one child gets auto-redirected past `/` on every visit and can never reach the picker again to add a sibling. The natural reachable entry point is the bottom-nav `Kids` tab, which is currently `href: "#"`.

Edit `apps/web/src/components/bottom-nav.tsx`. Change the `kids` tab's `href` from `"#"` to `"/?action=add-child"`:

```tsx
{ id: "kids", label: "Kids", href: "/?action=add-child", icon: KidsIcon },
```

Leave `profile` as `"#"` for now — out of scope.

- [ ] **Step 5: Type-check again**

```bash
pnpm check-types:web
```

- [ ] **Step 6: Smoke test the picker**

```bash
pnpm dev:web
```

Open `http://localhost:3000/` in incognito (logged-out): expect to see NSBH and RGHS as crest cards plus the "Sign in" CTA at the bottom. Tap NSBH — expect to land on the catalog (still using the old PARENT mock for the banner, that's OK until Task 10).

Now sign in. Re-visit `/`. Expect:
- "Good morning, <firstname>." greeting.
- Empty middle area + the dashed "Add another child" button.
- Tap "Add another child" → modal opens with NSBH/RGHS in the dropdown. Save → modal closes, picker shows the new child card.
- Tap the child card → `uo:active-child` cookie sets (verify in devtools → Application → Cookies) and navigates to `/<tenantId>`.
- Edit the child → modal opens pre-filled, school select disabled.
- Remove → confirm prompt, on OK the row disappears.
- **Active-child remove check:** save two children, tap the first to set the active cookie, navigate back to `/`, then Remove that first child. Confirm `uo:active-child` is cleared in devtools. Now repeat with two children, tap the first to set the active cookie, but Remove the *second* child. Confirm the cookie is **still set** to the first child's id.

**Single-child reachability check** (the manage-children path):
- After saving exactly one child, navigate to `/` directly. Expect: auto-redirect to that child's tenant catalog.
- From the catalog, tap the bottom-nav `Kids` tab. Expect: lands on `/?action=add-child`, the picker renders (auto-redirect skipped), and the Add Child modal is open. Save a second child. Expect: now `/` shows two children, no auto-redirect.

Stop dev server with Ctrl-C.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/home-client.tsx apps/web/src/app/page.tsx apps/web/src/components/bottom-nav.tsx
git commit -m "feat(picker): real Neon Auth + DB-driven home with add/edit/remove"
```

---

## Task 10: Catalog header banner consumes active child

**Files:**
- Modify: `apps/web/src/app/[tenant]/page.tsx`

- [ ] **Step 1: Replace the PARENT lookup**

In `apps/web/src/app/[tenant]/page.tsx`, change the imports and the `kid` resolution:

Before:

```ts
import { CATALOG, CATEGORIES, PARENT, TENANTS, type TenantId } from "@/lib/data";
// ...
const kid = PARENT.kids.find((k) => k.tenantId === tenant.id);
```

After:

```ts
import { CATALOG, CATEGORIES, TENANTS, type TenantId } from "@/lib/data";
import { getActiveChild } from "@/lib/active-child";
// ...
const active = await getActiveChild();
const kid =
  active && active.tenantId === tenant.id
    ? { name: active.name, year: `Year ${active.year}` }
    : null;
```

The render block that uses `kid?.name` and `kid?.year` stays the same (they're already optional-chained).

- [ ] **Step 2: Type-check**

```bash
pnpm check-types:web
```

- [ ] **Step 3: Smoke test**

`pnpm dev:web`, signed in with a saved child:
- Tap the saved NSBH child on `/` → land on `/nsbh`.
- Expect the header to read "Shopping for · Riley, Year 9".
- Manually navigate to `/rgsh` (the *other* tenant) → expect the banner hidden (active child is for NSBH).

Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\[tenant\]/page.tsx
git commit -m "feat(catalog): banner reads active-child cookie instead of PARENT mock"
```

---

## Task 11: Cart header banner consumes active child

**Files:**
- Modify: `apps/web/src/app/[tenant]/cart/page.tsx`
- Modify: `apps/web/src/app/[tenant]/cart/cart-screen.tsx`

- [ ] **Step 1: Update the cart server page to fetch active child**

Replace `apps/web/src/app/[tenant]/cart/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { TENANTS, type TenantId } from "@/lib/data";
import { MobileShell } from "@/components/mobile-shell";
import { CartScreen } from "./cart-screen";
import { getActiveChild } from "@/lib/active-child";

export default async function CartPage({ params }: PageProps<"/[tenant]/cart">) {
  const { tenant: tid } = await params;
  if (!(tid in TENANTS)) notFound();
  const tenant = TENANTS[tid as TenantId];
  const active = await getActiveChild();
  const activeChild =
    active && active.tenantId === tenant.id
      ? { name: active.name, year: `Year ${active.year}` }
      : null;
  return (
    <MobileShell bg="var(--color-paper)">
      <CartScreen tenant={tenant} activeChild={activeChild} />
    </MobileShell>
  );
}
```

- [ ] **Step 2: Update `CartScreen` to consume the prop**

In `apps/web/src/app/[tenant]/cart/cart-screen.tsx`:

Remove the `PARENT` import and `PARENT.kids.find(...)` lookup. Add `activeChild` to the props:

Before:

```ts
import { PARENT, cartTotal } from "@/lib/data";
// ...
export function CartScreen({ tenant }: { tenant: Tenant }) {
  const { lines, hydrated, setQty } = useCart();
  const total = cartTotal(lines);
  const totalQty = lines.reduce((s, l) => s + l.qty, 0);
  const kid = PARENT.kids.find((k) => k.tenantId === tenant.id);
```

After:

```ts
import { cartTotal } from "@/lib/data";
// ...
type ActiveChildView = { name: string; year: string } | null;
export function CartScreen({ tenant, activeChild }: { tenant: Tenant; activeChild: ActiveChildView }) {
  const { lines, hydrated, setQty } = useCart();
  const total = cartTotal(lines);
  const totalQty = lines.reduce((s, l) => s + l.qty, 0);
  const kid = activeChild;
```

The render block that uses `kid?.name` / `kid?.year` is unchanged.

- [ ] **Step 3: Type-check**

```bash
pnpm check-types:web
```

- [ ] **Step 4: Smoke test**

`pnpm dev:web`. Add an item to cart at `/nsbh`, navigate to `/nsbh/cart`. Confirm the banner reads "Shopping for · Riley, Year 9". Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\[tenant\]/cart/page.tsx apps/web/src/app/\[tenant\]/cart/cart-screen.tsx
git commit -m "feat(cart): banner reads active-child cookie via server prop"
```

---

## Task 12: Order placed page derives from order row

**Files:**
- Modify: `apps/web/src/app/[tenant]/order/placed/page.tsx`

- [ ] **Step 1: Replace `PARENT.email` with order row lookup**

Edit the imports and the page body. The `orderId` already arrives via `searchParams.orderId`; we just need to fetch the order.

Before (line 3 area):

```ts
import { PARENT, TENANTS, type TenantId } from "@/lib/data";
```

After:

```ts
import { TENANTS, type TenantId } from "@/lib/data";
import { getOrderForReceipt } from "@/db/queries";
```

After the existing `searchParams` parsing (where `orderId`, `total`, `delivery` are pulled), add:

```ts
const order = await getOrderForReceipt(orderId);
const receiptEmail = order?.parentEmail ?? "your email";
```

Replace the line that renders `PARENT.email`:

Before:

```tsx
A receipt has been sent to <b style={{ color: "var(--color-ink)" }}>{PARENT.email}</b>.
```

After:

```tsx
A receipt has been sent to <b style={{ color: "var(--color-ink)" }}>{receiptEmail}</b>.
```

- [ ] **Step 2: Type-check**

```bash
pnpm check-types:web
```

- [ ] **Step 3: Smoke test**

Place a real order through the checkout flow (`pnpm dev:web` → sign in → add item → checkout → pay with Stripe test card 4242…). On the placed page, confirm the receipt email is the actual signed-in user's email, not the old `george.qiao@gmail.com` mock value.

If a Stripe smoke is impractical right now (no Connect account onboarded — see `docs/remaining_work.md` §2.8), at minimum visit `/<tenant>/order/placed?orderId=NSBH-FAKE-ID` and confirm it falls back to "your email" instead of erroring.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\[tenant\]/order/placed/page.tsx
git commit -m "feat(placed): receipt email from order row, not PARENT mock"
```

---

## Task 13: Checkout — `parent_note` field + active-child prefill

**Files:**
- Modify: `apps/web/src/app/[tenant]/checkout/page.tsx`
- Modify: `apps/web/src/app/[tenant]/checkout/checkout-screen.tsx`
- Modify: `apps/web/src/app/api/orders/route.ts`

- [ ] **Step 1: Server page passes active-child prefill into the screen**

Open `apps/web/src/app/[tenant]/checkout/page.tsx`. Add `getActiveChild()` and pass a prefill prop. Sketch (preserve any existing logic):

```tsx
import { getActiveChild } from "@/lib/active-child";
// ...

const active = await getActiveChild();
const prefill =
  active && active.tenantId === tenantId
    ? {
        studentName: active.name,
        year: `Year ${active.year}`,
        rollClass: active.rollClass ?? "",
      }
    : null;

return (
  <MobileShell bg="var(--color-paper)">
    <CheckoutScreen tenant={tenant} prefill={prefill} />
  </MobileShell>
);
```

- [ ] **Step 2: Wire the prefill prop into `CheckoutScreen` initial state**

In `apps/web/src/app/[tenant]/checkout/checkout-screen.tsx`, change the props and seed the initial `student` state from prefill (falling back to localStorage for parents without an active child cookie):

```tsx
type Prefill = { studentName: string; year: string; rollClass: string } | null;

export function CheckoutScreen({ tenant, prefill }: { tenant: Tenant; prefill: Prefill }) {
  const router = useRouter();
  const { lines, clearCart } = useCart();
  // ...

  const [student, setStudent] = useState<StudentDetails>(() => {
    const saved = readStudentDetails();
    return {
      studentName: prefill?.studentName ?? saved?.studentName ?? "",
      rollClass: prefill?.rollClass ?? saved?.rollClass ?? "",
      year: prefill?.year ?? saved?.year ?? "Year 9",
      parentName: saved?.parentName ?? "",
      mobile: saved?.mobile ?? "",
      email: saved?.email ?? "",
    };
  });

  // Drop the existing useEffect that overwrites student from readStudentDetails on mount —
  // initial state already accounts for both sources.

  // After successful POST, also overwrite localStorage so the next visit (without active child)
  // still has the same details — this preserves existing behaviour.
```

Find and remove the original `useEffect(() => { const saved = readStudentDetails(); if (saved) setStudent(saved); }, []);` since the initial state now handles it.

- [ ] **Step 3: Add the `parent_note` textarea**

In `checkout-screen.tsx`, add a new state and a textarea section. Place the field after the delivery section, before the refund-policy consent block.

Add state near the other useState calls:

```ts
const [parentNote, setParentNote] = useState("");
```

Render block (Tailwind classes mirror the sibling input fields):

```tsx
<div className="px-5 pt-2 pb-1">
  <label className="type-label block mb-1" style={{ color: "var(--color-ink-dim)" }}>
    Note for the school (optional)
  </label>
  <textarea
    value={parentNote}
    onChange={(e) => setParentNote(e.target.value.slice(0, 500))}
    rows={3}
    placeholder="Anything the shop should know about this order?"
    className="w-full border rounded-md px-3 py-2 text-[13px] outline-none resize-y"
    style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
  />
  <div className="text-[11px] mt-1" style={{ color: "var(--color-ink-dim)" }}>
    {parentNote.length} / 500
  </div>
</div>
```

- [ ] **Step 4: Send `parentNote` in the create-order POST body**

Find the `fetch("/api/orders", { method: "POST", ... })` call inside `checkout-screen.tsx` (the POST body that includes `tenantId`, `parentName`, `parentEmail`, etc.). Add to the body:

```ts
body: JSON.stringify({
  // ...existing fields...
  parentNote: parentNote.trim() ? parentNote.trim() : null,
}),
```

- [ ] **Step 5: Server-side accept + persist**

Open `apps/web/src/app/api/orders/route.ts`. Find the destructuring of the body (around the validation block earlier inspected):

```ts
const {
  tenantId, parentName, parentEmail, parentMobile,
  studentName, studentYear, studentRoll,
  delivery, deliveryFee,
  subtotal, gst, total,
  stripePaymentIntentId, refundPolicyAccepted,
  lines,
} = body;
```

Add `parentNote` to that destructuring. Then before the `insertOrder` call, normalise it:

```ts
const normalizedParentNote =
  typeof parentNote === "string" && parentNote.trim().length > 0
    ? parentNote.trim().slice(0, 500)
    : null;
```

In `insertOrder`'s `tx.insert(orders).values({ ... })` call, append:

```ts
parentNote: normalizedParentNote,
```

- [ ] **Step 6: Reconcile the active-child cookie after a successful order**

The spec requires clearing `uo:active-child` on a successful order placement that names a different child than the one carried by the cookie (`docs/superpowers/specs/2026-05-08-parent-account-children-design.md` "Tap-a-child — active-child transport contract" → "Cleared:"). Without this, a parent who taps Riley, edits the form to Mia, and submits will still see Riley's banner and prefill on the next shopping flow.

**Why a name-only check isn't enough:** the spec explicitly allows two children with the same first name (`docs/superpowers/specs/...` Edge cases table — "Parent has two kids with the same first name | Allowed"). Comparing only `studentName` would treat Alex (Year 9) and Alex (Year 7) as the same child and skip the clear. The robust client-side heuristic is to compare the full prefill triple — `studentName`, `studentYear`, `rollClass`. If any one of the three differs, the cookie is cleared. (Identical-twins-same-class is the only degenerate case where this still keeps the cookie, but that's effectively one shopping profile and acceptable.)

Implementation in `apps/web/src/app/[tenant]/checkout/checkout-screen.tsx`:

1. Add the import:

```ts
import { clearActiveChildCookieClient } from "@/lib/active-child";
```

2. Locate the success branch of the `/api/orders` POST — the block that currently runs `clearCart()` and `router.push(...)` to the placed page. Immediately before the navigate, compare the submitted student fields against the prefill's:

```ts
const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();
const matchesActive =
  prefill !== null &&
  norm(student.studentName) === norm(prefill.studentName) &&
  norm(student.year) === norm(prefill.year) &&
  norm(student.rollClass) === norm(prefill.rollClass);
if (!matchesActive) {
  clearActiveChildCookieClient();
}
```

This clears the cookie unless the parent kept ALL of {name, year, rollClass} unchanged from the active-child prefill. If the parent kept Riley unchanged, the cookie stays and the next visit's banners still read "Shopping for Riley".

- [ ] **Step 7: Type-check**

```bash
pnpm check-types:web
```

- [ ] **Step 8: Smoke test**

`pnpm dev:web`. Sign in, add a saved NSBH child named "Riley", tap into the catalog, add an item, go to checkout. Confirm:
- Student name / year / roll class fields are pre-populated with Riley.
- The "Note for the school (optional)" textarea is below delivery.
- Type a note ("Test note from parent"), place the order with Stripe test card.
- After placement, query the DB:

```bash
psql "$DATABASE_URL" -c "SELECT id, parent_note FROM orders ORDER BY created_at DESC LIMIT 1;"
```

Expected: latest order row has `parent_note = 'Test note from parent'`.

**Active-child reconciliation check (the new Step 6):**
- After the placed page renders, devtools → Application → Cookies → confirm `uo:active-child` is **still set** (you submitted as Riley, matching the active child on all of name + year + roll class).
- Place a second order: tap Riley on the picker, but this time edit the student name in the checkout form to "Mia" before paying. After placement, expect `uo:active-child` to be **cleared** (name diverged). Re-visit `/nsbh` and confirm the catalog header banner is hidden.
- **Same-name siblings check** (the case the name-only comparison would miss): create two children at NSBH both named "Alex", one in Year 9 and one in Year 7. Tap Alex/Year 9 on the picker (active cookie now points at that profile). At checkout, edit the year field to "Year 7" and place the order. Expect `uo:active-child` to be **cleared** even though the name didn't change.

Stop dev server.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/app/\[tenant\]/checkout/page.tsx \
        apps/web/src/app/\[tenant\]/checkout/checkout-screen.tsx \
        apps/web/src/app/api/orders/route.ts
git commit -m "feat(checkout): active-child prefill + parent_note capture + reconcile-on-success"
```

---

## Task 14: Operator order detail — show parent_note callout

**Files:**
- Modify: `apps/web/src/app/admin/[tenant]/orders/[orderId]/page.tsx`

- [ ] **Step 1: Verify the page already fetches the order with `parent_note`**

```bash
grep -n "parent_note\|parentNote\|getOrderById" apps/web/src/app/admin/\[tenant\]/orders/\[orderId\]/page.tsx
```

The existing `getOrderById` fetches the full row including the new `parent_note` column (because Drizzle's default `select()` returns everything from `schema.orders`). Confirm by reading `getOrderById` definition at `apps/web/src/db/queries.ts:397`.

- [ ] **Step 2: Render the callout**

Open `apps/web/src/app/admin/[tenant]/orders/[orderId]/page.tsx`. Locate where the order detail body renders line items (search for the line-items table header). Insert above it:

```tsx
{order.parentNote && (
  <div
    className="rounded-lg border p-3 mb-4"
    style={{ borderColor: "var(--color-rule)", background: "var(--color-parchment)" }}
  >
    <div className="text-[11px] font-bold tracking-[1.2px] uppercase mb-1" style={{ color: "var(--color-gold)" }}>
      Note from parent
    </div>
    <div className="text-[13px] leading-[1.5]" style={{ color: "var(--color-ink)" }}>
      {order.parentNote}
    </div>
  </div>
)}
```

If `order` lives on a child client component instead, thread `parentNote` through as a prop and render in the same place.

- [ ] **Step 3: Type-check**

```bash
pnpm check-types:web
```

- [ ] **Step 4: Smoke test**

`pnpm dev:web`. Sign in as an operator (the email matching `nsbh`'s `shopEmail`), navigate to the order placed in Task 13's smoke test. Confirm the "Note from parent" callout renders with the expected text. Place a control order without a note and confirm the callout is absent. Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/admin/\[tenant\]/orders/\[orderId\]/page.tsx
git commit -m "feat(admin): parent_note callout on order detail"
```

---

## Task 15: Pick slip — include parent_note prominently

**Files:**
- Modify: TBD — locate the pick-slip surface in this task's first step.

- [ ] **Step 1: Locate the pick slip**

```bash
grep -rn "window\.print\|@media print\|data-no-print\|pick.slip\|pickslip" apps/web/src --include="*.tsx" --include="*.ts" | head -20
```

Identify the file that renders the printable view — likely the same `admin/[tenant]/orders/[orderId]/...` tree (a "Print" button triggers `window.print()`, and a `@media print` stylesheet hides chrome). Note the file path.

- [ ] **Step 2: Add parent_note to the print view**

In the print-only block (a `<div>` only visible under `@media print`, or a class like `print:block hidden`), include the note as a bordered box at the top so it cannot be missed:

```tsx
{order.parentNote && (
  <div className="print:block hidden mb-4 p-3 border-2 border-black">
    <div className="text-[11px] font-bold uppercase tracking-wide mb-1">Note from parent</div>
    <div className="text-[13px] leading-snug">{order.parentNote}</div>
  </div>
)}
```

If the codebase uses a different print toggle (e.g. a separate "PrintView" component branched from a `?print=1` query, or a CSS module), adapt to match — the goal is for the note to print on paper.

- [ ] **Step 3: Type-check**

```bash
pnpm check-types:web
```

- [ ] **Step 4: Smoke test**

`pnpm dev:web`. Open the order detail with a parent_note. Trigger Print Preview (Cmd+P / Ctrl+P). Confirm the note renders at the top of the printed page. Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add <files-modified-in-step-2>
git commit -m "feat(pick-slip): include parent_note on printable view"
```

---

## Task 16: Parent order detail — echo parent_note

**Files:**
- Modify: `apps/web/src/app/orders/[orderId]/order-detail-client.tsx`

- [ ] **Step 1: Thread parentNote into the client component**

Open `apps/web/src/app/orders/[orderId]/page.tsx`. Confirm the `order` row passed to `<OrderDetailClient>` (or whatever the import is named) already includes `parentNote` (Drizzle's full-row select gives it for free).

- [ ] **Step 2: Render the note**

In `apps/web/src/app/orders/[orderId]/order-detail-client.tsx`, locate the section after pickup details and before the line-items list. Insert:

```tsx
{order.parentNote && (
  <div
    className="rounded-lg border p-3"
    style={{ borderColor: "var(--color-rule)", background: "var(--color-parchment)" }}
  >
    <div className="text-[11px] font-bold tracking-[1.2px] uppercase mb-1" style={{ color: "var(--color-gold)" }}>
      Your note to the school
    </div>
    <div className="text-[13px] leading-[1.5]" style={{ color: "var(--color-ink)" }}>
      {order.parentNote}
    </div>
  </div>
)}
```

If the prop drilling needs explicit type widening, update the `OrderDetailClient` props type to include `parentNote: string | null`.

- [ ] **Step 3: Type-check**

```bash
pnpm check-types:web
```

- [ ] **Step 4: Smoke test**

`pnpm dev:web`, signed in as the parent. Visit `/orders/<NSBH-XXXX>` for the order placed in Task 13 with a note. Confirm the "Your note to the school" box appears with the expected text. Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/orders/\[orderId\]/order-detail-client.tsx apps/web/src/app/orders/\[orderId\]/page.tsx
git commit -m "feat(parent-orders): echo parent_note on order detail receipt"
```

---

## Task 17: Sign-out clears active-child cookie

**Files:**
- Modify: `apps/web/src/components/admin-shell.tsx`
- Possibly modify: any other surface that calls `authClient.signOut()`

- [ ] **Step 1: Find every sign-out call site**

```bash
grep -rn "authClient.signOut\|signOut()" apps/web/src --include="*.ts" --include="*.tsx"
```

For each call site, ensure the active-child cookie is cleared.

- [ ] **Step 2: Add the cookie clear**

In `apps/web/src/components/admin-shell.tsx` near line 60 (`handleSignOut`):

Before:

```ts
const handleSignOut = async () => {
  setSignOutError(null);
  setSigningOut(true);
  try {
    await authClient.signOut();
    router.replace("/");
    router.refresh();
  } catch {
    setSignOutError("Sign-out failed. Please try again.");
  } finally {
    setSigningOut(false);
  }
};
```

After:

```ts
import { clearActiveChildCookieClient } from "@/lib/active-child";
// ...
const handleSignOut = async () => {
  setSignOutError(null);
  setSigningOut(true);
  try {
    await authClient.signOut();
    clearActiveChildCookieClient();
    router.replace("/");
    router.refresh();
  } catch {
    setSignOutError("Sign-out failed. Please try again.");
  } finally {
    setSigningOut(false);
  }
};
```

If other sign-out call sites exist (per Step 1), apply the same `clearActiveChildCookieClient()` call there.

- [ ] **Step 3: Type-check**

```bash
pnpm check-types:web
```

- [ ] **Step 4: Smoke test**

`pnpm dev:web`, sign in, tap a saved child to set the cookie. In devtools → Application → Cookies, confirm `uo:active-child` exists with the child UUID. Sign out via the operator shell (or whichever surface owns sign-out for parents — they currently sign out by clearing the Neon Auth cookie via the auth UI; verify by reading `authClient.signOut` docs). Confirm the `uo:active-child` cookie is cleared after sign-out. Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/admin-shell.tsx
git commit -m "feat(auth): clear uo:active-child cookie on sign-out"
```

---

## Task 18: Privacy page expansion

**Files:**
- Modify: `apps/web/src/app/privacy/page.tsx`

- [ ] **Step 1: Verify Neon Auth's account-management surface**

Before drafting the rights/deletion section, determine whether `<AuthView>` exposes a self-service deletion path in the version the app is on.

```bash
grep -rn "AuthView\|AuthViewPath" node_modules/@neondatabase/auth/dist 2>/dev/null | head -20
ls node_modules/@neondatabase/auth/dist/react/ui 2>/dev/null
```

If a path like `account` / `profile` / `settings` is supported, sign in on dev (`pnpm dev:web`) and try `http://localhost:3000/auth/account` (and any other plausible route based on the dist files). Note which URL renders an account-management UI with a delete option.

- [ ] **Step 2: Pin the deletion path or fall back**

Based on Step 1, the rights paragraph either links to the verified path *or* falls back to "email support". Use whichever was confirmed.

- [ ] **Step 3: Replace the privacy page**

Replace `apps/web/src/app/privacy/page.tsx` with:

```tsx
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-serif text-3xl font-semibold mb-4">Privacy notice</h1>
      <div className="space-y-4 text-[14px] leading-[1.6]" style={{ color: "var(--color-ink)" }}>
        <p>
          uniformorder.online is a shopfront platform that lets schools (the seller of record) sell uniforms online.
          This notice tells you what personal information we collect when you use the platform, why, where it's stored,
          how long we keep it, and how you can access or delete it.
        </p>

        <h2 className="font-serif text-xl mt-6">What we collect</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>Your account:</b> email address and (if you sign in with Google) display name.</li>
          <li><b>Saved children profiles:</b> the name you choose to display on the order, year level, school, and (optional) roll class.</li>
          <li><b>Order details:</b> line items purchased, pickup or shipping selection, your name and mobile, payment metadata via Stripe (we do not store card numbers ourselves), and any optional note you write to the school at checkout.</li>
        </ul>

        <h2 className="font-serif text-xl mt-6">Why we collect it</h2>
        <p>
          To process and fulfil uniform orders, and so you can re-order quickly without re-typing your child's details.
          We do not sell your data and we do not market to you.
        </p>

        <h2 className="font-serif text-xl mt-6">Where it's stored</h2>
        <p>
          Order and account data is stored on Neon (a US-hosted PostgreSQL service). Payment data flows through Stripe (US).
          Transactional emails are sent via Resend. The platform itself is hosted on Hostinger.
        </p>

        <h2 className="font-serif text-xl mt-6">How long we keep it</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>Saved children profiles:</b> until you remove them or delete your account.</li>
          <li><b>Orders:</b> retained for 7 years to meet Australian record-keeping requirements. Deleting your account de-links your orders from your account but they remain on the school's records.</li>
        </ul>

        <h2 className="font-serif text-xl mt-6">Your rights</h2>
        <p>
          {/*
            Choose ONE of the two sentences below based on Step 1 of this task:
            (A) Verified Neon Auth account path:
            You can update or delete your account from <Link href="/auth/account" className="underline">your account settings</Link>.
            (B) Fallback if no self-service deletion is exposed:
            To delete your account or correct your details, contact us at <a className="underline" href="mailto:support@uniformorder.online">support@uniformorder.online</a>.
          */}
          {/* TODO replace with the correct sentence */}
        </p>
        <p>
          For refund or shipping questions about a specific order, contact the school directly — the school is the seller of record.
        </p>

        <h2 className="font-serif text-xl mt-6">Contact</h2>
        <p>
          For privacy questions about the platform itself, email <a className="underline" href="mailto:support@uniformorder.online">support@uniformorder.online</a>.
        </p>

        <p className="mt-8 text-[12px]" style={{ color: "var(--color-ink-dim)" }}>
          Last updated: 8 May 2026.
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Replace the rights-paragraph TODO**

Based on Step 1's outcome, pick (A) or (B) and remove the comment block + the TODO marker. The page must not ship with a `TODO` in the rendered output.

- [ ] **Step 5: Type-check**

```bash
pnpm check-types:web
```

- [ ] **Step 6: Smoke test**

`pnpm dev:web`, visit `/privacy` (signed-out and signed-in). Confirm content renders, no TODO visible. If sentence (A) was chosen, click the account link and confirm the account UI loads. Stop dev server.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/privacy/page.tsx
git commit -m "docs(privacy): expand notice for parent-account + saved-children data"
```

---

## Task 19: Delete the `PARENT` mock

By this task, all four `PARENT` consumer files have been migrated. Now delete the constant — the type-checker will catch any missed references.

**Files:**
- Modify: `apps/web/src/lib/data.ts`

- [ ] **Step 1: Confirm there are no remaining `PARENT` consumers**

```bash
grep -rn "PARENT\b\|: Kid\b\|Kid\[\]" apps/web/src --include="*.ts" --include="*.tsx" | grep -v "data.ts:"
```

Expected: no matches. If any remain, fix them before proceeding.

- [ ] **Step 2: Remove `PARENT` and the `Kid` type**

In `apps/web/src/lib/data.ts`, delete the `Kid` interface (line ~275) and the `PARENT` constant block (lines ~281–288). Leave everything else unchanged.

- [ ] **Step 3: Type-check**

```bash
pnpm check-types:web
```

Expected: passes. If it fails, the grep in Step 1 missed something — restore the deletions, find the holdout, migrate, re-run.

- [ ] **Step 4: Smoke test**

`pnpm dev:web`. Walk the parent flow end-to-end: home picker → tap saved child → catalog → cart → checkout → place order → placed page → /orders → order detail. Walk the operator flow: admin orders board → click a parent_note order → see callout → print preview shows note. Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/data.ts
git commit -m "refactor(data): delete PARENT mock; all consumers now real"
```

---

## Task 20: Track ticket + ops checklist

**Files:**
- Modify: `docs/remaining_work.md`

- [ ] **Step 1: Mark §3.3 as code-complete**

Update §3.3 to reflect that the feature has shipped, listing the ops follow-ups still required before merge / launch.

In `docs/remaining_work.md`, replace the existing §3.3 body with:

```markdown
### 3.3 "Add another child" flow on school picker ✅ (code complete)

**Spec:** `docs/superpowers/specs/2026-05-08-parent-account-children-design.md`
**Plan:** `docs/superpowers/plans/2026-05-08-parent-account-children.md`
**Status:** Code complete on `<branch>`. Ops verifications remaining before merge:

- [ ] Verify both **magic-link email** and **Google** providers are enabled in the Neon Auth project dashboard for the production environment.
- [ ] Verify Neon Auth dedupes by primary email when the same email signs in via both magic-link and Google. If not, surface the setting and flip it.
- [ ] Confirm the Neon Auth account-management path linked from `/privacy` (per Task 18 Step 1) renders correctly on production-mirroring staging. If a self-service deletion path is unavailable, replace the link with the support-email fallback in `app/privacy/page.tsx` before merge.
- [ ] Run a real end-to-end smoke test on staging: sign in via magic-link, add a child, place an order with a note, confirm the operator detail callout, confirm the printed pick slip includes the note, confirm the parent receipt echoes the note.
- [ ] Run the same E2E with Google sign-in.
- [ ] After deploy, manually run `UPDATE tenants SET is_publicly_listed = true WHERE id IN ('nsbh','rgsh');` against production if the migration's seed UPDATE didn't apply (verify by checking the row).
```

- [ ] **Step 2: Commit**

```bash
git add docs/remaining_work.md
git commit -m "docs: mark §3.3 code-complete + ops verification checklist"
```

---

## Self-Review Checklist (run before handing off)

After landing all tasks, run these checks before requesting code review:

- [ ] `pnpm check-types:web` passes from a clean state.
- [ ] `pnpm build:web` passes.
- [ ] `grep -rn "PARENT\b" apps/web/src` returns nothing (or only `lib/data.ts` if the constant was kept for tests, which we did not write).
- [ ] `grep -rn "TODO\|TBD" apps/web/src/app/privacy/page.tsx` returns nothing.
- [ ] No `console.log` left in modified files.
- [ ] `git log --oneline main..HEAD` shows ~20 small commits, each ending in a passing type-check.

---

## Notes on testing convention

This codebase has no automated test suite by convention (per CLAUDE.md and prior plans). Each task ends with a manual smoke verification using the dev server plus `pnpm check-types:web`. The spec's "Testing" table is therefore **not** implemented as automated tests — it's implemented as the manual smoke steps embedded in each task and the Task 20 ops checklist. If a future PR wants to introduce a test framework, that's a separate plan; this one mirrors existing conventions to keep the diff focused on the feature.
