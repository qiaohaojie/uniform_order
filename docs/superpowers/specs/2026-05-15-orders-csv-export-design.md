# Admin Orders CSV Export — Design

**Date:** 2026-05-15
**Status:** Draft (pending implementation)
**Author:** Engineering (brainstormed with George)
**Backlog ref:** New feature; supersedes the deferred §4.3 (bulk email parents) by giving operators the data they need to email parents themselves.

---

## Problem

The admin Orders board has no way to export order data. Operators who want to email all parents with "Ready" orders, reconcile a roll-call list, or hand the principal a spreadsheet of weekly pickups must read the Kanban board manually. The Reports page exports only monthly GST aggregates — no per-order rows, no parent contact info.

## Goal

Add a CSV export to the admin Orders page that downloads one row per order, filtered by status, with the columns an operator needs to drive downstream email/contact workflows.

## Non-goals

- Not a replacement for transactional emailing — operators still use their mail client (the deferred §4.3 "real send" stays deferred)
- Not refactoring the codebase's Sydney-hardcoded date utils (`sydneyDateParts` etc.) — only the new export uses `tenant.timezone`
- Not adding a date-range filter (can be added later if asked)
- Not adding a per-export entry in the operator audit log (low value; easy to add later)

---

## UX

### Placement
A new "Export CSV" button sits in the Orders topbar between **Print pick slips** and **Email parents** in `orders-page-client.tsx`. Visual style matches the existing `ExportCsvButton` on the Reports page (h-9, bordered, `var(--color-ink)` text).

### Interaction
Clicking the button opens a small popover positioned below it (absolutely positioned, click-outside or Escape closes). The popover contains:

1. A `<select>` for status, options:
   - `All statuses` (default)
   - `New`
   - `Packing`
   - `Ready`
   - `Collected`
   - `Refunded`
2. A muted one-liner: *"Exports all orders with this status for this school — ignores your current search."*
3. A primary "Download" button (accent-coloured)

On Download:
- Calls the `exportOrdersCsv` server action
- Builds a CSV blob client-side (RFC 4180 escaping)
- Triggers a browser download
- Closes the popover

The "Email parents" `mailto:` button is unchanged.

### Filename
`<tenant-slug>-orders-<status>-<YYYY-MM-DD>.csv` — e.g. `nsbh-orders-ready-2026-05-15.csv`. `all` is used for the "All statuses" case.

---

## Data

### CSV columns (in order)

| Column | Source | Format |
|---|---|---|
| Order ID | `orders.id` | e.g. `NSBH-04298` |
| Date | `orders.createdAt` | `DD/MM/YYYY` in `tenant.timezone` via `Intl.DateTimeFormat` |
| Status | `orders.status` | enum value as stored |
| Parent Name | `orders.parentName` | text, RFC 4180 escaped |
| Parent Email | `orders.parentEmail` | text |
| Parent Mobile | `orders.parentMobile` | text |
| Student Name | `orders.studentName` | text |
| Student Year | `orders.studentYear` | text |
| Total | `orders.total` | `$27.50` (dollar-formatted) |
| Items | derived from `order_lines` | semicolon-joined: `School Shirt (Navy / S) ×2; Shorts (Grey / 10) ×1` |

### Items string assembly
For each order, join its `order_lines` rows as `"{itemName} ({variantLabel}{ / size if present}) ×{qty}"` with `"; "` separator. Assembled in JS after the query — not in SQL.

### Query strategy
Two queries to avoid N+1:
1. `SELECT * FROM orders WHERE tenant_id = $1 [AND status = $2] ORDER BY created_at DESC`
2. `SELECT * FROM order_lines WHERE order_id = ANY($order_ids)`

Then group lines by `orderId` in JS. Acceptable for the foreseeable scale (single-school exports rarely exceed a few thousand rows).

---

## Schema change

Add a `timezone` column to the `tenants` table:

```sql
ALTER TABLE tenants ADD COLUMN timezone text NOT NULL DEFAULT 'Australia/Sydney';
```

All existing tenants default to Sydney. Drizzle schema (`db/schema.ts`) gets a matching `timezone: text("timezone").notNull().default("Australia/Sydney")` line.

Applied via Neon MCP `run_sql_transaction` per the project's drizzle-kit-websocket-blocker workaround memory, with a manual `__drizzle_migrations` row insert matching the new migration file in `apps/web/drizzle/`.

