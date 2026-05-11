# Tenant legal capture & per-tenant refund-policy — design spec

**Project:** Uniform Online Order System
**Author:** George Qiao + Claude (brainstorming session)
**Date:** 11 May 2026
**Closes:** `docs/remaining_work.md` §3.10 follow-up #1 (school onboarding refund-policy capture) and follow-up #2 (re-introduce per-tenant `/refund-policy` route + email footer link)
**Builds on:** PR #18 (`1ea6055`) — branding editor drawer, `requirePlatformAdmin` / `parseInput` action helper, `BrandingEditDrawer` UX template

---

## 1. Goal

Let each school (tenant) declare its own refund / exchange policy through the platform-admin portal, capture the legal acknowledgements that protect uniformorder.online under Australian Consumer Law (ACL) and the Stripe Connect seller-of-record model, and surface that policy to parents from the order-confirmation email.

Today the email footer reads "For refund or exchange questions, contact {tenantName} at {shopEmail}." There is no platform-authored refund text and no per-tenant policy route. After this spec ships, schools that have authored a policy get a `/{tenant}/refund-policy` link in their email footer that resolves to either inline text or a 302 redirect to the school's own URL. Schools that have not yet authored a policy keep today's contact-only footer.

## 2. Non-goals

- Wizard Step 5 — provision wizard stays at 4 steps; legal capture is a separate post-provision flow.
- School-operator self-edit — only platform admins can edit legal data.
- Markdown / rich-text rendering — `policy_text` is plain text rendered with `whitespace-pre-wrap`.
- Version-history viewer in the LegalCard — schema stores versions but the UI shows only the current one. Future enhancement.
- Backfill of existing tenants (NSBH, RGSH) — they stay null until their admin saves a policy.
- i18n / translation of policy text.
- Allowlist / denylist on the external policy URL host. Loop-back to uniformorder.online is technically possible; Chrome will catch the 302 loop and the cost of policing it isn't worth the schema complexity.

## 3. Schema

One new table, two new FK columns. All migrations go in `apps/web/drizzle/`.

### 3.1 `tenant_legal_versions` (new table)

```
id                            uuid pk
tenant_id                     text fk → tenants(id), not null
version                       int not null              -- per-tenant 1, 2, 3…
policy_mode                   enum('text','url') not null
policy_text                   text nullable
policy_url                    text nullable
acl_acknowledged              bool not null             -- must be true to save
seller_of_record_acknowledged bool not null             -- must be true to save
declarant_name                text not null
declarant_role                text not null
entered_by_user_id            uuid fk → neon_auth.user(id) not null  -- platform admin who saved
entered_by_email              text not null             -- snapshot for audit
created_at                    timestamptz not null default now()
unique (tenant_id, version)
check ((policy_mode = 'text' and policy_text is not null and policy_url is null)
    or (policy_mode = 'url'  and policy_url  is not null and policy_text is null))
```

The check constraint is the DB-layer defense-in-depth backup to the zod discriminated union enforced in the server action. Both layers are intentional.

### 3.2 `tenants` — add column

```
current_legal_version_id      uuid fk → tenant_legal_versions(id) nullable
```

Nullable because tenants exist before any policy is captured. When `null`, the LegalCard renders a "Not set" badge and the tenant detail page shows the onboarding banner.

### 3.3 `orders` — add column

```
legal_version_id              uuid fk → tenant_legal_versions(id) nullable
```

Snapshotted at order-creation time (`POST /api/orders`) by reading `tenant.currentLegalVersionId`. Nullable so legacy orders predating this feature continue to work without backfill.

The snapshot is for **audit trail** (proving which policy was in force when this specific order was placed, e.g. during an ACL dispute). Parent-facing rendering — the email footer and the `/refund-policy` route — always serves the *current* version, not the order's snapshot. See §7.2 for the rationale. **No UI surface reads `orders.legal_version_id`; it exists for SQL-level dispute lookup only** — flagged here to head off a future "why isn't this used?" cleanup.

### 3.4 Drizzle schema

