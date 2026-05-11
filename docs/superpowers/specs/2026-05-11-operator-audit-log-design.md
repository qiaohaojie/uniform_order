# Operator audit log — design spec

**Project:** Uniform Online Order System
**Author:** George Qiao + Claude (brainstorming session)
**Date:** 11 May 2026
**Closes:** `docs/remaining_work.md` §4.6 (operator audit log — who marked the order ready, who refunded)
**Builds on:** PR #19 (tenant legal capture) — `declared_by` attribution pattern, `db.batch` + client-uuid pattern, log-after error model

---

## 1. Goal

Provide a durable, append-only record of every human-actor mutation made through the school-operator and platform-admin portals, with one queryable table that answers "who did what, when, to which entity?" Today, attribution lives in scattered breadcrumb columns (`tenant_legal_versions.declared_by`, `orders.refundRequestedBy`), unused stubs (`tenants.platformApprovedBy`), or PostHog events that are observability not system-of-record.

After this spec ships:

- One `audit_events` table holds every operator + platform-admin mutation across both portals.
- Operator order-detail pages show an "Activity" timeline of order events (audit rows UNIONed with Stripe payment events).
- Platform tenant-detail pages show a tenant-scoped activity feed under the existing Branding / Legal cards.
- The unused `tenants.platformApprovedBy` column is retired in favour of audit rows (deferred to a follow-up migration to keep the v1 migration atomic).

## 2. Non-goals

- **Stripe webhook events as audit rows.** Webhook-driven facts (`payment_intent.succeeded`, `charge.refunded`) already live durably in `payments` and `orders.refundedAt`. The order-timeline UI joins them in at read time instead of duplicating them into audit_events.
- **Parent-facing audit log.** Parents don't get an "Activity" view of their order. Order-placed is shown on the operator timeline as a synthesised row from `orders.createdAt`, not a real audit_events row.
- **DB-level immutability.** No `REVOKE UPDATE/DELETE`, no row-level security, no triggers. Append-only is enforced at the app layer (no edit/delete server actions exist). Re-evaluate at scale or first compliance ask.
- **Retention / pruning.** Forever. Flag for re-evaluation at 1M rows.
- **Diff snapshots.** `payload.changedFields: string[]` is sufficient; we do not store before/after values of every changed column.
- **Filtering, search, date-range, CSV export.** Both viewers are limit-20 reverse-chronological. "Show more" / pagination is a v1.1 follow-up.
- **Operator-side tenant activity feed.** Operators see order activity only; they do not see a tenant-level feed of platform-admin actions on their tenant. Defer until requested.
- **Backfilling historical mutations.** Audit log starts on deploy day. Past `tenant.went_live` events for NSBH and RGSH stay un-rowed.
- **Inventory / stock events.** Out of product scope — no `catalog_item.stock_changed` exists or will be added (see memory: `project_no_inventory.md`).

## 3. Schema

One new table, three new indexes. No changes to existing tables in v1. (A follow-up migration retires `tenants.platformApprovedBy` once the new table is populated and confirmed correct.)

### 3.1 `audit_events` (new table)

```
id            uuid pk                                       -- client-generated
created_at    timestamptz not null default now()
tenant_id     text fk → tenants(id) on delete set null      -- nullable for cross-tenant events
actor_email   text not null
actor_role    text not null                                 -- check ('operator','platform_admin')
action        text not null                                 -- dotted key, e.g. 'order.marked_ready'
target_type   text not null                                 -- check ('order','tenant','catalog_item','tenant_legal_version')
target_id     text not null                                 -- text because order ids are uuid and tenant ids are slugs
payload       jsonb not null default '{}'
```

**Constraints:**

- `check (actor_role in ('operator','platform_admin'))`
- `check (target_type in ('order','tenant','catalog_item','tenant_legal_version'))`
- `fk tenant_id → tenants(id) on delete set null` — preserves history if a draft tenant is hard-deleted
- No `unique` constraint on `(tenant_id, action, target_id)` — the same action on the same target can repeat (e.g. branding edited twice).

### 3.2 Indexes

```
idx_audit_events_tenant_time     on (tenant_id, created_at desc)
idx_audit_events_target          on (target_type, target_id, created_at desc)
idx_audit_events_actor_time      on (actor_email, created_at desc)
```

