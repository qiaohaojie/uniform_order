# Desktop Frame Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Style the canvas surrounding the 430 px parent shop column on desktop — drop-shadow, logo watermark, tip line — without changing the column itself.

**Architecture:** A single component change to `MobileShell` adds the canvas decorations and a new optional `logoUrl` prop. Seven tenant route files thread the prop from their existing `getTenant()` fetch. Non-tenant routes (`/`, `/orders/*`) are untouched.

**Tech Stack:** Next.js 16 App Router, Tailwind CSS v4, TypeScript. No test suite — correctness gate is `pnpm check-types:web`.

---

## File map

| Action | File |
|---|---|
| Modify | `apps/web/src/components/mobile-shell.tsx` |
| Modify | `apps/web/src/app/[tenant]/page.tsx` |
| Modify | `apps/web/src/app/[tenant]/cart/page.tsx` |
| Modify | `apps/web/src/app/[tenant]/checkout/page.tsx` |
| Modify | `apps/web/src/app/[tenant]/item/[itemId]/page.tsx` |
| Modify | `apps/web/src/app/[tenant]/contact/page.tsx` |
| Modify | `apps/web/src/app/[tenant]/refund-policy/page.tsx` |
| Modify | `apps/web/src/app/[tenant]/order/placed/page.tsx` |

---

## Task 1: Update `MobileShell` component

**Files:**
- Modify: `apps/web/src/components/mobile-shell.tsx`

- [ ] **Step 1: Replace the file with the new implementation**

```tsx
import type { ReactNode } from "react";

export function MobileShell({
  children,
  bg = "var(--color-paper)",
  logoUrl,
}: {
  children: ReactNode;
  bg?: string;
  logoUrl?: string;
}) {
  return (
    <div
      className="min-h-dvh w-full flex flex-col items-center sm:justify-center relative"
      style={{ background: "var(--color-parchment)" }}
    >
      {logoUrl && (
        <div className="max-w-[430px] mx-auto absolute inset-0 pointer-events-none hidden sm:block">
          <img
            alt=""
            src={logoUrl}
            className="absolute top-4 right-4 w-24 h-24 object-contain opacity-[0.08]"
          />
        </div>
      )}
      <div
        className="w-full max-w-[430px] min-h-dvh sm:min-h-0 flex flex-col sm:rounded-[10px] sm:shadow-[0_4px_32px_rgba(8,26,45,0.14),0_1px_6px_rgba(8,26,45,0.07)]"
        style={{ background: bg }}
      >
        {children}
      </div>
      <p
        className="hidden sm:block text-center text-xs mt-3 tracking-wide opacity-60"
        style={{ color: "var(--color-gold)" }}
      >
        Open on your phone for the best experience
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Run the type check**

```bash
pnpm check-types:web
```

Expected: no errors. If errors appear, they will be in callers that passed `logoUrl` before it was a known prop — not yet added, so none expected yet.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/mobile-shell.tsx
git commit -m "feat(mobile-shell): desktop canvas — shadow, logo watermark, tip line"
```

---

## Task 2: Thread `logoUrl` through the seven tenant pages

**Context:** Each page below already calls `getTenant(slug)`. The DB schema has `logoUrl: text("logo_url")` — nullable — so the Drizzle type is `string | null`. Passing `tenantRecord.logoUrl ?? undefined` converts it to `string | undefined`, matching the prop type.

Variable name varies by page:
- Pages that call `toTenantBrand()` store the raw DB record as **`tenantRecord`**.
- `contact/page.tsx` and `refund-policy/page.tsx` call `getTenant()` and store the result as **`tenant`** (no `toTenantBrand` call).

**Files:**
- Modify: `apps/web/src/app/[tenant]/page.tsx`
- Modify: `apps/web/src/app/[tenant]/cart/page.tsx`
- Modify: `apps/web/src/app/[tenant]/checkout/page.tsx`
- Modify: `apps/web/src/app/[tenant]/item/[itemId]/page.tsx`
- Modify: `apps/web/src/app/[tenant]/contact/page.tsx`
- Modify: `apps/web/src/app/[tenant]/refund-policy/page.tsx`
- Modify: `apps/web/src/app/[tenant]/order/placed/page.tsx`

