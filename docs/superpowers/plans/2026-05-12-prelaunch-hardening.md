# Pre-launch hardening + parent shell polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 7 pre-launch hardening items in one squash-merged PR: tenant footer, per-tenant Contact page, SEO basics, Stripe PaymentElement (Apple/Google Pay) via deferred-intent, audit-log entries for `payment_intent.payment_failed` + dashboard-initiated refunds, server-side total assertion with catalog-variant price validation, and removal of the `getPreviousSizeHint` feature.

**Architecture:** 7 tasks → 7 commits on a feature branch → squash-merged to `main`. Intra-PR commits exist for review readability, not `git bisect` (squash collapses them). The codebase works in **dollars (AUD)** end-to-end — only the Stripe API boundary converts to integer cents via `Math.round(total * 100)`. Stripe Elements moves to **deferred-intent mode** (`stripe.elements({ mode: 'payment', amount, currency })`) so the PaymentElement can mount before the PaymentIntent is created. New helpers live in `apps/web/src/lib/shipping.ts` and `apps/web/src/lib/order-totals.ts`. **Server-side line validation:** the totals helper does not trust client-supplied `unitPrice` — Task 5 builds a `Map<${itemId}::${variantLabel}, price>` from `getActiveCatalog(tenantId)` (prices live on `catalog_variants.price`, per-variant) and rejects mismatches. **`payment_intent.payment_failed`** is observed via **audit-log entries targeting the PaymentIntent** (Task 6 Option B) — there is no `'payment_failed'` order status because declined cards never produce order rows in this codebase.

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

**Resolved during code-review pass (do not re-investigate):**

- `BottomNav` is rendered **only** by `app/[tenant]/page.tsx:83` (the catalog home). `cart/checkout/order/placed/refund-policy/contact` pages do **not** render `BottomNav`. This shapes Task 2: the footer is rendered by each page directly (not auto-appended by `MobileShell`) so it lands above `BottomNav` on the catalog home and at end-of-content elsewhere.
- `MobileShell` (`apps/web/src/components/mobile-shell.tsx`) is a simple `flex flex-col` column with no `BottomNav` slot — its `children` is rendered as-is. Auto-appending the footer from inside `MobileShell` would put it **after** `BottomNav` in the DOM on the catalog page. Task 2 therefore renders `<TenantFooter>` from each page, not from the shell.
- `getActiveCatalog` is wrapped in React `cache()` for request-scoped dedup (`db/queries.ts:926`). Sitemap calls it once per tenant per request — cold per crawl but deduped within the response.
- `audit_events.tenantId` is **nullable** in the schema (`db/schema.ts:245` — no `.notNull()` chain). Populating it when available is preferred for the index, but `null` is a legal insert value.
- `app/privacy/page.tsx` and `app/terms/page.tsx` both exist; footer links will not 404.

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
| `apps/web/src/app/[tenant]/page.tsx` | Render `<TenantFooter>` before `<BottomNav>` (catalog has BottomNav) |
| `apps/web/src/app/[tenant]/cart/page.tsx` | Render `<TenantFooter>` at end of MobileShell children |
| `apps/web/src/app/[tenant]/checkout/page.tsx` | Same |
| `apps/web/src/app/[tenant]/order/placed/page.tsx` | Same |
| `apps/web/src/app/[tenant]/refund-policy/page.tsx` | Same |
| `apps/web/src/app/[tenant]/item/[itemId]/page.tsx` | Render `<TenantFooter>` + add `generateMetadata` |
| `apps/web/src/app/[tenant]/layout.tsx` | Add `generateMetadata` for per-tenant title/description/OG |
| `apps/web/src/app/[tenant]/item/[itemId]/interactive.tsx` | Remove size-hint fetch + state + JSX (Task 1) |
| `apps/web/src/app/[tenant]/checkout/checkout-screen.tsx` | PaymentElement swap (Task 7); import `SHIP_FEE_AUD` (Task 4) |
| `apps/web/src/db/queries.ts` | Delete `getPreviousSizeHint` + `SizeHint` type |
| `apps/web/src/lib/audit/types.ts` | Add `"system"` to `AuditActorRole`; add `"payment_intent"` to `AuditTargetType` |
| `apps/web/src/app/api/stripe/webhook/route.ts` | Add `payment_intent.payment_failed` branch (audit-log only); add audit log to `charge.refunded` |
| `apps/web/src/app/api/stripe/payment-intent/route.ts` | Call `assertTotalsMatch`; add `tenantId` to PI metadata |
| `apps/web/src/app/api/orders/route.ts` | Call `assertTotalsMatch`; use server-computed totals + server-authoritative per-variant prices in insert |
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

- [ ] **Step 2: Delete `getPreviousSizeHint` + `SizeHint` type from `db/queries.ts`**

Open `apps/web/src/db/queries.ts`. Remove:
- The `export async function getPreviousSizeHint(...)` block (lines ~427-467).
- The `SizeHint` type export (also exported from this file; verify via `grep "export type SizeHint\|export interface SizeHint" apps/web/src/db/queries.ts`).
- Any imports the function pulled in that are now unreferenced.