Order timeline = scan by `(target_type='order', target_id=:orderId)`. Tenant activity feed = scan by `(tenant_id=:tenantId)`. Actor-history index is for debug queries; no v1 UI uses it but the cost is negligible.

### 3.3 Why not typed columns per event

Common audit-table pattern: typed columns for what's queried, JSONB for the long tail. The typed columns above (`tenant_id`, `actor_email`, `actor_role`, `action`, `target_type`, `target_id`) cover every v1 query. Event-specific data (`changedFields`, `refundAmountCents`, `sourceTenantId`, etc.) lives in `payload` where adding a new field needs no migration. If a payload field becomes a hot query path later, promote it to a typed column then.

## 4. Event taxonomy

Twelve events for v1. Verbs are past tense (describing what happened, not a command).

### 4.1 Operator events (school-admin portal)

| Action | Target type | Payload (beyond standard fields) |
|---|---|---|
| `order.marked_ready` | order | `{ previousStatus }` |
| `order.refund_issued` | order | `{ refundAmountCents, lineItems: { id, name, quantity }[], reason? }` |
| `catalog_item.created` | catalog_item | `{ sku, name, priceCents }` |
| `catalog_item.updated` | catalog_item | `{ changedFields: string[] }` |
| `catalog_item.deleted` | catalog_item | `{ sku, name }` |

### 4.2 Platform-admin events (super-admin portal)

| Action | Target type | Payload |
|---|---|---|
| `tenant.draft_created` | tenant | `{ name }` |
| `tenant.branding_updated` | tenant | `{ changedFields: string[] }` |
| `tenant.operator_updated` | tenant | `{ previousEmail, newEmail }` |
| `tenant.legal_updated` | tenant_legal_version | `{ version: number, mode: 'text' \| 'url' }` |
| `tenant.stripe_account_linked` | tenant | `{ stripeAccountId }` |
| `tenant.catalog_cloned` | tenant | `{ sourceTenantId, itemCount }` |
| `tenant.went_live` | tenant | `{}` |

### 4.3 `changedFields` semantics

For all `*.updated` events (`tenant.branding_updated`, `tenant.operator_updated`, `catalog_item.updated`), `changedFields` is the **DB-state diff**: the route reads the current row, compares to the incoming payload, and emits only fields whose value actually differs from what's stored. This matches PR #18's branding-editor pattern (server-side `changedFields` computation, not form-pristine state). The reason: form-pristine diff over-reports — a no-op save (open drawer, click save without typing) would emit a phantom event listing every field "edited."

A no-op save (no fields differ) **does not emit an audit row at all** — the action short-circuits before reaching `logAuditEvent`. This matches PR #18 and PR #19's no-op short-circuit pattern.

### 4.4 Cloning semantics

`tenant.catalog_cloned` fires **once** with `itemCount` set to the number of rows copied. It does **not** also fire 24× `catalog_item.created`. The clone is logically one action by one actor; spamming the feed with 24 rows defeats the purpose. The clone runs inside `db.batch(...)` so partial-clone is structurally impossible — `itemCount` is for human readability in the feed, not integrity.

### 4.5 Excluded actions

- Read actions (viewing lists, viewing details) — not mutations, not logged.
- Stripe webhook receipts — already durably in `payments` / `orders`; joined into the timeline UI.
- Order placement by parents — synthesised in the timeline UI from `orders.createdAt`; no audit row.
- Login / logout — handled by Neon Auth; out of scope.

## 5. Helper

### 5.1 `lib/audit/log.ts`

```ts
export type AuditTargetType = 'order' | 'tenant' | 'catalog_item' | 'tenant_legal_version';
export type AuditActorRole = 'operator' | 'platform_admin';

export interface LogAuditEventInput {
  tenantId: string | null;
  actorEmail: string;
  actorRole: AuditActorRole;
  action: string;            // dotted key, e.g. 'order.marked_ready'
  targetType: AuditTargetType;
  targetId: string;
  payload?: Record<string, unknown>;
}

export async function logAuditEvent(input: LogAuditEventInput): Promise<void> {
  // The try wraps only the DB write — its success/failure is the audit signal.
  // PostHog co-emit is best-effort and must not affect the audit-success path.
  try {
    await db.insert(auditEvents).values({
      id: crypto.randomUUID(),
      ...input,
      payload: input.payload ?? {},
    });
  } catch (err) {
    console.error('[audit] failed to log', { action: input.action, targetId: input.targetId }, err);
    try {
      await serverCapture(input.actorEmail, 'audit_log_failed', {
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        error: err instanceof Error ? err.message : String(err),
      });
    } catch { /* swallow — PostHog is best-effort */ }
    return; // user-facing mutation already succeeded; we do not rethrow
  }

  // Audit row landed. Now best-effort PostHog co-emit, isolated from the success signal.
  try {
    await serverCapture(input.actorEmail, input.action, {
      ...input.payload,
      tenantId: input.tenantId,
      targetType: input.targetType,
      targetId: input.targetId,
      actorRole: input.actorRole,
    });
  } catch (err) {
    console.error('[audit] posthog co-emit failed (audit row landed OK)', { action: input.action }, err);
  }
}
```