`apps/web/src/db/schema.ts` gets:
- `tenantLegalVersions` `pgTable` with the columns above (`pgEnum('policy_mode', ['text','url'])`).
- New column on `tenants` and `orders`.
- Exports `TenantLegalVersionRow = typeof tenantLegalVersions.$inferSelect` (mirroring `TenantRow`).

Migration journal entry follows the existing numbering. Use `db.batch()` for any multi-statement seeds (project rule, neon-http has no transactions).

## 4. Server action

`editTenantLegal(tenantId, input)` lives in `apps/web/src/app/platform/tenants/[id]/actions.ts`, sibling to `editTenantBranding`.

### 4.1 Helpers reused

- `requirePlatformAdmin()` from `lib/platform/action-helpers.ts` — enforces session + platform-admin email.
- `parseInput(schema, input)` from the same helpers file — wraps zod `safeParse` and returns the action's standard `{ ok: false, error }` on failure.

### 4.2 Zod schema (in `lib/platform/schema.ts`)

```ts
// Zod v4 (project uses ^4.4.3) — `error` parameter, not v3's `errorMap`.
export const tenantLegalSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('text'),
    policyText: z.string().min(50, 'Policy text must be at least 50 characters'),
    aclAcknowledged: z.literal(true, { error: 'Required' }),
    sellerOfRecordAcknowledged: z.literal(true, { error: 'Required' }),
    declarantName: z.string().min(1),
    declarantRole: z.string().min(1),
  }),
  z.object({
    mode: z.literal('url'),
    policyUrl: z.string().url().refine(u => new URL(u).protocol === 'https:', 'Must be HTTPS'),
    aclAcknowledged: z.literal(true, { error: 'Required' }),
    sellerOfRecordAcknowledged: z.literal(true, { error: 'Required' }),
    declarantName: z.string().min(1),
    declarantRole: z.string().min(1),
  }),
])
```

### 4.3 Behaviour

1. `requirePlatformAdmin()` → grab session user.
2. `parseInput(tenantLegalSchema, input)` → typed payload.
3. SELECT current version (if `tenants.currentLegalVersionId` set), build the comparable snapshot of {mode, policyText|null, policyUrl|null, declarantName, declarantRole}.
4. Diff parsed input against current snapshot. **Identical → return `{ ok: true as const }` without writing.** Mirrors `editTenantBranding` (`actions.ts:90`), which uses the same `{ ok: true as const }` shape with no extra `noop` flag — keeping contracts symmetric across both edit actions.
5. Otherwise, in a single `db.batch([...])`:
   - INSERT new `tenant_legal_versions` row with `version = max(version) + 1` for the tenant.
   - UPDATE `tenants` SET `current_legal_version_id = <new id>`.

   The version-increment race is mitigated by the `unique (tenant_id, version)` constraint plus a small retry loop. On `unique_violation` (PG code 23505) for `(tenant_id, version)`, re-SELECT max version and retry up to ~3 times. Same shape as the `orders_pkey` collision-retry in `apps/web/src/app/api/orders/route.ts:225` (`isUniqueConstraintError(error, "orders_pkey")`). In practice the race is rare — typically a single platform admin per tenant — but the constraint guarantees we never get duplicate version numbers.
6. Compute `changedFields: ('mode'|'policy'|'declarant'|'acks')[]` server-side.
7. `serverCapture(user.email, 'tenant_legal_edited', { tenantId, mode, version, changedFields })`. Matches the existing call signature at `app/platform/tenants/[id]/actions.ts:102` and `app/platform/tenants/new/actions.ts:38`. Single event per save.
8. `revalidatePath(\`/platform/tenants/${tenantId}\`)` and `revalidatePath(\`/${tenantId}\`, 'layout')`. The layout flag is required because `/[tenant]/refund-policy` lives under the tenant layout — matches the pattern used by `editTenantBranding` (`actions.ts:14`).
9. Return `{ ok: true as const, version }`.

### 4.4 Errors

- Zod failure → `{ ok: false, error: <first message> }`. Drawer surfaces it inline.
- DB throw → caught, `serverCapture(user.email, 'tenant_legal_edit_error', { tenantId, message })`, return `{ ok: false as const, error: 'Save failed. Please try again.' }`.
- Auth failure inside `requirePlatformAdmin` throws and is caught by the framework's error boundary — same behaviour as `editTenantBranding`.

