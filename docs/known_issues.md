# Known Issues

---

## 1. "Riley wore size X last year" hint is hardcoded

**File:** `apps/web/src/app/[tenant]/item/[itemId]/interactive.tsx:147`

**Problem:** The size hint shown beneath the size selector on the item detail page is a static string `"Riley wore size 14 last year"`. It does not reflect the actual parent's order history or their child's name.

**Proper fix — three pieces:**

### 1. New db query (`apps/web/src/db/queries.ts`)

```ts
export async function getPreviousSizeHint(tenantId: string, email: string, itemId: string) {
  const rows = await db
    .select({ studentName: orders.studentName, variantLabel: orderLines.variantLabel, createdAt: orders.createdAt })
    .from(orders)
    .innerJoin(orderLines, eq(orderLines.orderId, orders.id))
    .where(and(eq(orders.tenantId, tenantId), eq(orders.parentEmail, email), eq(orderLines.itemId, itemId)))
    .orderBy(desc(orders.createdAt))
    .limit(1);
  return rows[0] ?? null;
}
```

### 2. New API route

`GET /api/orders/size-hint?tenantId=...&email=...&itemId=...`

Returns `{ studentName, variantLabel }` or `null`. A dedicated route is cleaner than extending the existing orders route.

### 3. Wire `interactive.tsx`

Add a `useEffect` that:
1. Calls `readStudentDetails()` (from `@/lib/order-store`) to get the parent's email from `uo:student:v1` localStorage
2. Fetches `/api/orders/size-hint?tenantId=...&email=...&itemId=${item.id}`
3. If a result is returned, renders `"{studentName} wore {variantLabel} last year"` dynamically
4. If no result (first-time buyer or item never ordered), hides the hint entirely

**Notes:**
- The email and student name are already persisted to localStorage during checkout via `writeStudentDetails()` — no new storage needed
- The hint should only appear when there is a real match; don't fall back to any hardcoded value

---

## 2. Transactional email — end-to-end verification not run

**Plan:** `docs/superpowers/plans/2026-05-05-transactional-email.md` (Task 8)

**Problem:** The plan required an end-to-end verification pass before merge — Stripe CLI replay, double-PATCH, real-inbox render in Gmail and Outlook, and a 5xx-fallback test — culminating in an `--allow-empty` chore commit. That pass has not been executed; no verification commit exists.

**To do:**
1. `stripe listen --forward-to localhost:3000/api/stripe/webhook` and trigger a real `payment_intent.succeeded` for an order created via the checkout flow. Confirm the row flips `pending_payment → new` and the confirmation email arrives.
2. `stripe events resend <evt_id>` — confirm no second email (atomic UPDATE no-op, `console.info` ignored line).
3. PATCH `/api/orders/{id}` with `{status: "ready"}` twice in quick succession — confirm one ready email, one no-op.
4. Render both `OrderConfirmation` and `OrderReady` in Gmail (web + iOS) and Outlook web; verify no clipped layout, working refund-policy link, accent colour intact.
5. Block Emailit (e.g. invalid API key) and confirm: PATCH/webhook still succeeds, error logged with `orderId`, `emails_sent.{confirmation|ready}` not stamped (so manual retry path works).
6. Stamp the verification chore commit referenced in the plan.

---

## 3. Transactional email — webhook commit was not split as planned

**Plan:** `docs/superpowers/plans/2026-05-05-transactional-email.md` (Task 6, Steps 3 & 4)

**Problem:** The plan asked for two commits — a scaffold-only webhook (sig verify + atomic flip), then a separate commit wiring `sendOrderConfirmationEmail`. Both were collapsed into `3ce98b1`. This is purely a history/bisect convenience deviation; functionality is correct.

**Mitigation:** Not worth rewriting history. Note the deviation here so future bisects accommodate.