### 5.2 Log-after pattern (not in-batch)

`logAuditEvent` is called **after** the business mutation succeeds, never inside its `db.batch`. Reason: wrapping audit + mutation in one batch means a failed audit row rolls back the user's mark-ready or refund. The user-facing mutation must not fail because of an audit-logging hiccup.

Tradeoff: a vanishingly small race window where the mutation lands but the audit row doesn't (DB write succeeds, second DB write to same connection fails an instant later). Accepted v1. The PostHog co-emit in the success path gives a backup observability trail.

### 5.3 Actor identification

Every call site already runs `requireSessionUser()` for auth. Actor email comes from that user. Role is derived inline:

```ts
const actorRole: AuditActorRole = isPlatformAdminEmail(user.email) ? 'platform_admin' : 'operator';
```

No new auth helper. No `actor_user_id` foreign key — Neon Auth user IDs are not stable across deletion, and email is the durable handle the app uses everywhere.

**Consequence of email-as-actor (intentional):** if an operator changes their login email later, historical rows keep the *old* email. This is arguably correct — the row records what was true at the time of the action — but worth saying out loud so a future reader doesn't "fix" it by retroactively rewriting `actor_email`.

### 5.4 PostHog co-emit

Every audit row also fires a PostHog `serverCapture` with the same event name and a superset of the payload (adds `targetType`, `targetId`, `actorRole`). This means:

- **PostHog** remains the analytics funnel + alerting surface (already integrated, dashboards exist).
- **`audit_events` table** is the system of record (durable, queryable, joinable to `tenants` / `orders` / `catalog_items`).
- Existing `serverCapture` calls in the four `app/platform/tenants/new/actions.ts` mutation paths are replaced by `logAuditEvent` calls — no duplicate emission.

## 6. UI viewers

Two server-rendered, read-only viewers. Both reuse the same row template via a shared helper.

### 6.1 `formatAuditEvent` (shared formatter)

`lib/audit/format.ts` exports one function:

```ts
export function formatAuditEvent(event: AuditEvent): { icon: ReactNode; line: string }
```

One switch over `action`. Returns a one-line human-readable string. Example mappings:

- `order.marked_ready` → "Marked order #{shortId} ready"
- `order.refund_issued` → "Requested refund of ${amount}"
- `tenant.branding_updated` → "Updated branding ({n} fields)"
- `tenant.went_live` → "Approved tenant for live ordering"
- `tenant.legal_updated` → "Saved legal policy v{n} ({mode} mode)"
- `tenant.catalog_cloned` → "Cloned catalog from {sourceTenantId} ({n} items)"

Centralised so future event additions or copy tweaks change in one place.

### 6.2 Order activity strip

**Where:** `app/admin/[tenant]/orders/[orderId]/page.tsx`, new section between the existing order-info card and the action buttons (`order-detail-actions.tsx`).

**Source data:** server-side merge of three queries, scoped to this order, ordered desc, capped at 20 rows total:

1. `audit_events WHERE target_type = 'order' AND target_id = :orderId`
2. `payments WHERE order_id = :orderId` (joined as virtual rows: "Payment received $X" / "Refund processed $X")
3. `orders.createdAt` + `orders.parentName` (synthesised single virtual row: "Order placed by {parentName}" — e.g. "Order placed by Sarah Chen")

