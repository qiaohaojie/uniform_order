# Pre-launch hardening + parent shell polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 7 pre-launch hardening items in one squash-merged PR: tenant footer, per-tenant Contact page, SEO basics, Stripe PaymentElement (Apple/Google Pay) via deferred-intent, `payment_intent.payment_failed` handling + dashboard-refund audit log + retry transition, server-side total assertion, and removal of the `getPreviousSizeHint` feature.

**Architecture:** Each task = one bisect-safe commit. The codebase works in **dollars (AUD)** end-to-end — only the Stripe API boundary converts to integer cents via `Math.round(total * 100)`. Stripe Elements moves to **deferred-intent mode** (`stripe.elements({ mode: 'payment', amount, currency })`) so the PaymentElement can mount before the PaymentIntent is created. New helpers live in `apps/web/src/lib/shipping.ts` and `apps/web/src/lib/order-totals.ts` for single-source-of-truth totals shared by client display, server assertion, and the Reports page.

**Tech Stack:** Next.js 16 (App Router, RSC), Drizzle + neon-http (Postgres on Neon), Stripe Connect (destination charges) + Stripe.js, Tailwind v4 + HeroUI v3, PostHog, Hostinger Node.js deploy.

**Spec:** `docs/superpowers/specs/2026-05-12-prelaunch-hardening-design.md`

---

## Pre-flight checks

Resolved during plan authoring (do not re-investigate):

- `getPubliclyListedTenants()` already exists at `apps/web/src/db/queries.ts:859` — Task 3 imports it.
- `tenants` table has all fields the spec references: `shopEmail`, `shopHours`, `motto`, `logoUrl`, `currentLegalVersionId`, `address`, `collectionInstructions` — confirmed via `db/schema.ts:67-94`.
- `app/[tenant]/cart/page.tsx`, `app/[tenant]/checkout/page.tsx`, `app/[tenant]/order/placed/page.tsx` all already call `getTenant(slug)` — no new fetches required for the footer.
- `payment_intent.succeeded` transitions `pending_payment → 'new'` at `apps/web/src/app/api/stripe/webhook/route.ts:62-66`. The `'new'` status is the success state — there is no `'paid'`.
- `charge.refunded` branch is at `webhook/route.ts:137-184`. It updates `orderRefunds` + transitions order status; it does **not** call `logAuditEvent`. Task 6 adds that call.

**One outstanding pre-flight that the plan handles inline (Task 6 Step 1):**

- `AuditActorRole` at `apps/web/src/lib/audit/types.ts:10` is `"operator" | "platform_admin"` — does **not** include `"system"`. Task 6 Step 1 widens this union before the webhook audit-log call sites land.

**Apple Pay domain-association file (Task 7):** the `public/.well-known/apple-developer-merchantid-domain-association` file is a placeholder in this PR. Post-merge, ops replaces it with the real file from Stripe Dashboard → Settings → Payment methods → Apple Pay → Add new domain. Google Pay does not need domain verification.

---

## File structure

### New files

| Path | Responsibility |
|---|---|
| `apps/web/src/components/tenant-footer.tsx` | Per-tenant policy/contact link strip; RSC; consumes `TenantRow` |
| `apps/web/src/app/[tenant]/contact/page.tsx` | Per-tenant Contact page; reads existing onboarding fields |
| `apps/web/src/app/sitemap.ts` | Next.js sitemap route; strict (listed + approved tenants only) |
| `apps/web/src/app/robots.ts` | Next.js robots route; disallows /admin /platform /auth /api |
| `apps/web/src/lib/shipping.ts` | `SHIP_FEE_AUD` constant shared by client + server |
| `apps/web/src/lib/order-totals.ts` | `computeTotals` + `assertTotalsMatch` helpers (dollars) |
| `apps/web/public/.well-known/apple-developer-merchantid-domain-association` | Apple Pay domain placeholder (ops replaces post-merge) |

### Modified files

| Path | Reason |
|---|---|
| `apps/web/src/components/mobile-shell.tsx` | Accept optional `tenant` prop; render `<TenantFooter>` above `BottomNav` slot |
| `apps/web/src/app/[tenant]/page.tsx` | Pass `tenantRecord` to `MobileShell` |
| `apps/web/src/app/[tenant]/cart/page.tsx` | Same |
| `apps/web/src/app/[tenant]/checkout/page.tsx` | Same |
| `apps/web/src/app/[tenant]/order/placed/page.tsx` | Same |
| `apps/web/src/app/[tenant]/refund-policy/page.tsx` | Same |
| `apps/web/src/app/[tenant]/item/[itemId]/page.tsx` | Same + add `generateMetadata` |
| `apps/web/src/app/[tenant]/layout.tsx` | Add `generateMetadata` for per-tenant title/description/OG |
| `apps/web/src/app/[tenant]/item/[itemId]/interactive.tsx` | Remove size-hint fetch + state + JSX (Task 1) |
| `apps/web/src/app/[tenant]/checkout/checkout-screen.tsx` | PaymentElement swap (Task 7); import `SHIP_FEE_AUD` (Task 4) |
| `apps/web/src/db/queries.ts` | Delete `getPreviousSizeHint`; add `WHERE status != 'payment_failed'` filter in `listOrdersForParent` |
| `apps/web/src/db/schema.ts` | Add `'payment_failed'` to `orderStatusEnum` |
| `apps/web/src/lib/audit/types.ts` | Add `"system"` to `AuditActorRole` |
| `apps/web/src/app/api/stripe/webhook/route.ts` | Add `payment_intent.payment_failed` branch + audit log in `charge.refunded` |
| `apps/web/src/app/api/stripe/payment-intent/route.ts` | Call `assertTotalsMatch`; transition `payment_failed → pending_payment` on retry |
| `apps/web/src/app/api/orders/route.ts` | Call `assertTotalsMatch`; use server-computed totals in insert |
| `apps/web/drizzle/<next-number>_payment_failed_enum.sql` | New migration file with `ALTER TYPE` |
| `docs/completed.md` | Note size-hint removal under §4.8 |

### Deleted files

| Path | Reason |
|---|---|
| `apps/web/src/app/api/orders/size-hint/` (entire directory) | Endpoint backing the deleted `getPreviousSizeHint` feature |

---

## Verification approach (project-wide)

This repo has **no automated test suite**. `pnpm check-types:web` is the only correctness gate. Every task's verification step is:

1. `pnpm check-types:web` must pass.
2. Where relevant, a one-line `grep` confirms the change landed.
3. End-to-end smoke testing is reserved for the final task and uses Stripe test cards on the dev server.

Do **not** invent Jest/Playwright tests — none exist in this codebase. The harness at `apps/web/tests/print/print-qa.mjs` is for one specific feature and is not a general suite.

---

## Branch

Create a feature branch from `main`:

```bash
git checkout -b prelaunch-hardening
```

All tasks below commit to this branch. Final squash-merge to `main` at the end.