TypeScript will flag remaining downstream issues in Step 4.

- [ ] **Step 3: Remove size-hint usage from `interactive.tsx`**

Open `apps/web/src/app/[tenant]/item/[itemId]/interactive.tsx`. Remove the following named symbols (verified by reading the file):

- Import: `import type { SizeHint } from "@/db/queries";` (line 7).
- State: `const [hint, setHint] = useState<SizeHint | null>(null);` (line 31).
- Effect: the `useEffect` at line 33 that calls `fetch('/api/orders/size-hint?...')` (whole block, including the cancellation flag).
- JSX: the `{hint && (...)}` render block at lines 173-178 (renders `<span>{hint.studentName} wore size {hint.size} last year</span>`).

If `useState` or `useEffect` are no longer used after the removal, drop them from the React import on line 5 (currently `import { useEffect, useState, type ReactNode } from "react";`). Confirm via type-check.

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
- Modify: each tenant page below — render `<TenantFooter>` directly inside `MobileShell` as the last child (above `BottomNav` on the catalog page; at end-of-content elsewhere)
- **Not modified:** `apps/web/src/components/mobile-shell.tsx` — the shell stays a generic flex-column wrapper. Pages render their own footer to control placement relative to `BottomNav`.

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

- [ ] **Step 2: Render `<TenantFooter>` in each tenant page**

`MobileShell` is **not** modified. Each page renders `<TenantFooter tenant={tenantRecord} />` as a child of `MobileShell`, placed:

- **Catalog home** (`app/[tenant]/page.tsx`) — immediately **before** `<BottomNav ... />` (line 83). Order in DOM: catalog grid → `<TenantFooter>` → `<BottomNav>`. Since `BottomNav` is `fixed` (verify by reading `apps/web/src/components/bottom-nav.tsx`), the footer scrolls naturally into view at the end of the catalog. If `BottomNav` is fixed and overlays content, add `pb-16` (or matching height) to the scrollable container so the footer isn't permanently obscured.
- **Cart, checkout, order/placed, refund-policy, contact** — at end of content, inside `MobileShell` as the last child. These pages don't render `BottomNav`, so no overlap concern.

Each page already calls `getTenant(slug)` and binds it to `tenantRecord` (or equivalent — most files use `tenantRecord`; checkout/cart files may name it differently). Pass the **raw row** to `<TenantFooter>` so the footer has `shopEmail`, `shopHours`, `currentLegalVersionId`. Do **not** pass `toTenantBrand(...)` — that subset drops the footer's required fields.

Pages to modify:

- `apps/web/src/app/[tenant]/page.tsx` (place before `<BottomNav>`)
- `apps/web/src/app/[tenant]/cart/page.tsx` (end of `MobileShell` children)
- `apps/web/src/app/[tenant]/checkout/page.tsx` (end of `MobileShell` children)
- `apps/web/src/app/[tenant]/order/placed/page.tsx` (end of `MobileShell` children)
- `apps/web/src/app/[tenant]/refund-policy/page.tsx` (end of `MobileShell` children)
- `apps/web/src/app/[tenant]/item/[itemId]/page.tsx` (end of `MobileShell` children — verify path; PDP may use its own shell)

Import at the top of each:

```tsx
import { TenantFooter } from "@/components/tenant-footer";
```

JSX example (cart page):

```tsx
<MobileShell bg="var(--color-paper)">
  {/* existing cart content */}
  <TenantFooter tenant={tenantRecord} />
</MobileShell>
```

JSX example (catalog page — note placement above BottomNav):

```tsx
<MobileShell bg="var(--color-paper)">
  {/* existing header + CatalogGrid */}
  <TenantFooter tenant={tenantRecord} />
  <BottomNav active="shop" shopHref={`/${tenant.id}`} accent={tenant.accent} />
</MobileShell>
```

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
    <MobileShell bg="var(--color-paper)">
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
        <TenantFooter tenant={tenant} />
      </div>
    </MobileShell>
  );
}
```

Add the `TenantFooter` import alongside the other imports:

```tsx
import { TenantFooter } from "@/components/tenant-footer";
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
git add apps/web/src/components/tenant-footer.tsx apps/web/src/app/\[tenant\]
git commit -m "feat: tenant footer with policy links + contact page

Surface refund-policy, contact, privacy, terms across all tenant
routes via a new <TenantFooter>. Pages render the footer directly
inside MobileShell (above BottomNav on the catalog page; at
end-of-content elsewhere). MobileShell itself is unchanged.
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
// Exported so /api/orders can use the same rounding for lineTotal in Task 5.
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Compute order totals in AUD dollars.
 *
 * GST model: 1/11 of the **GST-inclusive total** (subtotal + shipping).
 * This treats shipping as GST-applicable, which is the AU norm for domestic
 * deliveries by a GST-registered business.
 *
 * Reports page (`app/platform/billing/`, `app/admin/[tenant]/reports/`) has
 * its own GST calculation today. Consolidating to this helper is tracked as
 * a follow-up in `docs/remaining_work.md` and is NOT done in this PR —
 * accountant sign-off (§3.6) will reconcile any formula drift between the
 * two callsites first.
 *
 * If shipping is ever moved to GST-free, change to `(subtotal / 11)` and
 * audit historical Reports rows before deploying.
 */
