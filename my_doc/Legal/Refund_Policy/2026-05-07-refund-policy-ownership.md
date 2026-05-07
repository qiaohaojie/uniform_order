# Refund Policy Ownership — Platform vs. Per-Shop

**Date:** 2026-05-07
**Context:** Order Confirmation email originally linked to `/[tenant]/refund-policy` with platform-authored content. Question raised: should the refund policy be centrally set by uniformorder.online, or owned by each school?
**Decision (v1):** Drop the policy link from the email entirely. Replace with inline "contact {school} at {shopEmail}" sentence. Defer per-shop policy capture to the school onboarding flow.

---

## Stripe Connect lens

With Standard/Express connected accounts (the typical setup for marketplaces like ours), each school is the **seller of record**:

- School's name on Stripe receipts and parent's bank statement
- Funds settle to the school's bank account
- School owns chargebacks/disputes — Stripe charges the school the dispute fee directly

Stripe's Connect platform agreement explicitly requires connected accounts to disclose their own refund policy because the legal sales contract is between the parent and the school, not the platform.

If we publish only a platform-wide policy, we're effectively making refund commitments on schools' behalf, which Stripe's TOS flags as a platform risk.

## Common marketplace practice

| Marketplace | Model |
|---|---|
| Etsy, Shopify, eBay | Hybrid — platform baseline, seller-set policy on top |
| Amazon 3P (third-party sellers) | Hybrid with strict platform overrides |
| Amazon 1P (first-party) | Centralized — but only works because Amazon owns inventory and is seller of record |
| Uber Eats | Hybrid — restaurants set rules, Uber enforces minimums |

Pure-centralized only works when the platform actually owns inventory. Pure-decentralized creates inconsistent UX and missing policies. Hybrid is the universal pattern for facilitator marketplaces.

## Business / operational lens

- Schools usually already have a uniform-shop refund policy (printed in their handbook or website).
- A platform-authored policy means:
  - We overwrite their existing policy
  - Onboarding requires their legal sign-off on our specific text
  - Any policy edit becomes a platform-wide release
- Letting schools paste/link their own removes that friction and keeps legal liability where it already sits — with the school.

## Legal lens (Australia)

- **Australian Consumer Law (ACL)** applies regardless of whose policy we publish. Non-excludable consumer guarantees (faulty goods → refund/repair/replacement) override any policy text.
- Refund policy text is therefore mostly about *change-of-mind* refunds, sizing exchanges, time windows.
- ACL has marketplace-operator provisions: if uniformorder.online is seen as more than a "facilitator," we can share liability with the school.
- Making the per-school policy clearly the school's, and our platform terms clearly the platform's, is the cleanest separation of liability.

---

## v1 decision: inline contact, no link, no platform-authored copy

For the launch tenant (NSBH), the order confirmation email's refund footer becomes:

> *For refund or exchange questions, contact {tenantName} at {shopEmail}.*

Rationale:
- **No platform commitments.** We are not authoring refund text under our name. School answers parent questions directly.
- **No content to maintain or defend.** No `/terms` page yet. The `/[tenant]/refund-policy` route is no longer referenced from emails — can be deleted in a follow-up commit (see `docs/remaining_work.md` §3.10).
- **No friction for schools at launch.** No onboarding form to build for v1. Schools don't need to draft or sign anything. They just need a working `shopEmail` on the tenants row (which we already require).
- **Implicitly assigns ownership to the school.** The parent's path to a refund question lands in the school's inbox, not ours.
- **ACL still applies.** Doesn't need to be stated in the email. Consumer guarantees are non-excludable by law — the absence of a policy doesn't waive them.

### Implemented in v1

- ✅ Order Confirmation email: refund-policy link removed; inline `contact {tenantName} at {shopEmail}` sentence added (commit on `worktree-parent-order-detail`).
- ✅ `refundPolicyUrl` prop dropped from `OrderConfirmationEmail`; `shopEmail` threaded from `tenant.shopEmail` via `email/index.ts`.

### Deferred to school onboarding flow (v2)

When we build the school onboarding form (currently tracked under `docs/remaining_work.md` §2.2 — super-admin / platform portal), capture:

1. **Refund policy text or external URL** — paste a textarea OR link to their existing site.
2. **Digital declaration** — "We confirm this refund policy complies with Australian Consumer Law and we accept responsibility for honoring it for purchases via uniformorder.online" — name, role, date.
3. **Seller-of-record acknowledgement** — checkbox confirming the school understands they are the seller of record under Stripe Connect.

Stored on the tenants table (or a `tenant_legal` join table). Versioned. Then v2 can re-introduce a per-tenant policy link in the email pointing to school-authored content with a clear audit trail.

### Deferred indefinitely

- Platform `uniformorder.online/terms` page. Not needed until we have multiple tenants and an actual legal review. No work scheduled.

---

## Reference: alternative hybrid model (not adopted for v1)

Documented for completeness — the standard marketplace pattern most platforms eventually adopt:

1. Add `uniformorder.online/terms` — platform-level Terms of Service covering: ACL applies, school is seller of record, dispute escalation, baseline minimums every school must honor (e.g., faulty-goods returns).
2. Per-tenant `/[tenant]/refund-policy` content authored by the school during onboarding (textarea or external URL), not the platform.
3. Onboarding gate: school agrees to platform terms AND submits their refund policy text/URL before going live. Both stored, both versioned.

We're not doing this for v1 because (a) it adds friction we don't need at launch, (b) we don't yet have multiple tenants whose policies might diverge enough to require it, and (c) the inline-contact approach is strictly safer for the platform pending a real legal review.

The hybrid model remains the proper end-state — re-evaluate when tenant #3 onboards or when a parent dispute escalates beyond a school's ability to resolve directly.