---

## Task 1: Remove `getPreviousSizeHint` feature entirely

**Spec:** §2.7

**Files:**
- Delete: `apps/web/src/app/api/orders/size-hint/` (entire directory)
- Modify: `apps/web/src/db/queries.ts` (remove `getPreviousSizeHint`, lines ~427-467)
- Modify: `apps/web/src/app/[tenant]/item/[itemId]/interactive.tsx` (remove fetch + state + JSX)
- Modify: `docs/completed.md` (one-line note under §4.8)

- [ ] **Step 1: Delete the API route directory**

```bash
rm -rf apps/web/src/app/api/orders/size-hint
```

- [ ] **Step 2: Delete `getPreviousSizeHint` from `db/queries.ts`**

Open `apps/web/src/db/queries.ts`, find the `export async function getPreviousSizeHint(...)` block (around line 427-467) and remove it entirely along with any orphaned imports it pulled in. TypeScript will flag downstream issues in Step 4.

- [ ] **Step 3: Remove client fetch + state + JSX from `interactive.tsx`**

Open `apps/web/src/app/[tenant]/item/[itemId]/interactive.tsx`. Remove:
- The `fetch('/api/orders/size-hint?...')` call at line ~36 and its surrounding `useEffect`.
- Any `useState` holding the hint result (typically named `previousSize` or similar).
- The hint render block (was around line 173-178; usually a small `<p>` reading "...wore size X last year" or similar).
- The hint-related imports if no longer referenced.

- [ ] **Step 4: Type-check**

Run:
```bash
pnpm check-types:web
```
Expected: PASS with no errors. If TypeScript flags an unused import or a reference in another file (e.g. `app/[tenant]/item/[itemId]/page.tsx` might thread a `previousSizeHint` prop), remove those too until the type-check is clean.

- [ ] **Step 5: Grep verification**

Run:
```bash
grep -rn "getPreviousSizeHint\|size-hint" apps/web/src
```
Expected: zero matches.

- [ ] **Step 6: Update completed.md**

Open `docs/completed.md`, find §4.8 (the "Riley wore size X last year" entry), and append:
> Removed 2026-05-12 — see `docs/remaining_work.md` §2.14 for reasoning.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/api/orders apps/web/src/db/queries.ts apps/web/src/app/\[tenant\]/item/\[itemId\]/interactive.tsx docs/completed.md
git commit -m "chore: remove getPreviousSizeHint feature

Drop the 'Riley wore size 14 last year' hint instead of fixing the
wrong-child bug for multi-child parents (see remaining_work.md §2.14).
Parents who want past-size info can check order history at
/orders/[orderId], which already shows garment + size purchased.

Removes:
- getPreviousSizeHint function in db/queries.ts
- /api/orders/size-hint/ route directory
- Client fetch + state + JSX in interactive.tsx"
```

---

## Task 2: Tenant footer + per-tenant Contact page

**Spec:** §2.1 + §2.2

**Files:**
- Create: `apps/web/src/components/tenant-footer.tsx`
- Create: `apps/web/src/app/[tenant]/contact/page.tsx`
- Modify: `apps/web/src/components/mobile-shell.tsx`
- Modify: each tenant page that uses `MobileShell` — pass `tenant` prop

- [ ] **Step 1: Create `tenant-footer.tsx`**

Create `apps/web/src/components/tenant-footer.tsx`:

```tsx
import Link from "next/link";
import type { TenantRow } from "@/db/schema";

export function TenantFooter({ tenant }: { tenant: TenantRow }) {
  const showRefund = tenant.currentLegalVersionId !== null;
  return (
    <footer className="border-t border-rule bg-parchment px-5 py-4 text-[12px] leading-relaxed text-ink-dim">
      <nav aria-label="Tenant policies" className="flex flex-wrap gap-x-4 gap-y-1.5">
        {showRefund && (
          <Link className="underline hover:text-ink" href={`/${tenant.id}/refund-policy`}>
            Refund policy
          </Link>
        )}
        <Link className="underline hover:text-ink" href={`/${tenant.id}/contact`}>
          Contact
        </Link>
        <Link className="underline hover:text-ink" href="/privacy">
          Privacy
        </Link>
        <Link className="underline hover:text-ink" href="/terms">
          Terms
        </Link>
      </nav>
      {(tenant.shopEmail || tenant.shopHours) && (
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {tenant.shopEmail && (
            <>
              <dt className="font-semibold">Email</dt>
              <dd>
                <a className="underline hover:text-ink" href={`mailto:${tenant.shopEmail}`}>
                  {tenant.shopEmail}
                </a>
              </dd>
            </>
          )}
          {tenant.shopHours && (
            <>
              <dt className="font-semibold">Hours</dt>
              <dd className="whitespace-pre-wrap">{tenant.shopHours}</dd>
            </>
          )}
        </dl>
      )}
    </footer>
  );
}
```

If `TenantRow` is not yet exported from `db/schema.ts`, add it. Check first with `grep "export type TenantRow" apps/web/src/db/schema.ts`. It exists per pre-flight; line ~261.

- [ ] **Step 2: Modify `mobile-shell.tsx` to accept and render the footer**

Open `apps/web/src/components/mobile-shell.tsx`. Add an optional `tenant?: TenantRow` prop (import the type from `@/db/schema`). Inside the layout, render `<TenantFooter tenant={tenant} />` at the end of the scrolled content area, before the slot that holds `BottomNav`. The footer must sit in the normal scroll flow (not fixed) so it appears at the end of content.

Example structure (preserve existing wrapper classes):
```tsx
import { TenantFooter } from "@/components/tenant-footer";
import type { TenantRow } from "@/db/schema";