export function computeTotals(args: {
  lines: LineInput[];
  delivery: DeliveryMode;
}): ComputedTotals {
  const subtotal = round2(
    args.lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0),
  );
  const ship = args.delivery === "ship" ? SHIP_FEE_AUD : 0;
  const total = round2(subtotal + ship);
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

## Task 5: Server-side total assertion with catalog-price validation

**Spec:** §2.6 enforcement

**Critical:** Earlier plan revisions accepted client-supplied `unitPrice` and only validated sums. That's theatre — a tampering client sends `unitPrice: 0.01, qty: 1` and passes a self-consistent assertion. This task looks up authoritative prices from `getActiveCatalog(tenantId)` per **(itemId, variantLabel)** pair, rejects unknown items/variants, and recomputes totals from server-side prices.

**Pricing model (verified):** prices live on `catalog_variants.price` (`numeric(10,2)`, AUD dollars), NOT on `catalog_items`. Each item has 1+ variants; a Boys 10/64cm trouser and a Mens 8/102cm trouser of the same item have different prices. The lookup key must be `${itemId}::${variantLabel}` — keying on itemId alone would over-reject (legitimate non-base-price variants) or under-reject (tampered orders that swap to a non-base variant). `getActiveCatalog(tenantId)` already returns `CatalogItem[]` with nested `variants: { label, price, sizes }[]` (`db/queries.ts:926-967`) — no new query helper needed.

**Files:**
- Modify: `apps/web/src/lib/order-totals.ts` — extend the helper to take a price-lookup map
- Modify: `apps/web/src/app/api/orders/route.ts`
- Modify: `apps/web/src/app/api/stripe/payment-intent/route.ts`
- Modify: `apps/web/src/app/[tenant]/checkout/checkout-screen.tsx` — send `lines` payload with `itemId` to PI endpoint

- [ ] **Step 1: Extend `lib/order-totals.ts` with catalog-price validation**

Update `apps/web/src/lib/order-totals.ts`. The line input now requires an `itemId`; the helper accepts a `priceLookup` map from `itemId → unitPrice` resolved from the catalog. On price mismatch (>1¢) or unknown `itemId`, throw `TotalsMismatchError`.

Replace the `LineInput` type and add a new error class:

```ts
export type LineInput = {
  itemId: string;
  variantLabel: string;
  unitPrice: number; // AUD dollars as claimed by the client
  qty: number; // positive integer
};

// ... ComputedTotals + DeliveryMode unchanged ...

export type MismatchReason = "total_mismatch" | "price_mismatch" | "unknown_variant";

export class TotalsMismatchError extends Error {
  constructor(
    readonly expected: ComputedTotals,
    readonly received: { subtotal: number; gst: number; total: number },
    readonly reason: MismatchReason,
    readonly offendingKey?: string, // "${itemId}::${variantLabel}" when reason references a line
  ) {
    super(reason);
  }
}

/** Build the lookup key for the priceLookup map. */
export function priceLookupKey(itemId: string, variantLabel: string): string {
  return `${itemId}::${variantLabel}`;
}

/**
 * Validate every line against the catalog price-lookup, then compute totals.
 *
 * Rejects on:
 * - Unknown (itemId, variantLabel) combination (not present in priceLookup)
 * - Client-claimed unitPrice differs from catalog variant price by > 1¢
 * - Resulting subtotal/gst/total differs from received by > 1¢
 */
export function assertTotalsMatch(args: {
  lines: LineInput[];
  delivery: DeliveryMode;
  received: { subtotal: number; gst: number; total: number };
  priceLookup: Map<string, number>; // "${itemId}::${variantLabel}" → catalog price
}): ComputedTotals {
  const PRICE_TOLERANCE = 0.01;
  const TOTAL_TOLERANCE = 0.01;

  const serverLines: { unitPrice: number; qty: number }[] = [];
  for (const l of args.lines) {
    const key = priceLookupKey(l.itemId, l.variantLabel);
    const catalogPrice = args.priceLookup.get(key);
    if (catalogPrice === undefined) {
      throw new TotalsMismatchError(
        { subtotal: 0, gst: 0, total: 0 },
        args.received,
        "unknown_variant",
        key,
      );
    }
    if (Math.abs(catalogPrice - l.unitPrice) > PRICE_TOLERANCE) {
      throw new TotalsMismatchError(
        { subtotal: 0, gst: 0, total: 0 },
        args.received,
        "price_mismatch",
        key,
      );
    }
    serverLines.push({ unitPrice: catalogPrice, qty: l.qty });
  }

  const expected = computeTotals({ lines: serverLines, delivery: args.delivery });
  const ok =
    Math.abs(expected.subtotal - args.received.subtotal) <= TOTAL_TOLERANCE &&
    Math.abs(expected.gst - args.received.gst) <= TOTAL_TOLERANCE &&
    Math.abs(expected.total - args.received.total) <= TOTAL_TOLERANCE;
  if (!ok) throw new TotalsMismatchError(expected, args.received, "total_mismatch");

  return expected;
}
```

