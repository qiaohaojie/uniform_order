# Order Fulfilment Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the overloaded single-status Kanban with a fulfilment workflow that separates fulfilment / payment / notification / refund state, supports Standard (4-column) and Simple (2-column) modes per tenant, ships a mobile pick mode, and audits every transition.

**Architecture:** Schema is split into `fulfilment_status` / `payment_status` / `completion_type` / `fulfilment_method` columns on `orders`. Two new audit tables: `order_events` (transitions) and `order_notification_events` (ready/hold/refund emails, idempotent on stripe_refund_id). A new `tenant_settings` table holds `workflow_mode` + `shipping_enabled` + `pickup_enabled`, audited via `tenant_setting_events`. Server actions replace the PATCH status endpoint and are the only mutation entrypoint; they enforce mode + transition rules and queue notifications through a single `enqueueNotification()` dispatcher. The desktop board renders columns from `workflow_mode`; a parallel mobile list view exposes the same actions as buttons.

**Tech Stack:** Next.js 16 App Router (RSC + server actions), Drizzle ORM on Neon Postgres (use `db.batch(...)` — neon-http has no transactions), HeroUI v3 (`@heroui/react`) + HeroUI Pro for sheets/dialogs, Tailwind v4, Stripe Connect refunds with `reverse_transfer + refund_application_fee`, EmailIt provider via `lib/email/client.ts`, PostHog `serverCapture` for analytics. Source design: `docs/2025-05-15-Order_Fulfilment_Workflow.md`. Planning notes: `/Volumes/T7/georgeqiao/.claude/plans/implement-the-work-in-immutable-whisper.md`.

**Verification model:** No test suite in this repo — `pnpm check-types` is the correctness gate. Each task ends with a `check-types` run + (where UI is touched) a targeted manual smoke against `pnpm dev:web`. Database changes are applied via Neon MCP `mcp__Neon__run_sql_transaction` because drizzle-kit migrate hangs in this env (see project memory).

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `apps/web/drizzle/0014_fulfilment_workflow.sql` | One-shot migration — new enums, alter `orders`, new `tenant_settings` / `tenant_setting_events` / `order_events` / `order_notification_events`, backfill, drop old enums. |
| `apps/web/src/lib/email/dispatch.ts` | `enqueueNotification()` — single entrypoint that writes `order_notification_events`, calls EmailIt, updates the row with outcome, mirrors latest state into `orders.emails_sent`. |
| `apps/web/src/lib/email/templates/OrderHold.tsx` | Hold-notice email template (issue found after ready email). |
| `apps/web/src/lib/email/templates/OrderRefund.tsx` | Refund confirmation email template (full + partial copy variants). |
| `apps/web/src/app/admin/[tenant]/orders/orders-mobile-list.tsx` | Mobile pick-mode list view with action buttons; mounted alongside the desktop board, toggled via `lg:hidden` / `hidden lg:block`. |
| `apps/web/src/app/admin/[tenant]/orders/[orderId]/order-history.tsx` | Renders chronological `order_events` + `order_notification_events` on the detail page. |
| `apps/web/src/app/platform/tenants/[tenantId]/settings/page.tsx` | RSC; loads tenant settings + recent setting events. |
| `apps/web/src/app/platform/tenants/[tenantId]/settings/settings-client.tsx` | Form: workflow_mode radio, shipping_enabled / pickup_enabled toggles, required reason input. |

### Files to modify

| Path | Reason |
|---|---|
| `apps/web/src/db/schema.ts` | Replace `orderStatusEnum` / `deliveryMethodEnum`; add the four new enums; rewrite `orders` columns; add the four new tables. |
| `apps/web/src/db/queries.ts` | Replace `LiveOrderStatus`; rename `countNewOrders` → `countToPrepare`; add `BoardOrder` type; add `getTenantSettings` / `updateTenantSettings` / `listOrderEvents` / `listOrderNotificationEvents` / `getOrdersForBoard`; update `getLiveDashboardData` filters. |
| `apps/web/src/lib/auth/authorization.ts` | Add `requirePlatformAdmin()`. |
| `apps/web/src/lib/email/index.ts` | Route `sendOrderReadyEmail` through `enqueueNotification`; add `sendOrderHoldEmail` / `sendOrderRefundEmail`. |
| `apps/web/src/app/admin/[tenant]/orders/actions.ts` | Replace contents — server actions: `markReady`, `reportIssue`, `resolveIssue`, `markCompleted`, `reopenOrder`, `recordPickSlipPrinted`. |
| `apps/web/src/app/admin/[tenant]/orders/page.tsx` | RSC: load `tenant_settings` + paid orders; pass `workflowMode` to client. |
| `apps/web/src/app/admin/[tenant]/orders/orders-page-client.tsx` | Branch desktop ↔ mobile; thread `workflowMode` to both. |
| `apps/web/src/app/admin/[tenant]/orders/orders-board.tsx` | Mode-aware column rendering; new card actions + badges; remove drag/drop assumptions. |
| `apps/web/src/app/admin/[tenant]/orders/csv.ts` | Replace `status` column with `fulfilment_status` / `payment_status` / `completion_type` / `refunded_amount` / `pick_slip_printed_at` / `ready_at` / `completed_at`. |
| `apps/web/src/app/admin/[tenant]/orders/[orderId]/page.tsx` | Load order_events + notification_events; pass to client. |
| `apps/web/src/app/admin/[tenant]/orders/[orderId]/order-detail-actions.tsx` | Mode-aware actions; reopen dialog with reason; new refund warning copy; mount history. |
| `apps/web/src/app/admin/[tenant]/settings/page.tsx` + `settings-client.tsx` | Add read-only "Workflow configuration" section. |
| `apps/web/src/app/api/orders/route.ts` | Enforce `shipping_enabled` on POST. |
| `apps/web/src/app/api/orders/[orderId]/route.ts` | Delete the PATCH-status endpoint (Task 5.0; server actions replace it). |
| `apps/web/src/app/api/orders/[orderId]/refund/route.ts` | Update `payment_status` + `refunded_amount_cents`; write `order_events`; enqueue refund email. |
| `apps/web/src/app/api/stripe/webhook/route.ts` | Reconcile `charge.refunded` against new columns; enqueue refund email with idempotency on `stripe_refund_id`. |
| `apps/web/src/app/[tenant]/checkout/page.tsx` + `checkout-screen.tsx` | Hide Ship option when `shipping_enabled=false`. |
| `apps/web/src/app/admin/[tenant]/layout.tsx` | Use renamed `countToPrepare` (the layout fetches the count; `admin-shell.tsx` only renders it). |
| `apps/web/src/lib/data.ts` | Any references to the legacy `status` literals get updated. |
| `docs/remaining_work.md` + `docs/completed.md` | Strike replaced items; append §4.38 entry after merge. |

---

## Pre-flight

- [ ] **Step 0a: Branch off main**

```bash
cd /Volumes/T7/georgeqiao/dev/uniform_order
git checkout main
git pull --ff-only
git checkout -b feat/fulfilment-workflow
```

- [ ] **Step 0b: Verify clean type baseline**

```bash
pnpm check-types
```

Expected: PASS with no errors. If errors exist before any change, surface them before continuing.

- [ ] **Step 0c: Verify required MCP tooling**

Confirm `mcp__Neon__run_sql_transaction` and `mcp__Neon__run_sql` are available (needed for Task 2 migration). If absent, the migration step will need to fall back to `neonctl` against the database URL — flag before proceeding.

- [ ] **Step 0d: Inspect existing FK target for `neon_auth_users`**

```bash
grep -n "neonAuthUsers\|neon_auth" apps/web/src/db/external-schema.ts
```

Expected output: `neonAuthUsers` is declared on `pgSchema("neon_auth").table("user", …)`. The migration SQL in Task 2 therefore references `"neon_auth"."user"("id")` (schema-qualified, singular `user`), NOT `"neon_auth_users"`.

- [ ] **Step 0e: Inspect existing email client signature**

Read `apps/web/src/lib/email/client.ts`. Confirm `sendEmail` requires `{ to, subject, html, text }` (text is **not** optional). The dispatcher in Task 5 must render both HTML and plaintext.

- [ ] **Step 0f: Fetch HeroUI Pro Sheet API**

Before Task 13:

```text
mcp__heroui-pro__get_component_docs({ components: ["sheet"] })
```

Record the actual compound API shape (likely `Sheet.Root`/`Sheet.Trigger`/`Sheet.Content`/etc.) so Task 13 implements against the real API, not a guess. If Sheet isn't suitable, the fallback is `@heroui/react` `Modal` or a native `<dialog>`.

---

## Task 1 — Schema definitions in `db/schema.ts`

**Files:**
- Modify: `apps/web/src/db/schema.ts`

This task only updates the Drizzle source (TypeScript). The SQL migration that actually moves the DB forward is Task 2. We do schema-first so type errors elsewhere surface early.

- [ ] **Step 1.1: Replace the order/delivery enums and add new enums**

In `apps/web/src/db/schema.ts`, replace the existing enum exports (currently lines 18–31) with:

```ts
// ─── Enums ───────────────────────────────────────────────────────────────────
export const orderFulfilmentStatusEnum = pgEnum("order_fulfilment_status", [
  "to_prepare",
  "ready",
  "needs_attention",
  "completed",
]);

export const orderPaymentStatusEnum = pgEnum("order_payment_status", [
  "pending",
  "paid",
  "partially_refunded",
  "refunded",
]);

export const orderCompletionTypeEnum = pgEnum("order_completion_type", [
  "collected",
  "shipped",
  "manual",
]);

export const orderFulfilmentMethodEnum = pgEnum("order_fulfilment_method", [
  "pickup",
  "shipping",
]);

export const workflowModeEnum = pgEnum("workflow_mode", [
  "standard",
  "simple",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "ready",
  "hold",
  "refund",
]);

export const notificationStatusEnum = pgEnum("notification_status", [
  "queued",
  "sent",
  "failed",
  "skipped",
]);

export const orderEventTypeEnum = pgEnum("order_event_type", [
  "order_paid",
  "pick_slip_printed",
  "status_changed",
  "ready_email_sent",
  "hold_email_sent",
  "refund_email_sent",
  "refund_created",
  "refund_failed",
  "order_reopened",
]);

export const policyModeEnum = pgEnum("policy_mode", ["text", "url"]);
```

(Keep `policyModeEnum` unchanged.) **Delete** `orderStatusEnum` and `deliveryMethodEnum`.

- [ ] **Step 1.2: Rewrite the `orders` table columns**

Replace the `orders` table definition. The new shape:

```ts
export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    // Parent
    parentName: text("parent_name").notNull(),
    parentEmail: text("parent_email").notNull(),
    parentMobile: text("parent_mobile").notNull(),
    // Student
    studentName: text("student_name").notNull(),
    studentYear: text("student_year").notNull(),
    studentRoll: text("student_roll").notNull(),
    // Fulfilment
    fulfilmentMethod: orderFulfilmentMethodEnum("fulfilment_method")
      .notNull()
      .default("pickup"),
    fulfilmentStatus: orderFulfilmentStatusEnum("fulfilment_status")
      .notNull()
      .default("to_prepare"),
    completionType: orderCompletionTypeEnum("completion_type"),
    deliveryFee: numeric("delivery_fee", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    // Financials
    subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
    gst: numeric("gst", { precision: 10, scale: 2 }).notNull(),
    total: numeric("total", { precision: 10, scale: 2 }).notNull(),
    refundedAmountCents: integer("refunded_amount_cents").notNull().default(0),
    // Stripe + payment
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripeRef: text("stripe_ref"),
    paymentStatus: orderPaymentStatusEnum("payment_status")
      .notNull()
      .default("pending"),
    // Legal
    refundPolicyAcceptedAt: timestamp("refund_policy_accepted_at"),
    parentNote: text("parent_note"),
    // Notification cache (source of truth lives in order_notification_events)
    emailsSent: jsonb("emails_sent").notNull().default(sql`'{}'::jsonb`),
    // Timestamps
    readyAt: timestamp("ready_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    pickSlipPrintedAt: timestamp("pick_slip_printed_at", { withTimezone: true }),
    pickSlipPrintedBy: uuid("pick_slip_printed_by").references(
      () => neonAuthUsers.id,
      { onDelete: "set null" },
    ),
    // Auth + audit
    userId: uuid("user_id").references(() => neonAuthUsers.id, { onDelete: "set null" }),
    legalVersionId: uuid("legal_version_id"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    stripePaymentIntentIdUnique: uniqueIndex("orders_stripe_payment_intent_id_unique").on(
      table.stripePaymentIntentId,
    ),
    tenantParentEmailIdx: index("idx_orders_tenant_parent_email").on(
      table.tenantId,
      table.parentEmail,
    ),
    tenantFulfilmentStatusIdx: index("idx_orders_tenant_fulfilment_status").on(
      table.tenantId,
      table.fulfilmentStatus,
    ),
  }),
);
```

- [ ] **Step 1.3: Add the four new tables**

Append after `orderRefunds`:

```ts
export const tenantSettings = pgTable("tenant_settings", {
  tenantId: text("tenant_id")
    .primaryKey()
    .references(() => tenants.id, { onDelete: "cascade" }),
  workflowMode: workflowModeEnum("workflow_mode").notNull().default("standard"),
  pickupEnabled: boolean("pickup_enabled").notNull().default(true),
  shippingEnabled: boolean("shipping_enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => neonAuthUsers.id, { onDelete: "set null" }),
});

export const tenantSettingEvents = pgTable(
  "tenant_setting_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    settingKey: text("setting_key").notNull(),
    oldValue: text("old_value"),
    newValue: text("new_value").notNull(),
    changedBy: uuid("changed_by").references(() => neonAuthUsers.id, { onDelete: "set null" }),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantTimeIdx: index("idx_tenant_setting_events_tenant_time").on(t.tenantId, t.createdAt),
  }),
);

export const orderEvents = pgTable(
  "order_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    eventType: orderEventTypeEnum("event_type").notNull(),
    fromStatus: orderFulfilmentStatusEnum("from_status"),
    toStatus: orderFulfilmentStatusEnum("to_status"),
    actorId: uuid("actor_id").references(() => neonAuthUsers.id, { onDelete: "set null" }),
    reason: text("reason"),
    metadataJson: jsonb("metadata_json").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orderTimeIdx: index("idx_order_events_order_time").on(t.orderId, t.createdAt),
    tenantTimeIdx: index("idx_order_events_tenant_time").on(t.tenantId, t.createdAt),
  }),
);

export const orderNotificationEvents = pgTable(
  "order_notification_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    status: notificationStatusEnum("status").notNull().default("queued"),
    recipientEmail: text("recipient_email").notNull(),
    providerMessageId: text("provider_message_id"),
    failureReason: text("failure_reason"),
    metadataJson: jsonb("metadata_json").notNull().default(sql`'{}'::jsonb`),
    idempotencyKey: text("idempotency_key"),
    triggeredBy: text("triggered_by"),
    triggeredByUserId: uuid("triggered_by_user_id").references(
      () => neonAuthUsers.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
  },
  (t) => ({
    idempotencyUnique: uniqueIndex("uniq_order_notification_idempotency")
      .on(t.idempotencyKey)
      .where(sql`idempotency_key is not null`),
    orderTypeTimeIdx: index("idx_order_notification_order_type_time").on(
      t.orderId,
      t.type,
      t.createdAt,
    ),
  }),
);
```

Make sure all referenced imports (`boolean`, `integer`, `uniqueIndex`, `sql`) are already imported at the top of the file — add any that are missing.

- [ ] **Step 1.4: Expect compile errors in dependent files**

```bash
pnpm check-types
```

Expected: errors in `db/queries.ts`, `orders-board.tsx`, `order-detail-actions.tsx`, `api/orders/[orderId]/route.ts`, `csv.ts`, etc., all referencing `orderStatusEnum`, `LiveOrderStatus`, `status`, `delivery`. **Do not fix yet** — fixes happen task-by-task. This step exists to confirm schema rewrite landed.

- [ ] **Step 1.5: Commit**

```bash
git add apps/web/src/db/schema.ts
git commit -m "feat(schema): introduce split fulfilment/payment enums and audit tables"
```

---

## Task 2 — Migration SQL `0014_fulfilment_workflow.sql`

**Files:**
- Create: `apps/web/drizzle/0014_fulfilment_workflow.sql`
- Modify: `apps/web/drizzle/meta/_journal.json`

Per project memory, drizzle-kit migrate hangs in this env; the SQL is applied via Neon MCP.

- [ ] **Step 2.0: Pre-flight — verify refund→collected backfill assumption**

The backfill below maps `status IN ('partially_refunded','refunded')` to `completion_type='collected'`. That is correct **only if** every such order was actually collected before the refund (i.e. it was never refunded while still in `ready`). Confirm via `mcp__Neon__run_sql`:

```sql
SELECT id, status, updated_at FROM orders
WHERE status IN ('partially_refunded','refunded');
```

If every returned row corresponds to a collected order (cross-check with the operator if uncertain), proceed with the migration as written. If any row was refunded while still `ready`/`packing`/`new`, adjust the `completion_type` CASE: leave `completion_type` NULL for those orders and instead set `fulfilment_status='ready'` (or appropriate prior state). Document the exception inline in the migration as a one-off `UPDATE … WHERE id IN (…)` before the generic CASE.

- [ ] **Step 2.1: Write the migration**

Create `apps/web/drizzle/0014_fulfilment_workflow.sql` with the full SQL (idempotent where convenient; ordered so backfills can run before drops):

```sql
-- New enums
CREATE TYPE "order_fulfilment_status" AS ENUM ('to_prepare','ready','needs_attention','completed');
CREATE TYPE "order_payment_status"    AS ENUM ('pending','paid','partially_refunded','refunded');
CREATE TYPE "order_completion_type"   AS ENUM ('collected','shipped','manual');
CREATE TYPE "order_fulfilment_method" AS ENUM ('pickup','shipping');
CREATE TYPE "workflow_mode"           AS ENUM ('standard','simple');
CREATE TYPE "notification_type"       AS ENUM ('ready','hold','refund');
CREATE TYPE "notification_status"     AS ENUM ('queued','sent','failed','skipped');
CREATE TYPE "order_event_type" AS ENUM (
  'order_paid','pick_slip_printed','status_changed','ready_email_sent',
  'hold_email_sent','refund_email_sent','refund_created','refund_failed','order_reopened'
);

-- tenant_settings
CREATE TABLE "tenant_settings" (
  "tenant_id"        text PRIMARY KEY REFERENCES "tenants"("id") ON DELETE CASCADE,
  "workflow_mode"    "workflow_mode"  NOT NULL DEFAULT 'standard',
  "pickup_enabled"   boolean          NOT NULL DEFAULT true,
  "shipping_enabled" boolean          NOT NULL DEFAULT false,
  "created_at"       timestamptz      NOT NULL DEFAULT now(),
  "updated_at"       timestamptz      NOT NULL DEFAULT now(),
  "updated_by"       uuid REFERENCES "neon_auth"."user"("id") ON DELETE SET NULL
);

CREATE TABLE "tenant_setting_events" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"   text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "setting_key" text NOT NULL,
  "old_value"   text,
  "new_value"   text NOT NULL,
  "changed_by"  uuid REFERENCES "neon_auth"."user"("id") ON DELETE SET NULL,
  "reason"      text,
  "created_at"  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "idx_tenant_setting_events_tenant_time"
  ON "tenant_setting_events"("tenant_id","created_at");

-- order_events
CREATE TABLE "order_events" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id"      text NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "tenant_id"     text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "event_type"    "order_event_type" NOT NULL,
  "from_status"   "order_fulfilment_status",
  "to_status"     "order_fulfilment_status",
  "actor_id"      uuid REFERENCES "neon_auth"."user"("id") ON DELETE SET NULL,
  "reason"        text,
  "metadata_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at"    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "idx_order_events_order_time"  ON "order_events"("order_id","created_at");
CREATE INDEX "idx_order_events_tenant_time" ON "order_events"("tenant_id","created_at");

-- order_notification_events
CREATE TABLE "order_notification_events" (
  "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id"              text NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "tenant_id"             text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "type"                  "notification_type"   NOT NULL,
  "status"                "notification_status" NOT NULL DEFAULT 'queued',
  "recipient_email"       text NOT NULL,
  "provider_message_id"   text,
  "failure_reason"        text,
  "metadata_json"         jsonb NOT NULL DEFAULT '{}'::jsonb,
  "idempotency_key"       text,
  "triggered_by"          text,
  "triggered_by_user_id"  uuid REFERENCES "neon_auth"."user"("id") ON DELETE SET NULL,
  "created_at"            timestamptz NOT NULL DEFAULT now(),
  "sent_at"               timestamptz,
  "failed_at"             timestamptz
);
CREATE UNIQUE INDEX "uniq_order_notification_idempotency"
  ON "order_notification_events"("idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;
CREATE INDEX "idx_order_notification_order_type_time"
  ON "order_notification_events"("order_id","type","created_at");

-- Add new orders columns (nullable so backfill can fill them before NOT NULL)
ALTER TABLE "orders"
  ADD COLUMN "fulfilment_status" "order_fulfilment_status",
  ADD COLUMN "payment_status"    "order_payment_status",
  ADD COLUMN "completion_type"   "order_completion_type",
  ADD COLUMN "fulfilment_method" "order_fulfilment_method",
  ADD COLUMN "refunded_amount_cents" integer NOT NULL DEFAULT 0,
  ADD COLUMN "ready_at"          timestamptz,
  ADD COLUMN "completed_at"      timestamptz,
  ADD COLUMN "pick_slip_printed_at" timestamptz,
  ADD COLUMN "pick_slip_printed_by" uuid REFERENCES "neon_auth"."user"("id") ON DELETE SET NULL;

-- Backfill orders
UPDATE "orders" SET
  "fulfilment_method" = CASE WHEN "delivery" = 'ship' THEN 'shipping'::order_fulfilment_method
                              ELSE 'pickup'::order_fulfilment_method END,
  "fulfilment_status" = CASE "status"
                          WHEN 'pending_payment' THEN 'to_prepare'
                          WHEN 'new'             THEN 'to_prepare'
                          WHEN 'packing'         THEN 'to_prepare'
                          WHEN 'ready'           THEN 'ready'
                          WHEN 'collected'       THEN 'completed'
                          WHEN 'partially_refunded' THEN 'completed'
                          WHEN 'refunded'        THEN 'completed'
                        END::order_fulfilment_status,
  "payment_status"    = CASE "status"
                          WHEN 'pending_payment' THEN 'pending'
                          WHEN 'partially_refunded' THEN 'partially_refunded'
                          WHEN 'refunded'        THEN 'refunded'
                          ELSE 'paid'
                        END::order_payment_status,
  "completion_type"   = CASE "status"
                          WHEN 'collected'          THEN 'collected'::order_completion_type
                          WHEN 'partially_refunded' THEN 'collected'::order_completion_type
                          WHEN 'refunded'           THEN 'collected'::order_completion_type
                          ELSE NULL
                        END,
  "ready_at"          = CASE WHEN "status" = 'ready'     THEN "updated_at" ELSE NULL END,
  "completed_at"      = CASE WHEN "status" IN ('collected','partially_refunded','refunded')
                              THEN "updated_at" ELSE NULL END;

-- Backfill refunded amount (cents)
UPDATE "orders" o SET "refunded_amount_cents" = COALESCE(sub.cents, 0)
FROM (
  SELECT "order_id", ROUND(SUM("amount") * 100)::int AS cents
  FROM "order_refunds" GROUP BY "order_id"
) sub
WHERE o.id = sub.order_id;

-- Enforce NOT NULL
ALTER TABLE "orders"
  ALTER COLUMN "fulfilment_status" SET NOT NULL,
  ALTER COLUMN "payment_status"    SET NOT NULL,
  ALTER COLUMN "fulfilment_method" SET NOT NULL,
  ALTER COLUMN "fulfilment_status" SET DEFAULT 'to_prepare',
  ALTER COLUMN "payment_status"    SET DEFAULT 'pending',
  ALTER COLUMN "fulfilment_method" SET DEFAULT 'pickup';

CREATE INDEX "idx_orders_tenant_fulfilment_status"
  ON "orders"("tenant_id","fulfilment_status");

-- Drop legacy columns + enums
ALTER TABLE "orders" DROP COLUMN "status";
ALTER TABLE "orders" DROP COLUMN "delivery";
DROP TYPE "order_status";
DROP TYPE "delivery_method";

-- Seed tenant_settings for every existing tenant
INSERT INTO "tenant_settings" ("tenant_id")
SELECT "id" FROM "tenants"
ON CONFLICT ("tenant_id") DO NOTHING;
```

- [ ] **Step 2.2: Update `_journal.json`**

Append a new entry to `apps/web/drizzle/meta/_journal.json` matching the existing entry structure (idx 14, tag `0014_fulfilment_workflow`, current timestamp in ms). Format per existing entries — read the file first to match shape.

- [ ] **Step 2.3: Apply via Neon MCP and register in `__drizzle_migrations`**

Run the SQL with `mcp__Neon__run_sql_transaction` against the project's database. After success, register the migration so drizzle-kit won't try to re-run it. Drizzle stores `sha256(sql)` as the hash, not the tag — compute it explicitly:

```bash
HASH=$(shasum -a 256 apps/web/drizzle/0014_fulfilment_workflow.sql | awk '{print $1}')
echo "$HASH"
```

Then via `mcp__Neon__run_sql`, insert one row matching the convention of existing rows (first read the latest existing row to confirm column names and the timestamp encoding):

```sql
SELECT * FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1;
-- then, using the captured $HASH:
INSERT INTO __drizzle_migrations (hash, created_at)
VALUES ('<sha256-from-shasum>', extract(epoch from now())::bigint * 1000);
```

If the existing rows reveal a different column set (e.g. an `id` column or alternative timestamp unit), adapt the INSERT to match exactly — divergence will cause drizzle-kit to re-attempt the migration on next push.

- [ ] **Step 2.4: Spot-check the migration**

Run via `mcp__Neon__run_sql`:

```sql
SELECT id, fulfilment_status, payment_status, completion_type, fulfilment_method,
       refunded_amount_cents, ready_at, completed_at
FROM orders ORDER BY created_at DESC LIMIT 10;

SELECT * FROM tenant_settings;
```

Expected: each existing order has non-null fulfilment_status/payment_status/fulfilment_method matching the mapping table; tenant_settings has one row per tenant with `workflow_mode='standard'`, `pickup_enabled=true`, `shipping_enabled=false`.

- [ ] **Step 2.5: Commit**

```bash
git add apps/web/drizzle/0014_fulfilment_workflow.sql apps/web/drizzle/meta/_journal.json
git commit -m "feat(db): migration 0014 — split order status, add workflow + audit tables"
```