export function MobileShell({
  children,
  bg,
  tenant,
}: {
  children: React.ReactNode;
  bg?: string;
  tenant?: TenantRow;
}) {
  return (
    <div /* existing classes */ style={bg ? { background: bg } : undefined}>
      {children}
      {tenant && <TenantFooter tenant={tenant} />}
      {/* BottomNav slot (existing) */}
    </div>
  );
}
```

Match the actual file's structure — do not blindly overwrite layout classes.

- [ ] **Step 3: Thread `tenant` into every tenant page's `MobileShell`**

For each of the following pages, find the `<MobileShell ...>` JSX and add `tenant={tenantRecord}` (using whichever variable name the file uses for the raw `getTenant` result — typically `tenantRecord` or `tenantRow`):

- `apps/web/src/app/[tenant]/page.tsx`
- `apps/web/src/app/[tenant]/cart/page.tsx`
- `apps/web/src/app/[tenant]/checkout/page.tsx`
- `apps/web/src/app/[tenant]/order/placed/page.tsx`
- `apps/web/src/app/[tenant]/refund-policy/page.tsx`

Per pre-flight, all of these already fetch the tenant via `getTenant(slug)`. Pass the **raw row** (not the `toTenantBrand`-converted shape) so the footer has access to `shopEmail`, `shopHours`, `currentLegalVersionId`.

- [ ] **Step 4: Create `app/[tenant]/contact/page.tsx`**

Create `apps/web/src/app/[tenant]/contact/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTenant } from "@/db/queries";
import { getSessionUser, isPlatformAdminEmail } from "@/lib/auth/authorization";
import { MobileShell } from "@/components/mobile-shell";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string }>;
}): Promise<Metadata> {
  const { tenant: slug } = await params;
  const tenant = await getTenant(slug);
  if (!tenant) return { title: "Contact" };
  return { title: `Contact ${tenant.name}`, robots: { index: true } };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const tenant = await getTenant(slug);
  if (!tenant) notFound();

  // Same public-visibility gate as catalog home
  const isVisibleToPublic =
    tenant.isPubliclyListed && tenant.platformApprovalStatus === "approved";
  if (!isVisibleToPublic) {
    const user = await getSessionUser();
    if (!user || !isPlatformAdminEmail(user.email)) notFound();
  }

  return (
    <MobileShell bg="var(--color-paper)" tenant={tenant}>
      <div className="px-5 py-6">
        <h1
          className="font-serif text-2xl font-semibold pb-2 mb-4 border-b-2"
          style={{ borderColor: tenant.accent }}
        >
          Contact {tenant.name}
        </h1>
        <div className="space-y-4 text-sm leading-6 text-ink">
          {tenant.shopEmail && (
            <section>
              <div className="text-ink-dim text-xs uppercase tracking-wide">Email</div>
              <a
                className="underline hover:text-ink-dim"
                href={`mailto:${tenant.shopEmail}`}
              >
                {tenant.shopEmail}
              </a>
            </section>
          )}
          {tenant.shopHours && (
            <section>
              <div className="text-ink-dim text-xs uppercase tracking-wide">Shop hours</div>
              <p className="whitespace-pre-wrap">{tenant.shopHours}</p>
            </section>
          )}
          {tenant.address && (
            <section>
              <div className="text-ink-dim text-xs uppercase tracking-wide">Address</div>
              <p className="whitespace-pre-wrap">{tenant.address}</p>
            </section>
          )}
          {tenant.collectionInstructions && (
            <section>
              <div className="text-ink-dim text-xs uppercase tracking-wide">
                Collection instructions
              </div>
              <p className="whitespace-pre-wrap">{tenant.collectionInstructions}</p>
            </section>
          )}
        </div>
      </div>
    </MobileShell>
  );
}
```

- [ ] **Step 5: Type-check**

```bash
pnpm check-types:web
```
Expected: PASS.

- [ ] **Step 6: Smoke (manual)**

Start dev server (`pnpm dev:web`), visit:
- `http://localhost:3000/nsbh` — footer renders at end of catalog with all four links.
- `http://localhost:3000/nsbh/cart`, `/checkout`, `/refund-policy` — footer present.
- `http://localhost:3000/nsbh/contact` — page renders with email, hours, address, collection instructions if present.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/tenant-footer.tsx apps/web/src/components/mobile-shell.tsx apps/web/src/app/\[tenant\]
git commit -m "feat: tenant footer with policy links + contact page

Surface refund-policy, contact, privacy, terms across all tenant
routes via a new <TenantFooter> rendered inside MobileShell.
Refund policy link omits when tenant has no policy version set
(currentLegalVersionId is null).

Adds /[tenant]/contact reading shopEmail, shopHours, address,
collectionInstructions captured during onboarding."
```

---

## Task 3: SEO basics — sitemap, robots, generateMetadata

**Spec:** §2.3

**Files:**
- Create: `apps/web/src/app/sitemap.ts`
- Create: `apps/web/src/app/robots.ts`
- Modify: `apps/web/src/app/[tenant]/layout.tsx` (add `generateMetadata`)
- Modify: `apps/web/src/app/[tenant]/item/[itemId]/page.tsx` (add `generateMetadata`)

- [ ] **Step 1: Create `app/sitemap.ts`**

Create `apps/web/src/app/sitemap.ts`:

```ts
import type { MetadataRoute } from "next";
import { getPubliclyListedTenants, getActiveCatalog } from "@/db/queries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://uniformorder.online";
  const tenants = await getPubliclyListedTenants();
  const perTenant = await Promise.all(
    tenants.map(async (tenant) => {
      const items = await getActiveCatalog(tenant.id);
      return [
        { url: `${base}/${tenant.id}`, changeFrequency: "weekly" as const },
        { url: `${base}/${tenant.id}/contact`, changeFrequency: "monthly" as const },
        ...items.map((item) => ({
          url: `${base}/${tenant.id}/item/${item.id}`,
          changeFrequency: "weekly" as const,
        })),
      ];
    }),
  );
  return perTenant.flat();
}
```

- [ ] **Step 2: Create `app/robots.ts`**

Create `apps/web/src/app/robots.ts`:

```ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://uniformorder.online";
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/platform", "/auth", "/api"] },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
```

- [ ] **Step 3: Add `generateMetadata` to `[tenant]/layout.tsx`**

Open `apps/web/src/app/[tenant]/layout.tsx`. Add at the top (after imports):

```ts
import type { Metadata } from "next";
import { getTenant } from "@/db/queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string }>;
}): Promise<Metadata> {
  const { tenant: slug } = await params;
  const tenant = await getTenant(slug);
  if (!tenant) return { title: "Uniform shop" };
  return {
    title: `${tenant.name} Uniform Shop`,
    description: tenant.motto ?? `${tenant.name} parent uniform shop`,
    openGraph: {
      title: `${tenant.name} Uniform Shop`,
      images: tenant.logoUrl ? [{ url: tenant.logoUrl }] : [],
    },
  };
}
```

If the layout file already defines `generateMetadata` for some other reason (unlikely — pre-flight saw only `app/[tenant]/refund-policy/page.tsx` using it), reconcile manually.

- [ ] **Step 4: Add `generateMetadata` to `item/[itemId]/page.tsx`**

Open `apps/web/src/app/[tenant]/item/[itemId]/page.tsx`. Add at the top (after imports):

```ts
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string; itemId: string }>;
}): Promise<Metadata> {
  const { tenant: slug, itemId } = await params;
  const [tenant, items] = await Promise.all([getTenant(slug), getActiveCatalog(slug)]);
  const item = items.find((i) => i.id === itemId);
  if (!tenant || !item) return { title: "Item" };
  return {
    title: `${item.name} — ${tenant.name}`,
    description: item.description ?? `${item.name} available from ${tenant.name}`,
    alternates: { canonical: `/${tenant.id}/item/${itemId}` },
  };
}
```

Note: `alternates.canonical` sets a `<link rel="canonical">` tag pointing to the bare URL. Search engines honour this and consolidate signals onto the canonical URL when the page is reached via `?cat=…`. Next.js does not rewrite the user's URL.

- [ ] **Step 5: Type-check**

```bash
pnpm check-types:web
```
Expected: PASS.

- [ ] **Step 6: Smoke (manual)**

With dev server running:

```bash
curl -s http://localhost:3000/sitemap.xml | head -40
curl -s http://localhost:3000/robots.txt
```
Expected: sitemap lists nsbh + rgsh entries (catalog, contact, item URLs). robots disallows /admin /platform /auth /api.

Open `http://localhost:3000/nsbh` and view source — `<title>` reads "North Sydney Boys High School Uniform Shop" (or whatever NSBH's `name` is).

