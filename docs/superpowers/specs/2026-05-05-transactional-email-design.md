# Specification: Transactional Email System (Emailit + React Email)

**Status:** Final
**Date:** 5 May 2026
**Author:** Uniform Order Engineering
**Related Docs:** [PDP](../../../my_doc/PDP.md) (§3.1), [Remaining Work](../../remaining_work.md) (§1.4, §2.3), [Emailit Guide](../../../my_doc/Emailit/EMAILIT_GUIDE.md)

## 1. Overview
Implement automated email notifications for the Uniform Online Order platform using **Emailit** for delivery and **React Email** for template generation. This fulfills PDP requirement §3.1 and addresses the go-live blockers for payment confirmation and pickup notification.

## 2. Requirements
- Send **Order Confirmation** email immediately upon successful payment (triggered by Stripe webhook).
- Send **Ready for Pickup** email when an operator updates an order status to `ready`.
- Templates must be branded with the tenant's accent color (fetched from the `tenants` table).
- Deliver both HTML and plain-text versions using `@react-email/render` with `{ plainText: true }`.
- Graceful degradation in development (log to console if `EMAILIT_API_KEY` is missing).
- Non-blocking "fire-and-forget" implementation for status updates from the admin's perspective, but handled robustly in the background.
- **Robust Idempotency:** Use atomic database updates and a "stamp on success" strategy to ensure each email type is sent exactly once per order.

## 3. Architecture

### 3.1 Service Layer (`src/lib/email/`)
- `client.ts`: Lightweight `sendEmail` utility using `fetch` to `api.emailit.com/v2/emails`.
- `templates/`: React Email components (e.g., `OrderConfirmation.tsx`, `OrderReady.tsx`).
- `index.ts`: High-level service functions (e.g., `sendOrderConfirmationEmail`, `sendOrderReadyEmail`).

### 3.2 Dependencies
- `@react-email/render`: For converting React components to strings.
- `@react-email/components`: Standard email UI primitives.
- `react`, `react-dom`: Peer dependencies for rendering.

### 3.3 Data Flow & Triggers
1. **Trigger 1: Stripe Webhook** (`POST /api/stripe/webhook`)
   - Listen for `payment_intent.succeeded` (matching current Elements/PaymentIntent flow).
   - **Atomic State Transition:** Update order status from `pending_payment` to `new` using a conditional update: `WHERE id = ? AND status = 'pending_payment'`.
   - If transition succeeds (rowCount == 1), call `sendOrderConfirmationEmail(orderId)`.
2. **Trigger 2: Admin Status Update** (`PATCH /api/orders/[id]`)
   - **Atomic State Transition:** Update status using a conditional update: `WHERE id = ? AND status != 'ready'`.
   - If transition succeeds (rowCount == 1) and the new status is `ready`, call `sendOrderReadyEmail(orderId)`. Prevents double-fire from operator double-clicks or concurrent PATCHes.
3. **Template Generation:**
   - Fetch Order and Tenant details from DB.
   - Render React component to HTML and Plain Text (`render(..., { plainText: true })`).
4. **Delivery & Stamping:**
   - **Await with Timeout:** The handler will await the `sendEmail` call with a hard timeout (e.g., 5s) to ensure execution in serverless environments.
   - **Stamp on Success:** Update `orders.emails_sent` *after* a successful Emailit call.
   - Return `200 OK` to Stripe/Admin even if the email fails (log the error).
   - Distinguish between **4xx** (bad recipient/request - do not retry) and **5xx** (server error - log for audit/retry).

## 4. Templates

### 4.1 Order Confirmation
- **Subject:** `Order confirmation - [OrderId]`
- **Content:**
  - Header: School Name (Tenant name) with a band using `tenants.accent`.
  - Body: "Hi [parentName], your order for [studentName] ([studentYear]) has been received."
  - Table: Itemized list (itemName, variantLabel, qty, unitPrice, lineTotal).
  - Totals: Subtotal, GST, Delivery Fee, Total.
  - Footer: Link to `/[tenant]/refund-policy`.
- **Data Source:** `orders` and `orderLines` tables.

### 4.2 Ready for Pickup
- **Subject:** `Your order is ready for collection - [OrderId]`
- **Content:**
  - Header: School Name with a band using `tenants.accent`.
  - Body: "The items for [studentName] are ready."
  - Highlight: Collection instructions (from `tenants.collection_instructions` and `tenants.shop_hours`).
  - Item List: Summary of items to collect.
  - Footer: "Bring your Order ID: [OrderId] for collection."

## 5. Prerequisite: Database Changes
Update the schema to support email tracking and better collection metadata:
- **`orders` table:** Add `emails_sent` (`jsonb`, `NOT NULL`, `DEFAULT '{}'`).
  - Schema: `{ [type]: { sentAt: string, messageId: string } }`
- **`tenants` table:** Add `collection_instructions` (`text`).
- **`order_status` enum:** Add `pending_payment`.
- **`orders.status`:** Default to `pending_payment`.

## 6. Prerequisite: Stripe Webhook
Implement `POST /api/stripe/webhook` with signature verification (`STRIPE_WEBHOOK_SECRET`). 
- **Idempotency:** Only transition `pending_payment` -> `new` once.
- **Side Effects:** Trigger confirmation email only on successful state transition.

## 7. Environment Variables
- `EMAILIT_API_KEY`: Required for production.
- `FROM_EMAIL`: Default sender address `Uniform Online <noreply@uniformorder.online>`.
- `STRIPE_WEBHOOK_SECRET`: Required for webhook verification.

## 8. Implementation Notes
- **Idempotency Strategy:**
  1. Check `emails_sent->type` IS NULL.
  2. Call `sendEmail()`.
  3. If success, `UPDATE orders SET emails_sent = jsonb_set(...) WHERE id = ?`.
  *Note: Stripe usually retries sequentially; parallel-delivery dupes are accepted for v1.*
- **Resilience:** Wrap Emailit calls in `try/catch`. 5xx errors should be logged with high priority for potential manual/automated retry.

## 9. Success Criteria
- [ ] Emailit client correctly logs to console in dev mode.
- [ ] Stripe webhook triggers confirmation email once per successful payment.
- [ ] Transitioning order to "ready" triggers pickup email.
- [ ] `emails_sent` field correctly stores `sentAt` and `messageId`.
- [ ] Templates render correctly in `react-email` dev preview.
- [ ] 4xx/5xx responses from Emailit are handled/logged appropriately.