(Note: `computeTotals` itself stays the same — it now operates on the **server-checked** lines fed in by `assertTotalsMatch`.)

- [ ] **Step 2: Add assertion in `/api/orders` POST handler**

Open `apps/web/src/app/api/orders/route.ts`. Locate the validation block at line ~141. After that 400 and before the `existingOrder` idempotency check at line ~157, fetch the catalog and build the price lookup, then assert:

```ts
import {
  assertTotalsMatch,
  TotalsMismatchError,
  priceLookupKey,
  round2,
} from "@/lib/order-totals";
import { getActiveCatalog } from "@/db/queries";
// ↑ at top alongside existing imports

// ... after the type-validation 400 ...

// Build authoritative (itemId, variantLabel) → price lookup.
// getActiveCatalog returns CatalogItem[] with nested variants:{label,price,sizes}
// — see db/queries.ts:926-967. Prices are already numbers in dollars.
const catalog = await getActiveCatalog(tenantId);
const priceLookup = new Map<string, number>();
for (const item of catalog) {
  for (const v of item.variants) {
    priceLookup.set(priceLookupKey(item.id, v.label), v.price);
  }
}

let verifiedTotals;
try {
  verifiedTotals = assertTotalsMatch({
    lines: lines.map((l: {
      itemId: string;
      variantLabel: string;
      unitPrice: number;
      qty: number;
    }) => ({
      itemId: l.itemId,
      variantLabel: l.variantLabel,
      unitPrice: l.unitPrice,
      qty: l.qty,
    })),
    delivery: delivery === "ship" ? "ship" : "pickup",
    received: { subtotal, gst, total },
    priceLookup,
  });
} catch (err) {
  if (err instanceof TotalsMismatchError) {
    return NextResponse.json(
      {
        error: "totals_mismatch",
        reason: err.reason,
        offendingKey: err.offendingKey,
        expected: err.expected,
        received: err.received,
      },
      { status: 400 },
    );
  }
  throw err;
}
```

Then **use `verifiedTotals.subtotal/gst/total` in the `db.insert(orders).values({...})` call** (not the client values):

```ts
subtotal: String(verifiedTotals.subtotal),
gst: String(verifiedTotals.gst),
total: String(verifiedTotals.total),
```

**`unitPrice` per line:** also override the client's claimed `line.unitPrice` with the catalog price when writing to `orderLines`:

```ts
const linesInsert = db.insert(orderLines).values(
  lines.map((line) => {
    const authoritativeUnitPrice = priceLookup.get(
      priceLookupKey(line.itemId, line.variantLabel),
    )!; // guaranteed non-undefined by the assertion above
    return {
      orderId,
      itemId: line.itemId,
      itemName: line.itemName,
      variantLabel: line.variantLabel,
      size: line.size?.trim() || null,
      qty: line.qty,
      unitPrice: String(authoritativeUnitPrice),
      lineTotal: String(round2(authoritativeUnitPrice * line.qty)),
    };
  })
);
```

`round2` is exported from `lib/order-totals.ts` per Task 4 Step 2.

- [ ] **Step 3: Add assertion in `/api/stripe/payment-intent` POST handler**

Open `apps/web/src/app/api/stripe/payment-intent/route.ts`. Extend the request body to accept `lines` (with `itemId`), `delivery`, `subtotal`, `gst`. Then run the same `getActiveCatalog`-backed assertion before `paymentIntents.create`:

```ts
import {
  assertTotalsMatch,
  TotalsMismatchError,
  priceLookupKey,
} from "@/lib/order-totals";
import { getActiveCatalog } from "@/db/queries";
// ↑ at top

// inside POST handler, after auth + tenant lookup, before paymentIntents.create:
const { lines, delivery, subtotal, gst } = body;
if (!Array.isArray(lines) || typeof subtotal !== "number" || typeof gst !== "number") {
  return NextResponse.json({ error: "Missing totals payload" }, { status: 400 });
}

// Same lookup construction as /api/orders Step 2.
const catalog = await getActiveCatalog(tenantId);
const priceLookup = new Map<string, number>();
for (const item of catalog) {
  for (const v of item.variants) {
    priceLookup.set(priceLookupKey(item.id, v.label), v.price);
  }
}

let verified;
try {
  verified = assertTotalsMatch({
    lines: lines.map((l: {
      itemId: string;
      variantLabel: string;
      unitPrice: number;
      qty: number;
    }) => ({
      itemId: l.itemId,
      variantLabel: l.variantLabel,
      unitPrice: l.unitPrice,
      qty: l.qty,
    })),
    delivery: delivery === "ship" ? "ship" : "pickup",
    received: { subtotal, gst, total: amount },
    priceLookup,
  });
} catch (err) {
  if (err instanceof TotalsMismatchError) {
    return NextResponse.json(
      {
        error: "totals_mismatch",
        reason: err.reason,
        offendingKey: err.offendingKey,
        expected: err.expected,
        received: err.received,
      },
      { status: 400 },
    );
  }
  throw err;
}

// Stripe boundary: dollars → integer cents
const stripeAmount = Math.round(verified.total * 100);
// ... paymentIntents.create({ amount: stripeAmount, currency: 'aud', ... })
```

