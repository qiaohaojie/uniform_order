# Code Review Findings — apps/web — 2026-06-13

> **Purpose of this document.** This is a self-contained hand-off brief for an autonomous coding agent (Claude Code, ultracode-driven or otherwise). Each finding below carries everything needed to implement the fix **without asking follow-up questions**: the exact files/lines, why it is a bug, a concrete reproduction, the proposed fix, the project-specific constraints that bound the fix, and acceptance criteria. Read the "Repo invariants" section first — several fixes are wrong if you ignore those constraints (e.g. neon-http has no transactions).
>
> **How these findings were produced.** A multi-agent review fanned out over 8 dimensions of `apps/web`; 6 dimensions completed (Auth/authz, API input-validation, Stripe, Money/totals, Data-layer, Config/secrets/headers). Each finding was then re-read against the actual source by the orchestrator. The adversarial-verification pass and 2 dimensions (Next.js/RSC correctness, general-correctness/dead-code) did **not** run — see "Coverage gaps" at the end; those two dimensions should be re-run.
>
> **Scope discipline.** Do the fixes one at a time, smallest blast radius first. `pnpm check-types:web` is the only correctness gate in this repo (no tests, no linter). Run it after every change. Do **not** bundle a schema migration and an app change in the same commit without verifying the migration applies first (see invariant about drizzle-kit below).

---

## Repo invariants (read before fixing anything)

These come from `CLAUDE.md` and the codebase. Violating one of these will break the app.

