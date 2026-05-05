# Transactional Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement automated Order Confirmation and Ready for Pickup emails using Emailit and React Email.

**Architecture:** A centralized email service layer that renders React Email templates, sends them via the Emailit REST API (with a 5s timeout for serverless safety), and tracks delivery status in the database to ensure idempotency.

**Tech Stack:** Next.js (API Routes), Drizzle ORM, Emailit REST API, React Email (@react-email/components, @react-email/render).

---

### Task 1: Database Schema Migration

**Files:**
- Modify: `apps/web/src/db/schema.ts`
- Create: `apps/web/drizzle/0001_add_email_tracking_and_pickup_info.sql` (generated)

- [ ] **Step 1: Update `order_status` enum and `tenants`/`orders` tables**
Add `pending_payment` to the status enum. Update `orders` default status. Add `emails_sent` and `collection_instructions`.

```typescript
// apps/web/src/db/schema.ts
import { sql } from "drizzle-orm";

export const orderStatusEnum = pgEnum("order_status", [
  "pending_payment", // New: used before payment is confirmed
  "new",
  "packing",
  "ready",
  "collected",
]);

// In tenants table:
collectionInstructions: text("collection_instructions"),

// In orders table:
// NOTE: jsonb defaults must use sql template, not a JS object literal —
// .default({}) is unreliable across drizzle versions for jsonb columns.
emailsSent: jsonb("emails_sent").notNull().default(sql`'{}'::jsonb`),
status: orderStatusEnum("status").notNull().default("pending_payment"), // Updated default
```

- [ ] **Step 2: Identify the project's migration toolchain**
Before running anything, inspect `apps/web/package.json` scripts and `apps/web/drizzle.config.*` to determine which workflow this repo actually uses:
- If there is a `db:generate` / `db:migrate` script — use those.
- If there is a runner at `apps/web/src/scripts/migrate.ts` — use `pnpm --filter web tsx src/scripts/migrate.ts`.
- If neither exists — use `pnpm --filter web drizzle-kit generate` followed by `pnpm --filter web drizzle-kit migrate` (or `drizzle-kit push` for dev-only schemas).
Record the chosen commands in this file before continuing.

- [ ] **Step 3: Generate migration**
Run the generate command identified in Step 2.

- [ ] **Step 4: Apply migration**
Run the apply command identified in Step 2. Verify in the DB that `orders.emails_sent`, `orders.status` default, `tenants.collection_instructions`, and the `pending_payment` enum value all exist before moving on.

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/db/schema.ts apps/web/drizzle/
git commit -m "db: add pending_payment status, email tracking and collection instructions"
```

---

### Task 2: Emailit Client with Timeout

**Files:**
- Create: `apps/web/src/lib/email/client.ts`

- [ ] **Step 1: Create the Emailit fetch wrapper with 5s timeout**
Implement graceful degradation for dev and robust error handling for prod.

```typescript
// apps/web/src/lib/email/client.ts