---

## Task 3 — Query helpers in `db/queries.ts`

**Files:**
- Modify: `apps/web/src/db/queries.ts`

- [ ] **Step 3.1: Remove `LiveOrderStatus`**

Find and delete the `LiveOrderStatus` type export and any references in the same file (the queries that consumed it will be updated below).

- [ ] **Step 3.2: Re-export status types from schema, plus a shared `BoardOrder` row type**

Add near the top of `queries.ts`:

```ts
export type FulfilmentStatus =
  | "to_prepare" | "ready" | "needs_attention" | "completed";
export type PaymentStatus =
  | "pending" | "paid" | "partially_refunded" | "refunded";
export type CompletionType = "collected" | "shipped" | "manual";
export type FulfilmentMethod = "pickup" | "shipping";
export type WorkflowMode = "standard" | "simple";

// Single source-of-truth for the board card row shape — consumed by orders-board,
// orders-mobile-list, and order-card. Inferred from getOrdersForBoard so it can't drift.
export type BoardOrder = Awaited<ReturnType<typeof getOrdersForBoard>>[number];
```

(The `BoardOrder` line must follow `getOrdersForBoard`'s declaration — put it just after that function in 3.4.)

- [ ] **Step 3.3: Add tenant settings helpers**

```ts
export async function getTenantSettings(tenantId: string): Promise<{
  workflowMode: WorkflowMode;
  pickupEnabled: boolean;
  shippingEnabled: boolean;
}> {
  const [row] = await db
    .select()
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, tenantId))
    .limit(1);
  if (!row) {
    return { workflowMode: "standard", pickupEnabled: true, shippingEnabled: false };
  }
  return {
    workflowMode: row.workflowMode,
    pickupEnabled: row.pickupEnabled,
    shippingEnabled: row.shippingEnabled,
  };
}

type SettingPatch = Partial<{
  workflowMode: WorkflowMode;
  pickupEnabled: boolean;
  shippingEnabled: boolean;
}>;

export async function updateTenantSettings(
  tenantId: string,
  patch: SettingPatch,
  actorId: string | null,
  reason: string,
): Promise<void> {
  const current = await getTenantSettings(tenantId);
  const eventRows: Array<typeof tenantSettingEvents.$inferInsert> = [];
  for (const [key, newValue] of Object.entries(patch) as Array<
    [keyof SettingPatch, SettingPatch[keyof SettingPatch]]
  >) {
    if (newValue === undefined) continue;
    const oldValue = String(current[key]);
    const newStr = String(newValue);
    if (oldValue === newStr) continue;
    eventRows.push({
      tenantId,
      settingKey: key,
      oldValue,
      newValue: newStr,
      changedBy: actorId,
      reason,
    });
  }
  if (eventRows.length === 0) return;
  await db.batch([
    db
      .update(tenantSettings)
      .set({ ...patch, updatedAt: new Date(), updatedBy: actorId })
      .where(eq(tenantSettings.tenantId, tenantId)),
    db.insert(tenantSettingEvents).values(eventRows),
  ]);
}
```

(Imports needed: `tenantSettings`, `tenantSettingEvents` from `./schema`; `eq` from `drizzle-orm`. Add them.)

- [ ] **Step 3.4: Add board + counts queries**

```ts
export async function getOrdersForBoard(tenantId: string) {
  return db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.tenantId, tenantId),
        sql`${orders.paymentStatus} <> 'pending'`,
      ),
    )
    .orderBy(desc(orders.createdAt));
}

export async function countToPrepare(tenantId: string): Promise<number> {
  try {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, tenantId),
          eq(orders.fulfilmentStatus, "to_prepare"),
          sql`${orders.paymentStatus} <> 'pending'`,
        ),
      );
    return row?.n ?? 0;
  } catch (err) {
    console.error("countToPrepare failed", err);
    return 0;
  }
}
```

Imports needed: `and`, `desc`, `sql` from `drizzle-orm`. **Delete the existing `countNewOrders` export** (it queried `orders.status = 'new'`, which no longer exists). All callers — currently only `apps/web/src/app/admin/[tenant]/layout.tsx:37` — switch to `countToPrepare` in Task 11.

Note: `countToPrepare` and `getOrdersForBoard` share the `payment_status <> 'pending'` filter so the sidebar badge always matches the board's "To prepare" column count. Keep them in sync if either filter changes.

- [ ] **Step 3.5: Update `getLiveDashboardData` filters**

Wherever this function references the old `status` values, replace with:
- `awaitingPickup` count → `fulfilmentStatus IN ('to_prepare','needs_attention')` and `paymentStatus <> 'pending'`.
- `readyOverSevenDays` → `fulfilmentStatus = 'ready' AND ready_at < now() - interval '7 days'`.
- `recentOrders` returns the same columns but with the new statuses.

Use Drizzle's `sql` template for the interval predicate.

- [ ] **Step 3.6: Add order history queries**

```ts
export async function listOrderEvents(orderId: string) {
  return db
    .select()
    .from(orderEvents)
    .where(eq(orderEvents.orderId, orderId))
    .orderBy(desc(orderEvents.createdAt));
}

export async function listOrderNotificationEvents(orderId: string) {
  return db
    .select()
    .from(orderNotificationEvents)
    .where(eq(orderNotificationEvents.orderId, orderId))
    .orderBy(desc(orderNotificationEvents.createdAt));
}
```

(Import `orderEvents`, `orderNotificationEvents` from `./schema`.)

- [ ] **Step 3.7: Verify types**

```bash
pnpm check-types
```

Expected: errors should now be confined to UI files / API routes that still reference `status` / `delivery`. `queries.ts` itself should compile.

- [ ] **Step 3.8: Commit**

```bash
git add apps/web/src/db/queries.ts
git commit -m "feat(queries): board + tenant-settings + order-events helpers"
```

---

## Task 4 — `requirePlatformAdmin()` helper

**Files:**
- Modify: `apps/web/src/lib/auth/authorization.ts`

- [ ] **Step 4.1: Add the helper**

Append:

```ts
import { notFound, redirect } from "next/navigation";

// For RSC pages and server actions: redirect unauthenticated users to sign-in,
// and 404 unauthorised users (matches the rest of the app's pattern — throwing
// from an RSC produces a generic 500, which we want to avoid).
export async function requirePlatformAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/handler/sign-in");
  if (!isPlatformAdminEmail(user.email)) notFound();
  return user;
}
```

(If `redirect` / `notFound` are already imported, reuse the existing imports. `SessionUser` is the type declared earlier in this file.)

- [ ] **Step 4.2: Verify types + commit**

```bash
pnpm check-types
git add apps/web/src/lib/auth/authorization.ts
git commit -m "feat(auth): add requirePlatformAdmin guard"
```

---

## Task 5 — Notification dispatcher + templates

**Files:**
- Modify (delete handler): `apps/web/src/app/api/orders/[orderId]/route.ts`
- Create: `apps/web/src/lib/email/dispatch.ts`
- Create: `apps/web/src/lib/email/templates/OrderHold.tsx`
- Create: `apps/web/src/lib/email/templates/OrderRefund.tsx`
- Modify: `apps/web/src/lib/email/index.ts`

**Sequencing note:** The existing PATCH handler at `apps/web/src/app/api/orders/[orderId]/route.ts` is the only caller of the current `sendOrderReadyEmail(orderId: string)` signature. Step 5.0 removes that caller in the same commit as the signature change so `pnpm check-types` stays green through the task.

- [ ] **Step 5.0: Remove the legacy PATCH status handler**

Open `apps/web/src/app/api/orders/[orderId]/route.ts`. Delete the `PATCH` handler entirely — server actions in Task 6 are now the only mutation entrypoint for status. Keep any unrelated handlers (e.g., GET).

Before `git rm`-ing the file, **verify it contains no other exported HTTP handlers** (`GET`, `POST`, `PUT`, `DELETE`, etc.). Run `grep -E "export (async )?function (GET|POST|PUT|DELETE|HEAD|OPTIONS)" apps/web/src/app/api/orders/[orderId]/route.ts` — only proceed with `git rm` if zero matches remain after the PATCH deletion. If a GET handler exists, keep the file and just remove PATCH.

- [ ] **Step 5.1: Add the `OrderHold` template**

Mirror the structure of `OrderReady.tsx`. Body content per spec §13.4 case B:

```tsx
// apps/web/src/lib/email/templates/OrderHold.tsx
import { Html, Head, Preview, Body, Container, Text, Section } from "@react-email/components";

export function OrderHold(props: {
  tenantName: string;
  parentName: string;
  orderId: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>{`Update on order ${props.orderId}`}</Preview>
      <Body style={{ fontFamily: "Inter, sans-serif", background: "#FAF6EE" }}>
        <Container style={{ background: "#FDFBF6", padding: 24, maxWidth: 560 }}>
          <Text>Hi {props.parentName},</Text>
          <Section>
            <Text>
              We&apos;ve hit a small issue with order <strong>{props.orderId}</strong>.
              Please hold off on pickup. We&apos;ll be in touch as soon as it&apos;s ready.
            </Text>
          </Section>
          <Text>Thank you,<br />{props.tenantName} Uniform Shop</Text>
        </Container>
      </Body>
    </Html>
  );
}
```

- [ ] **Step 5.2: Add the `OrderRefund` template**

```tsx
// apps/web/src/lib/email/templates/OrderRefund.tsx
import { Html, Head, Preview, Body, Container, Text, Section } from "@react-email/components";

export function OrderRefund(props: {
  tenantName: string;
  parentName: string;
  orderId: string;
  amountAud: string;       // formatted, e.g. "$45.00"
  isFullRefund: boolean;
}) {
  return (
    <Html>
      <Head />
      <Preview>{`Refund processed for order ${props.orderId}`}</Preview>
      <Body style={{ fontFamily: "Inter, sans-serif", background: "#FAF6EE" }}>
        <Container style={{ background: "#FDFBF6", padding: 24, maxWidth: 560 }}>
          <Text>Hi {props.parentName},</Text>
          <Section>
            {props.isFullRefund ? (
              <Text>
                Your order <strong>{props.orderId}</strong> has been refunded for{" "}
                <strong>{props.amountAud}</strong>. The funds will return to your card
                within 5–10 business days.
              </Text>
            ) : (
              <Text>
                A partial refund of <strong>{props.amountAud}</strong> has been processed
                for order <strong>{props.orderId}</strong>. The remaining balance has not
                been refunded.
              </Text>
            )}
          </Section>
          <Text>If you have any questions, please reply to this email.</Text>
          <Text>Thank you,<br />{props.tenantName} Uniform Shop</Text>
        </Container>
      </Body>
    </Html>
  );
}
```

- [ ] **Step 5.3: Add the dispatcher**

Use `render` (matching existing `lib/email/index.ts`), produce both `html` and plaintext (the real `sendEmail` signature requires `text`), and avoid `sql.raw` interpolation by mapping the enum to a known constant path.

```ts
// apps/web/src/lib/email/dispatch.ts
import { render } from "@react-email/render";
import React from "react";
import { db } from "@/db";
import { orderNotificationEvents, orders } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { sendEmail } from "./client";

export type NotificationType = "ready" | "hold" | "refund";

// Keys are limited to the enum values, so the SQL path is one of a fixed,
// hardcoded set — no user input flows into the SQL string.
const EMAILS_SENT_PATH: Record<NotificationType, string> = {
  ready: "{ready}",
  hold:  "{hold}",
  refund:"{refund}",
};

export type EnqueueArgs = {
  orderId: string;
  tenantId: string;
  type: NotificationType;
  recipientEmail: string;
  idempotencyKey: string;
  triggeredBy: "staff_action" | "webhook" | "system";
  triggeredByUserId?: string | null;
  subject: string;
  reactBody: React.ReactElement;
  metadata?: Record<string, unknown>;
};

export type EnqueueResult = { eventId: string; status: "sent" | "failed" | "skipped" };

export async function enqueueNotification(args: EnqueueArgs): Promise<EnqueueResult> {
  // 1) Insert queued event; unique index on idempotency_key dedups.
  let inserted: { id: string } | null = null;
  try {
    const [row] = await db
      .insert(orderNotificationEvents)
      .values({
        orderId: args.orderId,
        tenantId: args.tenantId,
        type: args.type,
        status: "queued",
        recipientEmail: args.recipientEmail,
        idempotencyKey: args.idempotencyKey,
        triggeredBy: args.triggeredBy,
        triggeredByUserId: args.triggeredByUserId ?? null,
        metadataJson: args.metadata ?? {},
      })
      .returning({ id: orderNotificationEvents.id });
    inserted = row;
  } catch (err) {
    // ONLY treat Postgres unique-violation (SQLSTATE 23505) as "already enqueued".
    // Any other failure (FK violation, network blip, schema drift) must propagate
    // so the caller sees a real error instead of silently dropping the email.
    const code = (err as { code?: string } | null)?.code;
    if (code === "23505") {
      return { eventId: "", status: "skipped" };
    }
    throw err;
  }

  const path = EMAILS_SENT_PATH[args.type];

  // 2) Render html + text and send.
  try {
    const html = await render(args.reactBody);
    const text = await render(args.reactBody, { plainText: true });
    const result = await sendEmail({
      to: args.recipientEmail,
      subject: args.subject,
      html,
      text,
    });
    await db
      .update(orderNotificationEvents)
      .set({
        status: "sent",
        sentAt: new Date(),
        providerMessageId: result?.id ?? null,
      })
      .where(eq(orderNotificationEvents.id, inserted.id));

    // 3) Mirror latest state into orders.emails_sent for cheap board reads.
    await db
      .update(orders)
      .set({
        emailsSent: sql`jsonb_set(
          coalesce(${orders.emailsSent}, '{}'::jsonb),
          ${path}::text[],
          to_jsonb('sent'::text),
          true
        )`,
      })
      .where(eq(orders.id, args.orderId));

    return { eventId: inserted.id, status: "sent" };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await db
      .update(orderNotificationEvents)
      .set({ status: "failed", failedAt: new Date(), failureReason: reason })
      .where(eq(orderNotificationEvents.id, inserted.id));
    await db
      .update(orders)
      .set({
        emailsSent: sql`jsonb_set(
          coalesce(${orders.emailsSent}, '{}'::jsonb),
          ${path}::text[],
          to_jsonb('failed'::text),
          true
        )`,
      })
      .where(eq(orders.id, args.orderId));
    return { eventId: inserted.id, status: "failed" };
  }
}
```

Note: `sendEmail` may return `null` for 4xx (see `lib/email/client.ts`). The `result?.id ?? null` handles that. The `EMAILS_SENT_PATH` map keeps the jsonb path literal hard-coded — no `sql.raw` and no interpolation.

- [ ] **Step 5.4: Wire `lib/email/index.ts` to dispatcher**

Rewrite `sendOrderReadyEmail` with a structured-input signature (the old `(orderId)` overload is no longer called — Task 5.0 removed it). Idempotency keys derive from the `order_events` row ID emitted by the transition, so double-clicks within milliseconds yield the same key. Add `sendOrderHoldEmail` and `sendOrderRefundEmail`.

Keep the existing `sendOrderConfirmationEmail` flow untouched — it's a separate payment-confirmation event triggered from the Stripe webhook.

```tsx
// apps/web/src/lib/email/index.ts (additions; keep existing sendOrderConfirmationEmail and getOrderForEmail)
import { enqueueNotification, type EnqueueResult } from "./dispatch";
import { OrderHold } from "./templates/OrderHold";
import { OrderRefund } from "./templates/OrderRefund";
import { OrderReadyEmail } from "./templates/OrderReady";

export async function sendOrderReadyEmail(input: {
  orderId: string; tenantId: string; tenantName: string;
  parentName: string; parentEmail: string;
  orderEventId: string;             // PK from the order_events row that triggered this email
  triggeredByUserId: string | null;
}): Promise<EnqueueResult> {
  return enqueueNotification({
    orderId: input.orderId,
    tenantId: input.tenantId,
    type: "ready",
    recipientEmail: input.parentEmail,
    idempotencyKey: `ready:${input.orderId}:${input.orderEventId}`,
    triggeredBy: "staff_action",
    triggeredByUserId: input.triggeredByUserId,
    subject: `Your order ${input.orderId} is ready for pickup`,
    reactBody: <OrderReadyEmail tenantName={input.tenantName} parentName={input.parentName} orderId={input.orderId} />,
  });
}

export async function sendOrderHoldEmail(input: {
  orderId: string; tenantId: string; tenantName: string;
  parentName: string; parentEmail: string;
  orderEventId: string;             // PK from the needs_attention transition event
  triggeredByUserId: string | null;
}): Promise<EnqueueResult> {
  return enqueueNotification({
    orderId: input.orderId,
    tenantId: input.tenantId,
    type: "hold",
    recipientEmail: input.parentEmail,
    idempotencyKey: `hold:${input.orderId}:${input.orderEventId}`,
    triggeredBy: "staff_action",
    triggeredByUserId: input.triggeredByUserId,
    subject: `Update on order ${input.orderId}`,
    reactBody: <OrderHold tenantName={input.tenantName} parentName={input.parentName} orderId={input.orderId} />,
  });
}

export async function sendOrderRefundEmail(input: {
  orderId: string; tenantId: string; tenantName: string;
  parentName: string; parentEmail: string;
  stripeRefundId: string; amountAud: string; isFullRefund: boolean;
  triggeredBy: "staff_action" | "webhook";
  triggeredByUserId: string | null;
}): Promise<EnqueueResult> {
  return enqueueNotification({
    orderId: input.orderId,
    tenantId: input.tenantId,
    type: "refund",
    recipientEmail: input.parentEmail,
    idempotencyKey: `refund:${input.stripeRefundId}`,
    triggeredBy: input.triggeredBy,
    triggeredByUserId: input.triggeredByUserId,
    subject: `Refund processed for order ${input.orderId}`,
    reactBody: (
      <OrderRefund
        tenantName={input.tenantName}
        parentName={input.parentName}
        orderId={input.orderId}
        amountAud={input.amountAud}
        isFullRefund={input.isFullRefund}
      />
    ),
  });
}
```

If `OrderReadyEmail` currently expects more props than `{ tenantName, parentName, orderId }`, either adapt the call to provide the existing required props (collection instructions, shop hours, etc.) by joining tenant in the caller, or simplify the template signature. Check the existing template before finalising.

- [ ] **Step 5.5: Verify types + commit**

```bash
pnpm check-types
git add apps/web/src/lib/email/
git commit -m "feat(email): dispatcher with idempotent enqueue + hold/refund templates"
```

---

## Task 6 — Order transition server actions

**Files:**
- Modify: `apps/web/src/app/admin/[tenant]/orders/actions.ts` (replace contents)

- [ ] **Step 6.1: Define shared transition helper**

Important: `ensureTenantAccess(user, tenantOperatorEmail)` takes the operator email (not the tenant id) and returns a `NextResponse` when forbidden. In a server-action context we want to throw instead. We also need `tenant.name` for emails, so the helper joins the `tenants` row.

`requireSessionUser` in this repo returns `{ response } | { user }`. For server actions we unwrap and throw if the response form comes back.

```ts
"use server";

import React from "react";
import { db } from "@/db";
import { orders, orderEvents, tenants } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  requireSessionUser,
  isPlatformAdminEmail,
  isTenantOperatorEmail,
  type SessionUser,
} from "@/lib/auth/authorization";
import { getTenantSettings } from "@/db/queries";
import {
  sendOrderReadyEmail,
  sendOrderHoldEmail,
} from "@/lib/email";
import { serverCapture } from "@/lib/analytics/server";
import type {
  FulfilmentStatus,
  CompletionType,
  WorkflowMode,
} from "@/db/queries";

const STANDARD_ALLOWED: Record<FulfilmentStatus, FulfilmentStatus[]> = {
  to_prepare:      ["ready", "needs_attention", "completed"],
  ready:           ["needs_attention", "completed"],
  needs_attention: ["ready", "completed"],
  completed:       ["to_prepare"], // reopen only
};

const SIMPLE_ALLOWED: Record<FulfilmentStatus, FulfilmentStatus[]> = {
  to_prepare:      ["completed"],
  ready:           ["completed"],            // collapsed display
  needs_attention: ["completed"],            // collapsed display
  completed:       ["to_prepare"],           // reopen only
};

function assertAllowed(
  mode: WorkflowMode,
  from: FulfilmentStatus,
  to: FulfilmentStatus,
) {
  const map = mode === "simple" ? SIMPLE_ALLOWED : STANDARD_ALLOWED;
  if (!map[from]?.includes(to)) {
    throw new Error(`Transition ${from} → ${to} not allowed in ${mode} mode`);
  }
}

async function getActor(): Promise<SessionUser> {
  const result = await requireSessionUser();
  if ("response" in result) throw new Error("Authentication required");
  return result.user;
}

async function loadContext(tenantId: string, orderId: string) {
  const user = await getActor();

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order || order.tenantId !== tenantId) throw new Error("Order not found");

  // Server actions are callable independently of the board's UI filter that hides
  // unpaid orders. Refuse fulfilment transitions on unpaid orders explicitly.
  if (order.paymentStatus === "pending") {
    throw new Error("Cannot transition an unpaid order");
  }

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!tenant) throw new Error("Tenant not found");

  // Tenant operator email lives on tenants.shopEmail (per CLAUDE.md / authorization conventions).
  const allowed =
    isPlatformAdminEmail(user.email) ||
    isTenantOperatorEmail(user.email, tenant.shopEmail);
  if (!allowed) throw new Error("Forbidden");

  const settings = await getTenantSettings(tenantId);
  return { user, order, tenant, settings };
}
```

- [ ] **Step 6.2: `markReady`**

The order_events insert must run before the email so the event ID can flow into the idempotency key. We do two awaits rather than a `db.batch` so the `returning()` shape is unambiguous.

**Atomicity note:** A failure on the second insert leaves the order in the new fulfilment status with no audit row. Acceptable for now (operator can re-trigger; status is the source of truth) — flagged here so future readers don't expect transactional behaviour.

```ts
export async function markReady(tenantId: string, orderId: string) {
  const { user, order, tenant, settings } = await loadContext(tenantId, orderId);
  assertAllowed(settings.workflowMode, order.fulfilmentStatus, "ready");
  const now = new Date();

  await db.update(orders)
    .set({ fulfilmentStatus: "ready", readyAt: now, updatedAt: now })
    .where(eq(orders.id, orderId));

  const [evt] = await db.insert(orderEvents).values({
    orderId, tenantId,
    eventType: "status_changed",
    fromStatus: order.fulfilmentStatus,
    toStatus: "ready",
    actorId: user.id,
  }).returning({ id: orderEvents.id });

  await sendOrderReadyEmail({
    orderId, tenantId,
    tenantName: tenant.name,
    parentName: order.parentName,
    parentEmail: order.parentEmail,
    orderEventId: evt.id,
    triggeredByUserId: user.id,
  });
  await serverCapture("order_fulfilment_transition", {
    orderId, tenantId, from: order.fulfilmentStatus, to: "ready",
  });
  revalidatePath(`/admin/${tenantId}/orders`);
}
```

- [ ] **Step 6.3: `reportIssue`, `resolveIssue`, `markCompleted`, `reopenOrder`, `recordPickSlipPrinted`**

```ts
export async function reportIssue(
  tenantId: string,
  orderId: string,
  reason: string,
  options: { notifyParent: boolean },
) {
  if (!reason.trim()) throw new Error("Reason is required");
  const { user, order, tenant, settings } = await loadContext(tenantId, orderId);
  assertAllowed(settings.workflowMode, order.fulfilmentStatus, "needs_attention");
  const now = new Date();
  const wasReady = order.fulfilmentStatus === "ready";

  await db.update(orders)
    .set({ fulfilmentStatus: "needs_attention", updatedAt: now })
    .where(eq(orders.id, orderId));

  const [evt] = await db.insert(orderEvents).values({
    orderId, tenantId,
    eventType: "status_changed",
    fromStatus: order.fulfilmentStatus,
    toStatus: "needs_attention",
    actorId: user.id,
    reason,
  }).returning({ id: orderEvents.id });

  if (wasReady || options.notifyParent) {
    await sendOrderHoldEmail({
      orderId, tenantId,
      tenantName: tenant.name,
      parentName: order.parentName,
      parentEmail: order.parentEmail,
      orderEventId: evt.id,
      triggeredByUserId: user.id,
    });
  }
  await serverCapture("order_fulfilment_transition", {
    orderId, tenantId,
    from: order.fulfilmentStatus, to: "needs_attention",
    notified: wasReady || options.notifyParent,
  });
  revalidatePath(`/admin/${tenantId}/orders`);
}

export async function resolveIssue(tenantId: string, orderId: string) {
  const { user, order, tenant, settings } = await loadContext(tenantId, orderId);
  assertAllowed(settings.workflowMode, order.fulfilmentStatus, "ready");
  const now = new Date();

  await db.update(orders)
    .set({ fulfilmentStatus: "ready", readyAt: now, updatedAt: now })
    .where(eq(orders.id, orderId));

  const [evt] = await db.insert(orderEvents).values({
    orderId, tenantId,
    eventType: "status_changed",
    fromStatus: order.fulfilmentStatus,
    toStatus: "ready",
    actorId: user.id,
  }).returning({ id: orderEvents.id });

  await sendOrderReadyEmail({
    orderId, tenantId,
    tenantName: tenant.name,
    parentName: order.parentName,
    parentEmail: order.parentEmail,
    orderEventId: evt.id,
    triggeredByUserId: user.id,
  });
  revalidatePath(`/admin/${tenantId}/orders`);
}

export async function markCompleted(
  tenantId: string,
  orderId: string,
  completionType: CompletionType,
) {
  const { user, order, settings } = await loadContext(tenantId, orderId);
  assertAllowed(settings.workflowMode, order.fulfilmentStatus, "completed");
  const now = new Date();
  await db.batch([
    db.update(orders)
      .set({
        fulfilmentStatus: "completed",
        completionType,
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(orders.id, orderId)),
    db.insert(orderEvents).values({
      orderId, tenantId,
      eventType: "status_changed",
      fromStatus: order.fulfilmentStatus,
      toStatus: "completed",
      actorId: user.id,
      metadataJson: { completionType },
    }),
  ]);
  revalidatePath(`/admin/${tenantId}/orders`);
}

export async function reopenOrder(
  tenantId: string,
  orderId: string,
  reason: string,
) {
  if (!reason.trim()) throw new Error("Reason is required");
  const { user, order, settings } = await loadContext(tenantId, orderId);
  if (order.fulfilmentStatus !== "completed") {
    throw new Error("Only completed orders can be reopened");
  }
  assertAllowed(settings.workflowMode, "completed", "to_prepare");
  const now = new Date();
  await db.batch([
    db.update(orders)
      .set({
        fulfilmentStatus: "to_prepare",
        completionType: null,
        completedAt: null,
        updatedAt: now,
      })
      .where(eq(orders.id, orderId)),
    db.insert(orderEvents).values({
      orderId, tenantId,
      eventType: "order_reopened",
      fromStatus: "completed",
      toStatus: "to_prepare",
      actorId: user.id,
      reason,
    }),
  ]);
  revalidatePath(`/admin/${tenantId}/orders`);
}

export async function recordPickSlipPrinted(
  tenantId: string,
  orderIds: string[],
) {
  if (orderIds.length === 0) return;
  const user = await getActor();

  // Authorize: operator or platform admin for THIS tenant.
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!tenant) throw new Error("Tenant not found");
  const allowed =
    isPlatformAdminEmail(user.email) ||
    isTenantOperatorEmail(user.email, tenant.shopEmail);
  if (!allowed) throw new Error("Forbidden");

  // Confirm every order id actually belongs to this tenant BEFORE writing.
  // Without this, an operator could mark another tenant's orders by guessing ids,
  // and the audit rows would falsely attribute them to this tenant.
  const owned = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(inArray(orders.id, orderIds), eq(orders.tenantId, tenantId)));
  if (owned.length !== orderIds.length) {
    throw new Error("One or more orders do not belong to this tenant");
  }

  const now = new Date();

  // Two plain awaits — no transactional necessity, and avoids the heterogeneous-batch
  // typing hazard. `inArray` is the type-safe Drizzle helper for `IN (…)`.
  // The tenantId filter on UPDATE is belt-and-braces after the ownership check above.
  await db.update(orders)
    .set({ pickSlipPrintedAt: now, pickSlipPrintedBy: user.id })
    .where(and(inArray(orders.id, orderIds), eq(orders.tenantId, tenantId)));

  await db.insert(orderEvents).values(
    orderIds.map((id) => ({
      orderId: id,
      tenantId,
      eventType: "pick_slip_printed" as const,
      actorId: user.id,
    })),
  );

  revalidatePath(`/admin/${tenantId}/orders`);
}
```

- [ ] **Step 6.4: Verify types**

```bash
pnpm check-types
```

Expected: `actions.ts` compiles. UI still broken — fixed in later tasks.

- [ ] **Step 6.5: Commit**

```bash
git add apps/web/src/app/admin/[tenant]/orders/actions.ts
git commit -m "feat(orders): server actions for fulfilment transitions and pick-slip log"
```

---

## Task 7 — Refund flow + Stripe webhook updates

**Files:**
- Modify: `apps/web/src/app/api/orders/[orderId]/refund/route.ts`
- Modify: `apps/web/src/app/api/stripe/webhook/route.ts`

- [ ] **Step 7.1: Update refund POST**

After the existing Stripe refund call + `orderRefunds` insert, in the same handler. The route currently calls `await requireSessionUser()` (NextResponse return form), so unwrap accordingly. Load the `tenant` row if not already loaded — we need `tenant.name` for the email.

```ts
// Recompute totals using integer cents to avoid float drift
const newRefundedCents = (order.refundedAmountCents ?? 0) + amountCents;
const totalCents = Math.round(Number(order.total) * 100);
const newPaymentStatus =
  newRefundedCents >= totalCents ? "refunded" : "partially_refunded";

await db.batch([
  db.update(orders).set({
    paymentStatus: newPaymentStatus,
    refundedAmountCents: newRefundedCents,
    updatedAt: new Date(),
  }).where(eq(orders.id, order.id)),
  db.insert(orderEvents).values({
    orderId: order.id,
    tenantId: order.tenantId,
    eventType: "refund_created",
    actorId: user.id,
    reason: body.reason ?? null,
    metadataJson: { amountCents, stripeRefundId: refund.id },
  }),
]);

await sendOrderRefundEmail({
  orderId: order.id,
  tenantId: order.tenantId,
  tenantName: tenant.name,
  parentName: order.parentName,
  parentEmail: order.parentEmail,
  stripeRefundId: refund.id,
  amountAud: formatAud(amountCents / 100),
  isFullRefund: newPaymentStatus === "refunded",
  triggeredBy: "staff_action",
  triggeredByUserId: user.id,
});
```

Add a small helper `formatAud(n: number)` (or reuse one if already in the codebase — grep first):

```ts
function formatAud(amount: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(amount);
}
```

Remove any code that was previously setting the legacy `status` to `'refunded'` / `'partially_refunded'`. Fulfilment status MUST NOT change.

- [ ] **Step 7.2: Update Stripe webhook `charge.refunded`**

Inside the webhook handler's `charge.refunded` branch:

```ts
const refunds = charge.refunds?.data ?? [];

// Upsert orderRefunds rows first (existing logic via stripe_refund_id unique index).
// Then compute totals BEFORE dispatching emails so isFullRefund is accurate.
const newRefundedCents = refunds.reduce((s, r) => s + r.amount, 0);
const totalCents = Math.round(Number(order.total) * 100);
const newPaymentStatus =
  newRefundedCents >= totalCents ? "refunded" : "partially_refunded";
const isFullRefund = newPaymentStatus === "refunded";

await db.update(orders).set({
  paymentStatus: newPaymentStatus,
  refundedAmountCents: newRefundedCents,
  updatedAt: new Date(),
}).where(eq(orders.id, order.id));

for (const r of refunds) {
  const result = await sendOrderRefundEmail({
    orderId: order.id,
    tenantId: order.tenantId,
    tenantName: tenant.name,
    parentName: order.parentName,
    parentEmail: order.parentEmail,
    stripeRefundId: r.id,
    amountAud: formatAud(r.amount / 100),
    isFullRefund,
    triggeredBy: "webhook",
    triggeredByUserId: null,
  });

  // Only audit when the dispatcher actually sent (not on idempotency skip),
  // otherwise webhook replays would create duplicate refund_email_sent rows.
  if (result.status === "sent") {
    await db.insert(orderEvents).values({
      orderId: order.id,
      tenantId: order.tenantId,
      eventType: "refund_email_sent",
      metadataJson: { source: "webhook", chargeId: charge.id, stripeRefundId: r.id },
    });
  }
}
```

The dispatcher's idempotency-key check ensures the email isn't sent twice if the staff-triggered path already enqueued it.

- [ ] **Step 7.3: Verify + commit**

```bash
pnpm check-types
git add apps/web/src/app/api/orders/[orderId]/refund/route.ts apps/web/src/app/api/stripe/webhook/route.ts
git commit -m "feat(refund): split refund updates payment_status, emails parent, audits"
```

---

## Task 8 — Shipping guard + payment webhook updates

(The legacy PATCH `/api/orders/[orderId]` handler was removed in Task 5.0.)

**Files:**
- Modify: `apps/web/src/app/api/orders/route.ts`
- Modify: `apps/web/src/app/api/stripe/webhook/route.ts`

- [ ] **Step 8.2: Add shipping guard on POST /api/orders**

In `apps/web/src/app/api/orders/route.ts`, after parsing the request body and resolving `tenantId`:

```ts
import { getTenantSettings } from "@/db/queries";

const settings = await getTenantSettings(tenantId);
if (!settings.shippingEnabled && body.fulfilmentMethod === "shipping") {
  return NextResponse.json(
    { error: "Shipping is not enabled for this school" },
    { status: 400 },
  );
}
```

(Adapt the body field name to whatever the API expects — if it currently reads `delivery: 'pickup' | 'ship'`, accept both and normalise: `body.delivery === 'ship'` → `'shipping'`. Then write the new `fulfilmentMethod` column accordingly.)

Also update the order-insert call to set `fulfilmentMethod` (not `delivery`) and to leave `fulfilmentStatus` at default (`to_prepare`) and `paymentStatus` at `pending` until payment confirmation flips it (which is webhook territory — confirm `payment_intent.succeeded` handler now flips `paymentStatus` to `'paid'`, replacing whatever it did with the legacy `status`).

**Server-recompute `delivery_fee`.** Do not trust whatever fee value arrives in the request body — a client can post any number. After resolving `fulfilmentMethod`, recompute the fee server-side from the tenant configuration and use that for the order row, totals, and the Stripe PaymentIntent amount:

```ts
// Replace whatever currently reads body.delivery_fee / body.deliveryFee.
const deliveryFeeCents =
  body.fulfilmentMethod === "shipping"
    ? (settings.shippingFeeCents ?? DEFAULT_SHIPPING_FEE_CENTS) // or read from tenants table
    : 0;
```

If `shippingFeeCents` doesn't yet exist on `tenant_settings`, leave the literal `950` (matching the checkout copy "$9.50") behind a single named constant in the route file and add a follow-up to migrate it to `tenant_settings` when shipping graduates beyond a single flat rate. The key invariant: **the client-submitted fee value MUST NOT be used** for the persisted total or the Stripe charge amount.

- [ ] **Step 8.3: Update payment_intent.succeeded handler**

In `apps/web/src/app/api/stripe/webhook/route.ts`, find the `payment_intent.succeeded` branch. Replace the legacy `status: 'new'` set with:

```ts
await db.update(orders)
  .set({ paymentStatus: "paid", updatedAt: new Date() })
  .where(eq(orders.id, order.id));

await db.insert(orderEvents).values({
  orderId: order.id,
  tenantId: order.tenantId,
  eventType: "order_paid",
  metadataJson: { paymentIntentId: pi.id },
});
```

- [ ] **Step 8.4: Verify + commit**

```bash
pnpm check-types
git add apps/web/src/app/api/
git commit -m "feat(api): enforce shipping_enabled; remove legacy PATCH status; map paid via webhook"
```

---

## Task 9 — Checkout shipping option gating

**Files:**
- Modify: `apps/web/src/app/[tenant]/checkout/page.tsx`
- Modify: `apps/web/src/app/[tenant]/checkout/checkout-screen.tsx`

- [ ] **Step 9.1: Load settings in RSC and pass to client**

In `page.tsx`:

```ts
import { getTenantSettings } from "@/db/queries";
// ... existing await params, tenant validation ...
const settings = await getTenantSettings(tenant.id);
return (
  <CheckoutScreen
    {...existingProps}
    shippingEnabled={settings.shippingEnabled}
    pickupEnabled={settings.pickupEnabled}
  />
);
```

- [ ] **Step 9.2: Conditionally render the Ship option**

**Scope decision:** To minimise churn (and preserve PostHog analytics continuity), keep the client-side state variable `delivery` and the `/order/placed?…&delivery=…` query string as-is. Rename only at the API boundary:
- Submit body to POST `/api/orders` uses `fulfilmentMethod: delivery === "ship" ? "shipping" : "pickup"`.
- PostHog event name `delivery_method_selected` stays unchanged (analytics dashboard continuity).
- The `Delivery` TS union stays as `"pickup" | "ship"` on the client; conversion to the new `fulfilment_method` enum happens at the network boundary only.

In `checkout-screen.tsx`, find the radio block around lines 436–460 (per Explore findings). Wrap the Ship option:

```tsx
{shippingEnabled && (
  <label>
    <input type="radio" name="delivery" value="ship" /* … */ />
    Ship to home — $9.50
  </label>
)}
```

If `shippingEnabled` is false and the current `delivery` state is `'ship'`, force it back to `'pickup'`:

```ts
useEffect(() => {
  if (!shippingEnabled && delivery === "ship") setDelivery("pickup");
}, [shippingEnabled, delivery]);
```

In the submit handler around lines 264–295, replace the existing `delivery` body field with:

```ts
fulfilmentMethod: delivery === "ship" ? "shipping" : "pickup",
deliveryFee: delivery === "ship" ? SHIP_FEE_AUD : 0,
```

(Remove the legacy `delivery` body field. Keep the local `delivery` state for UI; the API receives the new enum value.)

- [ ] **Step 9.3: Smoke test**

```bash
pnpm dev:web
```

Visit `/<tenant>/checkout` with `shipping_enabled=false`. Confirm only Pickup is offered. Toggle `shipping_enabled=true` via Neon MCP (`UPDATE tenant_settings SET shipping_enabled=true WHERE tenant_id='nsbh'`), refresh, confirm Ship appears.

- [ ] **Step 9.4: Commit**

```bash
git add apps/web/src/app/[tenant]/checkout/
git commit -m "feat(checkout): gate Ship option on tenant_settings.shipping_enabled"
```

---

## Task 10 — Admin desktop board refactor

**Files:**
- Modify: `apps/web/src/app/admin/[tenant]/orders/page.tsx`
- Modify: `apps/web/src/app/admin/[tenant]/orders/orders-page-client.tsx`
- Modify: `apps/web/src/app/admin/[tenant]/orders/orders-board.tsx`

- [ ] **Step 10.1: Page load — orders + settings**

In `page.tsx`:

```ts
import { getOrdersForBoard, getTenantSettings } from "@/db/queries";

const [orders, settings] = await Promise.all([
  getOrdersForBoard(tenant.id),
  getTenantSettings(tenant.id),
]);

return (
  <OrdersPageClient
    tenantId={tenant.id}
    orders={orders}
    workflowMode={settings.workflowMode}
  />
);
```

- [ ] **Step 10.2: Page client — thread workflow mode**

In `orders-page-client.tsx`, accept the new `workflowMode` prop and pass it to `OrdersBoard` and (in Task 12) `OrdersMobileList`. Keep search/print UI.

Update the "Print pick slips" button to call `recordPickSlipPrinted([…ids])` (the new server action) **before** opening `window.print()`. Pass the list of `to_prepare` order IDs.

- [ ] **Step 10.3: Board — mode-aware columns**

Rewrite `orders-board.tsx`. Use the shared `BoardOrder` row type from `db/queries.ts` (Step 3.2) so the shape can't drift across files.

```tsx
"use client";

import type { BoardOrder, FulfilmentStatus, WorkflowMode } from "@/db/queries";
import { OrderCard } from "./order-card";

const STANDARD_COLUMNS: Array<{ key: FulfilmentStatus; label: string }> = [
  { key: "to_prepare",      label: "To prepare" },
  { key: "ready",           label: "Ready" },
  { key: "needs_attention", label: "Needs attention" },
  { key: "completed",       label: "Completed" },
];

const SIMPLE_COLUMNS: Array<{ key: "to_prepare" | "completed"; label: string }> = [
  { key: "to_prepare", label: "To prepare" },
  { key: "completed",  label: "Completed" },
];

export function OrdersBoard({
  tenantId, orders, workflowMode,
}: {
  tenantId: string;
  orders: BoardOrder[];
  workflowMode: WorkflowMode;
}) {
  if (workflowMode === "simple") {
    const groups = {
      to_prepare: orders.filter(o => o.fulfilmentStatus !== "completed"),
      completed:  orders.filter(o => o.fulfilmentStatus === "completed"),
    };
    return (
      <div className="hidden lg:grid grid-cols-2 gap-4">
        {SIMPLE_COLUMNS.map(col => (
          <Column key={col.key} label={col.label} count={groups[col.key].length}>
            {groups[col.key].map(o => (
              <OrderCard key={o.id} order={o} tenantId={tenantId} mode="simple" />
            ))}
          </Column>
        ))}
      </div>
    );
  }
  const groups: Record<FulfilmentStatus, Order[]> = {
    to_prepare: [], ready: [], needs_attention: [], completed: [],
  };
  for (const o of orders) groups[o.fulfilmentStatus].push(o);
  return (
    <div className="hidden lg:grid grid-cols-4 gap-4">
      {STANDARD_COLUMNS.map(col => (
        <Column key={col.key} label={col.label} count={groups[col.key].length}>
          {groups[col.key].map(o => (
            <OrderCard key={o.id} order={o} tenantId={tenantId} mode="standard" />
          ))}
        </Column>
      ))}
    </div>
  );
}

function Column({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  return (
    <section className="bg-paper border border-rule rounded-md p-3">
      <header className="flex items-baseline justify-between mb-3">
        <h3 className="font-serif text-lg">{label}</h3>
        <span className="tnum text-sm text-foreground/70">{count}</span>
      </header>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}
```

- [ ] **Step 10.4: Extract `OrderCard`**

Issue-button wiring (Report issue) is deferred to Task 13, which lands the sheet and the `reportIssue` server-action call together. This task ships markReady / markCompleted / resolveIssue inline; the issue button is omitted entirely until Task 13.

Create `apps/web/src/app/admin/[tenant]/orders/order-card.tsx`:

```tsx
"use client";
import Link from "next/link";
import type { BoardOrder, WorkflowMode } from "@/db/queries";
import { markReady, resolveIssue, markCompleted } from "./actions";

export function OrderCard({
  order, tenantId, mode,
}: { order: BoardOrder; tenantId: string; mode: WorkflowMode }) {
  return (
    <article className="bg-parchment border border-rule rounded p-3 text-sm">
      <Link href={`/admin/${tenantId}/orders/${order.id}`} className="font-mono text-gold">
        {order.id}
      </Link>
      <div className="mt-1">{order.studentName} · Yr {order.studentYear}</div>
      <div className="text-foreground/70">{order.parentName}</div>
      <div className="mt-2 flex items-center justify-between">
        <span className="tnum">${order.total}</span>
        <BadgeRow order={order} mode={mode} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <Actions order={order} tenantId={tenantId} mode={mode} />
      </div>
    </article>
  );
}

function BadgeRow({ order, mode }: { order: BoardOrder; mode: WorkflowMode }) {
  // emailsSent comes from orders.emails_sent jsonb — keys are notification types
  const emails = (order.emailsSent ?? {}) as Record<string, "queued" | "sent" | "failed" | undefined>;
  return (
    <div className="flex flex-wrap gap-1 text-xs">
      {order.paymentStatus !== "pending" && order.paymentStatus !== "refunded" && (
        <Badge label="Paid" tone="green" />
      )}
      {order.pickSlipPrintedAt && <Badge label="Printed" tone="muted" />}
      {mode === "standard" && emails.ready === "sent" && <Badge label="Email sent" tone="muted" />}
      {mode === "standard" && emails.ready === "failed" && <Badge label="Email failed" tone="red" />}
      {mode === "standard" && emails.hold === "sent" && <Badge label="Hold notice sent" tone="amber" />}
      {order.paymentStatus === "refunded" && <Badge label="Refunded" tone="red" />}
      {order.paymentStatus === "partially_refunded" && (
        <Badge label={`Partially refunded $${(order.refundedAmountCents/100).toFixed(2)}`} tone="amber" />
      )}
      {order.completionType === "collected" && <Badge label="Collected" tone="muted" />}
      {order.completionType === "manual" && <Badge label="Manual" tone="muted" />}
    </div>
  );
}

function Badge({ label, tone }: { label: string; tone: "green" | "red" | "amber" | "muted" }) {
  const cls = {
    green: "bg-green-100 text-green-900",
    red:   "bg-red-100 text-red-900",
    amber: "bg-amber-100 text-amber-900",
    muted: "bg-rule/60 text-foreground/80",
  }[tone];
  return <span className={`px-1.5 py-0.5 rounded ${cls}`}>{label}</span>;
}

function Actions({ order, tenantId, mode }: { order: BoardOrder; tenantId: string; mode: WorkflowMode }) {
  if (order.fulfilmentStatus === "completed") return null;
  if (mode === "simple") {
    return <button onClick={() => markCompleted(tenantId, order.id, "manual")} className="btn-xs">Mark completed</button>;
  }
  const s = order.fulfilmentStatus;
  // Note: Report issue is added in Task 13 (sheet UI + reportIssue wiring).
  return (
    <>
      {s === "to_prepare" && (
        <button className="btn-xs" onClick={() => markReady(tenantId, order.id)}>Mark ready</button>
      )}
      {s === "ready" && (
        <button className="btn-xs" onClick={() => markCompleted(tenantId, order.id, "collected")}>Mark completed</button>
      )}
      {s === "needs_attention" && (
        <>
          <button className="btn-xs" onClick={() => resolveIssue(tenantId, order.id)}>Resolve to ready</button>
          <button className="btn-xs" onClick={() => markCompleted(tenantId, order.id, "manual")}>Mark completed</button>
        </>
      )}
    </>
  );
}
```

(`.btn-xs` is illustrative; use a small Tailwind utility class that matches the rest of the admin UI, e.g. `text-xs px-2 py-1 rounded border border-rule hover:bg-rule/40`.)

The "report issue" dialog is intentionally minimal here — Task 13 replaces it with a proper sheet on mobile + dialog on desktop.

- [ ] **Step 10.5: Smoke test desktop board**

```bash
pnpm dev:web
```

Visit `/admin/nsbh/orders`. Expect four columns (Standard mode default). Mark a `to_prepare` order ready → moves columns and the ready email fires (check inbox / DB row in `order_notification_events`).

- [ ] **Step 10.6: Commit**

```bash
git add apps/web/src/app/admin/[tenant]/orders/
git commit -m "feat(admin-board): mode-aware columns, action buttons, badge rendering"
```

---

## Task 11 — Sidebar count rename

**Files:**
- Modify: `apps/web/src/app/admin/[tenant]/layout.tsx`
- Modify: `apps/web/src/app/admin/[tenant]/admin-shell.tsx` (label string only)

The current code is `countNewOrders(tenant)` in `apps/web/src/app/admin/[tenant]/layout.tsx:37` (imported from `@/db/queries`), passed to `AdminShell`. `admin-shell.tsx` itself does not fetch the count.

- [ ] **Step 11.1: Switch to `countToPrepare`**

In `apps/web/src/app/admin/[tenant]/layout.tsx`:

```ts
// before:
import { getTenant, countNewOrders } from "@/db/queries";
const newOrderCount = await countNewOrders(tenant);

// after:
import { getTenant, countToPrepare } from "@/db/queries";
const newOrderCount = await countToPrepare(tenant);
```

Keep the prop name passed into `AdminShell` (e.g. `newOrderCount`) the same to avoid touching `admin-shell.tsx`.

**Update the displayed label** in `admin-shell.tsx` from "X new" to "X to prepare" — the count semantics changed from `status='new'` to `fulfilment_status='to_prepare'` (which includes packing + new). Leaving "new" would mislead operators about what the badge counts. If the existing label render is short (e.g. `${count} new`), update both the string and any aria-label / tooltip uses in the same edit so the file stays internally consistent.

- [ ] **Step 11.2: Verify + commit**

```bash
pnpm check-types
git add apps/web/src/app/admin/[tenant]/layout.tsx apps/web/src/app/admin/[tenant]/admin-shell.tsx
git commit -m "feat(admin-shell): badge counts orders awaiting preparation"
```

---

## Task 12 — Mobile pick mode

**Files:**
- Create: `apps/web/src/app/admin/[tenant]/orders/orders-mobile-list.tsx`
- Modify: `apps/web/src/app/admin/[tenant]/orders/orders-page-client.tsx`

- [ ] **Step 12.1: Mobile list component**

Uses the shared `BoardOrder` type from `db/queries.ts` (no inline redeclaration). Report-issue wiring is deferred to Task 13; this task ships markReady / markCompleted / resolveIssue.

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import type { BoardOrder, FulfilmentStatus, WorkflowMode } from "@/db/queries";
import { markReady, markCompleted, resolveIssue } from "./actions";

const STANDARD_FILTERS: Array<{ key: "all" | FulfilmentStatus; label: string }> = [
  { key: "all", label: "All" },
  { key: "to_prepare", label: "To prepare" },
  { key: "ready", label: "Ready" },
  { key: "needs_attention", label: "Needs attention" },
  { key: "completed", label: "Completed" },
];

const SIMPLE_FILTERS = [
  { key: "all" as const, label: "All" },
  { key: "to_prepare" as const, label: "To prepare" },
  { key: "completed" as const, label: "Completed" },
];

export function OrdersMobileList({
  tenantId, orders, workflowMode,
}: { tenantId: string; orders: BoardOrder[]; workflowMode: WorkflowMode }) {
  const [filter, setFilter] = useState<"all" | FulfilmentStatus>("all");
  const filters = workflowMode === "simple" ? SIMPLE_FILTERS : STANDARD_FILTERS;
  const filtered = orders.filter((o) => {
    if (filter === "all") return true;
    if (workflowMode === "simple") {
      return filter === "completed"
        ? o.fulfilmentStatus === "completed"
        : o.fulfilmentStatus !== "completed";
    }
    return o.fulfilmentStatus === filter;
  });

  return (
    <div className="lg:hidden flex flex-col gap-3">
      <nav className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1 rounded-full border text-xs whitespace-nowrap ${
              filter === f.key ? "bg-navy-deep text-white" : "border-rule"
            }`}
          >
            {f.label}
          </button>
        ))}
      </nav>
      <ul className="flex flex-col gap-2">
        {filtered.map((o) => (
          <MobileRow key={o.id} order={o} tenantId={tenantId} mode={workflowMode} />
        ))}
      </ul>
    </div>
  );
}

function MobileRow({
  order, tenantId, mode,
}: { order: BoardOrder; tenantId: string; mode: WorkflowMode }) {
  const s = order.fulfilmentStatus;
  // Note: Report issue button is added in Task 13.
  return (
    <li className="bg-paper border border-rule rounded p-3 text-sm">
      <div className="flex items-baseline justify-between">
        <Link href={`/admin/${tenantId}/orders/${order.id}`} className="font-mono text-gold">
          {order.id}
        </Link>
        <span className="tnum">${order.total}</span>
      </div>
      <div className="mt-1">{order.studentName} · Yr {order.studentYear}</div>
      <div className="text-foreground/70 text-xs">{order.parentName}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {mode === "simple" && s !== "completed" && (
          <button className="btn-sm" onClick={() => markCompleted(tenantId, order.id, "manual")}>
            Mark completed
          </button>
        )}
        {mode === "standard" && s === "to_prepare" && (
          <>
            <button className="btn-sm" onClick={() => markReady(tenantId, order.id)}>Mark ready</button>
            <button className="btn-sm" onClick={() => markCompleted(tenantId, order.id, "manual")}>Mark completed</button>
          </>
        )}
        {mode === "standard" && s === "ready" && (
          <button className="btn-sm" onClick={() => markCompleted(tenantId, order.id, "collected")}>Mark completed</button>
        )}
        {mode === "standard" && s === "needs_attention" && (
          <>
            <button className="btn-sm" onClick={() => resolveIssue(tenantId, order.id)}>Resolve to ready</button>
            <button className="btn-sm" onClick={() => markCompleted(tenantId, order.id, "manual")}>Mark completed</button>
          </>
        )}
      </div>
    </li>
  );
}
```

(`.btn-sm` Tailwind class: `text-sm px-3 py-1.5 rounded border border-rule hover:bg-rule/40`.)

- [ ] **Step 12.2: Mount it in the page client**

In `orders-page-client.tsx`, render both:

```tsx
<OrdersBoard tenantId={tenantId} orders={orders} workflowMode={workflowMode} />
<OrdersMobileList tenantId={tenantId} orders={orders} workflowMode={workflowMode} />
```

Board has `hidden lg:grid`; mobile list has `lg:hidden`. They're mutually exclusive by breakpoint.

- [ ] **Step 12.3: Smoke test (resize browser to <1024px)**

Use Chrome DevTools responsive mode at iPhone 14 width. Verify filter chips, action buttons trigger transitions, sheet opens for Report issue (Task 13 builds the real sheet).

- [ ] **Step 12.4: Commit**

```bash
git add apps/web/src/app/admin/[tenant]/orders/
git commit -m "feat(admin-mobile): pick-mode list view with action buttons + filters"
```

---

## Task 13 — Report-issue sheet/dialog + wiring

**Files:**
- Create: `apps/web/src/app/admin/[tenant]/orders/report-issue-sheet.tsx`
- Modify: `apps/web/src/app/admin/[tenant]/orders/order-card.tsx` — add Report issue button + sheet state
- Modify: `apps/web/src/app/admin/[tenant]/orders/orders-mobile-list.tsx` — add Report issue button + sheet state

This task adds the Report issue button to both desktop cards and mobile rows, and lands the sheet that backs them — all in a single commit so no placeholder dialog ever lives in main.

- [ ] **Step 13.0: Confirm HeroUI Pro Sheet API**

(Step 0f should already have captured this, but re-verify before writing the file.) Call `mcp__heroui-pro__get_component_docs({ components: ["sheet"] })` and check the actual compound shape (e.g. `Sheet.Root` / `Sheet.Content` / `Sheet.Title`). If the Pro Sheet API doesn't match what's drafted below, either adapt to the real API, or drop down to `@heroui/react`'s `Modal` — the surface needed is small (header, body, two actions). If neither is available, use a native `<dialog>` styled with Tailwind.

- [ ] **Step 13.1: Implement the sheet**

```tsx
"use client";

import { useState, useTransition } from "react";
import { Sheet } from "@heroui-pro/react";   // adjust to verified API per Step 13.0
import type { BoardOrder } from "@/db/queries";
import { reportIssue } from "./actions";

export function ReportIssueSheet({
  order, tenantId, onClose,
}: {
  order: Pick<BoardOrder, "id" | "fulfilmentStatus">;
  tenantId: string;
  onClose: () => void;
}) {
  const wasReady = order.fulfilmentStatus === "ready";
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(wasReady); // forced on if was ready
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (!reason.trim()) return;
    startTransition(async () => {
      await reportIssue(tenantId, order.id, reason.trim(), { notifyParent: notify });
      onClose();
    });
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <Sheet.Content>
        <Sheet.Header>
          <Sheet.Title>Report issue — {order.id}</Sheet.Title>
        </Sheet.Header>
        <div className="p-4 flex flex-col gap-3">
          <label className="text-sm">
            What's the issue?
            <textarea
              className="mt-1 w-full border border-rule rounded p-2"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              autoFocus
            />
          </label>
          <label className="text-sm flex items-center gap-2">
            <input
              type="checkbox"
              checked={notify}
              disabled={wasReady}
              onChange={(e) => setNotify(e.target.checked)}
            />
            Notify parent now
            {wasReady && (
              <span className="text-xs text-foreground/70 ml-2">
                (required — they already received the ready email)
              </span>
            )}
          </label>
          <div className="flex gap-2 justify-end">
            <button onClick={onClose} className="btn-sm">Cancel</button>
            <button onClick={submit} disabled={pending || !reason.trim()} className="btn-sm bg-navy-deep text-white">
              {pending ? "Saving…" : "Submit"}
            </button>
          </div>
        </div>
      </Sheet.Content>
    </Sheet>
  );
}
```

If the `@heroui-pro/react` `Sheet` API differs, look it up via the `heroui-pro` MCP first (`mcp__heroui-pro__get_component_docs({ components: ["sheet"] })`).

- [ ] **Step 13.2: Wire the sheet into the desktop card**

In `order-card.tsx`, the `Actions` component gains local state for an issue-sheet target:

```tsx
import { useState } from "react";
import { ReportIssueSheet } from "./report-issue-sheet";

function Actions({ order, tenantId, mode }: { order: BoardOrder; tenantId: string; mode: WorkflowMode }) {
  const [showIssue, setShowIssue] = useState(false);
  if (order.fulfilmentStatus === "completed") return null;
  if (mode === "simple") {
    return <button onClick={() => markCompleted(tenantId, order.id, "manual")} className="btn-xs">Mark completed</button>;
  }
  const s = order.fulfilmentStatus;
  return (
    <>
      {s === "to_prepare" && (
        <>
          <button className="btn-xs" onClick={() => markReady(tenantId, order.id)}>Mark ready</button>
          <button className="btn-xs" onClick={() => setShowIssue(true)}>Report issue</button>
        </>
      )}
      {s === "ready" && (
        <>
          <button className="btn-xs" onClick={() => markCompleted(tenantId, order.id, "collected")}>Mark completed</button>
          <button className="btn-xs" onClick={() => setShowIssue(true)}>Report issue</button>
        </>
      )}
      {s === "needs_attention" && (
        <>
          <button className="btn-xs" onClick={() => resolveIssue(tenantId, order.id)}>Resolve to ready</button>
          <button className="btn-xs" onClick={() => markCompleted(tenantId, order.id, "manual")}>Mark completed</button>
        </>
      )}
      {showIssue && (
        <ReportIssueSheet order={order} tenantId={tenantId} onClose={() => setShowIssue(false)} />
      )}
    </>
  );
}
```

- [ ] **Step 13.3: Wire the sheet into the mobile row**

In `orders-mobile-list.tsx`, hoist the sheet target back into the parent component (the simpler shape from the earlier draft) and add Report issue buttons to `to_prepare` and `ready` rows:

```tsx
const [issueTarget, setIssueTarget] = useState<BoardOrder | null>(null);
// ...within MobileRow's `to_prepare` and `ready` branches, add:
<button className="btn-sm" onClick={() => setIssueTarget(order)}>Report issue</button>
// ...after the <ul>:
{issueTarget && (
  <ReportIssueSheet
    order={issueTarget}
    tenantId={tenantId}
    onClose={() => setIssueTarget(null)}
  />
)}
```

Since `MobileRow` now needs an `onIssueClick` prop, thread it through (or move the buttons up into the parent).

- [ ] **Step 13.4: Smoke + commit**

```bash
pnpm dev:web
# verify the sheet opens, validates, notify checkbox is checked+disabled when status=ready
git add apps/web/src/app/admin/[tenant]/orders/
git commit -m "feat(admin): report-issue sheet with required-notify rule"
```

---

## Task 14 — Order detail page

**Files:**
- Modify: `apps/web/src/app/admin/[tenant]/orders/[orderId]/page.tsx`
- Modify: `apps/web/src/app/admin/[tenant]/orders/[orderId]/order-detail-actions.tsx`
- Create: `apps/web/src/app/admin/[tenant]/orders/[orderId]/order-history.tsx`

- [ ] **Step 14.1: Fetch events in the RSC**

```ts
import { listOrderEvents, listOrderNotificationEvents, getTenantSettings } from "@/db/queries";
const [events, notifications, settings] = await Promise.all([
  listOrderEvents(orderId),
  listOrderNotificationEvents(orderId),
  getTenantSettings(tenant.id),
]);
```

Pass `events`, `notifications`, `settings.workflowMode` to `OrderDetailActions` (rename if needed to reflect broader scope).

- [ ] **Step 14.2: Rewrite the actions panel**

Replace contents of `order-detail-actions.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import type { WorkflowMode, getOrderForDetail, listOrderEvents, listOrderNotificationEvents } from "@/db/queries";
import {
  markReady, resolveIssue, markCompleted, reopenOrder, recordPickSlipPrinted,
} from "../actions";
import { ReportIssueSheet } from "../report-issue-sheet";
import { OrderHistory } from "./order-history";

// Row shapes inferred from the query helpers so this component cannot drift
// from the schema. `getOrderForDetail` is the helper that the parent RSC uses
// to load the row passed in — add a thin wrapper in db/queries.ts if one
// doesn't already exist (mirroring the listOrder* pattern from Step 3.6).
type OrderRow = Awaited<ReturnType<typeof getOrderForDetail>>;
type OrderEventRow = Awaited<ReturnType<typeof listOrderEvents>>[number];
type NotificationEventRow = Awaited<ReturnType<typeof listOrderNotificationEvents>>[number];

type Props = {
  order: NonNullable<OrderRow>;
  tenantId: string;
  workflowMode: WorkflowMode;
  events: OrderEventRow[];
  notifications: NotificationEventRow[];
};

export function OrderDetailActions(props: Props) {
  const [showIssue, setShowIssue] = useState(false);
  const [showReopen, setShowReopen] = useState(false);

  const isCompleted = props.order.fulfilmentStatus === "completed";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <button className="btn" onClick={async () => {
          await recordPickSlipPrinted(props.tenantId, [props.order.id]);
          window.print();
        }}>
          Print pick slip
        </button>

        {!isCompleted && props.workflowMode === "standard" && (
          <>
            {props.order.fulfilmentStatus === "to_prepare" && (
              <button className="btn" onClick={() => markReady(props.tenantId, props.order.id)}>Mark ready</button>
            )}
            {props.order.fulfilmentStatus === "needs_attention" && (
              <button className="btn" onClick={() => resolveIssue(props.tenantId, props.order.id)}>Resolve to ready</button>
            )}
            {props.order.fulfilmentStatus !== "needs_attention" && (
              <button className="btn" onClick={() => setShowIssue(true)}>Report issue</button>
            )}
            <button className="btn" onClick={() => markCompleted(props.tenantId, props.order.id, "collected")}>
              Mark completed
            </button>
          </>
        )}

        {!isCompleted && props.workflowMode === "simple" && (
          <button className="btn" onClick={() => markCompleted(props.tenantId, props.order.id, "manual")}>
            Mark completed
          </button>
        )}

        {isCompleted && (
          <>
            <RefundButton order={props.order} tenantId={props.tenantId} />
            <button className="btn" onClick={() => setShowReopen(true)}>Reopen order</button>
          </>
        )}
      </div>

      <OrderHistory events={props.events} notifications={props.notifications} />

      {showIssue && (
        <ReportIssueSheet
          order={props.order}
          tenantId={props.tenantId}
          onClose={() => setShowIssue(false)}
        />
      )}
      {showReopen && (
        <ReopenDialog
          order={props.order}
          tenantId={props.tenantId}
          onClose={() => setShowReopen(false)}
        />
      )}
    </div>
  );
}

function ReopenDialog({ order, tenantId, onClose }: {
  order: { id: string }; tenantId: string; onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  return (
    <dialog open className="rounded p-4 bg-paper border border-rule">
      <p className="font-serif text-lg mb-2">Reopen order {order.id}?</p>
      <p className="text-sm text-foreground/80 mb-2">
        This will move the order back to "To prepare". The parent will <strong>not</strong> be
        automatically notified.
      </p>
      <textarea
        className="w-full border border-rule rounded p-2"
        rows={3}
        placeholder="Reason (required)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="flex gap-2 justify-end mt-2">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button
          className="btn bg-navy-deep text-white"
          disabled={!reason.trim() || pending}
          onClick={() => start(async () => {
            await reopenOrder(tenantId, order.id, reason.trim());
            onClose();
          })}
        >Reopen</button>
      </div>
    </dialog>
  );
}

function RefundButton({ order, tenantId }: { order: NonNullable<OrderRow>; tenantId: string }) {
  // Existing refund modal — keep its existing implementation, but update warning copy.
  // The existing modal already POSTs to /api/orders/[id]/refund.
  // Per spec §14.4, header copy:
  //   "Refund $X to parent? This will return money to the parent's card and cannot be undone from this order. To charge again, the parent will need to place a new order."
  return <ExistingRefundButton order={order} tenantId={tenantId} />;
}
```

- [ ] **Step 14.3: History view**

Type the props with the Drizzle row shapes inferred via `listOrderEvents` / `listOrderNotificationEvents` (added in Step 3.6) so the renderer can't drift from schema.

```tsx
// apps/web/src/app/admin/[tenant]/orders/[orderId]/order-history.tsx
"use client";

import type { listOrderEvents, listOrderNotificationEvents } from "@/db/queries";

type OrderEventRow = Awaited<ReturnType<typeof listOrderEvents>>[number];
type NotificationEventRow = Awaited<ReturnType<typeof listOrderNotificationEvents>>[number];

export function OrderHistory({
  events, notifications,
}: { events: OrderEventRow[]; notifications: NotificationEventRow[] }) {
  const rows: Array<{ ts: Date; label: string; sub?: string }> = [];
  for (const e of events) rows.push({
    ts: new Date(e.createdAt),
    label: `${e.eventType}${e.fromStatus ? ` (${e.fromStatus} → ${e.toStatus})` : ""}`,
    sub: e.reason ?? undefined,
  });
  for (const n of notifications) rows.push({
    ts: new Date(n.createdAt),
    label: `email:${n.type} → ${n.status}`,
    sub: n.failureReason ?? undefined,
  });
  rows.sort((a, b) => b.ts.getTime() - a.ts.getTime());

  return (
    <section className="border border-rule rounded p-3 bg-paper">
      <h3 className="font-serif text-lg mb-2">History</h3>
      <ol className="text-sm flex flex-col gap-1">
        {rows.map((r, i) => (
          <li key={i} className="flex flex-col">
            <span className="text-xs text-foreground/60 tnum">{r.ts.toLocaleString()}</span>
            <span>{r.label}</span>
            {r.sub && <span className="text-xs text-foreground/70">{r.sub}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
```

- [ ] **Step 14.4: Refund modal copy update**

Locate the existing refund modal component. Update its title/body text to match spec §14.4 exactly (see §14.2 above for the wording).

- [ ] **Step 14.5: Smoke + commit**

```bash
pnpm check-types
pnpm dev:web
# verify reopen dialog requires reason; history renders chronologically
git add apps/web/src/app/admin/[tenant]/orders/[orderId]/
git commit -m "feat(order-detail): mode-aware actions, reopen dialog, history view"
```

---

## Task 15 — CSV export columns

**Files:**
- Modify: `apps/web/src/app/admin/[tenant]/orders/csv.ts`

- [ ] **Step 15.1: Replace status column with new columns**

Remove the legacy `Status` column. Pin the column order so downstream importers won't break silently. Final order (left → right):

```
Order ID
Created at (tenant tz)
Parent name
Parent email
Student name
Student year
Fulfilment method
Fulfilment status
Payment status
Completion type
Subtotal
GST
Total
Refunded amount
Ready at (tenant tz)
Completed at (tenant tz)
Pick slip printed at (tenant tz)
```

Format `Refunded amount` from `(refunded_amount_cents / 100).toFixed(2)` so values are always 2dp (avoids `45.5` vs `45.50` drift). Tenant-tz columns continue to use the existing formatter.

- [ ] **Step 15.2: Verify + commit**

```bash
pnpm check-types
git add apps/web/src/app/admin/[tenant]/orders/csv.ts
git commit -m "feat(csv): export split fulfilment/payment columns + key timestamps"
```

---

## Task 16 — Platform settings page

**Files:**
- Create: `apps/web/src/app/platform/tenants/[tenantId]/settings/page.tsx`
- Create: `apps/web/src/app/platform/tenants/[tenantId]/settings/settings-client.tsx`
- Modify: `apps/web/src/app/platform/tenants/[tenantId]/` whichever index page links to it (add a nav entry or button)

- [ ] **Step 16.1: RSC**

```tsx
import { requirePlatformAdmin } from "@/lib/auth/authorization";
import { getTenantSettings } from "@/db/queries";
import { db } from "@/db";
import { tenantSettingEvents, tenants } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { SettingsClient } from "./settings-client";

export default async function Page({ params }: PageProps<"/platform/tenants/[tenantId]/settings">) {
  await requirePlatformAdmin();
  const { tenantId } = await params;
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const settings = await getTenantSettings(tenantId);
  const events = await db
    .select()
    .from(tenantSettingEvents)
    .where(eq(tenantSettingEvents.tenantId, tenantId))
    .orderBy(desc(tenantSettingEvents.createdAt))
    .limit(5);
  return <SettingsClient tenant={tenant} settings={settings} recentEvents={events} />;
}
```

- [ ] **Step 16.2: Client form**

```tsx
"use client";
import { useState, useTransition } from "react";
import type { InferSelectModel } from "drizzle-orm";
import type { tenants, tenantSettingEvents } from "@/db/schema";
import type { getTenantSettings } from "@/db/queries";
import { updateTenantSettingsAction } from "./actions";

type Tenant = InferSelectModel<typeof tenants>;
type TenantSettings = Awaited<ReturnType<typeof getTenantSettings>>;
type SettingEvent = InferSelectModel<typeof tenantSettingEvents>;

type Props = {
  tenant: Tenant;
  settings: TenantSettings;
  recentEvents: SettingEvent[];
};

export function SettingsClient({ tenant, settings, recentEvents }: Props) {
  const [workflowMode, setWorkflowMode] = useState(settings.workflowMode);
  const [shippingEnabled, setShippingEnabled] = useState(settings.shippingEnabled);
  const [pickupEnabled, setPickupEnabled] = useState(settings.pickupEnabled);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  return (
    <main className="max-w-2xl p-6 flex flex-col gap-4">
      <h1 className="font-serif text-2xl">{tenant.name} — workflow settings</h1>

      <fieldset className="flex flex-col gap-2 border border-rule rounded p-3">
        <legend className="px-1">Workflow mode</legend>
        <label><input type="radio" checked={workflowMode === "standard"} onChange={() => setWorkflowMode("standard")} /> Standard (4 columns)</label>
        <label><input type="radio" checked={workflowMode === "simple"} onChange={() => setWorkflowMode("simple")} /> Simple (2 columns)</label>
        <p className="text-xs text-foreground/70">
          Switching collapses display only — historical statuses are preserved.
        </p>
      </fieldset>

      <label className="flex items-center gap-2">
        <input type="checkbox" checked={shippingEnabled} onChange={(e) => setShippingEnabled(e.target.checked)} />
        Shipping enabled (offers Ship in checkout)
      </label>

      <label className="flex items-center gap-2">
        <input type="checkbox" checked={pickupEnabled} onChange={(e) => setPickupEnabled(e.target.checked)} />
        Pickup enabled
      </label>

      <label className="text-sm">
        Reason for change (required)
        <textarea className="mt-1 w-full border border-rule rounded p-2" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>

      <button
        className="btn bg-navy-deep text-white self-start"
        disabled={!reason.trim() || pending}
        onClick={() => start(async () => {
          await updateTenantSettingsAction(tenant.id, { workflowMode, shippingEnabled, pickupEnabled }, reason.trim());
          setReason("");
        })}
      >
        Save
      </button>

      <section>
        <h2 className="font-serif text-lg mt-4">Recent changes</h2>
        <ul className="text-sm">
          {recentEvents.map((e) => (
            <li key={e.id} className="flex flex-col mb-2">
              <span className="text-xs text-foreground/60">{new Date(e.createdAt).toLocaleString()}</span>
              <span><code>{e.settingKey}</code>: {e.oldValue ?? "—"} → <strong>{e.newValue}</strong></span>
              {e.reason && <span className="text-xs italic">"{e.reason}"</span>}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
```

- [ ] **Step 16.3: Server action for the form**

Create `apps/web/src/app/platform/tenants/[tenantId]/settings/actions.ts`:

```ts
"use server";
import { requirePlatformAdmin } from "@/lib/auth/authorization";
import { updateTenantSettings } from "@/db/queries";
import { revalidatePath } from "next/cache";

export async function updateTenantSettingsAction(
  tenantId: string,
  patch: { workflowMode: "standard" | "simple"; shippingEnabled: boolean; pickupEnabled: boolean },
  reason: string,
) {
  const user = await requirePlatformAdmin();
  if (!reason.trim()) throw new Error("Reason is required");
  await updateTenantSettings(tenantId, patch, user.id, reason);
  revalidatePath(`/platform/tenants/${tenantId}/settings`);
}
```

- [ ] **Step 16.4: Add a link from the tenant detail page**

In `apps/web/src/app/platform/tenants/[tenantId]/page.tsx` (or whatever the tenant index is), add a link/button to `…/settings`.

- [ ] **Step 16.5: Smoke + commit**

```bash
pnpm dev:web
# as a platform admin, visit /platform/tenants/nsbh/settings; toggle workflow_mode='simple' with reason; revisit /admin/nsbh/orders and confirm 2-column board
git add apps/web/src/app/platform/tenants/[tenantId]/settings/
git commit -m "feat(platform): tenant workflow settings page with audit trail"
```

---

## Task 17 — Read-only workflow section in school settings

**Files:**
- Modify: `apps/web/src/app/admin/[tenant]/settings/page.tsx`
- Modify: `apps/web/src/app/admin/[tenant]/settings/settings-client.tsx`

- [ ] **Step 17.1: Show the current settings + contact note**

In `page.tsx`, also load `getTenantSettings(tenantId)`. In `settings-client.tsx`, add a read-only section:

```tsx
<section className="border border-rule rounded p-3 bg-paper">
  <h3 className="font-serif text-lg">Workflow configuration</h3>
  <dl className="text-sm grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
    <dt>Workflow mode</dt><dd className="capitalize">{settings.workflowMode}</dd>
    <dt>Pickup</dt><dd>{settings.pickupEnabled ? "Enabled" : "Disabled"}</dd>
    <dt>Shipping</dt><dd>{settings.shippingEnabled ? "Enabled" : "Disabled"}</dd>
  </dl>
  <p className="text-xs text-foreground/70 mt-2">
    Contact UniformOrder support to change these settings.
  </p>
</section>
```

- [ ] **Step 17.2: Commit**

```bash
pnpm check-types
git add apps/web/src/app/admin/[tenant]/settings/
git commit -m "feat(admin-settings): read-only workflow configuration display"
```

---

## Task 18 — Cleanup of legacy literals + docs

**Files:**
- Modify: any file with stale references (search drives this)
- Modify: `docs/remaining_work.md`
- Modify: `docs/completed.md`

- [ ] **Step 18.1: Grep for stragglers**

Tighten to match legacy-only references — the new code uses `'collected'` as a completion_type literal, so a bare `'collected'` grep would churn the new files. Two passes:

```bash
# Old enum types and helpers
grep -rn "order_status\b\|delivery_method\b\|LiveOrderStatus\|countNewOrders\|getNewOrderCount" apps/web/src

# Status-field comparisons against legacy values (assignments, equality checks, switch cases on status)
grep -rnE "status: ['\"](new|packing|pending_payment)['\"]|status === ['\"](new|packing|collected)['\"]|case ['\"](new|packing|collected)['\"]:" apps/web/src
```

Update any remaining call sites. Common locations: `lib/data.ts` (constants), any dashboard tile, `app/admin/[tenant]/reports/`. Be careful not to rewrite occurrences inside the new `completion_type` paths or inside the migration SQL itself.

- [ ] **Step 18.2: Update docs**

In `docs/remaining_work.md`, strike the relevant §4 line items (Kanban refactor, mobile pick, workflow modes, refund email, etc.). In `docs/completed.md`, append:

```markdown
### §4.38 Order fulfilment workflow refactor
Status → fulfilment/payment/completion split; Standard + Simple modes; mobile pick mode; ready/hold/refund email pipeline with idempotent `order_notification_events`; reopen flow; platform settings page; CSV export reflects new columns. Migration 0014.
```

- [ ] **Step 18.3: Final verification**

```bash
pnpm check-types        # MUST PASS
pnpm dev:web            # spot check golden path end-to-end (see Verification)
```

- [ ] **Step 18.4: Commit**

```bash
git add docs/ apps/web/src
git commit -m "chore: clean up legacy status literals; docs §4.38"
```

---

## Verification

End-to-end checks to run before merging:

1. **Types green:** `pnpm check-types` passes with zero errors.

2. **Migration sanity:** Re-run `SELECT id, fulfilment_status, payment_status, completion_type, fulfilment_method, refunded_amount_cents FROM orders ORDER BY created_at DESC LIMIT 20;` via Neon MCP. Every row populated.

3. **Standard mode happy path** (nsbh, `workflow_mode='standard'`, `shipping_enabled=false`):
   - Parent checkout: only Pickup visible.
   - Place a test order, complete payment with Stripe test card (`stripe:test-cards` skill).
   - Order lands in **To prepare**, `payment_status='paid'`.
   - Admin clicks **Mark ready** → moves to **Ready**, `ready_at` set, `OrderReady` email arrives, `order_notification_events` row with `type=ready status=sent`.
   - Admin clicks **Report issue** on the Ready order with default checkbox → moves to **Needs attention**, hold email sent, card shows "Hold notice sent".
   - Admin clicks **Resolve to ready** → back to Ready, distinct ready email sent (different idempotency key).
   - Admin clicks **Mark completed** with completion_type=`collected` → **Completed**, no email.

4. **Refund:**
   - On a completed order click **Refund**; verify warning copy matches spec §14.4 verbatim.
   - Submit partial refund. Card moves to **Completed** column with **"Partially refunded $X"** badge. `payment_status='partially_refunded'`, `refunded_amount_cents` correct.
   - Refund email arrives; `order_notification_events` row with `idempotency_key=refund:<stripe_refund_id>`.
   - In Stripe Dashboard, replay the same `charge.refunded` webhook event → confirm exactly one refund email was sent total (idempotency holds).

5. **Reopen:**
   - On a completed order click **Reopen order**; submit with reason. Order returns to **To prepare**; `order_events` row with `event_type='order_reopened'` and reason. No parent email.

6. **Simple mode:**
   - As platform admin, set `workflow_mode='simple'` for nsbh via `/platform/tenants/nsbh/settings`.
   - `/admin/nsbh/orders` collapses to two columns; orders previously in Ready/Needs attention show under **To prepare**.
   - Card actions show only **Mark completed** on To prepare cards.

7. **Mobile pick mode:**
   - DevTools at 390×844; filter chips render; Mark ready → toast; transition succeeds.

8. **Shipping flag:**
   - Toggle `shipping_enabled=true` via platform settings. Checkout shows Ship.
   - Manually POST to `/api/orders` with `fulfilmentMethod='shipping'` and `shipping_enabled=false` (toggle back) — expect HTTP 400.

9. **Tenant setting audit:**
   - Make three changes via platform settings (mode, shipping, pickup) with reasons.
   - Confirm `tenant_setting_events` has three new rows with old/new/reason/changed_by.

10. **History view:** Load a refunded+reopened order's detail page. Confirm chronological list shows: paid → status_changed (ready) → refund_created → status_changed (completed) → order_reopened → status_changed (to_prepare), plus email events.

If any check fails, stop and fix before merging.
