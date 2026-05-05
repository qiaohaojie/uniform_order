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
