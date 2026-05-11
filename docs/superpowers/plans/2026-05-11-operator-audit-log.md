# Operator audit log — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a durable `audit_events` table and instrument every operator + platform-admin mutation across both portals; surface the records via two read-only viewers (per-order timeline + per-tenant activity feed).

**Architecture:** One new Drizzle-managed table (`audit_events`), one helper (`logAuditEvent`) with PostHog co-emit and log-after error model, one shared formatter (`formatAuditEvent`), two server-component viewers. 12 events instrumented at 13 call sites. Migration applied via Neon MCP (drizzle-kit migrate hangs in this env — see memory). Spec: `docs/superpowers/specs/2026-05-11-operator-audit-log-design.md`.

**Tech Stack:** Next.js 16 App Router + RSC, Drizzle ORM on Neon Postgres (neon-http, `db.batch` not `db.transaction`), TypeScript strict, Tailwind v4 with project design tokens, PostHog server `serverCapture`.

---

## Pre-flight context for the executor

You are working in a git worktree at `.claude/worktrees/operator-audit-log` on branch `worktree-operator-audit-log`, branched from `main`. Run `pwd` first and confirm — every path in this plan is relative to that worktree root.

**Migration numbering caveat.** This plan uses `0010_audit_events.sql` because that's the next free number on `main` today. PR #19 (open on `worktree-tenant-legal-refund-policy`) also uses `0010_*`. Whichever PR merges second will need to rebase its migration filename + journal entry from `0010` → `0011`. Do not pre-rebase. Use `0010` throughout this work.

**Drizzle-kit migrate is broken in this env.** Per `MEMORY.md`, `drizzle-kit migrate` hangs on websocket connection. Task 1 documents the Neon MCP workaround. Do NOT run `pnpm --filter web exec drizzle-kit migrate` — apply SQL via Neon MCP `run_sql_transaction` and insert the journal row manually.

**No test suite.** The correctness gate is `pnpm check-types:web` per `CLAUDE.md`. Each task ends with a type-check + commit. The final task adds a manual smoke list.

**Existing imports + helpers you'll reuse:**