Open `http://localhost:3000/nsbh/item/<some-id>` and view source — `<link rel="canonical">` points at `/nsbh/item/<some-id>` (no query params).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/sitemap.ts apps/web/src/app/robots.ts apps/web/src/app/\[tenant\]/layout.tsx apps/web/src/app/\[tenant\]/item/\[itemId\]/page.tsx
git commit -m "feat: SEO basics — sitemap, robots, generateMetadata

Adds:
- app/sitemap.ts enumerating publicly-listed tenants × items
- app/robots.ts disallowing /admin /platform /auth /api
- generateMetadata on [tenant]/layout (per-tenant title, OG, description)
- generateMetadata on item PDPs (per-item title + canonical URL)

Strict visibility: sitemap includes only tenants with
isPubliclyListed=true AND platformApprovalStatus='approved'.
Canonical URL on PDPs strips ?cat= via rel=canonical tag."
```

---

## Task 4: Extract `lib/shipping.ts` + `lib/order-totals.ts` helpers

**Spec:** §2.6 (helpers only; enforcement lands in Task 5)

**Files:**
- Create: `apps/web/src/lib/shipping.ts`
- Create: `apps/web/src/lib/order-totals.ts`
- Modify: `apps/web/src/app/[tenant]/checkout/checkout-screen.tsx` (import `SHIP_FEE_AUD`, replace literal 9.5)

- [ ] **Step 1: Create `lib/shipping.ts`**

Create `apps/web/src/lib/shipping.ts`:

```ts
// Flat per-order shipping fee in AUD. Today this is the only delivery option.
// Per-tenant rates are tracked in remaining_work.md as a follow-up.
export const SHIP_FEE_AUD = 9.5;
```

- [ ] **Step 2: Create `lib/order-totals.ts`**

Create `apps/web/src/lib/order-totals.ts`:

```ts
import { SHIP_FEE_AUD } from "./shipping";

export type LineInput = {
  unitPrice: number; // AUD dollars (e.g. 19.95)
  qty: number; // positive integer
};

export type ComputedTotals = {
  subtotal: number; // AUD dollars, 2dp
  gst: number; // AUD dollars, 2dp — 1/11 of GST-inclusive total
  total: number; // AUD dollars, 2dp — subtotal + shipping
};

export type DeliveryMode = "pickup" | "ship";

// Round to 2dp using half-away-from-zero (Math.round behaviour).
// Matches the toFixed(2) display rounding used elsewhere.
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeTotals(args: {
  lines: LineInput[];
  delivery: DeliveryMode;
}): ComputedTotals {
  const subtotal = round2(
    args.lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0),
  );
  const ship = args.delivery === "ship" ? SHIP_FEE_AUD : 0;
  const total = round2(subtotal + ship);
  // GST is 1/11 of GST-inclusive total — AU standard for GST-inclusive pricing.
  const gst = round2(total / 11);
  return { subtotal, gst, total };
}

export class TotalsMismatchError extends Error {
  constructor(
    readonly expected: ComputedTotals,
    readonly received: { subtotal: number; gst: number; total: number },
  ) {
    super("totals_mismatch");
  }
}

export function assertTotalsMatch(args: {
  lines: LineInput[];
  delivery: DeliveryMode;
  received: { subtotal: number; gst: number; total: number };
}): ComputedTotals {
  const expected = computeTotals({ lines: args.lines, delivery: args.delivery });
  const TOLERANCE = 0.01; // 1 cent
  const ok =
    Math.abs(expected.subtotal - args.received.subtotal) <= TOLERANCE &&
    Math.abs(expected.gst - args.received.gst) <= TOLERANCE &&
    Math.abs(expected.total - args.received.total) <= TOLERANCE;
  if (!ok) throw new TotalsMismatchError(expected, args.received);
  return expected;
}
```

- [ ] **Step 3: Replace the hardcoded `9.5` in `checkout-screen.tsx`**

Open `apps/web/src/app/[tenant]/checkout/checkout-screen.tsx`. Find (around line 135):

```ts
const ship = delivery === "ship" ? 9.5 : 0;
```

Replace with:

```ts
const ship = delivery === "ship" ? SHIP_FEE_AUD : 0;
```

Add the import at the top of the file:

```ts
import { SHIP_FEE_AUD } from "@/lib/shipping";
```

- [ ] **Step 4: Type-check**

```bash
pnpm check-types:web
```
Expected: PASS.

- [ ] **Step 5: Grep verification**

```bash
grep -n "9.5\|9\\.5" apps/web/src/app/\[tenant\]/checkout/checkout-screen.tsx
```
Expected: no hardcoded 9.5 in checkout-screen.tsx (other than perhaps in unrelated comments).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/shipping.ts apps/web/src/lib/order-totals.ts apps/web/src/app/\[tenant\]/checkout/checkout-screen.tsx
git commit -m "refactor: extract lib/shipping.ts + lib/order-totals.ts helper

New helpers:
- lib/shipping.ts exports SHIP_FEE_AUD = 9.5 (the flat ship fee).
- lib/order-totals.ts exports computeTotals + assertTotalsMatch.

GST uses 1/11 of GST-inclusive total (AU standard, matches Reports
page). Works in dollars throughout — Stripe cents conversion stays
at the Stripe API boundary. 1¢ tolerance for floating-point rounding.

Checkout screen now imports SHIP_FEE_AUD instead of the inline literal.
Server-side enforcement lands in the next commit."
```

---

## Task 5: Server-side total assertion in `/api/orders` + `/api/stripe/payment-intent`

**Spec:** §2.6 enforcement

**Files:**
- Modify: `apps/web/src/app/api/orders/route.ts`
- Modify: `apps/web/src/app/api/stripe/payment-intent/route.ts`

- [ ] **Step 1: Add assertion in `/api/orders` POST handler**

Open `apps/web/src/app/api/orders/route.ts`. Locate the validation block that checks `typeof subtotal !== "number" || ...` (around line 141). **After** that block (and before the `existingOrder` idempotency check at line ~157), add:

```ts
import { assertTotalsMatch, TotalsMismatchError } from "@/lib/order-totals";
// ↑ at top of file alongside other imports

// ... inside POST handler, after the type-validation 400 ...
let verifiedTotals;
try {
  verifiedTotals = assertTotalsMatch({
    lines: lines.map((l: { unitPrice: number; qty: number }) => ({
      unitPrice: l.unitPrice,
      qty: l.qty,
    })),
    delivery: delivery === "ship" ? "ship" : "pickup",
    received: { subtotal, gst, total },
  });
} catch (err) {
  if (err instanceof TotalsMismatchError) {
    return NextResponse.json(
      { error: "totals_mismatch", expected: err.expected, received: err.received },
      { status: 400 },
    );
  }
  throw err;
}
```

Then **use `verifiedTotals.subtotal/gst/total` instead of the client-supplied `subtotal/gst/total`** in the `db.insert(orders).values({...})` call inside `insertOrder`. Concretely:

```ts
subtotal: String(verifiedTotals.subtotal),
gst: String(verifiedTotals.gst),
total: String(verifiedTotals.total),
```

- [ ] **Step 2: Add assertion in `/api/stripe/payment-intent` POST handler**

Open `apps/web/src/app/api/stripe/payment-intent/route.ts`. The current handler accepts `{ tenantId, amount, currency, metadata }` from the request. We extend it to accept `lines`, `delivery`, `subtotal`, `gst` so the server can verify totals before issuing the PaymentIntent.

Read the file first to confirm exact line numbers, then:

1. Extract `lines`, `delivery`, `subtotal`, `gst`, `total` from `body` (where `total === amount`).
2. Run `assertTotalsMatch` with the same shape as Task 5 Step 1.
3. On `TotalsMismatchError`, return 400 with `{ error: 'totals_mismatch', expected, received }`.
4. Use `Math.round(verifiedTotals.total * 100)` as the PI `amount` parameter (Stripe cents conversion at the boundary).

Concrete change:
```ts
import { assertTotalsMatch, TotalsMismatchError } from "@/lib/order-totals";
// ↑ at top

// inside POST handler, after auth + tenant lookup, before paymentIntents.create:
const { lines, delivery, subtotal, gst } = body;
if (!Array.isArray(lines) || typeof subtotal !== "number" || typeof gst !== "number") {
  return NextResponse.json({ error: "Missing totals payload" }, { status: 400 });
}
let verified;
try {
  verified = assertTotalsMatch({
    lines: lines.map((l: { unitPrice: number; qty: number }) => ({
      unitPrice: l.unitPrice,
      qty: l.qty,
    })),
    delivery: delivery === "ship" ? "ship" : "pickup",
    received: { subtotal, gst, total: amount },
  });
} catch (err) {
  if (err instanceof TotalsMismatchError) {
    return NextResponse.json(
      { error: "totals_mismatch", expected: err.expected, received: err.received },
      { status: 400 },
    );
  }
  throw err;
}

// Then pass verified.total (in cents) to Stripe:
const stripeAmount = Math.round(verified.total * 100);
// ... paymentIntents.create({ amount: stripeAmount, currency: 'aud', ... })
```

- [ ] **Step 3: Update the client to send `lines`, `delivery`, `subtotal`, `gst` in the PI request**

Open `apps/web/src/app/[tenant]/checkout/checkout-screen.tsx`. Find the `fetch("/api/stripe/payment-intent", {...})` call (around line 187). Extend the JSON body:

```ts
body: JSON.stringify({
  tenantId: tenant.id,
  amount: total,
  currency: "aud",
  lines: lines.map((l) => ({ unitPrice: l.unitPrice, qty: l.qty })),
  delivery,
  subtotal,
  gst,
  metadata: {
    parentEmail: student.email,
    studentName: student.studentName,
    studentYear: student.year,
    delivery,
  },
}),
```

- [ ] **Step 4: Type-check**

```bash
pnpm check-types:web
```
Expected: PASS.

- [ ] **Step 5: Smoke (manual)**

Start dev server. Place a test order with the card test number `4242 4242 4242 4242`. Verify the order completes normally (no 400 totals_mismatch).

Tamper test: open browser devtools → Network → catch the POST to `/api/orders`, modify the `total` value to `1`, and resubmit (right-click → "Resend"). Verify the response is `400 { error: 'totals_mismatch', ... }`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/orders/route.ts apps/web/src/app/api/stripe/payment-intent/route.ts apps/web/src/app/\[tenant\]/checkout/checkout-screen.tsx
git commit -m "feat: server-side total assertion in order + PI endpoints

Both POST /api/orders and POST /api/stripe/payment-intent now
recompute subtotal/gst/total server-side via assertTotalsMatch
and reject mismatches with HTTP 400 totals_mismatch.

Server-computed totals are authoritative — stored in the orders
row and passed to Stripe (as Math.round(total * 100) cents).
Client values are validated but never persisted directly.

