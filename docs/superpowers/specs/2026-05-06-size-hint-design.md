# Size Hint — replace hardcoded "Riley wore size X last year"

**Date:** 2026-05-06
**Source:** `docs/remaining_work.md` §4.9
**Severity:** 🟢 Low (post-launch acceptable, but fully spec'd)
**Revision history:**
- 2026-05-06 v1 — initial draft (returned `variantLabel` only; mis-modeled child context; passed email in URL)
- 2026-05-06 v2 — persisted `size` end-to-end; dropped the `studentName` filter; derived parent email from the session instead of the URL.
- 2026-05-06 v3 — current. Defined behavior when the latest matching order contains the same item in multiple sizes/variants (suppress hint).

## Problem

`apps/web/src/app/[tenant]/item/[itemId]/interactive.tsx:158` renders a static string `"Riley wore size 14 last year"` regardless of who is signed in or what they bought. The hint is wrong for every parent except a hypothetical Riley, and survives across logins.

A second, structural problem: even if we built a hint from order history today, we *cannot* tell the parent what size their child wore — `order_lines` has no `size` column (`apps/web/src/db/schema.ts:143`) and the checkout client never sends size to `POST /api/orders` (`apps/web/src/app/[tenant]/checkout/checkout-screen.tsx:242`). Cart locally tracks size, but it's discarded at the API boundary. Either we restore size end-to-end or we rename the feature.

## Goal

When a returning parent visits an item detail page, show their actual previous **size** for that item under the size selector, attributed to whichever child it was bought for. When no history exists, show nothing.

This requires persisting `size` on order lines from now on. Existing pre-migration rows will read as no-hint (`size IS NULL`) — acceptable: real history begins when this lands.

## Non-goals

- Backfilling `size` for pre-existing rows (we have no signal to recover it).
- Cross-item recommendations.
- Multi-child disambiguation. Without active-child state on the item page, we show the *most recent* purchase by the parent for this item, with the child's name in the copy so the parent can interpret it.
- Fuzzy/related-variant matching (Summer Shorts vs Winter Shorts). Exact `itemId` only.

## Architecture

Six pieces, in dependency order:

1. **Schema** — add `size text` (nullable) to `order_lines` in `apps/web/src/db/schema.ts`.
2. **Migration** — generate a Drizzle migration that adds the column.
3. **POST /api/orders** — accept `size` in each line payload, insert it.
4. **Checkout client** — include `size` when posting cart lines.
5. **DB query** — `getPreviousSizeHint(tenantId, parentEmail, itemId)` returning `{ studentName, size, variantLabel } | null`. Skips rows where `size IS NULL`.
6. **Hint API + UI**
   - `GET /api/orders/size-hint?tenantId=…&itemId=…` (parent email derived from session, not URL).
   - `useEffect` in `interactive.tsx` fetches it; renders `"{studentName} wore size {size} last year"` if present, otherwise nothing.

```
parent loads /[tenant]/item/[itemId]
  └─> useEffect → GET /api/orders/size-hint?tenantId=&itemId=
        ├─ requireSessionUser()         → user.email is the parent
        ├─ getTenant(tenantId)          → 404 if unknown
        ├─ rate limit per user
        ├─ getPreviousSizeHint(tenant, user.email, itemId)
        │     └─ skips rows with size IS NULL
        └─ 200 { hint: { studentName, size, variantLabel } | null }
```

## Design decisions

### 1. Persist `size` on order lines (P1 fix)

Without this, the feature can only ever be a *previous-purchase* hint, not a *size* hint. Add `size text` (nullable) to `order_lines`. Nullable keeps the migration safe for existing rows; the query skips nulls. The cart already carries `size` (`cart-store.ts:63`), so the checkout payload change is minimal: pass it through.

The Stripe webhook does **not** insert order lines (verified: only `app/api/orders/route.ts:184` inserts into `order_lines`), so a single insertion site needs updating.

### 2. No `studentName` filter (P2 fix)

The previous draft filtered by `studentName` from `readStudentDetails()` to avoid showing sibling A's history when shopping for sibling B. But `readStudentDetails()` is just the most recent checkout-form payload (`apps/web/src/lib/order-store.ts:40`, written from `checkout-screen.tsx:160`); the item-detail page has no active-child concept. Filtering by it would pin the hint to whichever child was last *checked out*, not the child currently being shopped for — likely worse than no filter.

We surface the child's name in the hint copy so the parent can interpret it themselves: "Sam wore size 14 last year" makes it obvious who the data is about. If/when we introduce real active-child state (e.g. via §3.3 "add another child"), we can revisit.

### 3. Derive parent email from session (P3 fix)

The route is already session-gated and revalidates the email against the session user. Passing `email` in the URL adds PII to logs and access-log analytics for no security benefit. `SessionUser.email` is already normalized (`authorization.ts:55`). Use `authResult.user.email` directly server-side. Query params: `tenantId`, `itemId`. Nothing else.

### 4. Auth model: parent-only, session-bound

- `requireSessionUser()` — must be authenticated.
- No `ensureParentEmailAccess` needed (we use the session's own email; access is implicit).
- Rate limit: 60/min per user.

Operators/admins are not explicitly excluded — if a tenant operator happens to also have parent orders, they'll see their own hints. That's fine and matches their identity.

### 5. Response shape

`{ hint: { studentName: string; size: string; variantLabel: string } | null }`. Wrapped to make absence explicit and leave room for future fields (date, year level) without breaking the client. 200 in all success paths including no-history; non-200 only on auth/validation/server failure.

### 6. Failure mode: silent

Any non-200 (auth blip, network error, server crash) → hide the hint. Never render a fallback string. The hint is enhancement-only — its absence is invisible to the user.

### 7. SSR/hydration

`useEffect` is a client-only fetch; render nothing on the first paint, then render the hint when the fetch resolves. Matches the existing client-only `interactive.tsx`. No hydration mismatch risk.

### 8. Ambiguous latest order → suppress hint

The cart merges lines only when `(itemId, variantLabel, size)` all match (`apps/web/src/lib/cart-store.ts:63`), so a single order can legitimately contain the same item in multiple sizes (a parent buying two sizes "to try"). With the v2 query (`ORDER BY orders.createdAt DESC LIMIT 1`), we'd return one of those rows arbitrarily.

**Decision:** when the most recent qualifying order contains more than one distinct `(size, variantLabel)` tuple for this item, return `null` and hide the hint. Rationale:

- The most recent purchase is the strongest signal *only when it is unambiguous*. "You wore size 14 last year" is misleading if you also bought 16 the same day.
- We do not heuristically pick "the bigger one" or "the one that fits the variant in the current selector" — both bake assumptions into a low-priority feature.
- We do not fall back to an older, single-size order: the latest order is what the parent remembers; reaching past it would be confusing ("but I just bought two sizes last week").

We also collapse on variant: if size 14 was bought in both Summer and Winter Shorts in the same order, those are two distinct purchase intents and we suppress. (This is rare in practice but the rule is the same and the SQL is the same.)

### 9. Hint copy

`"{studentName} wore size {size} last year"`. Closest to the original "Riley wore size 14 last year" copy. We omit `variantLabel` from the rendered string — the parent has just selected a variant on the same screen, and its label would be redundant noise. We *return* `variantLabel` from the API so a future revision can surface it (e.g. as a tooltip) without an API change.

## Implementation pieces

### Schema (`apps/web/src/db/schema.ts`)

In the `order_lines` table definition (~line 143-156), add:

```ts
size: text("size"),  // nullable; may be absent on rows pre-dating size persistence
```

### Migration

Run `pnpm drizzle-kit generate` (or the project's equivalent) — confirms `0004_add_size_to_order_lines.sql` (or similar; pick next available number after `0003`) is created with `ALTER TABLE order_lines ADD COLUMN size text;`. Apply with the project's existing migration runner.

> **Verify before writing the migration**: list `apps/web/src/db/migrations/` (or wherever the project keeps them) to confirm naming/numbering convention. The PR description should call out the migration so reviewers can apply it on staging.

### POST /api/orders (`apps/web/src/app/api/orders/route.ts`)

Accept and persist `size` in each line:

- In the validation block (~line 120-137), no extra requirement — `size` is optional in the payload (e.g. for one-size items, the cart's `size` is "OS"; we still pass it). No change to the missing-fields check.
- In the `tx.insert(orderLines)` loop (~line 184-192), add:

```ts
size: line.size ?? null,
```

### Checkout client (`apps/web/src/app/[tenant]/checkout/checkout-screen.tsx`)

In the lines payload constructed at ~line 242, add `size: l.size` for each cart line. The `size` field already exists on `CartLine` (`apps/web/src/lib/data.ts:243`).

### DB query (`apps/web/src/db/queries.ts`)

Two queries:
1. Find the most recent order from this parent containing this item with a non-null size.
2. Pull the distinct `(size, variantLabel)` tuples for that item in that order. If exactly one, return it; otherwise the latest order is ambiguous → return `null` (per Decision §8).

```ts
import { isNotNull } from "drizzle-orm";

export async function getPreviousSizeHint(
  tenantId: string,
  parentEmail: string,
  itemId: string,
): Promise<{ studentName: string; size: string; variantLabel: string } | null> {
  const [latest] = await db
    .select({ id: orders.id, studentName: orders.studentName })
    .from(orders)
    .innerJoin(orderLines, eq(orderLines.orderId, orders.id))
    .where(
      and(
        eq(orders.tenantId, tenantId),
        eq(orders.parentEmail, parentEmail),
        eq(orderLines.itemId, itemId),
        isNotNull(orderLines.size),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(1);

  if (!latest) return null;

  const tuples = await db
    .selectDistinct({
      size: orderLines.size,
      variantLabel: orderLines.variantLabel,
    })
    .from(orderLines)
    .where(
      and(
        eq(orderLines.orderId, latest.id),
        eq(orderLines.itemId, itemId),
        isNotNull(orderLines.size),
      ),
    );

  if (tuples.length !== 1) return null;
  const [t] = tuples;
  if (!t.size) return null;
  return { studentName: latest.studentName, size: t.size, variantLabel: t.variantLabel };
}
```

Note: the inner join in query 1 may produce duplicate `(orders.id, studentName)` rows if the parent bought multiple lines of this item in the same order. `LIMIT 1` after `ORDER BY desc(createdAt)` still returns one row, so duplication is harmless. We could `selectDistinct` here too but it's not needed for correctness.

### Hint API (`apps/web/src/app/api/orders/size-hint/route.ts`)

```ts
import { NextRequest, NextResponse } from "next/server";
import { getPreviousSizeHint, getTenant } from "@/db/queries";
import { requireSessionUser } from "@/lib/auth/authorization";
import { applyRateLimit } from "@/lib/rate-limit";
import { serverCaptureException } from "@/lib/analytics/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  const itemId = searchParams.get("itemId");

  if (!tenantId || !itemId) {
    return NextResponse.json({ error: "tenantId and itemId required" }, { status: 400 });
  }

  try {
    const authResult = await requireSessionUser();
    if ("response" in authResult) return authResult.response;

    const tenant = await getTenant(tenantId);
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

    const rateLimit = applyRateLimit(req, `size-hint:${authResult.user.id}`, {
      limit: 60,
      windowMs: 60_000,
    });
    if (rateLimit) return rateLimit;

    const hint = await getPreviousSizeHint(tenantId, authResult.user.email, itemId);
    return NextResponse.json({ hint });
  } catch (err) {
    console.error("GET /api/orders/size-hint error:", err);
    await serverCaptureException(
      "api-size-hint-get",
      err instanceof Error ? err : new Error(String(err)),
      { method: "GET", tenantId, itemId },
    );
    return NextResponse.json({ error: "Failed to fetch size hint" }, { status: 500 });
  }
}
```

### Client wire (`apps/web/src/app/[tenant]/item/[itemId]/interactive.tsx`)

Add at top of `ItemDetailInteractive`:

```ts
const [hint, setHint] = useState<{ studentName: string; size: string; variantLabel: string } | null>(null);

useEffect(() => {
  const params = new URLSearchParams({ tenantId: tenant.id, itemId: item.id });
  fetch(`/api/orders/size-hint?${params.toString()}`, { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => setHint(data?.hint ?? null))
    .catch(() => {});
}, [tenant.id, item.id]);
```

(No need for `readStudentDetails()` — the API uses the session.)

Replace the hardcoded block at `interactive.tsx:156-159`:

```tsx
{hint && (
  <div className="mt-2 text-[11px] flex items-center gap-1.5" style={{ color: "var(--color-ink-dim)" }}>
    <span style={{ color: "var(--color-success)" }}><CheckIcon size={12} /></span>
    <span>{hint.studentName} wore size {hint.size} last year</span>
  </div>
)}
```

## Testing

No automated test suite. Manual verification:

1. **`pnpm check-types`** — must pass. Primary correctness gate.
2. **Migration** — apply on dev DB; confirm `order_lines.size` exists, existing rows are NULL, new rows accept the value.
3. **End-to-end** — `pnpm dev:web`, sign in as a parent, place an order for item X (size 14), wait for confirmation. Navigate back to item X's detail page:
   - Hint renders: "{kid name} wore size 14 last year".
   - Sign out, navigate to item X: hint hidden.
   - Sign in as a parent who has never bought item X: hint hidden.
   - Sign in as parent A, navigate to an item only parent B has bought: hint hidden (different `parentEmail`).
4. **Pre-migration order** — confirm orders placed before the migration produce no hint (size is NULL → `isNotNull` filter skips them).
5. **Multi-size last order** — place an order containing item X in two sizes (e.g. blazer 100 *and* 105). Reload item X's detail page. Expect: hint hidden (latest order ambiguous, per Decision §8). Then place a single-size order for item X; reload; expect hint back, reflecting the new single-size purchase.
6. **Network tab** — one request per item-detail mount, 200 + `{ hint: {…} | null }`. URL contains no email.
7. **Rate-limit** — refresh 60+ times in <1 min: 429s start; client silently hides the hint.

## Risks / migration notes

- **Order-line insert other paths.** Verified at spec-time: only `app/api/orders/route.ts:184` inserts into `order_lines`. If a future webhook handler starts inserting lines, it must also pass `size`.
- **Rolling deploys.** During deploy, an old client posting to a new server is fine (`size` is nullable). A new client posting to an old server is impossible because the new client only ships once the new server is in front of it. Forward-only deploy.
- **Backfill.** Pre-migration rows have `size = NULL`. Treated as no-hint. We do not attempt to recover size from `variantLabel` because the catalog mixes "variant ≠ size" cases (e.g. "Boys 10–24" is a variant, "16" is a size).
- **Analytics implication.** None — the new column isn't exported anywhere yet. If reports later want size breakdowns, they'll need to handle NULLs.

## Out of scope / follow-ups

- PostHog event for hint hit-rate.
- Pre-fetching the hint via a server component (would require threading the session through the item-detail server boundary; the client effect is sufficient).
- Surfacing `variantLabel` in the hint UI (returned by the API for future use).
- Real active-child state on the item page (would unlock per-sibling hints; ties to §3.3 "add another child").