- `requirePlatformAdmin` and `parseInput` action helpers from `lib/auth/action-helpers.ts` (introduced in PR #18, used throughout `app/platform/`).
- `requireSessionUser`, `isPlatformAdminEmail`, `isTenantOperatorEmail` from `lib/auth/authorization.ts`.
- `serverCapture` from `lib/analytics/server.ts`.
- `db` from `db/index.ts`, schema from `db/schema.ts`.
- `crypto.randomUUID()` for client-generated UUIDs (PR #19 / #18 pattern).

When in doubt about an existing pattern, read the surrounding file before editing — do not invent a new shape.

---

## File structure

**Files to create:**

| Path | Purpose |
|---|---|
| `apps/web/src/db/schema.ts` (modify) | Add `auditEvents` table definition |
| `apps/web/drizzle/0010_audit_events.sql` | Migration DDL |
| `apps/web/drizzle/meta/_journal.json` (modify) | Add 0010 journal entry |
| `apps/web/drizzle/meta/0010_snapshot.json` | Drizzle snapshot for migration 0010 |
| `apps/web/src/lib/audit/types.ts` | Shared types (`AuditEvent`, `AuditTargetType`, `AuditActorRole`, `LogAuditEventInput`) |
| `apps/web/src/lib/audit/log.ts` | `logAuditEvent` helper with PostHog co-emit |
| `apps/web/src/lib/audit/format.ts` | `formatAuditEvent` shared formatter |
| `apps/web/src/lib/audit/load-order-activity.ts` | Server helper merging audit_events + payments + virtual order-placed row |
| `apps/web/src/lib/audit/load-tenant-activity.ts` | Server helper: list audit_events for a tenant (limit 20) |
| `apps/web/src/components/admin/order-activity-strip.tsx` | Order-detail timeline (server component) |
| `apps/web/src/components/platform/tenant-activity-feed.tsx` | Tenant-detail activity card (server component) |

**Files to modify (instrumentation + wiring):**

| Path | Change |
|---|---|
| `apps/web/src/app/admin/[tenant]/orders/[orderId]/order-detail-actions.tsx` | Add `logAuditEvent` for `order.marked_ready` |
| `apps/web/src/app/admin/[tenant]/orders/[orderId]/page.tsx` | Render `OrderActivityStrip` |
| `apps/web/src/app/api/orders/[orderId]/refund/route.ts` | Add `logAuditEvent` for `order.refund_issued` |
| `apps/web/src/app/api/catalog/route.ts` | Add `logAuditEvent` for `catalog_item.created` (POST) |
| `apps/web/src/app/api/catalog/[itemId]/route.ts` | Add `logAuditEvent` for `catalog_item.updated` (PUT) and `catalog_item.deleted` (DELETE); compute `changedFields` from DB-state diff per spec §4.3 |
| `apps/web/src/app/platform/tenants/new/actions.ts` | Replace 4 existing `serverCapture` calls with `logAuditEvent`; add `tenant.branding_updated` (wizard step) + `tenant.operator_updated` |
| `apps/web/src/app/platform/tenants/[id]/actions.ts` | Add `logAuditEvent` for `updateTenantBranding` + `updateTenantLegal` |
| `apps/web/src/app/platform/tenants/[id]/page.tsx` | Render `TenantActivityFeed` |

---

## Task 1: Schema + migration

**Files:**
- Create: `apps/web/drizzle/0010_audit_events.sql`
- Create: `apps/web/drizzle/meta/0010_snapshot.json`
- Modify: `apps/web/src/db/schema.ts` (append `auditEvents` table)
- Modify: `apps/web/drizzle/meta/_journal.json` (append entry idx=10)

- [ ] **Step 1: Add `auditEvents` to the schema**

Open `apps/web/src/db/schema.ts`. At the bottom of the file (after the last existing table), append:

```ts
// ─── Audit events ────────────────────────────────────────────────────────────
export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    tenantId: text("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
    actorEmail: text("actor_email").notNull(),
    actorRole: text("actor_role").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    payload: jsonb("payload").default({}).notNull(),
  },
  (t) => ({
    tenantTimeIdx: index("idx_audit_events_tenant_time").on(t.tenantId, t.createdAt.desc()),
    targetIdx: index("idx_audit_events_target").on(t.targetType, t.targetId, t.createdAt.desc()),
    actorTimeIdx: index("idx_audit_events_actor_time").on(t.actorEmail, t.createdAt.desc()),
  }),
);
```

Verify the imports already include `pgTable, uuid, timestamp, text, jsonb, index` from `drizzle-orm/pg-core`. If `jsonb` or `index` is missing, add them to the existing import. Do not duplicate the import line.

- [ ] **Step 2: Write the migration SQL**

Create `apps/web/drizzle/0010_audit_events.sql`:

```sql
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tenant_id" text,
	"actor_email" text NOT NULL,
	"actor_role" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "audit_events_actor_role_check"
		CHECK ("actor_role" IN ('operator', 'platform_admin')),
	CONSTRAINT "audit_events_target_type_check"
		CHECK ("target_type" IN ('order', 'tenant', 'catalog_item', 'tenant_legal_version'))
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_tenant_id_tenants_id_fk"
	FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
	ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint
CREATE INDEX "idx_audit_events_tenant_time" ON "audit_events" ("tenant_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX "idx_audit_events_target" ON "audit_events" ("target_type", "target_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX "idx_audit_events_actor_time" ON "audit_events" ("actor_email", "created_at" DESC);
```

The `--> statement-breakpoint` comments are drizzle-kit's convention; preserve them so future drizzle tooling can re-parse.

- [ ] **Step 3: Append the journal entry**

Open `apps/web/drizzle/meta/_journal.json`. Inside the `entries` array, after the last entry (idx 9, `0009_petite_the_phantom`), insert:

```json
,
    {
      "idx": 10,
      "version": "7",
      "when": <unix_millis_now>,
      "tag": "0010_audit_events",
      "breakpoints": true
    }
```

Replace `<unix_millis_now>` with the result of `node -e "console.log(Date.now())"` — capture once and use that exact number.

- [ ] **Step 4: Create the migration snapshot**

Create `apps/web/drizzle/meta/0010_snapshot.json` by copying `0009_petite_the_phantom`'s snapshot (`apps/web/drizzle/meta/0009_snapshot.json`) as a starting point, then add the new `audit_events` table block under `tables`. Verbatim block to add inside `tables` (keep alphabetical order if other entries are alphabetical; otherwise append at the end):

```json
"audit_events": {
  "name": "audit_events",
  "schema": "",
  "columns": {
    "id": {
      "name": "id",
      "type": "uuid",
      "primaryKey": true,
      "notNull": true
    },
    "created_at": {
      "name": "created_at",
      "type": "timestamp with time zone",
      "primaryKey": false,
      "notNull": true,
      "default": "now()"
    },
    "tenant_id": {
      "name": "tenant_id",
      "type": "text",
      "primaryKey": false,
      "notNull": false
    },
    "actor_email": {
      "name": "actor_email",
      "type": "text",
      "primaryKey": false,
      "notNull": true
    },
    "actor_role": {
      "name": "actor_role",
      "type": "text",
      "primaryKey": false,
      "notNull": true
    },
    "action": {
      "name": "action",
      "type": "text",
      "primaryKey": false,
      "notNull": true
    },
    "target_type": {
      "name": "target_type",
      "type": "text",
      "primaryKey": false,
      "notNull": true
    },
    "target_id": {
      "name": "target_id",
      "type": "text",
      "primaryKey": false,
      "notNull": true
    },
    "payload": {
      "name": "payload",
      "type": "jsonb",
      "primaryKey": false,
      "notNull": true,
      "default": "'{}'::jsonb"
    }
  },
  "indexes": {
    "idx_audit_events_tenant_time": {
      "name": "idx_audit_events_tenant_time",
      "columns": [
        { "expression": "tenant_id", "isExpression": false, "asc": true, "nulls": "last" },
        { "expression": "created_at", "isExpression": false, "asc": false, "nulls": "first" }
      ],
      "isUnique": false,
      "concurrently": false,
      "method": "btree",
      "with": {}
    },
    "idx_audit_events_target": {
      "name": "idx_audit_events_target",
      "columns": [
        { "expression": "target_type", "isExpression": false, "asc": true, "nulls": "last" },
        { "expression": "target_id", "isExpression": false, "asc": true, "nulls": "last" },
        { "expression": "created_at", "isExpression": false, "asc": false, "nulls": "first" }
      ],
      "isUnique": false,
      "concurrently": false,
      "method": "btree",
      "with": {}
    },
    "idx_audit_events_actor_time": {
      "name": "idx_audit_events_actor_time",
      "columns": [
        { "expression": "actor_email", "isExpression": false, "asc": true, "nulls": "last" },
        { "expression": "created_at", "isExpression": false, "asc": false, "nulls": "first" }
      ],
      "isUnique": false,
      "concurrently": false,
      "method": "btree",
      "with": {}
    }
  },
  "foreignKeys": {
    "audit_events_tenant_id_tenants_id_fk": {
      "name": "audit_events_tenant_id_tenants_id_fk",
      "tableFrom": "audit_events",
      "tableTo": "tenants",
      "columnsFrom": ["tenant_id"],
      "columnsTo": ["id"],
      "onDelete": "set null",
      "onUpdate": "no action"
    }
  },
  "compositePrimaryKeys": {},
  "uniqueConstraints": {},
  "checkConstraints": {
    "audit_events_actor_role_check": {
      "name": "audit_events_actor_role_check",
      "value": "\"actor_role\" IN ('operator', 'platform_admin')"
    },
    "audit_events_target_type_check": {
      "name": "audit_events_target_type_check",
      "value": "\"target_type\" IN ('order', 'tenant', 'catalog_item', 'tenant_legal_version')"
    }
  }
}
```

Adjust the snapshot's top-level `id` and `prevId` if your copied 0009 snapshot has those fields — set `prevId` to 0009's `id` and generate a new UUID for `id` (use `node -e "console.log(crypto.randomUUID())"`).

If the snapshot turns out to be more complex than this template (e.g. drizzle-kit's exact format differs), fall back: skip the snapshot for now and let `drizzle-kit generate` regenerate it once drizzle-kit is unblocked. The runtime app does not read the snapshot — only future `drizzle-kit generate` runs do.

- [ ] **Step 5: Apply the migration via Neon MCP**

Use the Neon MCP `run_sql_transaction` tool (NOT the Bash tool; NOT `drizzle-kit migrate`). Get the dev project ID first via `mcp__Neon__list_projects` if you don't already have it.

Issue the following SQL statements in a single transaction (this matches the `0010_audit_events.sql` content with the `--> statement-breakpoint` markers removed):

```sql
CREATE TABLE "audit_events" (
  "id" uuid PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "tenant_id" text,
  "actor_email" text NOT NULL,
  "actor_role" text NOT NULL,
  "action" text NOT NULL,
  "target_type" text NOT NULL,
  "target_id" text NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT "audit_events_actor_role_check"
    CHECK ("actor_role" IN ('operator', 'platform_admin')),
  CONSTRAINT "audit_events_target_type_check"
    CHECK ("target_type" IN ('order', 'tenant', 'catalog_item', 'tenant_legal_version'))
);
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_tenant_id_tenants_id_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
CREATE INDEX "idx_audit_events_tenant_time" ON "audit_events" ("tenant_id", "created_at" DESC);
CREATE INDEX "idx_audit_events_target" ON "audit_events" ("target_type", "target_id", "created_at" DESC);
CREATE INDEX "idx_audit_events_actor_time" ON "audit_events" ("actor_email", "created_at" DESC);
```

Expected: Neon MCP returns success. If it errors, read the error carefully — it is likely a duplicate-name issue (PR #19 used 0010 too; check `\\d audit_events` to see if it already exists; if it does, you may need to drop + recreate or rename).

- [ ] **Step 6: Insert the drizzle journal row**

Drizzle's migration runner records applied migrations in `drizzle.__drizzle_migrations`. Without this row, a future `drizzle-kit migrate` run would re-apply the file and fail with "table already exists." Insert manually via Neon MCP `run_sql`:

```sql
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
VALUES (
  '<sha256-of-migration-sql>',
  <unix_millis_now>::bigint
);
```

To compute the hash, in the worktree shell:

```bash
shasum -a 256 apps/web/drizzle/0010_audit_events.sql | awk '{print $1}'
```

Use the resulting 64-char hex string as `<sha256-of-migration-sql>`. Use the same `Date.now()` value you used in the journal entry for `<unix_millis_now>` (must be the same — drizzle keys off this).

Verify it landed via Neon MCP `run_sql`:

```sql
SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id DESC LIMIT 3;
```

You should see the new row at the top.

- [ ] **Step 7: Type check**

```bash
pnpm check-types:web
```

Expected: clean (no errors). If `auditEvents` isn't exported correctly from `schema.ts`, fix and re-run.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/db/schema.ts apps/web/drizzle/0010_audit_events.sql apps/web/drizzle/meta/0010_snapshot.json apps/web/drizzle/meta/_journal.json
git commit -m "feat(db): audit_events table + migration 0010"
```

---

## Task 2: Audit log helper + types

**Files:**
- Create: `apps/web/src/lib/audit/types.ts`
- Create: `apps/web/src/lib/audit/log.ts`

- [ ] **Step 1: Create the types file**

```ts
// apps/web/src/lib/audit/types.ts
import type { InferSelectModel } from "drizzle-orm";
import type { auditEvents } from "@/db/schema";

export type AuditTargetType =
  | "order"
  | "tenant"
  | "catalog_item"
  | "tenant_legal_version";

export type AuditActorRole = "operator" | "platform_admin";

/** Drizzle row shape — what reads from `audit_events` give back. */
export type AuditEvent = InferSelectModel<typeof auditEvents>;

export interface LogAuditEventInput {
  tenantId: string | null;
  actorEmail: string;
  actorRole: AuditActorRole;
  /** Dotted event key, e.g. 'order.marked_ready'. Must be past tense. */
  action: string;
  targetType: AuditTargetType;
  targetId: string;
  payload?: Record<string, unknown>;
}
```

- [ ] **Step 2: Create the helper**

```ts
// apps/web/src/lib/audit/log.ts
import { db } from "@/db";
import { auditEvents } from "@/db/schema";
import { serverCapture } from "@/lib/analytics/server";
import type { LogAuditEventInput } from "./types";

/**
 * Append an audit row + best-effort PostHog co-emit.
 *
 * Contract:
 * - Called AFTER the business mutation has succeeded (log-after pattern).
 * - Never throws to the caller. Failures are logged + reported to PostHog
 *   under the synthetic event `audit_log_failed`.
 * - The user-facing mutation must not be rolled back if this fails.
 */
export async function logAuditEvent(input: LogAuditEventInput): Promise<void> {
  try {
    await db.insert(auditEvents).values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      actorEmail: input.actorEmail,
      actorRole: input.actorRole,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      payload: input.payload ?? {},
    });
  } catch (err) {
    console.error(
      "[audit] failed to log",
      { action: input.action, targetId: input.targetId },
      err,
    );
    try {
      await serverCapture(input.actorEmail, "audit_log_failed", {
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        error: err instanceof Error ? err.message : String(err),
      });
    } catch {
      /* swallow — PostHog is best-effort */
    }
    return;
  }

  // Audit row landed. Best-effort PostHog co-emit; isolated from success signal.
  try {
    await serverCapture(input.actorEmail, input.action, {
      ...input.payload,
      tenantId: input.tenantId,
      targetType: input.targetType,
      targetId: input.targetId,
      actorRole: input.actorRole,
    });
  } catch (err) {
    console.error(
      "[audit] posthog co-emit failed (audit row landed OK)",
      { action: input.action },
      err,
    );
  }
}
```

If `serverCapture`'s signature in `lib/analytics/server.ts` differs from `(distinctId, event, properties)`, adapt the calls to match. Do not invent a new signature.

- [ ] **Step 3: Type check**

```bash
pnpm check-types:web
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/audit/types.ts apps/web/src/lib/audit/log.ts
git commit -m "feat(audit): logAuditEvent helper + shared types"
```

---

## Task 3: Audit format helper

**Files:**
- Create: `apps/web/src/lib/audit/format.ts`

- [ ] **Step 1: Create the formatter**

```ts
// apps/web/src/lib/audit/format.ts
import type { AuditEvent } from "./types";

export interface FormattedAuditEvent {
  /** One-line human-readable description. */
  line: string;
  /** Lucide icon hint or dot color hint. Empty string = use default gold dot. */
  iconHint: "" | "money" | "check" | "edit" | "plus" | "trash" | "rocket" | "scale";
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

function formatCents(cents: number | undefined): string {
  if (typeof cents !== "number") return "$0.00";
  return `$${(cents / 100).toFixed(2)}`;
}

function safeStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function safeNum(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}

function safeArr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export function formatAuditEvent(event: AuditEvent): FormattedAuditEvent {
  const p = (event.payload as Record<string, unknown>) ?? {};
  switch (event.action) {
    case "order.marked_ready":
      return { line: `Marked order #${shortId(event.targetId)} ready`, iconHint: "check" };
    case "order.refund_issued": {
      const amount = formatCents(safeNum(p.refundAmountCents));
      const items = safeArr<{ name: string }>(p.lineItems);
      const itemsLabel = items.length === 1 ? "1 item" : `${items.length} items`;
      return { line: `Refunded ${amount} (${itemsLabel})`, iconHint: "money" };
    }
    case "catalog_item.created":
      return { line: `Added "${safeStr(p.name) || safeStr(p.sku) || "item"}" to catalog`, iconHint: "plus" };
    case "catalog_item.updated": {
      const fields = safeArr<string>(p.changedFields);
      return { line: `Edited catalog item (${fields.length} ${fields.length === 1 ? "field" : "fields"})`, iconHint: "edit" };
    }
    case "catalog_item.deleted":
      return { line: `Removed "${safeStr(p.name) || safeStr(p.sku) || "item"}" from catalog`, iconHint: "trash" };
    case "tenant.draft_created":
      return { line: `Created tenant draft "${safeStr(p.name) || event.targetId}"`, iconHint: "plus" };
    case "tenant.branding_updated": {
      const fields = safeArr<string>(p.changedFields);
      return { line: `Updated branding (${fields.length} ${fields.length === 1 ? "field" : "fields"})`, iconHint: "edit" };
    }
    case "tenant.operator_updated":
      return { line: `Changed operator from ${safeStr(p.previousEmail) || "(none)"} to ${safeStr(p.newEmail)}`, iconHint: "edit" };
    case "tenant.legal_updated": {
      const version = safeNum(p.version) ?? 0;
      const mode = safeStr(p.mode) || "text";
      return { line: `Saved legal policy v${version} (${mode} mode)`, iconHint: "scale" };
    }
    case "tenant.stripe_account_linked":
      return { line: `Linked Stripe account ${safeStr(p.stripeAccountId) || ""}`.trim(), iconHint: "money" };
    case "tenant.catalog_cloned": {
      const source = safeStr(p.sourceTenantId) || "another tenant";
      const count = safeNum(p.itemCount) ?? 0;
      return { line: `Cloned catalog from ${source} (${count} items)`, iconHint: "plus" };
    }
    case "tenant.went_live":
      return { line: `Approved tenant for live ordering`, iconHint: "rocket" };
    default:
      return { line: event.action, iconHint: "" };
  }
}
```

- [ ] **Step 2: Type check**

```bash
pnpm check-types:web
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/audit/format.ts
git commit -m "feat(audit): formatAuditEvent shared formatter (12 events)"
```

---

## Task 4: Order activity merge helper

**Files:**
- Create: `apps/web/src/lib/audit/load-order-activity.ts`

This helper produces the merged + sorted row list for the order timeline UI. It combines three sources into one client-friendly array.

- [ ] **Step 1: Inspect the `payments` schema**

Read `apps/web/src/db/schema.ts` and locate the `payments` table (or whatever it's actually called — could be `orderPayments`, `stripePayments`, etc.). Note its column names for `orderId`, `amountCents`, `kind`/`type` (succeeded vs refunded), and `createdAt`. The code in the next step assumes column names — if yours differ, adjust accordingly.

Also note the `orders` table columns: confirm `parentName` and `createdAt` exist (per spec §6.2 + §7).

- [ ] **Step 2: Create the helper**

```ts
// apps/web/src/lib/audit/load-order-activity.ts
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, orderPayments, orders } from "@/db/schema";
import type { AuditEvent } from "./types";

export type OrderActivityRow =
  | {
      kind: "audit";
      id: string;
      createdAt: Date;
      event: AuditEvent;
    }
  | {
      kind: "payment_received";
      id: string;
      createdAt: Date;
      amountCents: number;
    }
  | {
      kind: "payment_refunded";
      id: string;
      createdAt: Date;
      amountCents: number;
    }
  | {
      kind: "order_placed";
      id: string;
      createdAt: Date;
      parentName: string;
    };

const MAX_ROWS = 20;

export async function loadOrderActivity(orderId: string): Promise<OrderActivityRow[]> {
  // Fetch the three sources in parallel.
  const [auditRows, paymentRows, orderRow] = await Promise.all([
    db
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.targetType, "order"), eq(auditEvents.targetId, orderId)))
      .orderBy(desc(auditEvents.createdAt))
      .limit(MAX_ROWS),
    db
      .select()
      .from(orderPayments)
      .where(eq(orderPayments.orderId, orderId))
      .orderBy(desc(orderPayments.createdAt))
      .limit(MAX_ROWS),
    db
      .select({ createdAt: orders.createdAt, parentName: orders.parentName })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1),
  ]);

  const rows: OrderActivityRow[] = [];

  for (const a of auditRows) {
    rows.push({ kind: "audit", id: a.id, createdAt: a.createdAt, event: a });
  }
  for (const p of paymentRows) {
    // Adjust the discriminator based on your payments schema. The example
    // below assumes a `kind` column with values 'charge_succeeded' or
    // 'refund_processed'. Adapt to the real column.
    const k = (p as { kind?: string }).kind;
    if (k === "refund_processed") {
      rows.push({
        kind: "payment_refunded",
        id: p.id,
        createdAt: p.createdAt!,
        amountCents: (p as { amountCents: number }).amountCents,
      });
    } else {
      rows.push({
        kind: "payment_received",
        id: p.id,
        createdAt: p.createdAt!,
        amountCents: (p as { amountCents: number }).amountCents,
      });
    }
  }
  const order = orderRow[0];
  if (order && order.createdAt) {
    rows.push({
      kind: "order_placed",
      id: `order-placed-${orderId}`,
      createdAt: order.createdAt,
      parentName: order.parentName ?? "parent",
    });
  }

  rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return rows.slice(0, MAX_ROWS);
}
```

If the actual payments table is called something other than `orderPayments`, change the import + reference. If the payments table doesn't have a `kind` column, infer refund-vs-charge from the presence of a `stripeRefundId` column (look at the schema you inspected in Step 1 and adapt).

If there is genuinely no payments-equivalent table (only the `order_refunds` table seen in the schema scan), use `order_refunds` for refund rows and skip "payment received" entirely (orders themselves carry payment status; you can synthesise a "Payment received" row from `orders.paidAt` if such a column exists, or drop the payment_received row type entirely if no such column exists). The point is: don't pretend a column exists when it doesn't. Read first, adapt the code, then proceed.

- [ ] **Step 3: Type check**

```bash
pnpm check-types:web
```

Expected: clean. If imports of `orderPayments` fail, that confirms the table is named differently — adjust per Step 2 notes.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/audit/load-order-activity.ts
git commit -m "feat(audit): loadOrderActivity merge helper (audit + payments + order-placed)"
```