**Also extend the PI metadata** with `tenantId` so the `payment_intent.payment_failed` webhook in Task 6 can attribute declined-card events to a tenant even when no order row exists. The existing `metadata` parameter at `payment-intent/route.ts:71` already includes some fields; add one more:

```ts
metadata: {
  ...existingMetadataFields,
  tenantId, // NEW: needed by Task 6 Step 2 for tenant-scoped audit attribution
},
```

- [ ] **Step 4: Update the client to send `itemId` per line in the PI request**

Open `apps/web/src/app/[tenant]/checkout/checkout-screen.tsx`. Find the `fetch("/api/stripe/payment-intent", {...})` call (around line 187). Extend the JSON body to include `lines` with `itemId`, `delivery`, `subtotal`, `gst`:

```ts
body: JSON.stringify({
  tenantId: tenant.id,
  amount: total,
  currency: "aud",
  lines: lines.map((l) => ({
    itemId: l.itemId,
    variantLabel: l.variantLabel,
    unitPrice: l.unitPrice,
    qty: l.qty,
  })),
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

The `/api/orders` POST body already includes `lines` with `itemId` + `variantLabel` (the existing insert at `route.ts:231` reads `line.unitPrice`, `line.variantLabel`, `line.size`, `line.qty`). No further client change needed.

- [ ] **Step 5: Type-check**

```bash
pnpm check-types:web
```
Expected: PASS.

- [ ] **Step 6: Smoke (manual)**

Start dev server. Place a test order with `4242 4242 4242 4242` — order completes normally (no 400).

**Tamper test A — total only:** in devtools, intercept POST to `/api/orders`, modify `total` to `1`. Expect `400 { error: 'totals_mismatch', reason: 'total_mismatch' }`.

**Tamper test B — unitPrice:** modify a line's `unitPrice` from (say) `40` to `0.01`. Expect `400 { error: 'totals_mismatch', reason: 'price_mismatch', offendingKey: '<itemId>::<variantLabel>' }`.

**Tamper test C — unknown variant:** modify a line's `variantLabel` from a real value (e.g. `"Size 12"`) to `"Size 999"`. Expect `400 { error: 'totals_mismatch', reason: 'unknown_variant', offendingKey: '<itemId>::Size 999' }`. (Same response shape if `itemId` is bogus.)

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/order-totals.ts apps/web/src/app/api/orders/route.ts apps/web/src/app/api/stripe/payment-intent/route.ts apps/web/src/app/\[tenant\]/checkout/checkout-screen.tsx
git commit -m "feat: server-side total assertion with catalog-price validation

Both POST /api/orders and POST /api/stripe/payment-intent now:
1. Fetch the tenant catalog via getActiveCatalog(tenantId).
2. Build a Map<\${itemId}::\${variantLabel}, price> from each item's
   variants. Prices live on catalog_variants.price (per-variant), not
   catalog_items — so a Boys 10/64cm and Mens 8/102cm trouser of
   the same item validate against their distinct catalog prices.
3. Reject lines whose (itemId, variantLabel) pair is missing from
   the catalog (reason: unknown_variant).
4. Reject lines where client-claimed unitPrice differs from the
   catalog variant price by > 1c (reason: price_mismatch).
5. Recompute subtotal/gst/total from server-authoritative prices
   and reject mismatches with the client (reason: total_mismatch).

Server-computed totals and per-line unitPrice are persisted; client
values are validated but never written directly. Closes the
'client trusts unitPrice' gap surfaced in the plan code review."
```

---

## Task 6: `payment_intent.payment_failed` audit log + dashboard-refund audit log

**Spec:** §2.5 (revised after plan review)

**Architecture pivot (Option B — audit-log-only):**

The original spec called for transitioning an `orders` row to a new `'payment_failed'` status on declined cards. But the codebase creates `orders` rows **after** `confirmPayment` succeeds — declined cards never produce a row. Adding the enum value, the row-update logic, and the parent /orders filter would all be dead code.

**Revised approach:** `payment_intent.payment_failed` writes an audit-log entry only. The entry targets the **PaymentIntent itself** (`targetType: 'payment_intent'`), captures decline metadata, and surfaces in the per-tenant audit log. This preserves the audit-trail intent without any `orders` row management.

What stays from the original Task 6:
- Extend `AuditActorRole` to include `"system"` for webhook-originated events.
- Extend `AuditTargetType` to include `"payment_intent"` for events that occur before an order row exists.
- Add `payment_intent.payment_failed` branch to the webhook (audit-log only, no DB row update).
- Add audit-log entry inside the existing `charge.refunded` branch (closes the TODO at `refund/route.ts:176-178`).