Client checkout-screen extended to send lines + delivery + subtotal
+ gst to /api/stripe/payment-intent so the assertion can run."
```

---

## Task 6: `payment_intent.payment_failed` webhook + dashboard-refund audit + retry transition

**Spec:** §2.5

**Files:**
- Modify: `apps/web/src/lib/audit/types.ts` (extend `AuditActorRole`)
- Modify: `apps/web/src/db/schema.ts` (add `'payment_failed'` to `orderStatusEnum`)
- Create: `apps/web/drizzle/<next-number>_payment_failed_enum.sql`
- Modify: `apps/web/src/app/api/stripe/webhook/route.ts` (new branch + audit-log call)
- Modify: `apps/web/src/app/api/stripe/payment-intent/route.ts` (retry transition)
- Modify: `apps/web/src/db/queries.ts` (`listOrdersForParent` filter)
- Apply migration via Neon MCP

- [ ] **Step 1: Extend `AuditActorRole` to include `"system"`**

Open `apps/web/src/lib/audit/types.ts:10`. Change:

```ts
export type AuditActorRole = "operator" | "platform_admin";
```

to:

```ts
export type AuditActorRole = "operator" | "platform_admin" | "system";
```

This unblocks the webhook calls in Step 4 and Step 5 below.

- [ ] **Step 2: Add `'payment_failed'` to `orderStatusEnum` in `db/schema.ts`**

Open `apps/web/src/db/schema.ts:18-19`. The current enum starts with `'pending_payment'`. Add `'payment_failed'` to the literal array:

```ts
export const orderStatusEnum = pgEnum("order_status", [
  "pending_payment",
  "payment_failed",
  "new",
  // ... whatever else is already there ...
]);
```

Read the full current list before editing — do not drop existing values.

- [ ] **Step 3: Generate the migration SQL file and apply it via Neon MCP**

Per the documented workaround (`/Volumes/T7/georgeqiao/.claude/projects/-Volumes-T7-georgeqiao-dev-uniform-order/memory/project_drizzle_kit_websocket_blocker.md`), `drizzle-kit migrate` hangs in this environment. Instead:

1. Run `pnpm --filter web drizzle-kit generate` to emit the new migration SQL file under `apps/web/drizzle/`. The generated file should contain `ALTER TYPE "order_status" ADD VALUE 'payment_failed';` (or similar). Commit the file as-is.

2. Apply the SQL manually against the dev Neon branch using the Neon MCP `run_sql_transaction` tool. The SQL is:

   ```sql
   ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'payment_failed';
   ```

3. Insert the corresponding row into `__drizzle_migrations` so future migrations don't try to re-apply (use the hash from the generated migration file's name or metadata):

   ```sql
   INSERT INTO __drizzle_migrations (hash, created_at)
   VALUES ('<generated-hash>', extract(epoch from now()) * 1000);
   ```

   (Verify the `__drizzle_migrations` columns exist in that schema before running — adjust types if `created_at` is a timestamp not a bigint.)

4. Verify:

   ```sql
   SELECT enum_range(NULL::order_status);
   ```
   The result should include `payment_failed`.

- [ ] **Step 4: Add `payment_intent.payment_failed` branch to `webhook/route.ts`**

Open `apps/web/src/app/api/stripe/webhook/route.ts`. After the `payment_intent.succeeded` branch (ends around line 88), add:

```ts
// ─── payment_intent.payment_failed ────────────────────────────────────────
if (event.type === "payment_intent.payment_failed") {
  const pi = event.data.object as Stripe.PaymentIntent;
  const flipped = await db
    .update(orders)
    .set({ status: "payment_failed" })
    .where(
      and(
        eq(orders.stripePaymentIntentId, pi.id),
        eq(orders.status, "pending_payment"),
      ),
    )
    .returning({ id: orders.id, tenantId: orders.tenantId });

  if (flipped.length === 1) {
    await logAuditEvent({
      tenantId: flipped[0].tenantId,
      actorEmail: "stripe-webhook",
      actorRole: "system",
      action: "order.payment_failed",
      targetType: "order",
      targetId: flipped[0].id,
      payload: {
        paymentIntentId: pi.id,
        lastPaymentError: pi.last_payment_error?.message ?? null,
        declineCode: pi.last_payment_error?.decline_code ?? null,
      },
    });
  } else {
    console.info("stripe webhook: no pending_payment order matched payment_failed", pi.id);
  }

  return NextResponse.json({ received: true });
}
```

Add the import at the top:

```ts
import { logAuditEvent } from "@/lib/audit/log";
```

- [ ] **Step 5: Add audit log to `charge.refunded` branch**

Inside the existing `charge.refunded` branch (`webhook/route.ts:137-184`), after the order status update (line ~177-183), before the closing `}` of the `if (orderRow)` block, add:

```ts
const totalRefundedCents = refunds.reduce(
  (sum, r) => sum + (r.amount ?? 0),
  0,
);
await logAuditEvent({
  tenantId: null, // we don't have it in this scope; webhook doesn't need it for filtering
  actorEmail: "stripe-webhook",
  actorRole: "system",
  action: "order.refunded.via_dashboard",
  targetType: "order",
  targetId: orderRow.id,
  payload: {
    chargeId: charge.id,
    amountRefundedCents: totalRefundedCents,
    fullyRefunded: charge.refunded ?? false,
  },
});
```

If `tenantId` is needed for the audit-log filter index, fetch it alongside the existing order query (extend the `select({ id, total, status, tenantId: orders.tenantId })` shape).

- [ ] **Step 6: Add retry transition in `/api/stripe/payment-intent`**

Open `apps/web/src/app/api/stripe/payment-intent/route.ts`. The endpoint already takes `tenantId` and `amount` from the body. To support retry-after-failure, the parent's client may have an existing `orderId` from a prior failed attempt — but in this codebase the order is created in `/api/orders` *after* successful payment, not before. So the retry-transition logic operates on **orders that were created by `/api/orders` and have a `stripePaymentIntentId` already set**.

Inspect the current endpoint to confirm what state it operates on. If the PI is always created fresh per click (no `orderId` in the body), the retry transition still has a role: if a previous PI was created for the same parent+cart, the resulting `orders` row (if it exists) is in `payment_failed`. The flip-back happens **inside the webhook handler for the new PI's success**, not in `/api/stripe/payment-intent`.

**Concretely:** the spec's retry-transition rule is implemented by **widening the `payment_intent.succeeded` WHERE clause** to also accept `payment_failed`:

Open `apps/web/src/app/api/stripe/webhook/route.ts:62-66`. Change:

```ts
.where(and(eq(orders.stripePaymentIntentId, pi.id), eq(orders.status, "pending_payment")))
```

to:

```ts
.where(
  and(
    eq(orders.stripePaymentIntentId, pi.id),
    inArray(orders.status, ["pending_payment", "payment_failed"]),
  ),
)
```

Add `inArray` to the `drizzle-orm` import at the top of the file.

This correctly handles the case where: parent's first PI failed → webhook set status to `payment_failed` → parent retried → /api/orders is called again (idempotency check finds no matching `stripePaymentIntentId` because a fresh PI was issued → new orders row created with new PI id) → succeeded webhook flips the (new) row. The **old** failed row stays in `payment_failed`, hidden from /orders by Step 7's filter.

(If on inspection `/api/orders` reuses the same row by PI id, the retry path is different; but the current code at orders/route.ts:155-167 issues 409 if a different user grabs an existing PI's order, otherwise 200-idempotent. Fresh PI per click means fresh order row per attempt, which is the assumed flow.)

- [ ] **Step 7: Filter `payment_failed` out of `listOrdersForParent`**

Open `apps/web/src/db/queries.ts` and find `listOrdersForParent`. Inside its WHERE clause, add a predicate excluding `payment_failed`:

```ts
import { ne } from "drizzle-orm"; // if not already imported

// inside listOrdersForParent's .where(...) — combine with existing predicates via and(...)
ne(orders.status, "payment_failed"),
```

- [ ] **Step 8: Type-check**

```bash
pnpm check-types:web
```
Expected: PASS.

- [ ] **Step 9: Smoke (manual)**

With dev server running and Stripe test webhooks forwarded (`stripe listen --forward-to localhost:3000/api/stripe/webhook` or the equivalent):

1. Place a normal order with `4242 4242 4242 4242` → confirm webhook flips `pending_payment → new`.
2. Place an order with `4000 0000 0000 0002` (declines) → confirm webhook flips `pending_payment → payment_failed`; verify the audit_events table has an `order.payment_failed` row; verify `/orders` does NOT list the failed row.
3. Retry: from checkout, submit again with a good card → new PI, new order row, succeeds → webhook flips new row to `new`. Old failed row remains in `payment_failed` and stays hidden from /orders.
4. Trigger a Stripe Dashboard refund on a paid order → webhook flips status to `refunded`/`partially_refunded` AND inserts an audit row with `action: 'order.refunded.via_dashboard'`.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/lib/audit/types.ts apps/web/src/db/schema.ts apps/web/drizzle apps/web/src/app/api/stripe/webhook/route.ts apps/web/src/app/api/stripe/payment-intent/route.ts apps/web/src/db/queries.ts
git commit -m "feat: payment_failed webhook + dashboard-refund audit + retry transition

- Extend orderStatusEnum with 'payment_failed' (migration via Neon MCP).
- Extend AuditActorRole to include 'system' for webhook-originated events.
- New payment_intent.payment_failed branch transitions pending_payment ->
  payment_failed and audit-logs the decline_code + error message.
- charge.refunded now audit-logs the dashboard-initiated refund
  (closes the TODO at refund/route.ts:176-178).
- payment_intent.succeeded WHERE clause broadened to accept
  pending_payment OR payment_failed, so retries-after-failure
  transition cleanly to 'new'.
- listOrdersForParent hides payment_failed rows from the parent
  /orders view; admin Kanban and audit surfaces are unaffected."
```

