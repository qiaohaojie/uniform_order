# Requirement — Platform Approval Gate for Connected Tenants

**Project:** Uniform Online Order System
**Author:** Engineering
**Date:** 6 May 2026
**Severity:** 🔴 Blocker (compliance — Stripe Connect Platform Agreement)
**Related:** [remaining_work.md §1.7](./remaining_work.md), [FEATURE_AUDIT.md](./FEATURE_AUDIT.md), Stripe Connect "Platform"-liability acknowledgement

---

## 1. Background

When provisioning the platform's Stripe Connect account, we accepted **Platform** liability for refunds, chargebacks, and seller compliance. Stripe's Connect Platform Agreement explicitly requires that we:

> "review each seller to ensure they're not operating in a restricted business category or selling restricted products."

Today, the moment a uniform shop completes Stripe Express onboarding, the `tenants.stripe_charges_enabled` flag flips to `true` (via the `account.updated` webhook, when implemented in §2.3) and the tenant becomes immediately able to take live payments through `POST /api/stripe/payment-intent`.

This means an un-vetted shop could take real parent money before any human at the platform has confirmed:

- The shop is a legitimate uniform retailer (and not selling something else under that account).
- The shop is not on Stripe's [restricted businesses](https://stripe.com/legal/restricted-businesses) list.
- The school has actually nominated this shop as their supplier.

Without an explicit human-approval step we are in breach of the Stripe Connect Platform Agreement and exposed to chargeback / fines liability we have already accepted.

---

## 2. Goal

Introduce a **platform approval gate** — a separate, human-driven approval state on each tenant — that must be `approved` before any `PaymentIntent` can be created for that tenant, regardless of what Stripe reports about the connected account's readiness.

Stripe-readiness (`stripe_charges_enabled`) and platform-approval are **independent prerequisites**; both must be `true` for live payments.

---

## 3. Functional requirements

### 3.1 Schema — `tenants` table additions

Add the following columns to `tenants` in [src/db/schema.ts](file:///Volumes/T7/georgeqiao/dev/uniform_order/apps/web/src/db/schema.ts):

| Column | Type | Default | Notes |
|---|---|---|---|
| `platform_approval_status` | `text` (`"pending" \| "approved" \| "rejected"`) | `"pending"` | Authoritative gate |
| `platform_approved_at` | `timestamp` | `NULL` | Set when status flips to `approved` |
| `platform_approved_by` | `text` | `NULL` | Email of the super-admin who approved |
| `platform_rejection_reason` | `text` | `NULL` | Required when status is `rejected`; surfaced to the shop |

A Drizzle migration must be added (this also covers item §4.8 in `remaining_work.md` — migrations checked into the repo).

### 3.2 Payment intent gate

In [api/stripe/payment-intent/route.ts](file:///Volumes/T7/georgeqiao/dev/uniform_order/apps/web/src/app/api/stripe/payment-intent/route.ts), reject creation when `tenant.platform_approval_status !== "approved"`:

```ts
if (tenant.platformApprovalStatus !== "approved") {
  return NextResponse.json(
    { error: "Tenant not yet approved by platform" },
    { status: 409 }
  );
}
```

This check sits **alongside** the existing `stripeChargesEnabled` check, not in place of it.

### 3.3 Super-admin approval surface

A new super-admin section is required (separate from the per-school admin at `/admin/[tenant]`).

**Route:** `app/super-admin/tenants/page.tsx` (or `/platform/tenants` if super-admin work in §2.2 lands first).

**Access control:** restricted to a hard-coded platform-admin email allowlist (`PLATFORM_ADMIN_EMAILS` env var) until full RBAC lands.

**Tenant review queue must show, per pending tenant:**

- School / tenant name and slug.
- Shop legal name (pulled from Stripe `account.business_profile.name`).
- Shop email and primary contact.
- MCC, country, and business type (from Stripe `account`).
- Deep link to the connected account in the Stripe Dashboard.
- Current Stripe readiness flags (`charges_enabled`, `payouts_enabled`, `details_submitted`).
- Free-text notes field (operator-only).

**Actions:**

- **Approve** → `PATCH /api/super-admin/tenants/[tenantId]/approval` with `{ status: "approved" }`. Writes `platform_approved_at = now()`, `platform_approved_by = currentUser.email`, clears `platform_rejection_reason`.
- **Reject** → same route with `{ status: "rejected", reason: "..." }`. Reason is mandatory and ≤ 500 chars.
- **Re-open / mark pending** → reverts to `pending` (e.g. when re-reviewing after the shop fixed an issue).

All transitions are logged (operator email + timestamp + previous status) — a lightweight `tenant_approval_audit` table is acceptable, or rely on a structured log line if a full audit-log table is deferred.

### 3.4 Shop-facing status banner

In the per-tenant admin (settings page, and a persistent banner across `/admin/[tenant]/*` until resolved), surface the current platform approval state to the shop:

- `pending` → *"Pending platform review — your store cannot accept live payments yet. We'll email you once approved."*
- `approved` → no banner needed (or a subtle ✓ badge in settings).
- `rejected` → *"Your account was not approved: {reason}. Contact support to resolve."*

This prevents shops from being confused by the situation where Stripe says "ready" but the platform still blocks payments.

### 3.5 Webhook interaction

When the `account.updated` Stripe webhook handler is implemented (§2.3 in `remaining_work.md`):

- It updates `stripe_charges_enabled` / `stripe_payouts_enabled` only.
- It must **not** auto-approve the platform gate.
- If a tenant is currently `approved` and Stripe later reports the account is no longer in good standing (e.g. `requirements.disabled_reason` becomes set), revert `platform_approval_status` to `pending` and notify the platform admin.

---

## 4. Non-functional requirements

- **Backwards compatibility:** existing seeded tenants (NSBH, RGSH) should be back-filled as `approved` in the migration so live-data flows in dev are not broken. Production deploy must run the migration before live cutover.
- **Auditability:** every status transition must be attributable to a real user; system-driven reverts (per §3.5) should be logged as `system`.
- **Idempotency:** approving an already-approved tenant is a no-op (200 OK), not a 409.
- **Rate limit / authn:** super-admin route is gated by session + allowlist; rate-limit consistent with the rest of the admin API.

---

## 5. Out of scope

- Full RBAC for multiple platform-admin users with granular permissions (single allowlist suffices for v1).
- Automated risk scoring or document review (manual review only).
- Periodic re-review cadence (will be revisited once we onboard >5 schools).

---

## 6. Acceptance criteria

1. A newly-onboarded tenant with `stripe_charges_enabled = true` is **rejected** by `POST /api/stripe/payment-intent` with HTTP 409 until a platform admin approves it.
2. Once approved, the same tenant successfully creates a `PaymentIntent` end-to-end.
3. The shop sees a clear status banner in their admin reflecting all three states.
4. Rejection writes a reason and the shop sees it.
5. The migration backfills existing tenants as `approved` and a fresh dev `db push` produces a working stack.
6. Super-admin route is unreachable to non-allowlisted users (returns 403).
7. Approval / rejection events are persisted with operator identity and timestamp.

---

## 7. Effort estimate

~½ engineering day:

- Schema + migration: 30 min
- API gate + super-admin route: 1 hr
- Super-admin UI (list + approve/reject): 2 hr
- Shop-facing banner + settings surface: 1 hr
- Tests + manual end-to-end check: 1 hr