What drops:
- ~~`orderStatusEnum` migration adding `'payment_failed'`~~ — not needed.
- ~~Neon MCP migration + `__drizzle_migrations` insert~~ — not needed.
- ~~`listOrdersForParent` filter on `status != 'payment_failed'`~~ — no failed rows to hide.
- ~~Widening `payment_intent.succeeded` WHERE clause~~ — only `pending_payment` is reachable.

**Files:**
- Modify: `apps/web/src/lib/audit/types.ts` (extend `AuditActorRole` + `AuditTargetType`)
- Modify: `apps/web/src/app/api/stripe/webhook/route.ts` (new branch + audit-log call in `charge.refunded`)

- [ ] **Step 1: Extend `AuditActorRole` + `AuditTargetType`**

Open `apps/web/src/lib/audit/types.ts`.

Change (line 10):
```ts
export type AuditActorRole = "operator" | "platform_admin";
```
to:
```ts
export type AuditActorRole = "operator" | "platform_admin" | "system";
```

Change (lines 4-8):
```ts
export type AuditTargetType =
  | "order"
  | "tenant"
  | "catalog_item"
  | "tenant_legal_version";
```
to:
```ts
export type AuditTargetType =
  | "order"
  | "tenant"
  | "catalog_item"
  | "tenant_legal_version"
  | "payment_intent";
```

`"system"` covers webhook-originated events. `"payment_intent"` covers audit events that fire **before** an order row exists (e.g. declined cards). Both are used in Steps 2 and 3 below.

- [ ] **Step 2: Add `payment_intent.payment_failed` branch (audit log only) to `webhook/route.ts`**

Open `apps/web/src/app/api/stripe/webhook/route.ts`. After the `payment_intent.succeeded` branch (ends around line 88), add:

```ts
// ─── payment_intent.payment_failed ────────────────────────────────────────
// No order row exists at this point — /api/orders inserts only after
// confirmPayment succeeds. We log the failure to audit_events targeted at
// the PaymentIntent itself, so per-tenant audit views can surface declined
// attempts alongside successful events.
if (event.type === "payment_intent.payment_failed") {
  const pi = event.data.object as Stripe.PaymentIntent;
  // PI metadata is populated by /api/stripe/payment-intent at creation time;
  // pull tenantId from there (and parentEmail, for the actor field).
  const piTenantId = typeof pi.metadata?.tenantId === "string" ? pi.metadata.tenantId : null;
  const piParentEmail = typeof pi.metadata?.parentEmail === "string"
    ? pi.metadata.parentEmail
    : "stripe-webhook";
  await logAuditEvent({
    tenantId: piTenantId,
    actorEmail: piParentEmail,
    actorRole: "system",
    action: "payment_intent.payment_failed",
    targetType: "payment_intent",
    targetId: pi.id,
    payload: {
      amount: pi.amount ? pi.amount / 100 : null,
      currency: pi.currency,
      lastPaymentError: pi.last_payment_error?.message ?? null,
      declineCode: pi.last_payment_error?.decline_code ?? null,
    },
  });
  return NextResponse.json({ received: true });
}
```

Add the import at the top:

```ts
import { logAuditEvent } from "@/lib/audit/log";
```

**PI metadata note:** the existing `/api/stripe/payment-intent` route already populates `metadata.parentEmail` and is the right place to also include `metadata.tenantId`. Confirm by reading the existing `paymentIntents.create({...metadata})` call (around `payment-intent/route.ts:71`); if `tenantId` is not yet in the metadata object, add it as part of Task 5's changes to that file (it's a one-line addition to the existing `metadata` object).

- [ ] **Step 3: Add audit log to `charge.refunded` branch (with tenantId)**

Inside the existing `charge.refunded` branch at `webhook/route.ts:137-184`:

1. **Extend the order select** at line ~145 to include `tenantId`:
   ```ts
   const [orderRow] = await db
     .select({
       id: orders.id,
       total: orders.total,
       status: orders.status,
       tenantId: orders.tenantId,
     })
     .from(orders)
     .where(eq(orders.stripePaymentIntentId, piId))
     .limit(1);
   ```