---

## Task 5: Tenant activity load helper

**Files:**
- Create: `apps/web/src/lib/audit/load-tenant-activity.ts`

- [ ] **Step 1: Create the helper**

```ts
// apps/web/src/lib/audit/load-tenant-activity.ts
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents } from "@/db/schema";
import type { AuditEvent } from "./types";

const MAX_ROWS = 20;

export async function loadTenantActivity(tenantId: string): Promise<AuditEvent[]> {
  return db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.tenantId, tenantId))
    .orderBy(desc(auditEvents.createdAt))
    .limit(MAX_ROWS);
}
```

- [ ] **Step 2: Type check**

```bash
pnpm check-types:web
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/audit/load-tenant-activity.ts
git commit -m "feat(audit): loadTenantActivity helper (limit 20 by tenant)"
```

---

## Task 6: OrderActivityStrip component

**Files:**
- Create: `apps/web/src/components/admin/order-activity-strip.tsx`

This is a server component. It accepts the merged rows from `loadOrderActivity` and renders them.

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/components/admin/order-activity-strip.tsx
import { formatAuditEvent } from "@/lib/audit/format";
import type { OrderActivityRow } from "@/lib/audit/load-order-activity";

function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function describeRow(row: OrderActivityRow): { line: string; actor: string; isHumanActor: boolean } {
  switch (row.kind) {
    case "audit": {
      const f = formatAuditEvent(row.event);
      return { line: f.line, actor: row.event.actorEmail, isHumanActor: true };
    }
    case "payment_received":
      return {
        line: `Payment received ($${(row.amountCents / 100).toFixed(2)})`,
        actor: "Stripe",
        isHumanActor: false,
      };
    case "payment_refunded":
      return {
        line: `Refund processed ($${(row.amountCents / 100).toFixed(2)})`,
        actor: "Stripe",
        isHumanActor: false,
      };
    case "order_placed":
      return {
        line: `Order placed by ${row.parentName}`,
        actor: row.parentName,
        isHumanActor: false,
      };
  }
}