---

## Task 7: Stripe PaymentElement swap (Apple Pay + Google Pay via deferred-intent)

**Spec:** §2.4

**Files:**
- Modify: `apps/web/src/app/[tenant]/checkout/checkout-screen.tsx`
- Create: `apps/web/public/.well-known/apple-developer-merchantid-domain-association`

- [ ] **Step 1: Replace eager `stripe.elements()` with deferred-intent initialisation**

Open `apps/web/src/app/[tenant]/checkout/checkout-screen.tsx`. The current code (lines ~80-130) calls `stripe.elements()` with no args and mounts a Card element. Replace the entire Stripe mount `useEffect` body with deferred-intent + PaymentElement.

The key constraint: `stripe.elements({ mode: 'payment', amount, currency, paymentMethodCreation: 'manual' })` requires `amount` at element-creation time. We compute `total` before the effect runs (it's derived from `lines` and `delivery`), so the mount effect depends on `total`.

Replace the `useEffect` body (preserving the cancellation pattern):

```tsx
useEffect(() => {
  let cancelled = false;
  if (!stripePromise) return;

  stripePromise.then((stripe) => {
    if (cancelled) return;
    if (!stripe) {
      setPaymentReady(false);
      setPaymentError(
        "Payment form could not load. Please refresh the page or contact the shop.",
      );
      return;
    }
    if (!paymentMountRef.current) return;

    const elements = stripe.elements({
      mode: "payment",
      amount: Math.round(total * 100), // cents at Stripe boundary
      currency: "aud",
      paymentMethodCreation: "manual",
      appearance: {
        theme: "stripe",
        variables: {
          colorPrimary: tenant.accent,
          fontFamily: "Inter, system-ui, sans-serif",
        },
      },
    });
    const paymentElement = elements.create("payment", { layout: "tabs" });

    paymentElement.on("ready", () => {
      if (paymentLockedRef.current) return;
      setPaymentReady(true);
      setPaymentError("");
    });
    paymentElement.on("change", (e) => {
      if (paymentLockedRef.current) return;
      // PaymentElement change event has no top-level error; surface validation
      // failures from elements.submit() at click time instead.
      if (!e.complete) setPaymentError("");
    });
    paymentElement.mount(paymentMountRef.current);

    stripeRef.current = stripe;
    elementsRef.current = elements;
    paymentElementRef.current = paymentElement;
  }).catch(() => {
    if (cancelled) return;
    setPaymentReady(false);
    setPaymentError(
      "Payment form could not load. Please refresh the page or contact the shop.",
    );
  });

  return () => {
    cancelled = true;
    paymentElementRef.current?.destroy();
    paymentElementRef.current = null;
    elementsRef.current = null;
    stripeRef.current = null;
    setPaymentReady(false);
  };
}, [total, tenant.accent]); // re-mount when amount changes
```

Rename `cardMountRef` → `paymentMountRef` and `cardRef` → `paymentElementRef` throughout. Update the corresponding `useRef<…>` types: `paymentElementRef` is `StripePaymentElement` (import from `@stripe/stripe-js`).

Update JSX mount point:

```tsx
<div id="payment-element" ref={paymentMountRef} />
```

- [ ] **Step 2: Update `onPay` to use `confirmPayment`**

In the same file, locate `onPay` (around line 156). Replace the section that calls `stripe.confirmCardPayment` (line ~216) with the deferred-intent submit + confirmPayment flow.

The full updated `onPay` body, from after the `paymentIntentRes.ok` check through to the existing success path:

```ts
const { clientSecret } = await paymentIntentRes.json();
if (typeof clientSecret !== "string" || !clientSecret) {
  setPaymentError("Payment could not be started. Please contact the shop.");
  setPaying(false);
  return;
}

// Deferred-intent flow: submit first, then confirm with the PI's clientSecret.
const { error: submitError } = await elementsRef.current!.submit();
if (submitError) {
  setPaymentError(submitError.message ?? "Payment validation failed");
  setPaying(false);
  return;
}

const { error, paymentIntent } = await stripeRef.current!.confirmPayment({
  elements: elementsRef.current!,
  clientSecret,
  confirmParams: {
    return_url: `${window.location.origin}/${tenant.id}/order/placed`,
    payment_method_data: {
      billing_details: {
        name: student.parentName,
        email: student.email,
        phone: student.mobile,
      },
    },
  },
  redirect: "if_required",
});
```

Keep the existing error-handling block below (the `if (error) { posthog.capture("payment_failed", ...) ... }` and the `paymentIntent.status !== "succeeded"` checks) — they remain valid; they just now run after `confirmPayment` instead of `confirmCardPayment`.

- [ ] **Step 3: Create the Apple domain-association placeholder**

```bash
mkdir -p apps/web/public/.well-known
```

Create `apps/web/public/.well-known/apple-developer-merchantid-domain-association`:

```
# Placeholder for Apple Pay domain verification.
# Post-merge, replace this file's contents with the real
# domain-association string from Stripe Dashboard:
#   Stripe Dashboard → Settings → Payment methods →
#   Apple Pay → Add new domain → uniformorder.online
# Then redeploy. Apple Pay will not appear in the wallet tab
# until the file matches Apple's expected content.
```

- [ ] **Step 4: Type-check**

```bash
pnpm check-types:web
```
Expected: PASS. If the ref/type renames flag downstream issues, resolve them inline.

- [ ] **Step 5: Smoke (manual)**

With dev server running and Stripe test mode + webhook forwarding active:

1. **Card path:** checkout → pay with `4242 4242 4242 4242`. PaymentElement renders the tabbed layout (at minimum the "Card" tab; Google Pay tab appears in Chrome with a saved card). Payment completes inline; order transitions to `new` after webhook.
2. **3DS path:** retry with `4000 0027 6000 3184`. Browser redirects through 3DS challenge → returns to `/[tenant]/order/placed`. Order resolves successfully.
3. **Decline path:** retry with `4000 0000 0000 0002`. Order transitions to `payment_failed`; parent /orders does not list it.
4. **Retry after failure:** with the same checkout open, submit again with the good card. New PI created, succeeds, order transitions to `new`.
5. **Awkward totals:** order with prices like `19.95 × 3`. Server assertion passes (within 1¢ tolerance).
6. **Totals tamper:** modify POST body's `total` in devtools to `1.00` and resubmit. Both `/api/orders` and `/api/stripe/payment-intent` return 400 `totals_mismatch`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\[tenant\]/checkout/checkout-screen.tsx apps/web/public/.well-known/apple-developer-merchantid-domain-association
git commit -m "feat: Stripe PaymentElement (Apple Pay + Google Pay) via deferred-intent

Replace the card-only Element with PaymentElement in deferred-intent
mode so the element can mount before the PaymentIntent is created.

Flow:
- stripe.elements({ mode: 'payment', amount: Math.round(total*100),
  currency: 'aud', paymentMethodCreation: 'manual' })
- elements.create('payment', { layout: 'tabs' })
- onPay: elements.submit() (deferred-intent gate), then
  stripe.confirmPayment({ elements, clientSecret, confirmParams,
  redirect: 'if_required' })

Card payments stay inline; wallet + 3DS flows redirect to
/[tenant]/order/placed. automatic_payment_methods.enabled = true on
the PI is already set — surfacing wallets needed only the element swap.

Apple Pay requires post-merge domain verification in Stripe Dashboard;
placeholder file lives at public/.well-known/apple-developer-
merchantid-domain-association. Google Pay needs no verification."
```

---

## Final verification + PR

- [ ] **Step 1: Full type-check + build**

```bash
pnpm check-types:web
pnpm build:web
```

`check-types:web` MUST pass. `build:web` may surface the pre-existing `useSearchParams` Suspense issue (#26, §2.8) — that's out of scope and tracked separately.

- [ ] **Step 2: End-to-end smoke (production-likeness, single sitting)**

Run through every smoke test from Tasks 1–7 in one sitting:
- Catalog → search → PDP → cart → checkout → card pay → confirm in /orders
- Checkout → declined card → verify hidden from /orders → retry with good card → succeeds
- Checkout → 3DS card → redirect path
- Tamper test on `/api/orders` total
- Visit `/<tenant>/contact`
- View page source on `/<tenant>` and `/<tenant>/item/<id>` for metadata
- `curl /sitemap.xml` and `/robots.txt`

- [ ] **Step 3: Update `docs/remaining_work.md`**

In §2.13 and §2.14, mark each shipped item with a `✅ shipped <PR#>` annotation once the PR number is known (after `gh pr create`). Items shipped:
- §2.13: tenant footer, contact page, SEO basics, Apple/Google Pay
- §2.14: payment_failed webhook + dashboard refund audit + server-side total assertion + `getPreviousSizeHint` removal

Add one new ops follow-up under §2.13:
> **Apple Pay domain verification** — replace `apps/web/public/.well-known/apple-developer-merchantid-domain-association` with the real file from Stripe Dashboard → Settings → Payment methods → Apple Pay → Add new domain (`uniformorder.online`), then redeploy. Until verified, Apple Pay does not surface in the PaymentElement wallet tab. Google Pay is unaffected.

- [ ] **Step 4: Commit doc updates**

```bash
git add docs/remaining_work.md
git commit -m "docs(remaining_work): mark pre-launch hardening items shipped + log Apple Pay verify ops step"
```

- [ ] **Step 5: Push and open PR**

```bash
git push -u origin prelaunch-hardening
gh pr create --title "feat(prelaunch): bundled hardening — footer, contact, SEO, wallets, webhook, totals, size-hint cleanup" --body "$(cat <<'EOF'
## Summary

Bundled pre-launch hardening per `docs/superpowers/specs/2026-05-12-prelaunch-hardening-design.md`:

- **Tenant footer + Contact page** — surface policy + contact info on every parent route
- **SEO basics** — `sitemap.ts`, `robots.ts`, per-tenant + per-PDP `generateMetadata`, canonical URLs on PDPs
- **Apple Pay + Google Pay** — Stripe `PaymentElement` in deferred-intent mode (replaces card-only element)
- **`payment_intent.payment_failed` webhook** — soft-cancel with audit-log entry; hidden from parent /orders
- **Dashboard-refund audit log** — closes acknowledged TODO at `refund/route.ts:176-178`
- **Server-side total assertion** — shared helper at `lib/order-totals.ts` (1/11 GST on inclusive total, 1¢ tolerance)
- **Removed `getPreviousSizeHint`** — wrong-child bug for multi-child parents; not worth fixing (see `remaining_work.md` §2.14)

## Test plan

- [x] `pnpm check-types:web` passes
- [ ] Smoke: card payment success
- [ ] Smoke: declined card → `payment_failed` row hidden from /orders; audit log entry created
- [ ] Smoke: retry after decline → new PI, new order row, transitions to `new`
- [ ] Smoke: 3DS path → redirect to `/order/placed` resolves correctly
- [ ] Smoke: `/api/orders` and `/api/stripe/payment-intent` reject tampered `total` with 400 totals_mismatch
- [ ] Smoke: `/sitemap.xml` lists publicly-approved tenants only; `/robots.txt` disallows /admin /platform /auth /api
- [ ] Smoke: `<title>` and canonical URLs render per-tenant + per-item
- [ ] Smoke: `/<tenant>/contact` renders email/hours/address/collection instructions
- [ ] Smoke: footer renders on catalog, PDP, cart, checkout, refund-policy, order detail
- [ ] Ops: Apple Pay domain file replaced in Stripe Dashboard after deploy

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review (post-author, no re-run needed)

**Spec coverage:**
- §2.1 Tenant footer → Task 2 ✅
- §2.2 Contact page → Task 2 ✅
- §2.3 SEO (sitemap, robots, generateMetadata × 2) → Task 3 ✅
- §2.4 PaymentElement deferred-intent → Task 7 ✅
- §2.5 payment_failed + dashboard-refund audit + retry transition → Task 6 ✅
- §2.6 totals helper + enforcement (both endpoints, server-computed values authoritative) → Task 4 + Task 5 ✅
- §2.7 getPreviousSizeHint removal (function + API route + client fetch) → Task 1 ✅

**Sequencing:** matches §5 of the spec (1: size-hint, 2: footer+contact, 3: SEO, 4: helpers, 5: enforcement, 6: webhook, 7: PaymentElement).

**Pre-flight open questions:**
- `getPubliclyListedTenants()` — resolved (exists).
- `actorRole: 'system'` — Task 6 Step 1 widens the union.
- Apple domain file — placeholder + post-merge ops step documented.

**Placeholder scan:** none. Every step has either a command, a code block, a file path with content, or a concrete verification.

**Type consistency:** `paymentMountRef` / `paymentElementRef` used consistently in Task 7. `TenantRow` used as the footer prop type consistently. `assertTotalsMatch` signature consistent across Tasks 4 and 5.