2. **After the order status update** (line ~177-183), before the closing `}` of the `if (orderRow)` block, add:

   ```ts
   const totalRefundedCents = refunds.reduce(
     (sum, r) => sum + (r.amount ?? 0),
     0,
   );
   await logAuditEvent({
     tenantId: orderRow.tenantId,
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

   `audit_events.tenantId` is nullable, but populating it keeps the `idx_audit_events_tenant_time` index useful for per-tenant audit views.

- [ ] **Step 4: Type-check**

```bash
pnpm check-types:web
```
Expected: PASS.

- [ ] **Step 5: Smoke (manual)**

With dev server running and Stripe test webhooks forwarded (`stripe listen --forward-to localhost:3000/api/stripe/webhook` or equivalent):

1. **Success path:** place a normal order with `4242 4242 4242 4242` → webhook flips `pending_payment → new` (unchanged from today; verify still working).
2. **Declined path:** attempt payment with `4000 0000 0000 0002`. `confirmPayment` returns an error → client surfaces "Card declined" → **no order row is created**. Webhook receives `payment_intent.payment_failed` → an audit row appears with `action: 'payment_intent.payment_failed'`, `target_type: 'payment_intent'`, `target_id: pi_xxx`, payload includes `declineCode` and `lastPaymentError`. Query: `SELECT action, target_type, payload FROM audit_events WHERE target_type='payment_intent' ORDER BY created_at DESC LIMIT 1;`
3. **Retry after decline:** with the same checkout open, submit with a good card. New PI created; succeeds normally. Original PI remains failed in Stripe Dashboard. Audit log shows both events.
4. **Dashboard refund:** issue a refund on a paid order from Stripe Dashboard. Webhook flips status to `refunded`/`partially_refunded` AND inserts an audit row with `action: 'order.refunded.via_dashboard'`, `tenantId` populated from the order.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/audit/types.ts apps/web/src/app/api/stripe/webhook/route.ts apps/web/src/app/api/stripe/payment-intent/route.ts
git commit -m "feat: audit-log payment_intent.payment_failed + dashboard refunds

Adds audit-log entries for two webhook events that were previously
unobserved:

1. payment_intent.payment_failed — declined cards never produce an
   order row (orders are created post-confirmPayment), so the audit
   entry targets the PaymentIntent itself (targetType:'payment_intent')
   and pulls tenantId from PI metadata. Captures decline_code and
   lastPaymentError for support visibility.

2. charge.refunded — closes the TODO at refund/route.ts:176-178.
   Inside the existing branch, after the status update, logAuditEvent
   with actorRole:'system' and tenantId populated from the order row
   (orders.tenantId added to the existing select shape).

Extends AuditActorRole with 'system' and AuditTargetType with
'payment_intent' to support these event shapes.

Also: /api/stripe/payment-intent now writes tenantId into PI metadata
so the payment_failed webhook can attribute the event to a tenant
even when no order row exists."
```

---

## Task 7: Stripe PaymentElement swap (Apple Pay + Google Pay via deferred-intent)

**Spec:** §2.4

**Files:**
- Modify: `apps/web/src/app/[tenant]/checkout/checkout-screen.tsx`
- Create: `apps/web/public/.well-known/apple-developer-merchantid-domain-association`

- [ ] **Step 1: Replace eager `stripe.elements()` with deferred-intent initialisation (mount once)**

Open `apps/web/src/app/[tenant]/checkout/checkout-screen.tsx`. The current code (lines ~80-130) calls `stripe.elements()` with no args and mounts a Card element. Replace the mount `useEffect` with deferred-intent + PaymentElement, **mounted once** on initial stripe load. Don't include `total` in the dep array — re-mounting would destroy in-progress card data when the user toggles delivery (pickup ↔ ship changes `total`). Use `elements.update({ amount })` in a separate effect to push amount changes into the existing element.