The CSV export reads this column. The existing Sydney-hardcoded date utils (reports page, dashboard) remain untouched in this feature — refactoring them is tracked as a separate follow-up before any non-AEST school onboards.

---

## Architecture

### New files

1. **`apps/web/src/app/admin/[tenant]/orders/actions.ts`** — server action `exportOrdersCsv(tenantId, status)`. Authorization: `requireSessionUser` + platform-admin-or-this-tenant's-operator email check (mirrors patterns in `app/platform/tenants/[id]/actions.ts`).

2. **`apps/web/src/components/export-orders-button.tsx`** — `"use client"`. Renders the button + popover. Owns the popover open/close state, the status select state, click-outside and Escape handling, the server-action call, and CSV blob construction.

### Modified files

1. **`apps/web/src/db/schema.ts`** — add `timezone` field to `tenants`.
2. **`apps/web/drizzle/<n>_add_tenant_timezone.sql`** — new migration file (SQL applied via Neon MCP).
3. **`apps/web/src/app/admin/[tenant]/orders/orders-page-client.tsx`** — insert `<ExportOrdersButton tenantId={tenantId} tenantSlug={tenant.id} timezone={tenant.timezone} accent={tenant.accent} />` in the topbar between Print and Email Parents.
4. **`apps/web/src/db/queries.ts`** — `getTenant` already returns the full row, so `timezone` flows through automatically; verify `toTenantBrand` includes it (add if absent).

### Authorization
The server action must reject:
- Unauthenticated requests → throws / returns 401-equivalent error
- Authenticated users who are not platform admin and not an operator of the requested `tenantId` → throws / returns 403-equivalent error

Implementation reuses `isPlatformAdminEmail` and the tenant-operator check from `lib/auth/authorization.ts`.

### CSV escaping (RFC 4180)
Client-side serializer:
- Each field wrapped in `"..."` if it contains `,`, `"`, `\n`, or `\r` — otherwise output bare
- Embedded `"` doubled to `""`
- Rows joined with `\r\n` (Excel-friendly)
- UTF-8 BOM prepended so Excel opens it with correct encoding

---

## Testing

### Type check
`pnpm check-types:web` must pass.

### Smoke test (manual)
1. Log in as NSBH operator → `/admin/nsbh/orders`
2. Click Export CSV → popover opens, status defaults to "All statuses"
3. Select "Ready" → click Download → `nsbh-orders-ready-2026-05-15.csv` downloads
4. Open in Excel/Numbers — verify:
   - All 10 columns present in correct order
   - Items column reads naturally with `;` separators
   - A parent name containing a comma (e.g. "Smith, Jane") is quoted correctly
   - Dates are `DD/MM/YYYY` in Sydney time
   - Total is dollar-formatted (`$27.50`)
5. Select "All statuses" → row count matches the dashboard's total order count for the tenant
6. Log in as an RGSH operator → confirm only RGSH orders appear in their export, never NSBH

### Authorization test
With NSBH operator credentials, call the server action with `tenantId: "rgsh"` (forge the parameter) → must throw / 403. Document in the smoke test or write a quick curl/devtools repro.

### Edge cases
- Zero orders for the selected status → empty CSV with just the header row, still downloadable
- Order with no `order_lines` (shouldn't happen in practice but possible) → Items column is empty string
- Order with `parentNote` containing newlines → not in CSV today (Items column doesn't include note), but verify any text field with quotes/newlines escapes correctly

---

## Rollout

1. Apply migration via Neon MCP `run_sql_transaction`, insert `__drizzle_migrations` row.
2. Update Drizzle schema, run `pnpm check-types:web`.
3. Implement server action, component, and topbar insertion.
4. Smoke test in dev.
5. Open PR.

No new env vars. No third-party dependencies. No PostHog event (admin-internal action).

## Out of scope (tracked separately)

- Refactoring `sydneyDateParts`, `sydneyLocalDateToUtc`, `addSydneyMonths` etc. to use `tenant.timezone` — the reports page and dashboard remain Sydney-only until that follow-up lands. Acceptable today since NSBH and RGSH are both NSW.
- Date range filter on the export (e.g. "orders placed in the last 30 days") — add later if requested.
- Audit-log entry per export — admin-internal, low risk; can be wired into the existing operator audit log in a small follow-up if desired.
