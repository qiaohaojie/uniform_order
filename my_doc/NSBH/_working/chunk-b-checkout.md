# Chunk B — Cart, Checkout, Payments & Post-purchase

**Scope.** This chunk compares the parent purchase journey from cart through payment, order confirmation, refunds, and returns/exchanges against the NSBH Shopify storefront. It deliberately excludes catalog/PDP (Chunk A), account/parent self-service (Chunk C) and brand/IA/content (Chunk D).

**Target:** https://north-sydney-boys-uniform-shop.myshopify.com/ — stock Shopify Horizon theme, no third-party apps, "collection-only" shipping policy. Evidence sourced from `/cart`, `/cart.js`, `/payments/config`, `/policies/shipping-policy`, `/policies/refund-policy`. **Codebase:** Uniform Order, `apps/web/`.

## Capability matrix

| Capability | NSBH (Shopify) | Uniform Order | Verdict |
|---|---|---|---|
| Cart surface | Full page (`/cart`); no drawer in HTML | Full mobile page (`/[tenant]/cart`) | Parity |
| Cart-level order note | None | None on cart; present on checkout (500 char) | UO ahead |
| Gift wrap / shipping estimator | None | None | Parity (n/a — pickup) |
| Cart persistence | Shopify cookie | localStorage (`uo:cart:v1`) | Parity |
| Credit/debit card | Yes (Shopify Payments) | Yes (Stripe `card` element) | Parity |
| Apple Pay | Yes (confirmed in `/payments/config`) | **No** | **Gap** |
| Google Pay | Yes (confirmed in `/payments/config`) | **No** | **Gap** |
| Shop Pay / PayPal / Amazon Pay | Not enabled (config nulls them) | n/a | Parity |
| Afterpay / Klarna / BNPL | **Not enabled** (no marker in cart HTML, not in `dynamicCheckoutPrioritization`) | **No** | Parity (target also missing) |
| Guest checkout | Yes (cart copy: "Log in to check out faster") | **No** — checkout redirects to `/auth/sign-in` | **Gap** |
| Shipping option | None ("we do not offer shipping") | Pickup OR ship-to-home ($9.50) | UO ahead |
| Pickup logistics surfaced pre-purchase | **No** — "details provided after order" | Yes — school hours on confirmation + ready email | UO ahead |
| GST handling | Shopify auto, AU 10% | Server-calculated 10%, GST-inclusive line | Parity |
| Order confirmation email | Shopify built-in | Emailit-wired `OrderConfirmation` template, idempotent "stamp on success" | Parity |
| Webhook reconciliation | Shopify internal | `payment_intent.succeeded`, `account.updated`, `charge.refunded` with livemode guard | UO equivalent |
| Idempotent order creation | Shopify | `db.batch()` + unique `stripePaymentIntentId` + duplicate-detection re-query | UO ahead |
| Parent-initiated refund/return | Email/contact only | Email/contact only | Parity |
| Operator refunds | Shopify dashboard | In-app, partial+full, Stripe-API, reverse_transfer, audit-logged | UO ahead |
| Partial refunds w/ status (`partially_refunded`) | Shopify dashboard | First-class enum + recompute-on-write | UO ahead |
| RMA / online returns flow | None | None | Parity |

---

### Cart UX