**Display:** vertical timeline, newest-first. Each row: dot · description · monospace right-aligned relative timestamp. Dot colour = `--color-gold` for human actor, neutral grey for Stripe/parent virtual rows. No expand-all (one order's lifetime fits in 20 rows comfortably).

**Component:** new server component `OrderActivityStrip` in `components/admin/order-activity-strip.tsx`. Pure presentational once given the merged rows; merging logic lives in the page's `loadOrderActivity(orderId)` server helper.

### 6.3 Tenant activity feed

**Where:** `app/platform/tenants/[id]/page.tsx`, new card below the existing `LegalCard` / `BrandingCard` layout.

**Source data:** `audit_events WHERE tenant_id = :tenantId` limit 20, ordered desc. No `payments` join — order-level events surface on the order detail page, not in the tenant-level feed.

**Display:** same row template as the order strip. **No "Show more" link in v1.** If fewer than 20 rows exist, the card simply ends after the last row. If exactly 20 rows are shown, a muted footer reads "Showing 20 most recent — full history coming soon." The standalone `/platform/tenants/[id]/activity` paginated page is a v1.1 follow-up (see §10).

**Component:** new server component `TenantActivityFeed` in `components/platform/tenant-activity-feed.tsx`. Mirrors `LegalCard` / `BrandingCard` shell (same border, padding, header style).

## 7. Instrumentation map

Where each event fires in code, ordered by file.

| File | Where to add `logAuditEvent` | Action(s) |
|---|---|---|
| `app/admin/[tenant]/orders/[orderId]/order-detail-actions.tsx` | After `markOrderReady` mutation succeeds | `order.marked_ready` |
| `app/api/orders/[orderId]/refund/route.ts` | After successful Stripe refund kickoff, before returning 200 | `order.refund_issued` |
| `app/api/catalog/route.ts` (POST) | After insert | `catalog_item.created` |
| `app/api/catalog/[itemId]/route.ts` (PUT) | After update; pass `changedFields` from input diff | `catalog_item.updated` |
| `app/api/catalog/[itemId]/route.ts` (DELETE) | After soft- or hard-delete | `catalog_item.deleted` |
| `app/platform/tenants/new/actions.ts` `createTenantDraft` | After insert; replaces existing `platform_tenant_created` serverCapture | `tenant.draft_created` |
| `app/platform/tenants/new/actions.ts` `updateTenantBranding` (wizard step) | After update | `tenant.branding_updated` |
| `app/platform/tenants/new/actions.ts` `updateTenantOperator` | After update | `tenant.operator_updated` |
| `app/platform/tenants/new/actions.ts` `createStripeStandardForTenant` | After Stripe account link; replaces existing `platform_tenant_stripe_created` serverCapture | `tenant.stripe_account_linked` |
| `app/platform/tenants/new/actions.ts` `cloneCatalogFromTenant` | After batch insert; replaces existing `platform_tenant_catalog_cloned` serverCapture | `tenant.catalog_cloned` |
| `app/platform/tenants/new/actions.ts` (approval step) | After flip; replaces existing `platform_tenant_went_live` serverCapture | `tenant.went_live` |
| `app/platform/tenants/[id]/actions.ts` `updateTenantBranding` | After update | `tenant.branding_updated` |
| `app/platform/tenants/[id]/actions.ts` `updateTenantLegal` | After version insert + pointer update | `tenant.legal_updated` |

Existing `serverCapture` calls at the marked sites get **removed** (the co-emit inside `logAuditEvent` replaces them).

**PostHog event-name migration:** the old event names (`platform_tenant_created`, `platform_tenant_stripe_created`, `platform_tenant_catalog_cloned`, `platform_tenant_went_live`) are renamed to the new dotted form (`tenant.draft_created`, etc.) via the co-emit. **Any existing PostHog dashboards, funnels, or alerts referencing the old names will break on deploy.** Pre-deploy action: audit the PostHog project for references to the four old names, update or recreate the dashboards against the new names. Tracked in §10.

## 8. Migration

Single migration `0011_audit_events.sql` (applied via Neon MCP `run_sql_transaction` per the established websocket-blocker workaround). The drizzle journal `__drizzle_migrations` row is inserted manually after the SQL applies, mirroring the PR #19 pattern.

Migration body:

```sql
CREATE TABLE audit_events (
  id          uuid PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now(),
  tenant_id   text REFERENCES tenants(id) ON DELETE SET NULL,
  actor_email text NOT NULL,
  actor_role  text NOT NULL,
  action      text NOT NULL,
  target_type text NOT NULL,
  target_id   text NOT NULL,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT audit_events_actor_role_check
    CHECK (actor_role IN ('operator', 'platform_admin')),
  CONSTRAINT audit_events_target_type_check
    CHECK (target_type IN ('order', 'tenant', 'catalog_item', 'tenant_legal_version'))
);

CREATE INDEX idx_audit_events_tenant_time  ON audit_events (tenant_id, created_at DESC);
CREATE INDEX idx_audit_events_target       ON audit_events (target_type, target_id, created_at DESC);
CREATE INDEX idx_audit_events_actor_time   ON audit_events (actor_email, created_at DESC);
```

No backfill. No data migration. No changes to existing tables in this migration.

## 9. Testing

- **Type check.** `pnpm check-types:web` clean.
- **Manual smoke (mirrors PR #19 plan Task 11):**
  - Sign in as operator → mark an order ready → confirm new audit row in DB + row appears on order detail page.
  - Sign in as operator → refund one line → confirm audit row + payment-refund row both appear on timeline.
  - Sign in as platform admin → edit tenant branding → confirm audit row + tenant activity feed row.
  - Sign in as platform admin → save legal policy v2 → confirm audit row with `{version: 2, mode: 'text'}`.
  - Sign in as platform admin → provision wizard end-to-end (draft → stripe → catalog clone → go-live) → confirm four audit rows in order.
  - Force a write failure (e.g. break the audit insert with an invalid UUID) → confirm the user-facing mutation still succeeds and a PostHog `audit_log_failed` event fires.
- **No unit tests in v1.** The codebase has no test suite; `check-types` is the correctness gate per `CLAUDE.md`.

## 10. Open questions / follow-ups

- **DB-level immutability.** Move `REVOKE UPDATE, DELETE ON audit_events FROM ...` into a future migration once we know which Neon role the app uses at runtime versus which role admin tooling uses. v1 ships with app-layer discipline.
- **Retire `tenants.platformApprovedBy`.** Drop in a separate migration `0012_drop_platform_approved_by.sql` after v1 deploys and the new audit row for `tenant.went_live` is confirmed firing on existing tenant approvals.
- **Standalone `/platform/tenants/[id]/activity` page.** "Show more" link in §6.3 is intentionally either disabled or hidden in v1. Build the paginated full-history page in v1.1 once we see how often anyone clicks through.
- **Operator self-service history.** "What have I done lately?" view for operators is not in v1. The `idx_audit_events_actor_time` index is there in case we add it.
- **Webhook attribution.** Currently webhook-driven events live only in `payments`. If we later want them in `audit_events` (with `actor_role = 'stripe_webhook'`), this means relaxing the `actor_role` check constraint and accepting `actor_email = 'stripe@webhook'` or similar. Deferred until we have a concrete need.
- **PostHog dashboard migration.** Pre-deploy: audit the PostHog project (organization 019c854e..., project UniformOrder id 411893) for any dashboard / funnel / alert referencing `platform_tenant_created`, `platform_tenant_stripe_created`, `platform_tenant_catalog_cloned`, or `platform_tenant_went_live` and update them to the new dotted names. Owner: George. Blocks the v1 deploy only if active alerts are wired to the old names.

  **Alternative: dual-emit transition window.** Instead of a pre-deploy gate, `logAuditEvent` could co-emit *both* the old name (`platform_tenant_created`) and the new dotted name (`tenant.draft_created`) for a 1–2 week window, then drop the old emit. Trade-off: doubles PostHog ingest temporarily and requires a follow-up cleanup task, but unblocks deploy and lets dashboard migration happen at George's own pace. Recommended only if dashboards/funnels/alerts on the old names actually exist; if there are none (likely — the events were just instrumented in the platform-portal work), the clean rename is simpler.

## 11. Why now

PR #19 just established the per-row attribution pattern (`declared_by`, `entered_by_email`) for tenant legal. Without a generalised audit table, every future feature reaches for its own column — and the `tenants.platformApprovedBy` column already shows what happens when that pattern decays (ships, sits unused, accumulates schema debt).

Doing this now also retires `remaining_work.md` §4.6, which has lived as a "low-priority but inferred-from-refund-work" item since the refund/exchange work landed in PR #4. With both the operator and platform-admin portals at v1 feature-complete, the instrumentation surface is finally stable enough to wire audit consistently in one pass.