export async function sendEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text: string }) {
  const apiKey = process.env.EMAILIT_API_KEY;
  const from = process.env.FROM_EMAIL || "Uniform Online <noreply@uniformorder.online>";

  if (!apiKey) {
    console.log(`[email:dev] To: ${to} | Subject: ${subject}`);
    return { id: "dev-mode-id" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout for serverless

  try {
    const res = await fetch("https://api.emailit.com/v2/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html, text }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const error = await res.text();
      if (res.status >= 400 && res.status < 500) {
        console.error(`Emailit 4xx Error (${res.status}): ${error}`);
        return null; // Do not retry
      }
      throw new Error(`Emailit 5xx Error (${res.status}): ${error}`);
    }

    return await res.json(); // { id: string }
  } catch (err) {
    clearTimeout(timeoutId);
    console.error("Emailit delivery error:", err);
    throw err; // Re-throw 5xx or timeout for high-priority logging
  }
}
```

- [ ] **Step 2: Commit**
```bash
git add apps/web/src/lib/email/client.ts
git commit -m "lib: add emailit client with 5s timeout"
```

---

### Task 3: React Email Templates

**Files:**
- Create: `apps/web/src/lib/email/templates/OrderConfirmation.tsx`
- Create: `apps/web/src/lib/email/templates/OrderReady.tsx`

- [ ] **Step 1: Install dependencies**
Run: `pnpm --filter web add @react-email/components @react-email/render`

After install, check the resolved versions against React peer requirements:
- `@react-email/components` and `@react-email/render` currently require **React 18+**. Next.js 16 ships React 19, which is supported.
- If pnpm prints any `ERR_PNPM_PEER_DEP_ISSUES` warnings, stop and resolve before continuing — do not proceed with `--strict-peer-dependencies=false` workarounds.

- [ ] **Step 2: Implement Order Confirmation template**
Include `tenantAccent` for header band and itemized table with `lineTotal`.

- [ ] **Step 3: Implement Ready for Pickup template**
Include `collectionInstructions` and `shopHours`.

- [ ] **Step 4: Commit**
```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/src/lib/email/templates/
git commit -m "feat: add branded react email templates"
```

---

### Task 4: Schema Preflight (verify required columns)

**Files:**
- Read-only: `apps/web/src/db/schema.ts`

- [ ] **Step 1: Confirm `orders` has `parentEmail`, `parentName`, `studentName`, `studentYear`, `stripePaymentIntentId`.** If any are missing, STOP and add them in a follow-up migration before continuing — the spec assumed they already exist (post-Stripe-checkout commits) but the executor must verify. Note actual column names (camelCase TS field vs snake_case SQL) for use in Tasks 5–6.

- [ ] **Step 2: Confirm `orderLines` has the fields needed for the itemized table** (item name, variant label, qty, unit price). Note any divergence from spec §4.1 so the templates can be adjusted.

- [ ] **Step 3: Confirm `tenants` has `accent`, `shopHours`** (plus `collectionInstructions` added in Task 1).

No commit — this task only validates assumptions.

---

### Task 5: Service Layer & Stamp-on-Success

**Files:**
- Create: `apps/web/src/lib/email/index.ts`

- [ ] **Step 1: Implement `sendOrderConfirmationEmail` and `sendOrderReadyEmail`**
Use check-then-send-then-stamp. NOTE: this is non-atomic by design — spec §8 accepts the v1 risk that two parallel webhook deliveries may double-send. Do not over-engineer this into a SELECT FOR UPDATE.

```typescript
// apps/web/src/lib/email/index.ts
// 1. Fetch order (incl. parentEmail, parentName, studentName, studentYear,
//    emailsSent) + orderLines + tenant (accent, name, collectionInstructions, shopHours)
// 2. if (order.emailsSent[type]) return; // v1 idempotency: cheap check
// 3. const html = await render(<Template ... />)
//    const text = await render(<Template ... />, { plainText: true })
// 4. const result = await sendEmail({ to: order.parentEmail, subject, html, text })
// 5. if (result?.id) {
//      await db.update(orders)
//        .set({ emailsSent: sql`jsonb_set(emails_sent, '{${type}}',
//                  ${JSON.stringify({ sentAt: new Date().toISOString(), messageId: result.id })}::jsonb)` })
//        .where(eq(orders.id, orderId));
//    }
```

- [ ] **Step 2: Commit**
```bash
git add apps/web/src/lib/email/index.ts
git commit -m "feat: add email service with stamp-on-success logic"
```

---

### Task 6: Stripe Webhook (signed, raw-body, atomic transition)

**Files:**
- Create: `apps/web/src/app/api/stripe/webhook/route.ts`

- [ ] **Step 1: Verify Stripe SDK and `STRIPE_WEBHOOK_SECRET`**
Confirm `stripe` is already installed (likely from prior Stripe checkout commits). Add `STRIPE_WEBHOOK_SECRET` to `.env.local` and document in `.env.example`.

- [ ] **Step 2: Implement the webhook**
The route must run on the Node runtime, read the raw request body for signature verification, filter for `payment_intent.succeeded`, atomically transition `pending_payment` -> `new`, and trigger the email only when the transition actually flipped a row.

```typescript
// apps/web/src/app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { orders } from "@/db/schema";
import { sendOrderConfirmationEmail } from "@/lib/email";

export const runtime = "nodejs"; // required: edge runtime can't read raw body for Stripe sig

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return new NextResponse("missing signature", { status: 400 });

  const rawBody = await req.text(); // MUST be raw text, not req.json()
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error("Stripe signature verification failed:", err);
    return new NextResponse("invalid signature", { status: 400 });
  }

  // Filter: only handle payment_intent.succeeded for now
  if (event.type !== "payment_intent.succeeded") {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  const pi = event.data.object as Stripe.PaymentIntent;

  // Atomic transition; .returning() gives us orderId only when we actually flipped the row
  const flipped = await db
    .update(orders)
    .set({ status: "new" })
    .where(and(eq(orders.stripePaymentIntentId, pi.id), eq(orders.status, "pending_payment")))
    .returning({ id: orders.id });

  if (flipped.length === 1) {
    try {
      await sendOrderConfirmationEmail(flipped[0].id);
    } catch (err) {
      // Stamp-on-success means the row stays unstamped; log loudly, still 200 to Stripe
      console.error("Confirmation email failed for order", flipped[0].id, err);
    }
  }

  // Always 200 — Stripe retries on non-2xx; idempotency lives in the conditional UPDATE above
  return NextResponse.json({ received: true });
}
```

- [ ] **Step 3: Commit webhook scaffolding (signature + atomic transition only)**
First land the webhook with signature verification, raw-body handling, and the atomic state transition — but with the `sendOrderConfirmationEmail` call commented out or replaced with a `console.log`. This isolates webhook plumbing from email side effects so a webhook regression is bisectable separately from an email regression.
```bash
git add apps/web/src/app/api/stripe/webhook/route.ts
git commit -m "api: add stripe webhook with signed raw-body verification and atomic state transition"
```

- [ ] **Step 4: Wire the email trigger and commit**
Uncomment / restore the `sendOrderConfirmationEmail(flipped[0].id)` call, then commit.
```bash
git add apps/web/src/app/api/stripe/webhook/route.ts
git commit -m "api: trigger order confirmation email from stripe webhook"
```

---

### Task 7: Wire Ready-for-Pickup into Admin PATCH (atomic)

**Files:**
- Modify: `apps/web/src/app/api/orders/[orderId]/route.ts`

- [ ] **Step 1: Convert the status update to a conditional UPDATE**
Mirror the webhook pattern so a double-clicked "Mark Ready" button or concurrent PATCHes don't double-fire the email.

```typescript
// In the PATCH handler, when the requested status is "ready":
const flipped = await db
  .update(orders)
  .set({ status: "ready" })
  .where(and(eq(orders.id, orderId), ne(orders.status, "ready")))
  .returning({ id: orders.id });

if (flipped.length === 1) {
  try {
    await sendOrderReadyEmail(orderId);
  } catch (err) {
    console.error("Ready email failed for order", orderId, err);
    // Do not fail the PATCH — admin update succeeded, email is best-effort
  }
}
```

For non-`ready` transitions, keep the existing update logic.

- [ ] **Step 2: Commit**
```bash
git add apps/web/src/app/api/orders/[orderId]/route.ts
git commit -m "api: atomic ready transition + trigger pickup email"
```

---

### Task 8: Verification

Each step below must be exercised against a real database and the Stripe CLI (`stripe listen --forward-to localhost:3000/api/stripe/webhook`). Pass criteria are explicit — do not mark a step done on "looks fine."

- [ ] **Step 1: Dev-mode console fallback**
With `EMAILIT_API_KEY` unset, transition an order to `ready`. Expect a single `[email:dev]` line in the console. No fetch to `api.emailit.com`.

- [ ] **Step 2: `emails_sent` JSONB structure**
After a successful send, query the row:
```sql
SELECT emails_sent FROM orders WHERE id = '...';
```
Expect: `{ "confirmation": { "sentAt": "<iso>", "messageId": "<emailit-id>" } }` (or `ready` for the pickup email). Reject if `sentAt` is missing or `messageId` is `null`/`"dev-mode-id"` in a real-key run.

- [ ] **Step 3: Stripe webhook idempotency (replay)**
Use `stripe events resend <event_id>` (or trigger `stripe trigger payment_intent.succeeded` twice for the same PaymentIntent). Expect:
  - First delivery: `flipped.length === 1`, status moves to `new`, one email sent, row stamped.
  - Second delivery: `flipped.length === 0` (status was already `new`), no email, no second log line, no second row in any email-audit table.

- [ ] **Step 4: Admin PATCH idempotency (double-click)**
PATCH the same order to `ready` twice in quick succession (e.g., two `curl` calls in a row, or click "Mark Ready" twice in the UI). Expect:
  - First PATCH: status flips, one ready email sent, `emails_sent.ready` stamped.
  - Second PATCH: `flipped.length === 0`, no email, `emails_sent.ready.sentAt` unchanged.

- [ ] **Step 5: Real inbox render check**
With `EMAILIT_API_KEY` set, send one confirmation and one ready email to a personal inbox you own. Open in **Gmail web** and **at least one of** Outlook desktop / Apple Mail. Confirm:
  - Tenant accent color renders in the header band (no broken inline styles).
  - Itemized table is legible on mobile width (≤ 375px).
  - Plain-text alternative exists (Gmail "Show original" → check `Content-Type: multipart/alternative` with a non-empty text part).

- [ ] **Step 6: 5xx / timeout fallback**
Temporarily point `EMAILIT_API_KEY` at an invalid endpoint or simulate a 500 (e.g., proxy that returns `500`). Trigger a confirmation. Expect:
  - Webhook still returns `200` to Stripe.
  - Error logged via `console.error` with order id.
  - `emails_sent.confirmation` is **not** stamped (so a manual retry path remains possible).

- [ ] **Step 7: Commit final verification**
```bash
git commit --allow-empty -m "chore: verify email integration and idempotency (dev fallback, replay, double-PATCH, inbox render, 5xx)"
```