**What it is** — Target is a stock Horizon `/cart` page (https://north-sydney-boys-uniform-shop.myshopify.com/cart). `/cart.js` returns `{ "note": null, "attributes": {}, "items": [] }` with no `cart_attributes` block in the form, and grepping the cart HTML for `cart-drawer`, `order_notes`, `gift_wrap`, `shipping-calculator` yields **zero hits** (only an unrelated `gift-card-recipient-form.js` asset reference). Empty-state copy: "Your cart is empty. Have an account? Log in to check out faster."

**Why it matters** — Cart is the last chance to add context (sibling pickup, label name, "leave at office") before payment.

**Current state in Uniform Order** — Mobile-first full-page cart at `apps/web/src/app/[tenant]/cart/cart-screen.tsx:15-153`. Lines from `useCart()` (localStorage, `lib/cart-store.ts`). Per-line qty stepper (`cart-screen.tsx:88-116`), subtotal, GST shown, "Checkout" CTA (`cart-screen.tsx:137-148`). No cart-level note (it lives on checkout: `checkout-screen.tsx:485-499`, 500-char limit).

**Gap** — No. Both are page-based, neither has drawer/gift-wrap/estimator; UO already has a parent note on the next step.

**Proposed mitigation** — Optional polish: surface the active child banner ("Order for Riley · Year 10 · NSBH" — already at `cart-screen.tsx:41-54`) as a higher-contrast pill so the parent doesn't enter checkout and discover the wrong student. No structural change required.

**Impact on existing app** — None. Cosmetic.

**Priority** — Won't-do (Chunk A/D will cover any cart polish; nothing here blocks an order).

---

### Payment methods

**What it is** — The target's `/payments/config` endpoint (a public Shopify storefront JSON) reveals concrete provider availability:

```
applePayConfig: { shopifyPaymentsEnabled: true, currencyCode: "AUD", … }
googlePayConfig: { … capabilities.environment: "PRODUCTION" … }
shopifyPayConfig: null
paypalConfig: null
amazonPayConfig: null
dynamicCheckoutPrioritization: [ShopifyPay, PayPal, ApplePay, AmazonPay, AmazonPayCv2, GooglePay]
```

Cart HTML grep for `afterpay|klarna|shoppay|paypal` returns **zero** matches. Conclusion: **Apple Pay + Google Pay + card** at checkout; **no Shop Pay, no PayPal, no Afterpay, no Klarna**.

**Why it matters** — In the AU mobile-parent demographic, Apple Pay / Google Pay is a real conversion lever (one-tap, FaceID, no card-typing on mobile). Afterpay's absence is a small mercy — schools often dislike BNPL for kids' compulsory wear — but the wallet-pay gap is real.

**Current state in Uniform Order** — `apps/web/src/app/[tenant]/checkout/checkout-screen.tsx:90-102` mounts a Stripe `card` element only — `elements.create("card", { hidePostalCode: true, … })`. The payment-intent route does pass `automatic_payment_methods: { enabled: true }` (`apps/web/src/app/api/stripe/payment-intent/route.ts:75`), so Stripe could surface wallets — but the front end never uses `PaymentElement` / `PaymentRequestButton`, so wallets cannot render.

**Gap** — Yes. Target offers Apple Pay + Google Pay; we offer card only.

**Proposed mitigation** — Replace the bespoke `card` mount with Stripe `PaymentElement` (`elements.create("payment", ...)`), which auto-renders Apple Pay, Google Pay, and card given `automatic_payment_methods: { enabled: true }` already on the PaymentIntent. Domain-verify the production host for Apple Pay (place `apple-developer-merchantid-domain-association` in `/public/.well-known/`). Keep the destination-charge config — wallets ride the same PaymentIntent.

**Impact on existing app** — Touches `checkout-screen.tsx` (replace `cardRef`/`confirmCardPayment` with `elements.submit()` + `stripe.confirmPayment({ clientSecret, elements, confirmParams: { return_url } })`). Add Apple Pay domain-verification asset to `public/`. No DB change. Effort: **M** (Stripe-side ~½ day; UI styling + redirect-flow handling another ½ day).

**Priority** — Must-have. Parent friction is highest on mobile, the dominant device, and the target is one tap ahead of us on every iOS uniform parent today.

---

### Guest checkout

**What it is** — Target's cart empty state literally invites guest flow ("**Log in** to check out faster" — `/cart` HTML). Shopify's default new-customer-account flow allows entering checkout without prior signup; account creation is post-checkout.

**Why it matters** — School-uniform parents may shop once a year at the start of term; forcing them to set a password to buy a $20 tie is the most common abandonment trigger.

**Current state in Uniform Order** — `apps/web/src/app/[tenant]/checkout/page.tsx:13-16` calls `getSessionUser()` and if null **hard-redirects to `/auth/sign-in?callbackURL=…`**. There is no email-verify-on-receipt fallback. `POST /api/orders` then also enforces `normalizedParentEmail !== authResult.user.email → 403` (`apps/web/src/app/api/orders/route.ts:153-155`).

**Gap** — Yes — target allows guest; we hard-block.

**Proposed mitigation** — Soft-onboard: collect email on checkout, send a one-time link to "save your order to an account" after payment, but allow PaymentIntent creation and order placement without a session. Use the order's `parentEmail` to bind to a user record retroactively when the parent later logs in with the same email. Keep PostHog identification by email until then. Keep the `/orders` list gated — guests get a link in the receipt email to view that single order.

**Impact on existing app** — Remove the `redirect()` in `checkout/page.tsx`. Loosen the email-match assertion in `POST /api/orders` (`route.ts:153-155`) to allow `authResult.user === null` for guest path; rate-limit by IP rather than user id (`rate-limit.ts`). Add `userId` nullable already exists in schema. Order-detail page (`apps/web/src/app/orders/[orderId]/page.tsx`) needs a signed-link fallback (HMAC of `orderId + parentEmail`). Effort: **M** (≈1–1.5 days; mostly auth-flow plumbing and signed-token utility).

**Priority** — Must-have. Forces NSBH-style "casual buyer" parents through a friction wall the competitor doesn't have.

---

### Shipping vs pickup

**What it is** — Target's `/policies/shipping-policy` says verbatim:
- "We do not provide postal, courier, or third-party delivery services"
- "Orders must be collected from the designated pickup location"
- "Pickup details will be provided after your order is placed"
- "Please bring your order confirmation when collecting"

That is the entire pickup spec — no hours, no map, no parent-vs-student rules, no school-office address on any pre-purchase page.

**Why it matters** — Parents need to know *when* and *where* before paying — "after your order is placed" reads as evasive.

**Current state in Uniform Order** — Delivery is a first-class enum on `orders.delivery` (`db/schema.ts` — `pickup | ship`). Choice surfaced at `apps/web/src/app/[tenant]/checkout/checkout-screen.tsx:404-428`, with ship priced at $9.50 and copy "Free · Ready in 1–2 school days" vs "$9.50 · 3–5 business days". Confirmation page shows the school hours inline (`apps/web/src/app/[tenant]/order/placed/page.tsx:60`) reading `tenant.shopHours`. The `OrderReady` email includes `collectionInstructions` and `shopHours` (`lib/email/index.ts:152-158`).

**Gap** — No — we are materially ahead.

**Proposed mitigation** — Make sure shop hours and collection instructions are mandatory tenant-setup fields and surface them on the checkout *pickup option* card too (today they only appear post-payment). One-line copy under "Pickup at school office" — pull from `tenant.shopHours`. Surfaces the answer pre-purchase, removes the only NSBH advantage (their lack of detail is consistent across funnel, so parents don't see ours either).

**Impact on existing app** — Read `tenant.shopHours` in `checkout/page.tsx`, thread to `CheckoutScreen`, replace the literal "Free · Ready in 1–2 school days" with `tenant.shopHours` in the pickup `DeliveryOption` (`checkout-screen.tsx:415`). Effort: **S** (~1 hr).

**Priority** — Should-have. Conversion-positive, near-zero cost.

---

### Order confirmation & receipt

**What it is** — Target uses Shopify's stock thank-you page (`/checkouts/c/.../thank-you`) and transactional email; couldn't observe directly without placing an order. Cart copy implies receipt-by-email and an order-status page.

**Why it matters** — Confidence the order went through; reference for pickup/refund.

**Current state in Uniform Order** — Success page at `apps/web/src/app/[tenant]/order/placed/page.tsx`: order ID, total, delivery method, school hours, parent email confirmation, "View order details" link to `/orders/[orderId]`. **Email is wired**, not TBD as recon-app stated: `apps/web/src/lib/email/index.ts:55-122` calls `sendOrderConfirmationEmail` via Emailit (`lib/email/client.ts`), with idempotent "stamp on success" via `orders.emailsSent` jsonb (`db/schema.ts:157`). Called from both `POST /api/orders` (best-effort, `apps/web/src/app/api/orders/route.ts:291`) and the `payment_intent.succeeded` webhook (`apps/web/src/app/api/stripe/webhook/route.ts:77`).

**Gap** — Partial. The plumbing is complete (Emailit integration, idempotency stamp, react-email templates). Open items: (a) confirm `EMAILIT_API_KEY` set in Hostinger env, (b) verify `FROM_EMAIL` SPF/DKIM aligned with `uniformorder.online`, (c) `NEXT_PUBLIC_APP_URL` must be set (otherwise `requireAppUrl()` throws at `index.ts:17`).

**Proposed mitigation** — Ops checklist (no code): set those three env vars in hPanel → Advanced → Node.js, restart the Node.js app, send a probe order to the platform-admin email, confirm both Postgres `emailsSent.confirmation` populated **and** the inbox arrival. Then capture screenshot of the email as the new "what good looks like" baseline.

**Impact on existing app** — None. Pure ops/DNS work.

**Priority** — Must-have. Receipt is the strongest signal that we are a real shop; missing or unsent email is reputational.

---

### Refunds (operator-issued)

**What it is** — Target offers no in-Shopify refund UI to parents; refunds happen via "contact us" → Shopify dashboard. Refund policy (`/policies/refund-policy`) requires proof of purchase and an in-person/email exchange request.

**Why it matters** — Refund speed is a school-procurement criterion ("how fast can you cancel a wrong order?"). Audit defensibility matters for school accounting.

**Current state in Uniform Order** — `apps/web/src/app/api/orders/[orderId]/refund/route.ts` issues Stripe refunds with `reverse_transfer: true` + `refund_application_fee: true` (line 104), idempotency-keyed on `orderId:lineId:amountCents` (line 113). Records to `order_refunds` (`db/schema.ts:196-211`, unique on `stripeRefundId`). Returns `reconcilePending` flag if Stripe succeeded but DB insert failed, letting the `charge.refunded` webhook (`webhook/route.ts:137-184`) reconcile via `ON CONFLICT DO NOTHING`. Recomputes refund total → status transitions to `partially_refunded` or `refunded`. Audit-logged (`refund/route.ts:185-207`). Operator UI per recon-app: order detail page in admin.

**Gap** — No. We are significantly ahead.

**Proposed mitigation** — None for parity. Differentiation opportunity: surface "Refund pending — please allow 5–7 days" in the parent's `/orders/[orderId]` view automatically when a refund row exists; cite the policy version stored on the order (`legalVersionId`) so the parent sees the exact policy they agreed to.

**Impact on existing app** — `orders/[orderId]/page.tsx` UI tweak; query `orderRefunds` + `tenant_legal_versions` by `legalVersionId`. Effort: **S**.

**Priority** — Should-have differentiation. Not a blocker.

---

### Parent-initiated returns / exchanges workflow

**What it is** — Target has policy text only ("Items may be exchanged for a different size or item of equal value … contact us"). No RMA form, no link to a return-request page, no online surface.

**Why it matters** — Wrong-size returns dominate uniform support volume. An asynchronous form would offload the shop staff considerably.

**Current state in Uniform Order** — Same — no parent-initiated returns flow. `/orders/[orderId]` shows the order and the refund-policy link; parent must email/visit the school.

**Gap** — No vs target (parity); both rely on offline contact.

**Proposed mitigation** — Defer for v1.x. When prioritised: add a "Request exchange/refund" CTA on `/orders/[orderId]` opening a modal with item-line picker (qty per line), reason taxonomy (Wrong size / Wrong item / Faulty / Other), free-text 300-char field. POST to a new `/api/orders/[orderId]/refund-request` creating an `order_refund_requests` row (status `pending`). Surfaces on operator's order detail with an "Approve & refund" action that pre-fills the existing refund POST.

**Impact on existing app** — New table `order_refund_requests (id, orderId, lineId?, requestedQty, reason, notes, status, parentUserId, createdAt)`; new API route; operator UI extension. Effort: **L** (3–5 days end-to-end + admin UI).

**Priority** — Nice-to-have. Genuine differentiation but neither side has it; not a sale-deciding feature.

---

### Idempotency & atomicity

**What it is** — Target is Shopify (idempotent by platform).

**Why it matters** — Double-charge / double-order is the single most damaging payment bug.

**Current state in Uniform Order** — `POST /api/orders` (`apps/web/src/app/api/orders/route.ts:157-171`) pre-checks for an existing order on the same `stripePaymentIntentId` and returns `idempotent: true` on collision. Order creation uses `db.batch([orderInsert, linesInsert])` (line 235) for single-round-trip atomic insert (neon-http can't run interactive transactions). Unique index on `orders.stripePaymentIntentId` is the hard guarantee. Front-end (`checkout-screen.tsx:300-316`) locks the pay button on success-confirmed-then-order-create-failed paths so the parent cannot retry against an already-charged intent.

**Gap** — No (strength). Document as architectural moat.

**Proposed mitigation** — None.

**Impact on existing app** — None.

**Priority** — Strength to advertise. No action.

---

### GST / AU tax

**What it is** — Target's Shopify auto-handles AU GST at checkout via Shopify Tax; presented inclusive at line level.

**Why it matters** — Australian school suppliers must remit GST; parents expect GST-inclusive display.

**Current state in Uniform Order** — GST computed server-side per request (`apps/web/src/app/[tenant]/checkout/checkout-screen.tsx:137` `const gst = total / 11`) and stored on `orders.gst` from the client payload (`route.ts:122,213`). Confirmation shows "GST included" line (cart-screen.tsx:129-132, checkout-screen.tsx:474-477). Platform console can export remittable amount per tenant.

**Gap** — Partial. The arithmetic is correct (10% inclusive = total/11) but client-supplied; should be re-derived server-side and asserted, not trusted. Today, a tampered client could send a `gst` value inconsistent with `total` and the API stores both as-is.

**Proposed mitigation** — In `POST /api/orders`, recompute `subtotal`, `gst`, `total` from `lines[].unitPrice * qty + deliveryFee` and assert match within 1¢ of the client values; reject 400 if mismatch. Single-line: `assertTotalsMatch({ lines, deliveryFee, subtotal, gst, total })`. Same recompute already happens implicitly via the Stripe amount (PaymentIntent uses parent-supplied `amount`), so also assert PaymentIntent amount matches DB-derived total before insert.

**Impact on existing app** — One helper in `lib/order-totals.ts`; called in `POST /api/orders` (`route.ts:151` area) and `POST /api/stripe/payment-intent` (`route.ts:57` area). Effort: **S** (~2 hrs).

**Priority** — Should-have. Tampering is low-risk financially (we still bind to PaymentIntent amount) but cleanup before any BAS-audit conversation.

---

### Webhook handling

**What it is** — Target relies on Shopify's internal eventing.

**Why it matters** — A reliable webhook surface is what lets schools trust the platform with their cash flow.

**Current state in Uniform Order** — `apps/web/src/app/api/stripe/webhook/route.ts` handles three events:
- `payment_intent.succeeded` (lines 58-87): atomic conditional update `WHERE status='pending_payment'` → flips to `new`, sends confirmation email via the same idempotent helper.
- `account.updated` (89-132): syncs Connect account `payouts_enabled`/`charges_enabled` to `tenants` table; revalidates billing cache tag; rethrows on DB failure so Stripe retries.
- `charge.refunded` (134-184): records out-of-band refunds initiated from Stripe Dashboard, recomputes `partially_refunded` / `refunded` status. Iterates `charge.refunds.data` to handle multi-partial.

Also has a **livemode guard** (`route.ts:41-55`) that compares `event.livemode` against the publishable-key mode to reject test webhooks in prod and vice versa.

**Gap** — No (strength).

**Proposed mitigation** — Two known gaps to track: (a) the dashboard-initiated refund reconcile path does not emit an audit_events row (acknowledged TODO comment at `refund/route.ts:176-178`); (b) `payment_intent.payment_failed` is not handled, so order rows stuck in `pending_payment` aren't cleaned up. Add a `payment_intent.payment_failed` handler that deletes/cancels the pending order. Effort: **S** for the failed-intent handler, **S** for the audit-log addition.

**Impact on existing app** — New `if (event.type === "payment_intent.payment_failed")` branch in `webhook/route.ts`. New `logAuditEvent` call in the `charge.refunded` branch with `actorRole: "system"`. Effort: **S** total (~3 hrs).

**Priority** — Should-have.

---

## Anti-patterns to avoid (from observing target)

- **"Details after order"** — Don't repeat the target's pickup-policy evasion. Show shop hours + collection address on the pickup option card *before* the parent commits.
- **Generic refund boilerplate** — Their refund page reads as template text; cite the school name and link to a specific contact email per tenant (we already do via `tenant.shopEmail`).
- **Subscription-disclaimer copy on one-off products** — Shopify Horizon bug from the recon: don't ship checkout copy unless it accurately describes the transaction.
- **Card-only payments** — Wallets are table stakes on AU mobile.
- **Login wall before purchase** — The target's cart copy is "log in to check out **faster**", not "log in to check out". Match that posture.
- **Treat refund as an out-of-band manual workflow** — We have the infrastructure; surface it.

## Where we're ahead

1. **Ship-to-home option** — Target literally doesn't offer it (`shipping-policy`). Some parents *cannot* drive to the school.
2. **In-app, audit-logged, partial-refund support** — Target operators must use Shopify dashboard; we do it inside the order detail with `reverse_transfer` and idempotency keys.
3. **`charge.refunded` reconciliation path** — Picks up dashboard-initiated Stripe refunds and updates order status. (Target doesn't need it; we benefit from defense-in-depth.)
4. **Idempotent order creation** — `db.batch()` + unique `stripePaymentIntentId` + duplicate-detection re-query + UI lock on payment-confirmed-but-order-failed. Hardened beyond what most Shopify stores expose.
5. **Versioned legal pinning** — `orders.legalVersionId` snapshots the refund policy the parent agreed to (`route.ts:198,221`); parent always sees the policy that applied at their order time.
6. **Connect account-status sync** — `account.updated` webhook keeps `tenants.stripeChargesEnabled` honest, and `POST /api/stripe/payment-intent` refuses to create an intent if the school's account isn't ready (`payment-intent/route.ts:50-55`). Better than Shopify's opaque "store unavailable".
7. **Email idempotency via stamp** — `orders.emailsSent` jsonb prevents duplicate sends even under webhook retries.
8. **Parent note** — Up to 500 chars at checkout (`checkout-screen.tsx:489-498`); flows into the pick slip (per CLAUDE.md / §3.7). Target has no equivalent.
