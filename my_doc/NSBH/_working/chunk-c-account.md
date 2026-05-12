# Chunk C — Account, multi-child support, parent self-service, communication

**Scope:** account/login friction, multi-child support, order history, saved sizes, address/payment save, contact channels, FAQ/help, transactional comms, password recovery, privacy/data deletion. **Out of scope** (handled in other chunks): catalog/PDP/search, checkout/payments, brand/IA/operator console.

**Target site:** stock Shopify Horizon theme on `north-sydney-boys-uniform-shop.myshopify.com`. Customer accounts use Shopify's "new customer accounts" (passwordless email OTP via `/customer_authentication/redirect`). No FAQ, no /pages/contact, no help link, no chat (per `recon-target.md` §2 "Help / FAQ / Contact" and §1 "Footer (parsed)").

**Codebase:** Next.js 16 App Router on Neon, Drizzle ORM. Auth via Neon Auth (Better Auth). Parent account UX lives in `app/page.tsx` → `app/home-client.tsx`, plus `app/orders/`.

## Capability matrix

| Capability | Target (NSBH Shopify) | Uniform Order | Verdict |
|---|---|---|---|
| Login method | Email OTP (passwordless) | Email + password (Neon Auth) | **Target ahead** on friction |
| Sign-up form | None — OTP-only | Standard email/password + verification | Target ahead on simplicity |
| Multi-child / saved students | None | Full CRUD (`parent_children`, home picker, add/edit/remove modal) | **UO ahead** (huge) |
| Order history | Standard Shopify | `app/orders/` — cross-tenant (parent's orders across schools) | **UO ahead** (cross-tenant native) |
| Saved sizes | None | `getPreviousSizeHint()` from order history → PDP hint | **UO ahead** |
| Address save | None (Shop Pay handles) | None | Parity (we don't save) |
| Payment-method save | Shop Pay (1-tap) | None | Target ahead |
| Contact channel | **None on site** | School `shopEmail` surfaced as `mailto:` on order detail | **UO ahead** |
| FAQ / help centre | None | None | Tie (both miss) |
| Transactional email | Shopify default (confirmation + status) | Emailit-wired: confirmation + ready-for-pickup, idempotent stamps | Parity, UO is custom-branded |
| Password reset | OTP makes this moot | Neon Auth reset flow | Target ahead on friction |
| Account deletion / data export | Shopify admin GDPR workflow | None visible to parent | Target ahead |

---

## 1. Account model & login

**What it is.** Target sends every account intent to `/customer_authentication/redirect?…` (Shopify "new customer accounts"). Email-only — Shopify emails a 6-digit code; one-tap login. UO uses Neon Auth's built-in `AuthView` (`apps/web/src/app/auth/[[...path]]/page-client.tsx:1`), which provides email+password sign-up, email verification, and password reset.

**Why it matters.** Parents log in once or twice a year (uniform season). They will forget any password they set in February by November. OTP eliminates that.

**Current state in UO.** `app/auth/[[...path]]/page-client.tsx` renders `<NeonAuthUIProvider>` → `<AuthView path={…}>`. Session resolved server-side via `getSessionUser()` (`apps/web/src/lib/auth/authorization.ts:35`). Public sign-up is open. Email verification + password reset present.

**Gap.** Higher friction than target (one extra cognitive step: remember/reset password).

**Mitigation.** Check whether Neon Auth `AuthView` supports a magic-link or email-OTP view path; if so flip the default. Otherwise add "email me a sign-in link" as a secondary action. Workaround that costs little: pre-fill checkout student data from `parent_children` so a logged-out parent doesn't *need* to log in to buy, only to save children — which we already do.

**Impact.** Medium. Friction matters most at re-engagement (Year 9 parent comes back for Year 10 kit).

**Priority.** **Should** (post-launch). Not a go-live blocker — Neon Auth's reset flow works.

---

## 2. Multi-child / saved students

**What it is.** Persisted "my children" list per parent — name, year, roll class, school. Tap one and the catalog/cart/checkout pre-fills for that student.

**Why it matters.** A typical parent has 1–3 kids, often at different schools, and re-orders every term. Re-typing student details is the biggest paper-form pain point this app digitises.

**Current state in UO.** Fully shipped:
- Table `parent_children` (`apps/web/src/db/schema.ts:218`) — `parentId` FK to Neon Auth users, tenant-scoped, `lastConfirmedAt` for year-rollover prompts.
- Home picker `app/home-client.tsx` — lists children with school accent, "is this still you?" year-confirm CTA, edit/remove buttons, dashed "Add another child" tile.
- `ChildFormModal` for create/edit (`app/child-form-modal.tsx` per imports at `home-client.tsx:11`).
- Active-child cookie via `setActiveChildCookieClient` (`lib/active-child.client.ts:10`), read server-side by `getActiveChild()` (`lib/active-child.server.ts:25`).
- Consumed by `app/[tenant]/page.tsx:40`, `app/[tenant]/cart/page.tsx:12`, `app/[tenant]/checkout/page.tsx:13`.
- REST routes `/api/parent/children/:id` (DELETE + PATCH) and `/api/parent/children/:id/confirm` (POST).

**Gap.** None vs target — target has nothing. Internal recon note "not fully integrated into checkout/onboarding UX" appears stale: checkout already reads active child.

**Mitigation.** Polish, not gap-filling. Consider surfacing a child-switcher chip *inside* `MobileShell` header so parents can flip mid-shop without bouncing home.

**Impact.** High. Single largest differentiator vs target.

**Priority.** **Already shipped.** Marketing copy should lead with this.

---

## 3. Order history

**What it is.** "My orders" list + drill-in to receipt, status, contact-school link.

**Why it matters.** Re-order, returns reference, and "did I pay?" reassurance.

**Current state in UO.** `app/orders/page.tsx` is auth-gated, redirects to `/auth/sign-in?callbackURL=%2Forders` if logged out. Crucially, `listOrdersForParent({ userId, email })` (`db/queries.ts`) joins on `orders.userId` OR `orders.parentEmail` and returns rows from **every tenant** that parent has bought from, with tenant name/short/accent attached — i.e. cross-school history in one list. Detail page (`app/orders/[orderId]/page.tsx:1`) is access-controlled by `ensureParentEmailAccess` (defense-in-depth on top of `userId`). Renders refunds, totals, status, and at line 302 a `mailto:{shopEmail}` link.

**Gap vs target.** Target's Shopify account shows orders for the one store the parent logged into. UO is cross-tenant out of the box — a parent with kids at two schools sees both order streams under one login.

**Mitigation.** None needed.

**Impact.** Medium-high once we have ≥2 tenants live (NSBH + RGSH already).

**Priority.** **Already shipped.** Worth a marketing line.

---

## 4. Saved sizes / size memory

**What it is.** "Riley wore size 14 last year — order again?" hint on the PDP.

**Why it matters.** Sizing is the #1 uncertainty parents face online. A reliable previous-size pointer is worth more than a size chart.

**Current state in UO.** `getPreviousSizeHint(tenantId, email, itemId)` in `db/queries.ts:427`, exposed via `GET /api/orders/size-hint` (`app/api/orders/size-hint/route.ts:37`). Per recon-app, the PDP already integrates the hint. Today it keys on `parentEmail + itemId` — so if the parent has two kids, the hint surfaces "whichever child bought this last." It does **not** key on the active child's identity, which is a minor correctness gap when one parent has multiple kids at the same school.

**Gap vs target.** Target: nothing. UO: real.

**Mitigation.** Pass `activeChildId` to `getPreviousSizeHint` and join on order's `studentName` (or migrate orders to carry `childId` FK — already half-there given `parent_children` exists). Trivial follow-up.

**Impact.** High at PDP — directly reduces returns risk.

**Priority.** **Already shipped** (Should-do refinement: scope by child).

---

## 5. Address / payment-method save

**What it is.** Saved shipping addresses and saved cards/wallets.

**Why it matters.** Repeat checkout speed.

**Current state in UO.** None. Stripe PaymentIntent is created per-order with no Customer reuse. No address book.

**Gap.** Target has Shop Pay (1-tap card + address). We don't.

**Mitigation.** (a) Target is collection-only (per recon-target §2 "Policies") so address-save isn't relevant to the dominant flow. (b) For payment, we can attach a Stripe `Customer` to the Neon Auth user the first time they pay and reuse `setup_future_usage` — but this is multi-tenant via Connect destination charges, which complicates a shared Customer. Park until volume justifies it.

**Impact.** Low (collection-only dominant flow).

**Priority.** **Nice-to-have.**

---

## 6. Contact channel

**What it is.** A way for parents to reach the uniform shop with questions ("does the blazer come back next month?", "I picked up the wrong size").

**Why it matters.** Trust + dispute deflection. A school selling uniforms without a contact line looks abandoned.

**Current state on target.** Per `recon-target.md` §2 "Help / FAQ / Contact": no `/pages/contact`, no chat widget, no email link in the footer. **Zero contact surface.** Massive gap on their side.

**Current state in UO.** `tenants.shopEmail` is set during platform onboarding (`app/platform/tenants/new/steps/step-3-operator.tsx`) and validated as a go-live requirement. Surfacing today:
- `app/orders/[orderId]/order-detail-client.tsx:302` — `mailto:{shopEmail}` link with a pre-populated subject. **Good.**
- `app/[tenant]/checkout/checkout-screen.tsx:522` — shown in checkout if it contains `@`.
- **Not** surfaced on the catalog (`app/[tenant]/page.tsx`), PDP, or cart pages. A parent who hasn't ordered yet has no way to ask "do you have size 18?".

**Gap.** UO is ahead of target but under-leveraging its own data. Add the school's `shopEmail` to the tenant header (or a "Contact this shop" entry on the bottom nav / footer) so it's reachable pre-purchase.

**Mitigation.** One-line addition: render `shopEmail` (and `shopHours` if present) as a tappable `mailto:` block in `MobileShell` footer or on the catalog page header.

**Impact.** High. Cheap win that strengthens the trust gap vs target.

**Priority.** **Should** (pre-launch, ~1hr).

---

## 7. FAQ / help

**What it is.** Self-serve answers: "when does my order arrive?", "can I exchange?", "what size is my Year 7?".

**Why it matters.** Deflects operator email volume, especially in Term 1.

**Current state on target.** None. (recon-target §2 "Help / FAQ / Contact".)

**Current state in UO.** None. `app/privacy/` and `app/terms/` exist; no `app/faq/` or `app/help/`.

**Gap.** Both miss. Refund policy is per-tenant via `tenant_legal_versions` so it's already covered for the "can I return?" question.

**Mitigation.** Sized FAQ markdown rendered from `tenants.legalFaqMd` (new optional column) OR a single platform-wide static page seeded with: shipping, returns, sizing approach, payment security, how to add another child, how to view past orders. Avoid building a CMS.

**Impact.** Medium. Operators benefit most.

**Priority.** **Nice-to-have** (post-launch). Not differentiating since target has none either.

---

## 8. Notifications & comms to parent

**What it is.** Transactional email on order placed and "ready for pickup."

**Why it matters.** Without confirmation, the parent doubts payment went through and emails the school. Without pickup notification, they show up at the wrong time.

**Current state in UO.** **Fully wired** (recon was stale):
- Provider: **Emailit** via `lib/email/client.ts:1` — Bearer-auth REST API, 5s serverless timeout, 4xx-no-retry / 5xx-throw policy. From-address `Uniform Online <noreply@uniformorder.online>`.
- Templates: `lib/email/templates/OrderConfirmation.tsx`, `lib/email/templates/OrderReady.tsx` — `@react-email/components`.
- Senders: `sendOrderConfirmationEmail` (called from `api/orders/route.ts:291` AND `api/stripe/webhook/route.ts:77`, double-trigger with idempotency via `emailsSent` stamp on the order), `sendOrderReadyEmail` (`api/orders/[orderId]/route.ts:112`).
- Dev fallback: missing `EMAILIT_API_KEY` logs to console and returns `dev-mode-id` — safe local default.

**Gap.** None functional. Note: requires `EMAILIT_API_KEY` env var on Hostinger before go-live or emails silently console-log.

**Mitigation.** Add a go-live checklist item: confirm `EMAILIT_API_KEY` is set in hPanel Node.js env + DNS for `uniformorder.online` (SPF/DKIM) is configured at Emailit.

**Impact.** Critical for go-live UX.

**Priority.** **Must** verify env var and DNS pre-launch. Code is done.

---

## 9. Password reset / account recovery

**What it is.** "I forgot my password" flow.

**Why it matters.** Annual users will always forget.

**Current state in UO.** Neon Auth `AuthView` ships a reset path. No customisation.

**Gap vs target.** Target's OTP makes reset unnecessary — superior.

**Mitigation.** Same as §1: flip to magic-link / OTP if Neon Auth offers it.

**Impact.** Medium.

**Priority.** **Should** (post-launch). Bundle with §1.

---

## 10. Privacy / data export / account deletion

**What it is.** GDPR-style "show me my data" + "delete my account."

**Why it matters.** Legal hygiene (Australian Privacy Principles), plus visible "delete my account" buttons build trust.

**Current state on target.** Shopify handles GDPR requests via admin; no parent-facing UI.

**Current state in UO.** `app/privacy/page.tsx` exists. **No `deleteAccount` or `deleteUser` code anywhere in `src/`** (grep returned zero). No data-export endpoint. The `parent_children` table has `ON DELETE CASCADE` from `neonAuthUsers`, so removing the auth user would cascade children — but there's no UI hook to trigger that.

**Gap.** No parent-facing "Delete my account" or "Download my data" button. Privacy notice is static text only.

**Mitigation.** (a) Add a "Danger zone" card in a `/account` page with a confirm-typed-email modal that calls a Neon Auth deletion API + manual cleanup of `parent_children` and anonymisation of `orders.parentEmail`/`parentName` (orders themselves must remain for tax/refund traceability — replace PII with `redacted-{hash}@uniformorder.online`). (b) Data export: send the parent a JSON of their `parent_children` + `orders` via email on request.

**Impact.** Medium. Required for APP-12 compliance and Apple/Google app-listing parity if we ever wrap as native.

**Priority.** **Should** (within 90 days of launch). Not a go-live blocker but a known regulatory exposure.

---

## Things they do we should NOT copy

- **Passwordless-only with no fallback.** OTP is great but every Year 12 mum has a flaky inbox — having password as a backup (which we do) is fine; don't go OTP-only if we add it.
- **No contact info anywhere.** Their lack of a contact page is a usability bug. Don't mirror it because the rest of Shopify provides email plumbing — we don't have that fallback.
- **No FAQ.** Not worth copying.
- **No multi-child UX.** Self-evident.

## Where we're ahead in this chunk

1. **Multi-child manager** — full CRUD with active-child propagation. Target has nothing comparable. This is our headline differentiator and should anchor marketing copy.
2. **Cross-tenant order history** — one parent login → orders from every school. Shopify can't do this (per-store accounts).
3. **Previous-size hint on PDP** — concrete sizing help drawn from real order history. (Should be scoped per-child as a follow-up.)
4. **Contact surfaced post-purchase** — `mailto:` from order detail. Beats target's zero-contact baseline; should be extended pre-purchase too.
5. **Transactional email is fully wired** — Emailit + React Email templates + idempotent stamps + dev fallback. (Recon report was stale on this point.)

**Pre-launch musts (this chunk only):**
1. Verify `EMAILIT_API_KEY` is set on Hostinger and `uniformorder.online` SPF/DKIM resolves.
2. Surface `tenant.shopEmail` on the catalog/MobileShell so pre-purchase parents have a contact path (~1hr).