## 5. UI components

### 5.1 `LegalCard`

`apps/web/src/app/platform/tenants/[id]/cards/legal-card.tsx`

- `"use client"` component (owns the `editing` boolean and conditionally renders `LegalEditDrawer` — same pattern as `BrandingCard`). Takes `tenant: TenantRow` and `currentVersion: TenantLegalVersionRow | null` props; summary content is server-fed via props.
- Header: "Legal & refund policy" + Edit link (opens drawer).
- Body when `currentVersion` is null: `Not set` badge + helper copy.
- Body when set:
  - Mode badge (Text / URL).
  - Preview: first 200 chars of `policy_text` (with ellipsis) or hostname for URL mode.
  - "Declared by {declarantName}, {declarantRole}".
  - "Last updated {createdAt}, version {version}".

### 5.2 `LegalEditDrawer`

`apps/web/src/app/platform/tenants/[id]/cards/legal-edit-drawer.tsx`

Mirrors `BrandingEditDrawer`:

- Right-side overlay drawer.
- Form layout (left form, no preview rail — the policy display surface is the email footer + `/refund-policy` route, both static).
- Fields:
  - Radio group: "Write policy text" / "Link to external URL".
  - Conditional `<textarea rows="14">` (text mode) or `<input type="url">` (url mode).
  - Two acknowledgement checkboxes with their full sentences:
    - *"We confirm this refund policy complies with Australian Consumer Law and we accept responsibility for honoring it for purchases via uniformorder.online."*
    - *"We acknowledge we are seller of record under Stripe Connect for purchases via uniformorder.online."*
  - Two text inputs: declarant name, declarant role.