Two `useEffect` hooks. First — initial mount (`[]` dep array):

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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once on initial stripe load
}, []);
```

Second — amount sync (`[total]` dep array):

```tsx
useEffect(() => {
  if (!elementsRef.current) return;
  elementsRef.current.update({ amount: Math.round(total * 100) });
}, [total]);
```

`elements.update({ amount })` is the documented Stripe.js pattern for amount changes in `mode: 'payment'` deferred-intent (Stripe.js v3 reference: "Updates the options the Elements group was created with"). It does not unmount the PaymentElement; it patches the underlying Intent params so the next `confirmPayment` reflects the new amount and wallet button labels (Apple Pay/Google Pay) re-render inline.

**Empty cart edge case:** the checkout page redirects to `/cart` when `lines.length === 0` (via existing client guard at `checkout-screen.tsx` `onPay`). The PaymentElement mount is also gated by `paymentReady`, so the `amount: 0` corner case cannot reach a render. No additional guard needed.

Rename `cardMountRef` → `paymentMountRef` and `cardRef` → `paymentElementRef` throughout. Update the corresponding `useRef<...>` types — `paymentElementRef` is `StripePaymentElement` (import from `@stripe/stripe-js`).

Note: **dropped `paymentMethodCreation: 'manual'`.** That mode pairs with `stripe.createPaymentMethod` + server-side `paymentIntents.confirm`. The `confirmPayment` flow used in Step 2 is the default deferred-intent variant and does not accept `paymentMethodCreation`.

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
3. **Decline path:** retry with `4000 0000 0000 0002`. `confirmPayment` returns an error; client surfaces "Card declined"; **no order row is created**. Webhook fires `payment_intent.payment_failed` → an `audit_events` row appears with `target_type='payment_intent'`, `target_id=pi_xxx`, payload includes `declineCode`.
4. **Retry after failure:** with the same checkout open, submit again with the good card. A fresh PI is created and succeeds; webhook flips the new order row `pending_payment → new`. The original failed PI remains in Stripe Dashboard with its audit entry.
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
  currency: 'aud' }) — mounted once on initial Stripe load.
- elements.update({ amount }) in a separate effect when total changes
  (delivery toggle); avoids destroying in-progress card data.
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
- §2.14: payment_failed audit-log entry + dashboard refund audit + server-side total assertion with variant-keyed catalog validation + `getPreviousSizeHint` removal

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
- **`payment_intent.payment_failed` audit log** — declined cards write to `audit_events` targeting the PaymentIntent (no order row exists at decline time)
- **Dashboard-refund audit log** — closes acknowledged TODO at `refund/route.ts:176-178`
- **Server-side total assertion + catalog price validation** — shared helper at `lib/order-totals.ts` (1/11 GST on inclusive total, 1¢ tolerance, variant-keyed price lookup against `catalog_variants.price`)
- **Removed `getPreviousSizeHint`** — wrong-child bug for multi-child parents; not worth fixing (see `remaining_work.md` §2.14)

## Test plan

- [x] `pnpm check-types:web` passes
- [ ] Smoke: card payment success
- [ ] Smoke: declined card → no order row created; `audit_events` row with `target_type='payment_intent'` and `declineCode`
- [ ] Smoke: retry after decline → fresh PI, new order row, transitions `pending_payment → new`
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
- §2.5 payment_failed audit + dashboard-refund audit → Task 6 ✅ (revised to Option B: audit-only, no order-row state machinery)
- §2.6 totals helper + variant-keyed catalog price validation → Task 4 + Task 5 ✅
- §2.7 getPreviousSizeHint removal (function + type + API route + client fetch + state + JSX) → Task 1 ✅

**Sequencing:** 1: size-hint, 2: footer+contact, 3: SEO, 4: helpers, 5: enforcement with catalog validation, 6: webhook audit, 7: PaymentElement. Squash-merge to `main`; intra-PR commits are for review readability only.

**Pre-flight resolutions:**
- `getPubliclyListedTenants()` exists at `queries.ts:859`.
- `BottomNav` rendered only by `app/[tenant]/page.tsx:83`; footer placement per-page.
- `audit_events.tenantId` nullable; populated when available.
- `/privacy` and `/terms` routes exist.
- `catalogVariants.price` is the authoritative price field (`numeric(10,2)`, dollars). Prices are per-variant; lookup keyed on `${itemId}::${variantLabel}`.
- `getActiveCatalog` returns nested `variants: { label, price, sizes }[]` (already grouped) — no new query helper needed.
- `orderStatusEnum` values: `pending_payment, new, packing, ready, collected, partially_refunded, refunded`. **No additions in this PR** (Task 6 pivoted to audit-only).
- `AuditActorRole`/`AuditTargetType` widened in Task 6 Step 1 (`"system"`, `"payment_intent"`).
- Apple domain file — placeholder + post-merge ops step documented.

**Round-2 code-review fixes incorporated (2026-05-13):**
1. **Task 6 pivoted to Option B** — declined cards never produce an `orders` row in this codebase (rows are created post-`confirmPayment`), so the original `pending_payment → payment_failed` transition was dead code. Task 6 now logs audit events targeting the PaymentIntent (`targetType: "payment_intent"`) instead. Dropped: enum migration, `__drizzle_migrations` insert, `listOrdersForParent` filter, `payment_intent.succeeded` WHERE-clause widening.
2. **Task 5 catalog lookup keyed on `(itemId, variantLabel)`** — prices live on `catalog_variants.price` (per-variant), not `catalog_items`. The earlier `Map<itemId, number>` was the wrong shape. New `priceLookupKey()` helper builds `${itemId}::${variantLabel}`. Lookup constructed from `getActiveCatalog(tenantId)`'s nested `item.variants[]`. Mismatch reason renamed `unknown_item → unknown_variant`, error surfaces `offendingKey` instead of `offendingItemId`.
3. **Task 4 JSDoc softened** — Reports-page consolidation is now noted as a follow-up, not a same-PR claim. Drift between the two callsites is left for accountant sign-off (§3.6).
4. **Task 5 PI metadata** — `tenantId` added to `paymentIntents.create({...metadata})` so the `payment_intent.payment_failed` audit entry in Task 6 can attribute the event to a tenant even with no order row.
5. **Task 7** — added explicit Stripe.js reference for `elements.update({ amount })` in deferred-intent mode + a note on the empty-cart guard.
6. (Round-1 fixes from 6a20d6e remain in place: footer placement, `paymentMethodCreation` drop, mount-once + elements.update split, audit `tenantId` populated from the order row in `charge.refunded`, etc.)

**Placeholder scan:** none. Every step has either a command, a code block, a file path with content, or a concrete verification.

**Type consistency:** `LineInput` includes `variantLabel` everywhere. `priceLookupKey(itemId, variantLabel)` used consistently in Task 5 Steps 2 and 3 + Task 4 helper. `priceLookup: Map<string, number>` shape consistent. `MismatchReason` union and `offendingKey` consistent across Task 4 + Task 5 + smoke-test expectations.