1. **No interactive DB transactions.** Data layer is Neon Postgres + Drizzle over the **neon-http** driver. `db.transaction(...)` is **not supported**. Use `db.batch([...])` — it pipelines statements as a single implicit transaction in one HTTP round-trip. A `db.batch` **cannot** reference an earlier statement's `RETURNING` output (no interactive control flow inside the batch). Any "make these two writes atomic" fix must be expressed as a single `db.batch` of independent statements, or as one SQL statement.
2. **Applying migrations is blocked via drizzle-kit in this environment.** `drizzle-kit migrate` hangs (websocket blocker). The working path is: apply the SQL via the Neon MCP `run_sql_transaction`, then manually insert the `__drizzle_migrations` bookkeeping row. Any finding that needs a new index/constraint (e.g. #12) must account for this — write the migration file under `apps/web/drizzle/` **and** apply the SQL out-of-band, then verify.
3. **Money convention is "integer cents", but the current code uses float dollars** end-to-end and only converts to cents at the Stripe boundary (`Math.round(total * 100)`). This is finding #7. Until that migration lands, every money calculation must funnel through `round2()` from `lib/order-totals.ts`. Do not introduce new float-dollar arithmetic without `round2`.
4. **Authorization is email-based.** `lib/auth/authorization.ts`: a tenant operator is whoever's session email equals `tenant.shopEmail` (`ensureTenantAccess`); platform admins are listed in `PLATFORM_ADMIN_EMAILS`; a parent may only read their own data (`ensureParentEmailAccess`, session email equality). `shopEmail` is therefore an **authorization key**, not just contact info — this is why #8 is HIGH.
5. **Deploy target is Hostinger "Cloud Startup" Node.js (`next start` / standalone), NOT Vercel, NOT Cloudflare.** No Edge runtime. There is **no `middleware.ts`** in `apps/web` today. Security headers are set in `next.config.ts` `headers()` (works under `next start`). This matters for #16 (CSP nonce needs middleware) and #17 (client-IP derivation depends on Hostinger's proxy headers).
6. **Production domain is `uniformorder.online`** (TLD `.online`). Web app will live at `app.uniformorder.online`. Ignore any stale `.com.au` references.
7. **The order/payment path is already hardened.** `/api/orders` POST requires a session, binds the order to `parentEmail === session.email`, trusts the Stripe PaymentIntent `amount` as the authoritative total, is idempotent on `stripePaymentIntentId`, and pins `fulfilmentMethod` from PI metadata. Do not "re-add" protections that already exist — read the handler first.

---

## Status summary

| # | Severity | Title | Disposition |
|---|----------|-------|-------------|
| 1 | medium | payment-intent trusted client `currency` | ✅ **FIXED** (this session) |
| 6 | low | cart screen money not 2dp-formatted | ✅ **FIXED** |
| 9 | medium | PI metadata spread let client override `fulfilmentMethod` | ✅ **FIXED** |
| 19 | low | UploadThing cleanup threw on unknown URL shape | ✅ **FIXED** |
| 20 | low | email recipient not format-validated | ✅ **FIXED** (guard in `sendEmail`) |
| 21 | low | dev email log leaked recipient PII | ✅ **FIXED** (masked) |
| 8 | **high** | tenant settings PATCH lets operator rewrite the `shopEmail` authz key | ✅ **RESOLVED** (min-viable; operatorEmail redesign deferred) |
| 4 | medium | `/api/stripe/payment-intent` has no auth / rate limit | ✅ **RESOLVED** |
| 11 | medium | `payment_intent.succeeded` webhook writes status + event non-atomically | ✅ **RESOLVED** (migration 0015 applied to dev) |
| 12 | medium | no DB uniqueness on `catalog_variants(item_id,label)` → mis-priced lines | ⬇ LOG (needs migration) |
| 5 | medium | persisted line prices can diverge from stored order subtotal | ⬇ LOG |
| 9b/10 | low | orders POST PII fields unbounded / unvalidated | ⬇ LOG |
| 16 | medium | CSP `'unsafe-inline'` in `script-src` in prod | ⬇ LOG (needs middleware + nonce) |
| 17 | medium | rate limiter collapses to one global bucket if client IP not derivable | ⬇ LOG (needs Hostinger header verification) |
| 18 | low | auth endpoints have no app-level rate limit | ⬇ LOG |
| 2 | low | `refundedAmountCents` from webhook is charge-local, not DB sum | ⬇ LOG (latent) |
| 3 | low | webhook-reconciled refund emits no operator-attributed audit event | ⬇ LOG (latent) |
| 14 | low | catalog-item editor has an unguarded read-modify-write race | ⬇ LOG (latent) |
| 7 | low | money modelled as float dollars, not integer cents | ⬇ LOG (informational / large refactor) |
| 13 | — | `reorderCatalogItems` partial-failure ordering | ℹ️ NO ACTION (self-healing; comment may be over-pessimistic) |
| 15 | — | `getPopularItems` raw SQL | ℹ️ NO ACTION (parameterized via drizzle `sql` — verified safe) |

**What "FIXED this session" changed** (so you don't redo it):
- `apps/web/src/app/api/stripe/payment-intent/route.ts`: removed `currency` from the client body; pinned `const currency = "aud"`. Reordered PI metadata so server keys (`tenantId`, `stripeAccountId`, `fulfilmentMethod`) are spread **after** client metadata and always win; guarded `clientMetadata` to objects only.
- `apps/web/src/app/[tenant]/cart/cart-screen.tsx`: lines ~114/127/135 now use `.toFixed(2)`.
- `apps/web/src/lib/email/client.ts`: added `EMAIL_RE` recipient validation (returns `null` on malformed `to`) and `maskEmail()` so the dev-mode log and the malformed-recipient log no longer print full addresses.
- `apps/web/src/lib/uploadthing-cleanup.ts`: unknown-URL-shape now warns and returns instead of throwing.

---

## HIGH priority

### #8 — Tenant settings PATCH lets an operator overwrite the `shopEmail` authorization key (account takeover / lockout)

> **✅ RESOLVED (this session, 2026-06-13) — minimum-viable.** `shopEmail` is no longer self-service editable: the PATCH route (`api/tenant/[tenantId]/route.ts`) now zod-validates the body via `PatchSchema` (name/address/shopHours only — `shopEmail` deliberately absent) and 400s on malformed/oversized input; `updateTenantSettings`'s `data` type drops `shopEmail` so it can never be written through that function; the operator settings UI (`settings-client.tsx`) renders the shop-email field read-only/disabled with a "Contact the platform admin to change the shop email" note and stops sending `shopEmail` in the PATCH body. **Deferred (future work):** the recommended `tenants.operatorEmail`-column / `tenant_operators` redesign that fully decouples the authz key from the contact field (migration-bearing, touches every `ensureTenantAccess` call site) — out of scope for this batch.

- **Severity:** high · **Fix-risk:** risky (touches the authz model + operator settings UI) · **Confidence:** high
- **Files:**
  - `apps/web/src/app/api/tenant/[tenantId]/route.ts:30-58` (the PATCH handler)
  - `apps/web/src/db/queries.ts:731-745` (`updateTenantSettings` — does `db.update(tenants).set({ ...data })`)
  - `apps/web/src/lib/auth/authorization.ts:27-33,69-74` (`isTenantOperatorEmail`, `ensureTenantAccess` — the email equality check)
  - `apps/web/src/app/admin/[tenant]/settings/settings-client.tsx:36,81-84,164` (operator UI binds an input to `shopEmail` and PATCHes `{ name, shopEmail, address, shopHours }`)

**What's wrong.** `ensureTenantAccess(user, tenant.shopEmail)` grants operator access iff `normalizeEmail(user.email) === normalizeEmail(tenant.shopEmail)`. The PATCH route reads `{ name, address, shopHours, shopEmail }` straight from `req.json()` with **no validation**, and writes them via `updateTenantSettings`. The access check at the top of PATCH reads the **current** `shopEmail` (before the write), so the caller passes, then rewrites `shopEmail` to anything. The operator settings UI even exposes `shopEmail` as a free-text field.

**Reproduction.**
1. Sign in as the operator of `nsbh` (session email == `nsbh.shopEmail`).
2. `PATCH /api/tenant/nsbh` with body `{"shopEmail":"attacker@evil.test"}`.
3. `ensureTenantAccess` passes (matched the *old* shopEmail). The write succeeds.
4. From now on `ensureTenantAccess` for `nsbh` grants access to whoever controls `attacker@evil.test`, and the original operator is locked out of their own shop's admin.
- Also: `{"shopEmail":"not-an-email"}` is accepted (no format check); `{"name":"<2 MB string>"}` is accepted (columns are unbounded `text`).

**Impact.** A tenant operator can hand operator access to an arbitrary email or lock out the legitimate operator — an access-control-rewrite primitive — plus malformed shop emails (breaking order/shop emails) and unbounded writes.

**Proposed fix (two parts — both required).**
1. **Decouple the authz key from self-service editing.** The cleanest fix is to stop trusting `tenant.shopEmail` as the operator-identity key. Options, in order of preference:
   - **(Recommended)** Introduce a dedicated `tenants.operatorEmail` (or a proper `tenant_operators` join table) that is the authorization key, separate from the customer-facing `shopEmail` contact field. `ensureTenantAccess` checks `operatorEmail`; the self-service settings route may freely edit `shopEmail` (contact) but **never** `operatorEmail`. Changing `operatorEmail` requires `isPlatformAdminEmail` (platform-admin only). This needs a schema migration (see invariant #2 about applying migrations) and an update to `ensureTenantAccess` + every `ensureTenantAccess(user, tenant.shopEmail)` call site (grep: `ensureTenantAccess(` — present in `api/orders/route.ts`, `api/orders/[orderId]/refund/route.ts`, `api/catalog/*`, etc.).
   - **(Minimum viable)** If you must keep `shopEmail` as the key short-term: **remove `shopEmail` from the self-service PATCH route entirely** (drop it from the destructure and from `updateTenantSettings`'s allowed fields), remove the field from `settings-client.tsx`, and add a separate platform-admin-only path (under `app/platform/tenants/[id]/...`) to change it.
2. **Validate the body with zod regardless.** Add input validation to the PATCH route so malformed/oversized values can't be written:
   ```ts
   import { z } from "zod";
   const PatchSchema = z.object({
     name: z.string().trim().min(2).max(120).optional(),
     address: z.string().trim().max(300).nullable().optional(),
     shopHours: z.string().trim().max(200).nullable().optional(),
     // shopEmail intentionally NOT settable here once part 1 lands.
   });
   const parsed = PatchSchema.safeParse(await req.json());
   if (!parsed.success) return NextResponse.json({ error: "Invalid settings", issues: parsed.error.flatten() }, { status: 400 });
   const updated = await updateTenantSettings(tenantId, parsed.data);
   ```
   ⚠️ **Watch the empty-string clear path:** `settings-client.tsx:36` defaults fields to `tenant.x ?? ""`, so an unset address is sent as `""`. If you make a field required/min-length, you'll 400 a legitimate "leave it blank" save. Keep optional fields `.optional()` and allow empty where the UI allows blank (e.g. `address`/`shopHours` `.max(...)` without `.min`).

**Acceptance criteria.** An operator can no longer change the email that grants them access; only a platform admin can. Malformed/oversized settings are rejected with 400. `pnpm check-types:web` passes. The operator settings UI still saves name/address/hours.

---

## MEDIUM priority

### #4 — `POST /api/stripe/payment-intent` has no authentication and no rate limit

> **✅ RESOLVED (this session, 2026-06-13).** Added `requireSessionUser()` + `applyRateLimit(req, "payment-intent:<userId>", { limit: 10, windowMs: 60_000 })` at the very top of `POST` (before `req.json()`), mirroring `/api/orders`. Anonymous callers now get the 401 path and abusive ones 429 before any Stripe/DB work. The checkout page already redirects unauthenticated users to sign-in, so authenticated parents complete checkout unchanged (no UX change). Also stamped `parentUserId` into the server-authoritative PI metadata for defense-in-depth.

- **Severity:** medium · **Fix-risk:** risky (sits on the live checkout path — must confirm the caller is authenticated *before* payment, or you'll break checkout) · **Confidence:** high
- **Files:** `apps/web/src/app/api/stripe/payment-intent/route.ts` (whole `POST` handler) · compare to `apps/web/src/app/api/orders/route.ts:106-115` (the sibling that *does* gate).

**What's wrong.** This is the only mutating/Stripe-touching route that never calls `requireSessionUser()` and never calls `applyRateLimit()`. It validates server-authoritative totals against the catalog and checks tenant readiness, then calls `stripe.paymentIntents.create()` against the tenant's connected account. There is no session check and no `middleware.ts` backstop.

**Reproduction.** Unauthenticated `POST /api/stripe/payment-intent` with a body whose `lines/subtotal/gst` match the live catalog totals → succeeds, minting a real PaymentIntent on the tenant's connected Stripe account. Loop it (no rate limit) → unbounded PI creation; distinct 200 vs 409 responses also let an anon caller enumerate which tenant slugs are approved + charges-enabled.

**Impact.** Unauthenticated resource abuse + tenant-readiness enumeration. **Not** a money/under-payment hole: totals are catalog-validated and `/api/orders` still binds the order to `session.email` and re-checks `pi.status === "succeeded"`, so a foreign/unpaid PI can't become a real order. Severity is medium for that reason.

**Proposed fix.**
1. Add at the top of the handler, mirroring `/api/orders`:
   ```ts
   const authResult = await requireSessionUser();
   if ("response" in authResult) return authResult.response;
   const rl = applyRateLimit(req, `payment-intent:${authResult.user.id}`, { limit: 10, windowMs: 60_000 });
   if (rl) return rl;
   ```
2. **Before merging, verify the checkout flow already has a session at the point it calls this route.** Read `apps/web/src/app/[tenant]/checkout/checkout-screen.tsx` — confirm the parent is signed in before the PaymentElement/PI-creation step (the order step already requires auth, so the user must authenticate at some point; the risk is only if PI creation currently happens *before* the sign-in gate, in which case adding auth here changes the UX and you must move the sign-in gate earlier). If guests can reach payment, coordinate the auth-gate placement rather than just 401-ing them.
3. Optionally stamp `authResult.user.id` into PI metadata and cross-check it in `/api/orders` for defense-in-depth.

**Constraint.** There is no `middleware.ts`; the check must live in the route handler.

**Acceptance criteria.** Anonymous calls get 401; authenticated parents complete checkout unchanged; rapid repeats get 429. `pnpm check-types:web` passes.

---

### #11 — `payment_intent.succeeded` webhook flips order status and writes the `order_paid` event in two non-atomic awaits

> **✅ RESOLVED (this session, 2026-06-13) — migration APPLIED (dev db).** Added a partial unique index `order_events_paid_unique` on `order_events(order_id) WHERE event_type='order_paid'` (`schema.ts` `paidUnique` + `drizzle/0015_order_paid_unique.sql` + `_journal.json` idx 15). The webhook now resolves the order id on BOTH paths — the row flipped this delivery, OR (on redelivery, already `paid`) a `SELECT … WHERE stripePaymentIntentId = pi.id` — and inserts the `order_paid` event **unconditionally** with `.onConflictDoNothing({ target: orderEvents.orderId, where: sql\`event_type='order_paid'\` })`, so a failed-then-redelivered insert backfills the audit event instead of leaving a permanent gap. Confirmation email + `order_confirmed` analytics stay inside the `flipped.length === 1` branch (fire once, never on redelivery). **Apply status:** index created on the DEV Neon db (`ap-southeast-2`), `__drizzle_migrations` bookkeeping row id 17 inserted (`hash="manual_0015_order_paid_unique"`, matching the existing manual-apply convention). Verified `indexdef`: `UNIQUE … (order_id) WHERE (event_type = 'order_paid')`. **Note for prod deploy:** run `drizzle-kit migrate` (or apply 0015 manually) on the production db before this ships — the `onConflictDoNothing` correctness depends on the partial index existing.

- **Severity:** medium · **Fix-risk:** moderate (payment webhook) · **Confidence:** high
- **Files:** `apps/web/src/app/api/stripe/webhook/route.ts:67-93` (the `payment_intent.succeeded` branch).

**What's wrong.** The handler does `db.update(orders).set({paymentStatus:'paid'}).where(paymentStatus='pending').returning()` and then, in a **separate** awaited round-trip, `db.insert(orderEvents).values({eventType:'order_paid', ...})`. The UPDATE is the atomic money-guard (matches only `pending` rows), so the paid state is correct; but the audit event is best-effort. If the process dies or the insert's round-trip fails after the UPDATE commits, the order is `paid` with no `order_paid` event. On Stripe's redelivery, the `UPDATE ... WHERE paymentStatus='pending'` matches 0 rows → the code takes the else branch (just logs "no pending-payment order matched") → the missing event is **never backfilled**. `order_events` is the order-timeline source of truth, so this is a permanent audit gap.

**Reproduction.** (1) PI succeeds, webhook fires. (2) UPDATE commits (→ paid). (3) the `orderEvents` insert round-trip fails (transient neon error / instance recycled). (4) Stripe redelivers. (5) UPDATE matches 0 rows; event never written.

**Impact.** Order timeline permanently missing the `order_paid` transition for that order even though it's paid. Reporting/operator views driven off `order_events` under-count paid transitions. No financial loss.

**Proposed fix.** Make the `order_paid` event insert **idempotent and unconditional** so redelivery backfills it, decoupled from the status flip:
- Add a unique constraint to make the event insert ON-CONFLICT-idempotent, e.g. `CREATE UNIQUE INDEX order_events_paid_unique ON order_events(order_id) WHERE event_type = 'order_paid';` (partial unique index; needs a migration — see invariant #2). Then run the event insert with `.onConflictDoNothing()` on **every** `succeeded` delivery, after resolving the order id from `stripePaymentIntentId` (not only when the flip matched a pending row).
- **Alternative without a migration:** keep the flip as-is, but on the else branch (already-paid), still resolve the order id from the PI and attempt the `order_paid` insert guarded by a `SELECT ... WHERE event_type='order_paid'` existence check before inserting. This narrows but does not fully close the race; prefer the ON CONFLICT approach.
- Note: you **cannot** `db.batch` the UPDATE and the INSERT together using the UPDATE's `RETURNING` id (invariant #1 — batch can't reference prior RETURNING). Resolve the order id with its own lookup, then batch `[update, insert.onConflictDoNothing()]` keyed on that id.

**Acceptance criteria.** After a simulated insert failure + redelivery, the order ends up `paid` **and** has exactly one `order_paid` event. `pnpm check-types:web` passes; migration applied per invariant #2.

---

### #12 — No DB uniqueness on `catalog_variants(item_id, label)`; duplicate active labels silently mis-price order lines

- **Severity:** medium · **Fix-risk:** moderate (needs a migration + dedup of any existing dupes) · **Confidence:** medium
- **Files:** `apps/web/src/db/queries.ts:949-971` (`getCatalogPriceLookup` builds `Map<"itemId::label", price>`), `apps/web/src/app/api/orders/route.ts:359-380` (order-line price snapshot uses `priceLookup.get(priceLookupKey(itemId, variantLabel)) ?? line.unitPrice`), `apps/web/src/db/schema.ts:154-163` (`catalog_variants` — no unique index on `(item_id, label)`).

**What's wrong.** The price lookup keys on `(itemId, label)` but the DB does not enforce that pair unique among active variants. If an operator (or a botched variant-sync save) leaves two active variants on one item with the same label and different prices, the `Map` keeps only the last one scanned. The order-line snapshot and the PI-time totals assertion (which consumes the same lookup) then bind to an arbitrary one of the two prices — not necessarily the one the parent saw.

**Reproduction.** Create two active `catalog_variants` rows on one item with identical `label`, different `price`. Add the item to cart → the PI assertion and the persisted `unitPrice`/`lineTotal` resolve the label to whichever duplicate was scanned last; the receipt price may not match what the parent intended.

**Impact.** Silent money-field corruption on order lines + price verification passing against a price the customer never saw. Low probability (requires duplicate labels) but no error is surfaced.

**Proposed fix.**
- **(Recommended, robust)** Carry `catalog_variants.id` (variantId) through the cart and key the lookup + order lines on the **variant id** rather than the label. This removes the ambiguity entirely. Touches: cart store (`lib/cart-store.ts`), the item/add-to-cart UI, `getCatalogPriceLookup`, `priceLookupKey`, and the order-line writer. Larger change.
- **(Smaller, sufficient)** Add a partial unique index and surface the conflict in the catalog editor:
  ```sql
  CREATE UNIQUE INDEX catalog_variants_item_label_active_unique
    ON catalog_variants (item_id, label) WHERE active = true;
  ```
  Then make `addCatalogItem`/`updateCatalogItem` (`db/queries.ts`) translate a `23505` on this index into a validation error ("duplicate size/label"). **Before applying the index, dedup any existing rows** (query for `(item_id, label)` having `count(*)>1 AND active`) or the index creation fails. Apply the migration per invariant #2.

**Acceptance criteria.** Two active variants with the same label on one item are impossible (or the lookup is variant-id-keyed). `pnpm check-types:web` passes.

---

### #5 — Persisted order line prices can sum to a different number than the stored order subtotal/total

- **Severity:** medium · **Fix-risk:** moderate (changes which price source is persisted on the order-write path) · **Confidence:** high
- **Files:** `apps/web/src/app/api/orders/route.ts:284-302` (totals locked to `stripePI.amount/100`), `:359-380` (line snapshot uses `const unitPrice = catalogPrice ?? line.unitPrice` — the **live** catalog price), `apps/web/src/app/api/stripe/payment-intent/route.ts:67-98` (PI amount was computed from the catalog snapshot *at PI-creation time*).

**What's wrong.** The order `total`/`subtotal` are locked to what Stripe charged (the snapshot at PI-creation time), but each persisted `orderLines.unitPrice` is taken from the **current live catalog** (`catalogPrice ?? line.unitPrice`). If an operator edits a variant price (or renames/deactivates it so the lookup misses and falls back to the stale client value) between PI creation and order POST, the stored line prices won't reconcile with the stored subtotal/total. `Σ lineTotal === subtotal` is never asserted.

**Reproduction.** (1) Parent reaches checkout with item X variant at $30; PI created for $30 (+$9.50 ship). (2) Operator edits X to $35. (3) Parent pays → Stripe charges the original $39.50. (4) `/api/orders`: `subtotal` stored as $30.00, but `orderLines.unitPrice` = $35 (the new price) → `lineTotal` $35. Stored line ($35) ≠ stored subtotal ($30). Receipt/admin detail show inconsistent numbers.

**Impact.** Internally inconsistent stored order — lines don't sum to subtotal/total. Confusing receipts, broken any reconciliation that sums `orderLines`. Customer is charged the correct (original) amount, so no financial loss — data-integrity only.

**Proposed fix (pick one, both keep lines reconciled with the Stripe-locked total).**
- **(Simplest)** Persist each line's `unitPrice` from the **client-supplied `line.unitPrice`** (the snapshot the parent actually saw and that backed the PI), and **drop the live-catalog re-read** for line snapshots. Safe because the *total* is already Stripe-locked, so a tampered per-line price can't change what was charged; and it keeps lines consistent with the captured subtotal.
- **(Defensive)** Keep the catalog re-read but, after building lines, assert `round2(Σ lineTotal) === verifiedTotals.subtotal`; on mismatch, fall back to client line prices (or reject and log) so an inconsistent row is never written.

**Interaction.** This finding and #12 both concern the line-price source; if you implement the variant-id-keyed lookup from #12, prefer option (Simplest) here so the line carries the exact price/variant the parent selected.

**Acceptance criteria.** For an order, `Σ orderLines.lineTotal === orders.subtotal` (within 1c). `pnpm check-types:web` passes.

---

### #16 — CSP allows `'unsafe-inline'` in `script-src` in production

- **Severity:** medium · **Fix-risk:** risky (a naive removal breaks the app; needs middleware + nonce) · **Confidence:** high
- **Files:** `apps/web/next.config.ts:8-18` (`scriptSrc` always includes `'unsafe-inline'`), `:22-31` (CSP assembly), `:51-56` (headers).

**What's wrong.** `scriptSrc` includes `'unsafe-inline'` unconditionally (only `'unsafe-eval'` is dev-gated). Production `script-src` is `'self' 'unsafe-inline' https://js.stripe.com https://connect-js.stripe.com https://*.posthog.com https://us-assets.i.posthog.com`. `'unsafe-inline'` defeats CSP's core protection against injected inline scripts/handlers.

**Current exploitability: LOW.** Grep shows **zero** `dangerouslySetInnerHTML` in the app; React auto-escapes interpolated user content (parentName/studentName/parentNote render as text nodes). There is no known XSS sink today. This is defense-in-depth: if any HTML sink is later introduced, `'unsafe-inline'` removes the safety net.

**Important:** the `'unsafe-inline'` on **`style-src`** (`next.config.ts:27`) is acceptable and should stay — Tailwind/HeroUI inline styles and the inline `style` attributes that thread tenant accent colours require it.

**Proposed fix (nonce-based CSP for scripts).** This requires per-request nonces, which the static `next.config.ts` `headers()` cannot produce. Steps:
1. Add `apps/web/src/middleware.ts` that generates a per-request nonce (`crypto.randomUUID()`/`crypto.getRandomValues`), sets `script-src 'self' 'nonce-<nonce>' https://js.stripe.com ...` (drop `'unsafe-inline'` for scripts in prod), and passes the nonce to the app (Next.js propagates a `nonce` from the request header to framework inline scripts automatically when the CSP header is present on the request). Keep `'unsafe-inline'` for `style-src`.
2. Move the CSP header out of `next.config.ts` into the middleware (keep the other static security headers — HSTS, X-Frame-Options, etc. — where they are or move them too).
3. Verify Stripe.js and PostHog still load (they're allowlisted by origin, not inline, so they should be unaffected) and that the app renders (no blocked framework bootstrap script).
- **Do NOT** simply delete `'unsafe-inline'` from `script-src` in the static config — Next's inline bootstrap scripts would be blocked and the app would break with no nonce in place.
- **Constraint:** deploy target is `next start` standalone on Hostinger (no Edge runtime). `middleware.ts` runs in the Node runtime there; confirm the middleware matcher covers HTML routes but skips static assets.

**If a full nonce rollout is out of scope now:** document this as accepted risk and add a guardrail that no `dangerouslySetInnerHTML`/untrusted-HTML sink is introduced.

**Acceptance criteria.** Prod `script-src` no longer contains `'unsafe-inline'`; pages render; Stripe + PostHog work; `style-src` still has `'unsafe-inline'`.

---

### #17 — Rate limiter degrades to a single shared global bucket when the client IP can't be derived

- **Severity:** medium · **Fix-risk:** moderate (depends on verifying Hostinger's proxy headers — get this wrong and you either trust a spoofable header or keep the bug) · **Confidence:** medium
- **Files:** `apps/web/src/lib/rate-limit.ts:19-35` (`getClientAddress` — only reads `req.ip`, `x-real-ip`, `cf-connecting-ip`; deliberately refuses `x-forwarded-for`), `:43-44` (when address is null, `bucketKey = key` with no IP suffix).

**What's wrong.** On the documented deploy target (Hostinger Node standalone, **not** Cloudflare): `req.ip` is undefined on NextRequest in Next 16 standalone; `cf-connecting-ip` only exists behind Cloudflare; whether Hostinger's reverse proxy sets `x-real-ip` to the `next start` process is unverified. When `getClientAddress()` returns null, anonymous limiters keyed by a static string (`catalog:post:anon`, `parent-children:get:anon`, etc.) collapse into **one global counter** shared by all anonymous clients worldwide. Authenticated buckets keyed by `user.id` are unaffected.

**Reproduction.** Deploy to Hostinger; if the proxy doesn't forward `x-real-ip`, every anon request to e.g. `POST /api/catalog` shares one bucket (limit 60/min globally). One attacker exhausts it → DoS for all other anonymous users.

**Impact.** Anonymous-tier limits become a shared global counter (DoS amplification). Authenticated per-user limits still work. (Also: the limiter is in-memory, so it resets on cold start and isn't shared across instances — already noted in the file's own comment.)

**Proposed fix.**
1. **Verify which header Hostinger's proxy sets** for the upstream client IP (almost certainly `x-forwarded-for`). The app sits behind exactly one trusted reverse proxy, so trusting the **last** entry of `x-forwarded-for` (the hop the trusted proxy appended) is the standard, safe pattern. Update `getClientAddress()` to parse `x-forwarded-for` (last hop) when present. The current blanket refusal throws away the only header that will actually be populated.
2. **Fail closed when no IP can be derived** for anon buckets: reject, or use a much tighter shared limit, instead of silently sharing one generous global bucket.
3. **Longer term:** move to Upstash/Redis (the file comment already suggests this) so limits survive restarts and span instances.

**Constraint:** Do not trust the *first* `x-forwarded-for` entry (client-spoofable). Trust only the last hop, and only because there is exactly one trusted proxy in front.

**Acceptance criteria.** On Hostinger, two different anonymous clients get independent rate-limit budgets. `pnpm check-types:web` passes.

---

## LOW priority

### #10 — Orders POST writes parent/student PII with truthiness-only checks (no length/format bounds)

- **Severity:** low · **Fix-risk:** moderate (on the checkout path — overly tight caps reject legit orders) · **Confidence:** high
- **Files:** `apps/web/src/app/api/orders/route.ts:118-163` (destructure + truthiness checks), `:335-380` (writes to DB), `apps/web/src/db/schema.ts:174-180,246-247` (unbounded `text` columns).

**What's wrong.** `/api/orders` validates only that `parentName/parentEmail/parentMobile/studentName/studentYear/studentRoll` are truthy, then writes them (and each line's `itemName`/`variantLabel`/`size`) verbatim into unbounded `text` columns. `parentMobile` isn't format-checked; `studentYear` is free-form (unlike `/api/parent/children`, which constrains year to 7..12). **Money is not exploitable here** — total is Stripe-locked and `qty`/`unitPrice` *are* validated (route.ts:204-208).

**Reproduction.** With a valid succeeded PI for your own session, `POST /api/orders` with `parentName` = a multi-MB string, `studentYear:'99 DROP'`, `lines:[{ itemName:'<10KB>', ... }]`. The string fields pass and are persisted unbounded.

**Impact.** Unbounded writes (storage bloat, oversized confirmation emails / printed picking slips) and malformed PII in order records + downstream email/report surfaces. No injection (Drizzle parameterizes), no financial impact → low.

**Proposed fix.** Add a zod schema for the order body mirroring existing patterns, e.g.:
```ts
const OrderLine = z.object({
  itemId: z.string().min(1), itemName: z.string().trim().min(1).max(200),
  variantLabel: z.string().trim().min(1).max(120), size: z.string().trim().max(60).nullish(),
  qty: z.number().int().positive(), unitPrice: z.number().finite().nonnegative(),
});
const OrderBody = z.object({
  parentName: z.string().trim().min(1).max(120),
  parentEmail: z.string().trim().toLowerCase().email(),
  parentMobile: z.string().trim().min(6).max(20),   // keep generous; AU mobiles vary in formatting
  studentName: z.string().trim().min(1).max(120),
  studentYear: z.string().trim().min(1).max(20),     // or align to ALLOWED_YEARS from parent/children
  studentRoll: z.string().trim().min(1).max(40),
  lines: z.array(OrderLine).min(1),
  // ...keep the rest (subtotal/gst/total/stripePaymentIntentId/refundPolicyAccepted/parentNote) as already validated
});
```
**⚠️ Keep caps generous** and don't tighten `parentMobile`/`studentYear` formats beyond what real users submit — this is the live checkout path, and a too-strict rule rejects valid orders. Prefer length bounds over format regexes. Money handling stays exactly as is (Stripe-locked total).

**Acceptance criteria.** Oversized/empty PII fields → 400; a normal order still succeeds end-to-end. `pnpm check-types:web` passes.

---

### #18 — Auth endpoints have no application-level rate limiting

- **Severity:** low · **Fix-risk:** moderate · **Confidence:** medium
- **Files:** `apps/web/src/app/api/auth/[...path]/route.ts:6-12` (delegates wholly to `getAuth().handler()`; no `applyRateLimit`).

**What's wrong.** The auth catch-all (sign-in, sign-up, password, OAuth callbacks) has no app-level throttle. Brute-force/credential-stuffing protection relies entirely on whatever `@neondatabase/auth-ui` / better-auth enforces, which isn't asserted here.

**Proposed fix.** Either (a) confirm + document that the Neon Auth backend throttles login and accept the risk, or (b) front the sign-in/sign-up sub-paths with a per-IP limiter (depends on the #17 IP-derivation fix). Given the in-memory limiter's weaknesses, a WAF/proxy-level rate limit on `/api/auth` is the more robust placement on Hostinger.

**Acceptance criteria.** Documented decision; if implemented, repeated failed logins from one IP get throttled.

---

### #2 — `refundedAmountCents` written by the `charge.refunded` webhook is charge-local, not the DB sum (latent)

- **Severity:** low · **Fix-risk:** moderate · **Confidence:** medium
- **Files:** `apps/web/src/app/api/stripe/webhook/route.ts:235` (`newRefundedCents = refunds.reduce(...)` over *this charge's* refunds), `:249` (writes it to `orders.refundedAmountCents`), `apps/web/src/app/api/orders/[orderId]/refund/route.ts:162-165` (the API path instead recomputes from the DB via `getTotalRefunded`).

**What's wrong.** The webhook derives `refundedAmountCents` (and `paymentStatus`) from the charge-local `charge.refunds` list, not the authoritative `order_refunds` DB sum. For the current **single-PI-per-order** design these agree (Stripe accumulates a charge's refunds). It only diverges under a future **multi-charge/multi-PI order** model or if refund rows are inserted by another path — then the webhook could clobber `refundedAmountCents` below the true total and flip a fully-refunded order back to `partially_refunded`.

**Proposed fix.** After the `ON CONFLICT DO NOTHING` insert of refund rows in the webhook, recompute the refunded total from the DB (`getTotalRefunded` / `SUM(order_refunds.amount)`) — the same source the API route uses — and derive `refundedAmountCents` + `paymentStatus` from that. Makes both writers agree on one authoritative source.

**Status.** Latent (not currently reachable in the single-PI design). Fix when/if multi-charge orders are introduced, or proactively for robustness.

---

### #3 — Webhook-reconciled refund emits no operator-attributed audit event (acknowledged in code)

- **Severity:** low · **Fix-risk:** moderate · **Confidence:** high
- **Files:** `apps/web/src/app/api/orders/[orderId]/refund/route.ts:235-240` (skips audit log on the `reconcilePending` path; comment documents the gap), `apps/web/src/app/api/stripe/webhook/route.ts:307-321` (`charge.refunded` logs `order.refunded.via_dashboard` as actor `stripe-webhook`).

**What's wrong.** When an operator-initiated refund succeeds in Stripe but the DB insert fails (the rare `reconcilePending` path), the route deliberately skips the `order.refund_issued` audit event. The `charge.refunded` webhook later reconciles the refund row but logs it as a system/dashboard event, so the operator's action isn't attributed to them. Correctly flagged as a known follow-up; no financial impact (refund still happens exactly once).

**Proposed fix.** The API route stamps `orderId/tenantId/lineId/reason` into the Stripe refund `metadata`. In the `charge.refunded` webhook, when that metadata is present, emit an `order.refund_issued` audit event attributed to the originating operator (distinguish API refunds — metadata present — from true dashboard refunds — no metadata).

---

### #14 — Catalog-item editor has an unguarded read-modify-write race (latent; single-operator-safe)

- **Severity:** low · **Fix-risk:** moderate · **Confidence:** high
- **Files:** `apps/web/src/db/queries.ts:625-672` (`updateCatalogItem` reads existing variant ids, then issues update/insert/delete in a batch with no concurrency guard; in-file comment 600-604 accepts this for a 1–2 ops/tenant editor). Contrast with the *guarded* legal-version path: `queries.ts:1134-1140` + `app/platform/tenants/[id]/actions.ts:174-207` (retries on unique-constraint — correctly handled, **no action**).

**What's wrong.** Under truly concurrent edits to the **same** catalog item, the delete/insert set computed from a stale read can resurrect a row another editor deleted or drop a row another editor added — end state is a merge of two stale reads. Single-operator usage (the documented norm) is unaffected.

**Proposed fix.** Optimistic concurrency: include `catalogItems.updatedAt` in the UPDATE where-clause (`where(and(eq(id, ...), eq(updatedAt, readVersion)))`); treat a 0-row update as a conflict the caller must re-read + retry. **Note (invariant #1):** `db.batch` alone does **not** fix this — the stale read happened in a prior round-trip; the where-clause version check is the only way to detect the lost update without interactive transactions.

**Status.** Latent; fix only if concurrent catalog editing becomes a real usage pattern.

---

### #7 — Money is modelled as floating-point dollars, not integer cents (informational / large refactor)

- **Severity:** low (informational) · **Fix-risk:** risky (large, cross-cutting) · **Confidence:** high
- **Files:** `apps/web/src/lib/order-totals.ts:28-66`, `apps/web/src/lib/data.ts:347-349`, `apps/web/src/lib/shipping.ts:3`, `apps/web/src/app/api/orders/route.ts:284-302`, and the cents conversion at `apps/web/src/app/api/stripe/payment-intent/route.ts:98`.

**What's wrong.** The project convention is integer cents, but the pipeline uses float dollars throughout, converting to cents only at the Stripe boundary. The reviewer **verified by exhaustive sweep** that with the current value ranges and the clean `$9.50` flat shipping fee, the `round2`-based math does **not** drift today (0 mischarges in 2,000,000 cases; client unrounded GST stays within the 1c assertion tolerance). So this is **not** an active bug — it's a latent class of risk: every new money calc must remember `round2`, and any future non-clean fee (e.g. a percentage fee, or per-tenant shipping like `$4.95`), or a tolerance tightened below 1c, can reintroduce sub-cent drift silently.

**Proposed fix.** Migrate the money pipeline to integer cents: store/compute `priceCents`, `subtotalCents`, `shippingCents`, `totalCents`, `gstCents` as integers; format to dollars only at the display edge. Removes the scattered `round2` calls and the 1c tolerances. **Large** change touching schema, queries, the totals helper, and both Stripe/orders routes — sequence it deliberately behind any existing cents-migration item in `docs/remaining_work.md`. Until then, honour invariant #3 (always `round2`).

---

## NO ACTION (verified non-issues — recorded so they aren't re-flagged)

- **#13 — `reorderCatalogItems` (queries.ts:684-697)** issues N `UPDATE`s in a `db.batch`. The in-file comment is pessimistic; on the installed `@neondatabase/serverless`, `db.batch` runs as an implicit transaction, so the statements commit/rollback together. Worst case is a temporarily non-dense `sortOrder`, self-healing on the next reorder. *Optional polish:* collapse to a single `UPDATE ... SET sort_order = CASE id ... END WHERE tenant_id = $t` for guaranteed single-statement atomicity, and correct the comment. No functional change required.
- **#15 — `getPopularItems` (queries.ts:1155-1177)** uses `db.execute(sql\`... WHERE o.tenant_id = ${tenantSlug} ...\`)`. Drizzle's `sql` tagged template parameterizes every `${}` as a bound placeholder, so the route-derived `tenantSlug` is **not** an injection vector. The query is correctly tenant-scoped and excludes pending/refunded. Keep all future raw SQL inside drizzle `sql` (never string concatenation) to preserve this.

---

## Coverage gaps (re-run when the session limit resets)

The review ran 6 of 8 planned dimensions. Two did **not** execute (account session limit) and should be re-run for completeness:

1. **Next.js 16 / RSC correctness** — `params`/`searchParams` awaited correctly (Next 16 Promises), server-only secrets not imported into `"use client"` components, `revalidatePath`/`revalidateTag` after mutations, server-action auth re-checks, `error.tsx`/`not-found.tsx` gaps, hydration/`localStorage`-during-SSR, accidental static caching of authed data.
2. **General correctness / error-handling / dead-code** — `lib/order-store.ts`, `lib/email/dispatch.ts` + `index.ts` (idempotency / send-before-commit / double-send), `lib/audit/*`, `lib/active-child.*`, `lib/admin-data.ts`, `components/export-orders-button.tsx`, `app/admin/[tenant]/orders/csv.ts` (**CSV formula injection** — cells starting with `= + - @` — is specifically worth checking), swallowed errors, type-safety holes.

Suggested re-run: an ultracode workflow with just these two review dimensions + the adversarial-verification pass that didn't get to run this time, classifying each finding auto-safe vs log-human exactly as above. The 6 completed dimensions do **not** need re-running; their findings are fully captured in this document.

---

*Generated from a multi-agent review (6/8 dimensions) on 2026-06-13; findings re-verified against source by the orchestrator. The 6 "FIXED" items are already applied to the working tree and pass `pnpm check-types:web`.*