- Save button enabled only when: mode picked + content present + both acks ticked + name + role both non-empty. Visual state mirrors current branding drawer.
- Save flow: `setPending(true)` → call `editTenantLegal` → on `{ ok: true }`, `router.refresh()` and close drawer; on `{ ok: false }`, show `error` near Save button.
- A11y (same as branding drawer):
  - `aria-modal="true"`, `role="dialog"`, `aria-labelledby` pointing at title.
  - Esc-to-close (stabilised via `onCloseRef` so an inline `onClose` from the parent doesn't churn the keydown listener).
  - Body-scroll-lock while open.
  - `isMounted` ref to no-op `setPending`/`setError` after unmount during a pending save.
  - Cancel / close-X / scrim disabled while `pending`.
  - Full focus trap deferred (matches branding-drawer scope).
- Initial state: when `currentVersion` is non-null, prefill all fields from it — including the two acknowledgement checkboxes (pre-ticked). This keeps the contract symmetric with the no-op short-circuit: if the admin opens the drawer and clicks Save without changing anything, the server diff returns `{ ok: true as const }` and no new version is minted. Forcing acks to false on open would require the user to perform a re-acknowledgement that produced no audit row — incoherent. To produce a re-acknowledgement audit row, the admin must change at least one field (typically declarant_name or declarant_role).

### 5.3 Onboarding banner

On `/platform/tenants/[id]/page.tsx`, when `tenant.currentLegalVersionId === null`, render an amber banner above the card grid:

> **Refund policy not set.** Add it to enable a per-tenant refund-policy link in confirmation emails.

The banner is text-only — no inline "Add policy" button. The LegalCard's "Edit" link sitting just below already opens the drawer; two affordances pointing at one modal is noise. Banner = visibility nudge, LegalCard = action. Banner disappears as soon as the tenant has any version.

### 5.4 `/[tenant]/refund-policy` route

Resurrects the route that PR #11 deleted. Lives at `apps/web/src/app/[tenant]/refund-policy/page.tsx`:

- Server component.
- Await tenant lookup via existing `getTenant(slug)`. Tenant not found → `notFound()`.
- Tenant exists but `currentLegalVersionId === null` → `notFound()`. (Parents shouldn't see a half-broken page; the platform-admin banner is the affordance to fix it.)
- Fetch the current version row.
- `mode === 'url'` → `redirect(version.policyUrl)` from `next/navigation`. Issues HTTP 307 by default (temporary, same-method). We deliberately do **not** pass `RedirectType.replace` — that flag controls client-side history-replacement and has no effect on the HTTP status of a server-initiated redirect to an external host. **Plan-time verification:** confirm `next/navigation`'s `redirect()` accepts off-origin URLs in Next 16 (recent versions allow it; older versions threw). If it doesn't, fall back to a `Response.redirect()` from a route handler.
- `mode === 'text'` → render inside `MobileShell`:
  - Serif heading "Refund policy" with tenant accent underline.
  - `<div className="whitespace-pre-wrap">{policyText}</div>`.
  - Footer line: "Declared by {declarantName}, {declarantRole}, {createdAt formatted}".
  - Tenant name + accent in the header bar.

### 5.5 Email templates

`OrderConfirmation.tsx` and `OrderReady.tsx`:

- Add prop `refundPolicyUrl: string | null`.
- Footer block:
  - When `refundPolicyUrl` is non-null: render a link styled with tenant accent — *"Refund policy"* — followed by the existing contact line as backup.
  - When `null`: render only *"Contact {tenantName} for refund policy questions."* (slightly reworded from today's "for refund or exchange questions" so the language matches the route name).

`apps/web/src/lib/email/index.ts` resolves the URL once per send:

```ts
const refundPolicyUrl = tenant.currentLegalVersionId
  ? `${requireAppUrl()}/${tenant.id}/refund-policy`
  : null
```

The route handles both modes (text vs URL) so the email never needs to branch.

## 6. Order snapshot

`POST /api/orders` order insert (in `apps/web/src/app/api/orders/route.ts`) gets one new field on the insert payload:

```ts
legalVersionId: tenant.currentLegalVersionId ?? null,
```

No new validation. We're recording state, not gating on it. If `legal_version_id` is null it means the tenant had no policy at the time of the order — a fact that is itself queryable.

## 7. Flows

### 7.1 First-time policy setup (new tenant)

1. Platform admin completes the 4-step provision wizard (unchanged).
2. New tenant detail page renders with the amber "Refund policy not set" banner.
3. Admin clicks **Add policy**, drawer opens.
4. Admin selects mode, fills text/URL, ticks both acks, types declarant name/role.
5. Save → version v1 inserted, `tenants.currentLegalVersionId` set to v1, banner disappears, LegalCard now shows summary.
6. From this moment forward, every new order writes `legal_version_id = v1`.
7. Confirmation emails for those orders link to `/{tenantId}/refund-policy`.

### 7.2 Policy update

1. Admin opens drawer; it pre-fills with v1 (acks reset to false, requiring re-acknowledgement).
2. Admin edits text, re-ticks acks, clicks Save.
3. Server diff detects change → version v2 inserted, `tenants.currentLegalVersionId` flipped to v2. v1 row preserved.
4. Old orders still reference v1 (queryable for audit). New orders reference v2.
5. `/refund-policy` route always serves the current version (v2). This is intentional — emails always show the policy in force *now*, not the policy at order time. Schools update policies precisely so future-looking parents see the new one.

### 7.3 Mode switch (text → URL or URL → text)

1. Admin opens drawer, switches radio.
2. Other-mode field clears; the now-required field needs filling.
3. Save → new version with new mode. Old version preserved with its mode.
4. Route resolves new mode for parents going forward.

### 7.4 Parent clicks email footer

1. Email footer link resolves to `https://uniformorder.online/{tenantId}/refund-policy`.
2. Route fetches the *current* version (not the order's snapshot — see 7.2 reasoning).
3. Text mode → MobileShell page renders inline.
4. URL mode → 307 redirect to school's own URL.

## 8. Edge cases

| Case | Handling |
|---|---|
| Tenant has no policy when order is placed | `legal_version_id` is null on order; email uses static fallback footer. Both states queryable. |
| Race: admin saves new version mid-checkout | Order writes whatever `tenant.currentLegalVersionId` was at INSERT time. No locking — small window, no parent-visible policy text in checkout today. |
| Mode switch | New version row, old version preserved with its mode. Orders linked to old version still resolve correctly. |
| URL host loop-back to uniformorder.online | Not policed. Chrome catches 302 loops. |
| Re-Save with no changes | Server diff returns `{ ok: true as const }` (no special flag, mirrors `editTenantBranding`). No new version, no PostHog event, no revalidation. Acks come pre-ticked from the prior version — see §5.2. |
| Email link → /refund-policy returns 404 | Theoretically possible if `tenant.currentLegalVersionId` is cleared between order placement and email send. In practice, `lib/email/index.ts` resolves `refundPolicyUrl` from `tenant.currentLegalVersionId` at send time — so if the FK is null, the link is null and the footer falls back to the contact line. The 404 race is not reachable through the email path. |
| URL with non-HTTPS scheme | Rejected by zod refinement. |
| Text policy < 50 chars | Rejected by zod minimum. |
| Tenant deletion | Out of scope — no tenant deletion flow exists today. FK cascade not specified; if/when tenant-delete is built, it'll need to deal with `tenant_legal_versions` and `orders.legal_version_id`. |

## 9. PostHog events

| Event | Properties |
|---|---|
| `tenant_legal_edited` | `tenantId`, `mode`, `version`, `changedFields[]` |
| `tenant_legal_edit_error` | `tenantId`, `message` |

Both fire from the server action via `serverCapture(user.email, eventName, props)` — see §4.3 step 7 for the signature. No client-side events for this surface.

## 10. Testing

No automated tests in this repo (project rule — `pnpm check-types` is the correctness gate).

Manual smoke checklist (to be expanded in the implementation plan):
1. Save first version (text mode) for NSBH; banner disappears, LegalCard renders.
2. Open drawer, change text, re-ack, save → version increments to 2.
3. Switch to URL mode, save → version 3 with mode='url' and policy_text=null.
4. Visit `/nsbh/refund-policy` in URL mode — DevTools Network tab shows status 307 with the `Location` header pointing to the school's `policy_url`. (The page itself won't render — Chrome follows the redirect to the external host.)
5. Switch back to text mode, visit page — confirm inline render.
6. Place a real order against NSBH; confirm `orders.legal_version_id` is set; check confirmation email footer renders the link.
7. Place an order against a tenant with `currentLegalVersionId IS NULL`; confirm fallback footer copy.
8. Try to save with one ack unchecked — Save button stays disabled.
9. Try to save with text policy < 50 chars — zod error surfaces.
10. Try to save with `http://` URL — zod error surfaces.
11. Esc closes drawer; scrim/Cancel/X disabled while pending.
12. `pnpm check-types:web` clean.

## 11. Files touched (estimated)

**New files:**
- `apps/web/drizzle/0010_tenant_legal_versions.sql` (migration — next number after `0009_petite_the_phantom.sql`)
- `apps/web/src/app/platform/tenants/[id]/cards/legal-card.tsx`
- `apps/web/src/app/platform/tenants/[id]/cards/legal-edit-drawer.tsx`
- `apps/web/src/app/[tenant]/refund-policy/page.tsx` (resurrected)

**Modified:**
- `apps/web/src/db/schema.ts` (table + 2 cols + types)
- `apps/web/src/lib/platform/schema.ts` (`tenantLegalSchema`)
- `apps/web/src/app/platform/tenants/[id]/actions.ts` (`editTenantLegal`)
- `apps/web/src/app/platform/tenants/[id]/page.tsx` (banner + render LegalCard)
- `apps/web/src/app/api/orders/route.ts` (snapshot `legal_version_id` on insert)
- `apps/web/src/lib/email/index.ts` (resolve `refundPolicyUrl`)
- `apps/web/src/lib/email/templates/OrderConfirmation.tsx` (footer)
- `apps/web/src/lib/email/templates/OrderReady.tsx` (footer)

Estimated diff: ~600 lines added in new files, ~80–120 LOC modified across the existing files (rough — email templates + action + page render + order INSERT all touch non-trivial chunks).

## 12. Sequencing

This is a single PR. The schema change, action, UI, route, and email update all need to ship together — the new `legal_version_id` column on `orders` is harmless if nothing writes to it, but the email template prop change and the action both require the schema. One coherent commit chain. Implementation plan will break it into ~7–9 commits per the established pattern.