- [ ] **Step 1: Update `app/[tenant]/page.tsx`**

Find the line:
```tsx
    <MobileShell bg="var(--color-paper)">
```
Change to:
```tsx
    <MobileShell bg="var(--color-paper)" logoUrl={tenantRecord.logoUrl ?? undefined}>
```

- [ ] **Step 2: Update `app/[tenant]/cart/page.tsx`**

Find the line:
```tsx
    <MobileShell bg="var(--color-paper)">
```
Change to:
```tsx
    <MobileShell bg="var(--color-paper)" logoUrl={tenantRecord.logoUrl ?? undefined}>
```

- [ ] **Step 3: Update `app/[tenant]/checkout/page.tsx`**

Find the line:
```tsx
    <MobileShell bg="var(--color-paper)">
```
Change to:
```tsx
    <MobileShell bg="var(--color-paper)" logoUrl={tenantRecord.logoUrl ?? undefined}>
```

- [ ] **Step 4: Update `app/[tenant]/item/[itemId]/page.tsx`**

Find the line:
```tsx
    <MobileShell bg="var(--color-paper)">
```
Change to:
```tsx
    <MobileShell bg="var(--color-paper)" logoUrl={tenantRecord.logoUrl ?? undefined}>
```

- [ ] **Step 5: Update `app/[tenant]/contact/page.tsx`**

This page uses `tenant` (not `tenantRecord`) for the raw DB row:

Find the line:
```tsx
    <MobileShell bg="var(--color-paper)">
```
Change to:
```tsx
    <MobileShell bg="var(--color-paper)" logoUrl={tenant.logoUrl ?? undefined}>
```

- [ ] **Step 6: Update `app/[tenant]/refund-policy/page.tsx`**

This page uses `tenant` (not `tenantRecord`) for the raw DB row:

Find the line:
```tsx
    <MobileShell>
```
Change to:
```tsx
    <MobileShell logoUrl={tenant.logoUrl ?? undefined}>
```

- [ ] **Step 7: Update `app/[tenant]/order/placed/page.tsx`**

Find the line:
```tsx
    <MobileShell bg="var(--color-parchment)">
```
Change to:
```tsx
    <MobileShell bg="var(--color-parchment)" logoUrl={tenantRecord.logoUrl ?? undefined}>
```

- [ ] **Step 8: Run the type check**

```bash
pnpm check-types:web
```

Expected: no errors. All 7 pages now pass `logoUrl?: string` which matches the prop signature.

- [ ] **Step 9: Commit**

```bash
git add \
  apps/web/src/app/\[tenant\]/page.tsx \
  apps/web/src/app/\[tenant\]/cart/page.tsx \
  apps/web/src/app/\[tenant\]/checkout/page.tsx \
  "apps/web/src/app/[tenant]/item/[itemId]/page.tsx" \
  apps/web/src/app/\[tenant\]/contact/page.tsx \
  apps/web/src/app/\[tenant\]/refund-policy/page.tsx \
  "apps/web/src/app/[tenant]/order/placed/page.tsx"
git commit -m "feat(tenant-pages): thread logoUrl to MobileShell for desktop watermark"
```

---

## Post-implementation verification

Run through the acceptance criteria manually on a desktop browser (`pnpm dev:web`, resize to ≥ 640 px):

1. **Shadow + rounded corners** — visible on any tenant route at desktop width.
2. **Logo watermark** — visit `/nsbh` on desktop; if NSBH has a `logoUrl` set, it appears top-right of the column at low opacity. Remove it from DB temporarily to confirm the corner is empty when null.
3. **Tip line** — visible below the column on desktop; hidden on a ≤ 430 px viewport.
4. **Non-tenant routes** — visit `/` (school picker) and `/orders`; shadow + tip appear, no watermark, no JS errors.
5. **Column unchanged** — catalog grid, item PDP, checkout, cart still look identical at 430 px.
6. **Type check passes** — `pnpm check-types:web` exits 0.

Tune logo opacity from 8% to 10–12% if the NSBH logo is too faint against the parchment background (`opacity-[0.08]` → `opacity-[0.10]` or `opacity-[0.12]` in `mobile-shell.tsx`).