export function OrderActivityStrip({ rows }: { rows: OrderActivityRow[] }) {
  if (rows.length === 0) {
    return (
      <section className="rounded-md border border-[color:var(--color-rule)] bg-[color:var(--color-paper)] p-5">
        <h2 className="font-serif text-lg text-[color:var(--color-navy-deep)]">Activity</h2>
        <p className="mt-2 text-sm text-neutral-500">No activity yet.</p>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-[color:var(--color-rule)] bg-[color:var(--color-paper)] p-5">
      <h2 className="font-serif text-lg text-[color:var(--color-navy-deep)]">Activity</h2>
      <ol className="mt-4 space-y-3">
        {rows.map((row) => {
          const { line, actor, isHumanActor } = describeRow(row);
          return (
            <li key={row.id} className="flex items-start gap-3 text-sm">
              <span
                aria-hidden
                className={`mt-2 inline-block h-2 w-2 shrink-0 rounded-full ${
                  isHumanActor ? "bg-[color:var(--color-gold)]" : "bg-neutral-400"
                }`}
              />
              <div className="flex flex-1 items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[color:var(--color-navy-deep)]">{line}</p>
                  <p className="text-xs text-neutral-500">{actor}</p>
                </div>
                <p className="tnum shrink-0 text-xs text-neutral-500">{relativeTime(row.createdAt)}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
```

- [ ] **Step 2: Type check**

```bash
pnpm check-types:web
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/admin/order-activity-strip.tsx
git commit -m "feat(audit): OrderActivityStrip server component"
```

---

## Task 7: TenantActivityFeed component

**Files:**
- Create: `apps/web/src/components/platform/tenant-activity-feed.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/components/platform/tenant-activity-feed.tsx
import { formatAuditEvent } from "@/lib/audit/format";
import type { AuditEvent } from "@/lib/audit/types";

function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

const MAX_ROWS = 20;

export function TenantActivityFeed({ events }: { events: AuditEvent[] }) {
  if (events.length === 0) {
    return (
      <section className="rounded-md border border-[color:var(--color-rule)] bg-[color:var(--color-paper)] p-5">
        <h2 className="font-serif text-lg text-[color:var(--color-navy-deep)]">Activity</h2>
        <p className="mt-2 text-sm text-neutral-500">No activity yet.</p>
      </section>
    );
  }

  const showFooter = events.length === MAX_ROWS;

  return (
    <section className="rounded-md border border-[color:var(--color-rule)] bg-[color:var(--color-paper)] p-5">
      <h2 className="font-serif text-lg text-[color:var(--color-navy-deep)]">Activity</h2>
      <ol className="mt-4 space-y-3">
        {events.map((e) => {
          const f = formatAuditEvent(e);
          return (
            <li key={e.id} className="flex items-start gap-3 text-sm">
              <span aria-hidden className="mt-2 inline-block h-2 w-2 shrink-0 rounded-full bg-[color:var(--color-gold)]" />
              <div className="flex flex-1 items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[color:var(--color-navy-deep)]">{f.line}</p>
                  <p className="text-xs text-neutral-500">{e.actorEmail}</p>
                </div>
                <p className="tnum shrink-0 text-xs text-neutral-500">{relativeTime(e.createdAt)}</p>
              </div>
            </li>
          );
        })}
      </ol>
      {showFooter ? (
        <p className="mt-4 text-xs text-neutral-500">Showing 20 most recent — full history coming soon.</p>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 2: Type check**

```bash
pnpm check-types:web
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/platform/tenant-activity-feed.tsx
git commit -m "feat(audit): TenantActivityFeed server component"
```

---

## Task 8: Instrument operator order actions (mark ready + refund)

**Files:**
- Modify: `apps/web/src/app/admin/[tenant]/orders/[orderId]/order-detail-actions.tsx`
- Modify: `apps/web/src/app/api/orders/[orderId]/refund/route.ts`

- [ ] **Step 1: Read the existing markOrderReady action**

```bash
cat apps/web/src/app/admin/[tenant]/orders/[orderId]/order-detail-actions.tsx | head -120
```

Locate the function that flips the order to status `ready` (likely `markOrderReady` or similar). Note the variable name holding the previous status, the user object (`requireSessionUser()` call), and the tenant slug.

- [ ] **Step 2: Add `logAuditEvent` for `order.marked_ready`**

In `order-detail-actions.tsx`, immediately after the successful `db.update(orders)...` (or `db.batch([...])`) call that sets status to ready, add:

```ts
import { logAuditEvent } from "@/lib/audit/log";
import { isPlatformAdminEmail } from "@/lib/auth/authorization";

// …inside the action, after the mutation succeeds:
await logAuditEvent({
  tenantId: tenantSlug,                 // adapt name to whatever the local variable is
  actorEmail: user.email,
  actorRole: isPlatformAdminEmail(user.email) ? "platform_admin" : "operator",
  action: "order.marked_ready",
  targetType: "order",
  targetId: orderId,
  payload: { previousStatus },
});
```

If the action does not already capture `previousStatus` before the mutation, add a `const previousStatus = existing.status;` line BEFORE the mutation, then reuse it here.

- [ ] **Step 3: Read the existing refund route**

```bash
cat apps/web/src/app/api/orders/[orderId]/refund/route.ts | head -200
```

Locate the point after the Stripe refund call succeeds and BEFORE returning 200. Note the variables available: refund amount, line item IDs, user email, tenant slug, order id.

- [ ] **Step 4: Add `logAuditEvent` for `order.refund_issued`**

In the refund route, after the Stripe refund call returns successfully and the local DB update commits, add:

```ts
import { logAuditEvent } from "@/lib/audit/log";
import { isPlatformAdminEmail } from "@/lib/auth/authorization";

// …after a successful refund, before `return NextResponse.json(...)`:
await logAuditEvent({
  tenantId: tenantSlug,
  actorEmail: user.email,
  actorRole: isPlatformAdminEmail(user.email) ? "platform_admin" : "operator",
  action: "order.refund_issued",
  targetType: "order",
  targetId: orderId,
  payload: {
    refundAmountCents,
    lineItems: refundedLineItems.map((li) => ({
      id: li.id,
      name: li.itemName,        // adapt to actual column name from the schema
      quantity: li.quantity,
    })),
    ...(reason ? { reason } : {}),
  },
});
```

`refundedLineItems` should already be in scope from the existing code that decides which lines to refund. If the code doesn't have a clean array of refunded lines, fetch the order with its items before the Stripe call and filter by the refund request's `lineItemIds`. Do not invent a snapshot — read what the route already has.

- [ ] **Step 5: Type check**

```bash
pnpm check-types:web
```

Expected: clean. Fix any reference errors before continuing.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/admin/[tenant]/orders/[orderId]/order-detail-actions.tsx apps/web/src/app/api/orders/[orderId]/refund/route.ts
git commit -m "feat(audit): instrument order.marked_ready and order.refund_issued"
```

---

## Task 9: Instrument catalog routes (create/update/delete)

**Files:**
- Modify: `apps/web/src/app/api/catalog/route.ts`
- Modify: `apps/web/src/app/api/catalog/[itemId]/route.ts`

- [ ] **Step 1: Read both catalog route files**

```bash
cat apps/web/src/app/api/catalog/route.ts
cat apps/web/src/app/api/catalog/[itemId]/route.ts
```

Note: handler names, where the mutation lands, and what local variables hold the user, tenant slug, item id, and the request body.

- [ ] **Step 2: Add `catalog_item.created` to POST**

In `apps/web/src/app/api/catalog/route.ts`, after the successful insert and before returning the 200/201 response:

```ts
import { logAuditEvent } from "@/lib/audit/log";
import { isPlatformAdminEmail } from "@/lib/auth/authorization";

// …after `const [inserted] = await db.insert(catalogItems).values(...).returning();`:
await logAuditEvent({
  tenantId: tenantSlug,
  actorEmail: user.email,
  actorRole: isPlatformAdminEmail(user.email) ? "platform_admin" : "operator",
  action: "catalog_item.created",
  targetType: "catalog_item",
  targetId: inserted.id,
  payload: {
    sku: inserted.sku,
    name: inserted.name,
    priceCents: inserted.priceCents,
  },
});
```

- [ ] **Step 3: Add `catalog_item.updated` to PUT with DB-state diff**

In `apps/web/src/app/api/catalog/[itemId]/route.ts`, the PUT handler must compute `changedFields` from the DB state BEFORE writing. Pattern:

```ts
import { logAuditEvent } from "@/lib/audit/log";
import { isPlatformAdminEmail } from "@/lib/auth/authorization";

// 1. Read current row
const [existing] = await db
  .select()
  .from(catalogItems)
  .where(eq(catalogItems.id, itemId))
  .limit(1);

if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

// 2. Compute changedFields by comparing parsed input to existing row.
//    Compare only the columns the request actually wants to change.
const candidates: Array<keyof typeof input.data> = ["sku", "name", "priceCents", "imageUrl", /* …all editable columns… */];
const changedFields: string[] = [];
for (const f of candidates) {
  if (input.data[f] !== undefined && input.data[f] !== (existing as Record<string, unknown>)[f]) {
    changedFields.push(f);
  }
}

// 3. No-op short-circuit: no audit row, no PostHog co-emit, just return 200.
if (changedFields.length === 0) {
  return NextResponse.json({ ok: true, noop: true });
}

// 4. Apply the update.
await db.update(catalogItems).set(input.data).where(eq(catalogItems.id, itemId));

// 5. Audit after successful update.
await logAuditEvent({
  tenantId: tenantSlug,
  actorEmail: user.email,
  actorRole: isPlatformAdminEmail(user.email) ? "platform_admin" : "operator",
  action: "catalog_item.updated",
  targetType: "catalog_item",
  targetId: itemId,
  payload: { changedFields },
});

return NextResponse.json({ ok: true });
```

Adapt variable names to whatever the existing PUT handler uses. The substantive change is: read-before-write to compute the diff, short-circuit on no-op, audit after success.

- [ ] **Step 4: Add `catalog_item.deleted` to DELETE**

In the same `[itemId]/route.ts`, after the successful delete:

```ts
// Read before delete so we have sku/name for the audit payload.
const [existing] = await db
  .select({ sku: catalogItems.sku, name: catalogItems.name })
  .from(catalogItems)
  .where(eq(catalogItems.id, itemId))
  .limit(1);

if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

await db.delete(catalogItems).where(eq(catalogItems.id, itemId));

await logAuditEvent({
  tenantId: tenantSlug,
  actorEmail: user.email,
  actorRole: isPlatformAdminEmail(user.email) ? "platform_admin" : "operator",
  action: "catalog_item.deleted",
  targetType: "catalog_item",
  targetId: itemId,
  payload: { sku: existing.sku, name: existing.name },
});

return NextResponse.json({ ok: true });
```

If catalog "delete" is actually a soft-delete (sets a `deletedAt` column), keep the same audit row — the action verb stays `catalog_item.deleted` because that's the semantic meaning from the operator's perspective.

- [ ] **Step 5: Type check**

```bash
pnpm check-types:web
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/catalog/route.ts apps/web/src/app/api/catalog/[itemId]/route.ts
git commit -m "feat(audit): instrument catalog_item create/update/delete"
```

---

## Task 10: Instrument platform provision wizard

**Files:**
- Modify: `apps/web/src/app/platform/tenants/new/actions.ts`

This file already has 4 `serverCapture` calls. Replace each with `logAuditEvent` (which co-emits the same PostHog event under the new name), and add 2 new audit calls for `updateTenantBranding` (wizard step) and `updateTenantOperator`.

- [ ] **Step 1: Read the existing actions file**

```bash
cat apps/web/src/app/platform/tenants/new/actions.ts | head -300
```

Note the names of each exported action (`createTenantDraft`, `updateTenantBranding`, `updateTenantOperator`, `createStripeStandardForTenant`, `cloneCatalogFromTenant`, and whichever flips approval status). Note the existing `serverCapture` call sites — those are the four to replace. The local variables for user, tenant id, and other inputs.

- [ ] **Step 2: Add the imports**

At the top of `actions.ts`, ensure these are imported (add what's missing; do not duplicate):

```ts
import { logAuditEvent } from "@/lib/audit/log";
import { isPlatformAdminEmail } from "@/lib/auth/authorization";
```

Remove any now-unused `import { serverCapture } …` line if nothing else in the file uses it.

- [ ] **Step 3: Replace `createTenantDraft`'s serverCapture**

Find the line that currently reads (approximately):

```ts
await serverCapture(user.email, "platform_tenant_created", { tenantId: parsed.data.id, name: parsed.data.name });
```

Replace with:

```ts
await logAuditEvent({
  tenantId: parsed.data.id,
  actorEmail: user.email,
  actorRole: "platform_admin",                  // this file is gated by requirePlatformAdmin
  action: "tenant.draft_created",
  targetType: "tenant",
  targetId: parsed.data.id,
  payload: { name: parsed.data.name },
});
```

If the file is gated by `requirePlatformAdmin` at the top of every action, you can hardcode `"platform_admin"`. If not, derive via `isPlatformAdminEmail(user.email) ? "platform_admin" : "operator"`. Match the surrounding code's pattern.

- [ ] **Step 4: Add `updateTenantBranding` (wizard step) with no-op short-circuit**

Find the wizard's `updateTenantBranding` action. Read the existing row, compute `changedFields` against the input (same DB-state diff pattern as Task 9 Step 3). Short-circuit if `changedFields.length === 0`. After the successful update:

```ts
await logAuditEvent({
  tenantId,
  actorEmail: user.email,
  actorRole: "platform_admin",
  action: "tenant.branding_updated",
  targetType: "tenant",
  targetId: tenantId,
  payload: { changedFields },
});
```

If this wizard step does NOT already write the columns being changed (e.g. only stores them in a draft buffer), the audit row may be misleading. Check whether the wizard step commits to the `tenants` row directly. If it doesn't, skip the audit call here and rely on the platform tenant detail page's branding edit (Task 11) to fire the event.

- [ ] **Step 5: Add `updateTenantOperator`**

In `updateTenantOperator`, after the successful update:

```ts
// previousEmail captured before the update:
const [existing] = await db.select({ shopEmail: tenants.shopEmail }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
const previousEmail = existing?.shopEmail ?? null;

if (previousEmail === parsed.data.shopEmail) {
  return { ok: true, noop: true };
}

await db.update(tenants).set({ shopEmail: parsed.data.shopEmail }).where(eq(tenants.id, tenantId));

await logAuditEvent({
  tenantId,
  actorEmail: user.email,
  actorRole: "platform_admin",
  action: "tenant.operator_updated",
  targetType: "tenant",
  targetId: tenantId,
  payload: { previousEmail, newEmail: parsed.data.shopEmail },
});
```

Adapt column name `shopEmail` to whatever the existing action actually writes.

- [ ] **Step 6: Replace `createStripeStandardForTenant`'s serverCapture**

```ts
await logAuditEvent({
  tenantId,
  actorEmail: user.email,
  actorRole: "platform_admin",
  action: "tenant.stripe_account_linked",
  targetType: "tenant",
  targetId: tenantId,
  payload: { stripeAccountId: account.id },     // adapt to actual variable
});
```

- [ ] **Step 7: Replace `cloneCatalogFromTenant`'s serverCapture**

```ts
await logAuditEvent({
  tenantId: destinationTenantId,
  actorEmail: user.email,
  actorRole: "platform_admin",
  action: "tenant.catalog_cloned",
  targetType: "tenant",
  targetId: destinationTenantId,
  payload: { sourceTenantId, itemCount: inserted.length },
});
```

`inserted.length` comes from the batch insert's return; if the existing code doesn't capture this, count rows being inserted before the batch and pass that number.

- [ ] **Step 8: Replace the approval-flip (`went_live`) serverCapture**

```ts
await logAuditEvent({
  tenantId,
  actorEmail: user.email,
  actorRole: "platform_admin",
  action: "tenant.went_live",
  targetType: "tenant",
  targetId: tenantId,
  payload: {},
});
```

- [ ] **Step 9: Type check**

```bash
pnpm check-types:web
```

Expected: clean.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/app/platform/tenants/new/actions.ts
git commit -m "feat(audit): instrument provision wizard (6 events; replaces 4 PostHog calls)"
```

---

## Task 11: Instrument platform tenant detail actions (branding + legal)

**Files:**
- Modify: `apps/web/src/app/platform/tenants/[id]/actions.ts`

- [ ] **Step 1: Read the file**

```bash
cat apps/web/src/app/platform/tenants/[id]/actions.ts
```

This file has `editTenantBranding` (from PR #18) and `editTenantLegal` (from PR #19). Both already do `changedFields` server-side. Note the names and the existing `serverCapture` calls if present.

- [ ] **Step 2: Add imports**

```ts
import { logAuditEvent } from "@/lib/audit/log";
```

- [ ] **Step 3: Add `tenant.branding_updated` to `editTenantBranding`**

After the successful branding update and AFTER the existing no-op short-circuit returns:

```ts
await logAuditEvent({
  tenantId,
  actorEmail: user.email,
  actorRole: "platform_admin",
  action: "tenant.branding_updated",
  targetType: "tenant",
  targetId: tenantId,
  payload: { changedFields },         // reuse the existing computed array
});
```

If `editTenantBranding` currently calls `serverCapture("tenant_branding_edited", …)`, replace that call with this `logAuditEvent` call — do not double-emit.

- [ ] **Step 4: Add `tenant.legal_updated` to `editTenantLegal`**

After the successful legal-version insert + tenant pointer update:

```ts
await logAuditEvent({
  tenantId,
  actorEmail: user.email,
  actorRole: "platform_admin",
  action: "tenant.legal_updated",
  targetType: "tenant_legal_version",
  targetId: newVersionId,             // the UUID of the inserted version row
  payload: { version: newVersionNumber, mode: parsed.data.policyMode },
});
```

If `editTenantLegal` calls `serverCapture("tenant_legal_edited", …)`, replace that call as above.

- [ ] **Step 5: Type check**

```bash
pnpm check-types:web
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/platform/tenants/[id]/actions.ts
git commit -m "feat(audit): instrument tenant branding + legal edits on platform detail"
```

---

## Task 12: Wire OrderActivityStrip into operator order detail page

**Files:**
- Modify: `apps/web/src/app/admin/[tenant]/orders/[orderId]/page.tsx`

- [ ] **Step 1: Read the page**

```bash
cat apps/web/src/app/admin/[tenant]/orders/[orderId]/page.tsx
```

Note: where the order-info card ends and where the action buttons (`order-detail-actions.tsx`) render. The activity strip goes between them.

- [ ] **Step 2: Load activity rows and render the component**

Add to the imports:

```tsx
import { loadOrderActivity } from "@/lib/audit/load-order-activity";
import { OrderActivityStrip } from "@/components/admin/order-activity-strip";
```

In the page function, after the existing order-fetch and BEFORE the JSX `return`:

```tsx
const activityRows = await loadOrderActivity(orderId);
```

In the JSX, immediately after the order-info card and before the action buttons:

```tsx
<OrderActivityStrip rows={activityRows} />
```

- [ ] **Step 3: Type check**

```bash
pnpm check-types:web
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/admin/[tenant]/orders/[orderId]/page.tsx
git commit -m "feat(audit): render OrderActivityStrip on operator order detail"
```

---

## Task 13: Wire TenantActivityFeed into platform tenant detail page

**Files:**
- Modify: `apps/web/src/app/platform/tenants/[id]/page.tsx`

- [ ] **Step 1: Read the page**

```bash
cat apps/web/src/app/platform/tenants/[id]/page.tsx
```

Note where `LegalCard` and `BrandingCard` are rendered. The activity feed goes below them.

- [ ] **Step 2: Load events and render**

Add to the imports:

```tsx
import { loadTenantActivity } from "@/lib/audit/load-tenant-activity";
import { TenantActivityFeed } from "@/components/platform/tenant-activity-feed";
```

In the page function, after the existing tenant-fetch:

```tsx
const activity = await loadTenantActivity(tenantId);
```

In the JSX, below `LegalCard` / `BrandingCard`:

```tsx
<TenantActivityFeed events={activity} />
```

- [ ] **Step 3: Type check**

```bash
pnpm check-types:web
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/platform/tenants/[id]/page.tsx
git commit -m "feat(audit): render TenantActivityFeed on platform tenant detail"
```

---

## Task 14: Final smoke + PR

**Files:** none (verification only)

- [ ] **Step 1: Final type-check**

```bash
pnpm check-types:web
```

Expected: clean.

- [ ] **Step 2: Boot dev server and smoke-test the six core paths**

```bash
pnpm dev:web
```

Open `http://localhost:3000` and run through the smoke list from spec §9. **Halt and report at the first failure** — do not patch in this task; instead, file a follow-up task or fix the relevant earlier task's commit.

1. Sign in as operator → open an existing order → click "Mark ready" → reload the page → "Activity" section shows a `Marked order #XXXXX ready` row attributed to the operator email.
2. Sign in as operator → open the same order → refund one line → reload → "Activity" shows both the refund row (gold dot) and a Stripe refund row (grey dot) plus the original payment.
3. Sign in as platform admin → `/platform/tenants/nsbh` → open branding edit drawer → change a single field → save → reload → "Activity" card shows `Updated branding (1 field)`.
4. Sign in as platform admin → `/platform/tenants/nsbh` → open legal edit drawer → save a v2 → reload → "Activity" shows `Saved legal policy v2 (text mode)` (adjust mode to whatever you actually set).
5. Sign in as platform admin → `/platform/tenants/new` → complete the wizard end-to-end on a throwaway slug → confirm four audit rows in the new tenant's "Activity" card: draft_created, stripe_account_linked (or skipped if you skipped Stripe), catalog_cloned (if you cloned), went_live (if you approved).
6. Force-failure check: temporarily edit `lib/audit/log.ts` to `throw new Error("force")` at the top of the function, mark an order ready, confirm the order STILL flips to ready in the DB and a PostHog `audit_log_failed` event fires. Revert the throw and re-type-check before committing.

- [ ] **Step 3: Update remaining_work.md**

Open `docs/remaining_work.md` and:
- Strike §4.6 from the §4 table (mark as ✅ Done with cross-reference to `completed.md` once written).
- Optional: add a §4.6 entry to `docs/completed.md` mirroring the format of §4.12 / §4.16.

- [ ] **Step 4: Commit the docs update**

```bash
git add docs/remaining_work.md docs/completed.md
git commit -m "docs: retire §4.6 (operator audit log) from backlog"
```

- [ ] **Step 5: Push and open PR**

```bash
git push -u origin worktree-operator-audit-log
gh pr create --title "feat: operator audit log (§4.6)" --body "$(cat <<'EOF'
## Summary

Adds a durable `audit_events` table and instruments every operator + platform-admin mutation across both portals. Renders two read-only viewers: a per-order timeline on the operator order-detail page (merged with Stripe payment rows) and a per-tenant activity feed below the existing branding / legal cards on the platform tenant detail page.

- **Schema:** new `audit_events` table (uuid, tenant_id FK, actor_email, actor_role, action, target_type, target_id, jsonb payload), three indexes. Check constraints on actor_role + target_type. FK ON DELETE SET NULL to preserve history if a draft tenant is hard-deleted.
- **Helper `logAuditEvent`:** log-after pattern (called after the business mutation succeeds, never inside its `db.batch`). PostHog co-emit on the same event name. Failures are isolated — the user-facing mutation must not roll back. On audit-write failure, a synthetic `audit_log_failed` event fires to PostHog.
- **Instrumentation:** 12 events at 13 call sites (5 operator, 7 platform-admin). The 4 existing PostHog calls in `app/platform/tenants/new/actions.ts` are replaced by `logAuditEvent` (which co-emits the new dotted names).
- **Viewers:** `OrderActivityStrip` joins audit_events + payments + a virtual "Order placed by {parentName}" row. `TenantActivityFeed` is audit_events only, limit 20. Both use a shared `formatAuditEvent` formatter.
- **Migration:** `0010_audit_events.sql` applied via Neon MCP `run_sql_transaction` (drizzle-kit migrate hangs in dev; standard workaround). Journal row inserted manually.

Spec: `docs/superpowers/specs/2026-05-11-operator-audit-log-design.md`
Plan: `docs/superpowers/plans/2026-05-11-operator-audit-log.md`

## Notes for review

- **PostHog event names changed.** Old: `platform_tenant_created`, `platform_tenant_stripe_created`, `platform_tenant_catalog_cloned`, `platform_tenant_went_live`. New (dotted): `tenant.draft_created`, `tenant.stripe_account_linked`, `tenant.catalog_cloned`, `tenant.went_live`. Any dashboard / funnel / alert referencing the old names needs migration before deploy.
- **Migration filename may conflict with PR #19.** PR #19 also uses `0010_*`. Whichever PR merges second renames its migration to `0011_*` + updates the journal entry.
- **`tenants.platformApprovedBy` retirement deferred** to a follow-up migration once the new `tenant.went_live` audit row is confirmed firing on real approvals (see spec §10).

## Test Plan

Manual smoke per spec §9:

- [ ] Operator marks an order ready → audit row + UI row, attributed to operator email
- [ ] Operator refunds one line → audit row + Stripe refund row both render
- [ ] Platform admin edits tenant branding → audit row with `changedFields`
- [ ] Platform admin saves legal v2 → audit row with `{ version: 2, mode }`
- [ ] Platform admin runs provision wizard end-to-end → 4 audit rows in order
- [ ] Force `logAuditEvent` to throw → user mutation still succeeds; `audit_log_failed` PostHog event fires

`pnpm check-types:web` clean across the branch.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Return the PR URL on completion.

---

## Self-review (already performed during plan-writing)

**Spec coverage:**
- §3 schema → Task 1 ✓
- §4 taxonomy (12 events) → Tasks 8–11 ✓
- §4.3 changedFields / no-op rules → Task 9 Step 3, Task 10 Step 4, Task 11 Step 3 ✓
- §4.4 cloning semantics (one row, not 24) → Task 10 Step 7 ✓
- §5 helper → Task 2 ✓
- §5.3 actor identification via `isPlatformAdminEmail` → Tasks 8–11 ✓
- §6.1 formatAuditEvent → Task 3 ✓
- §6.2 order activity strip → Tasks 4, 6, 12 ✓
- §6.3 tenant activity feed (no Show more in v1) → Tasks 5, 7, 13 ✓
- §7 instrumentation map (13 sites) → Tasks 8–11 ✓
- §7 PostHog event-name migration → covered in PR body Notes for review ✓
- §8 migration via Neon MCP workaround → Task 1 Step 5, Step 6 ✓
- §9 testing / smoke → Task 14 Step 2 ✓

**Placeholder scan:** no TBD / TODO / "handle edge cases" / "similar to Task N" without repeating code. Where a step says "adapt to actual column name" or "if the column doesn't exist," that's a deliberate instruction to read-before-write rather than a placeholder — the spec cannot promise schema details we did not verify.

**Type consistency:** `AuditEvent` / `AuditTargetType` / `AuditActorRole` defined in Task 2 are imported consistently by Tasks 3, 4, 5, 6, 7. `OrderActivityRow` defined in Task 4 is imported by Task 6. No phantom signatures.
