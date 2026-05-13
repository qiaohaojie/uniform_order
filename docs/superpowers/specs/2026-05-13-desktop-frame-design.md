# Desktop Frame for Parent Shop — Design Spec

**Date:** 2026-05-13
**Status:** Approved (rev 2 — incorporates review feedback)
**Backlog ref:** `remaining_work.md` §3.12 / gap-analysis §5.18
**Effort:** ~4h

---

## Problem

The parent shop is intentionally capped at 430 px (`MobileShell`). On a desktop browser, the phone column floats in the centre of a flat parchment canvas with no visual treatment — it looks unfinished and undermines credibility with school decision-makers who evaluate the platform on a laptop before recommending it to parents.

Mobile-first is a product constraint, not a defect; the fix is to make the surrounding canvas look intentional.

---

## Goal

Style the desktop canvas so the 430 px column reads as a deliberate design choice rather than an unfinished page. Keep the column itself unchanged — no width increase, no layout changes inside it.

---

## Design

### Visual elements (desktop canvas only)

| Element | Detail |
|---|---|
| Column shadow | `box-shadow: 0 4px 32px rgba(8,26,45,0.14), 0 1px 6px rgba(8,26,45,0.07)` — applied at `sm:` (≥ 640 px) only; full-bleed on real phones gets none |
| Logo watermark | `tenant.logoUrl` rendered as an `<img>` near the top-right of the column, 96 × 96 px, `object-contain`, **8% opacity (tunable 8–12% based on visual check across NSBH and RGSH logos)**, `pointer-events-none`. Not rendered when `logoUrl` is null/empty. |
| Tip line | `"Open on your phone for the best experience"` — small text centred below the column, `hidden sm:block`. Styled with inline `style={{ color: "var(--color-gold)" }}` at reduced opacity (matches codebase convention). |
| Canvas background | Unchanged — `var(--color-parchment)` (`#FAF6EE`). |

### Breakpoint behaviour

- **< 430 px (real phone):** Column fills the viewport (`min-h-dvh`). No shadow, no watermark, no tip. Identical to today.
- **430 px – 640 px:** Column centred at full width; no decorations yet (narrow tablet edge case).
- **≥ 640 px (desktop / landscape tablet):** Full treatment — shadow, watermark, tip line. Column drops `min-h-dvh` and hugs content; canvas centres column vertically.

The `sm:` Tailwind breakpoint (640 px) gates all desktop treatment.

### Layout mechanics (fixes review-blocker #2)

Outer container today: `min-h-dvh w-full flex justify-center`.

Restructure to:
- **Outer:** `min-h-dvh w-full flex flex-col items-center sm:justify-center relative` (column-stack, `relative` so watermark can be absolutely positioned).
- **Inner column:** `w-full max-w-[430px] min-h-dvh sm:min-h-fit flex flex-col sm:rounded-[10px] sm:shadow-[…]`. Dropping `min-h-dvh` at `sm:` lets the tip sibling render directly below the column on desktop while preserving full-screen fill on phones.
- **Tip (sibling after inner column):** `hidden sm:block text-center text-xs mt-3 tracking-wide opacity-60`.
- **Watermark (sibling, absolute):** wrapped in a `max-w-3xl mx-auto absolute inset-0 pointer-events-none hidden sm:block` overlay; the `<img>` sits at `top-4 right-4` of that overlay. This keeps the watermark adjacent to the column even on ultrawide (1920px+) viewports — without the cap it would drift ~745 px from the column.

---

## Component changes

### `components/mobile-shell.tsx`

Add one optional prop:

```ts
logoUrl?: string
```

Apply the layout restructure described above. The watermark `<img>` is only rendered when `logoUrl` is truthy.

### Callers — thread `logoUrl`

11 caller sites exist. Treatment varies by route family:

| File | Action |
|---|---|
| `app/[tenant]/page.tsx` | Pass `logoUrl={tenant.logoUrl ?? undefined}` |
| `app/[tenant]/item/[itemId]/page.tsx` | Same — tenant already fetched |
| `app/[tenant]/cart/page.tsx` | Same |
| `app/[tenant]/checkout/page.tsx` | Same |
| `app/[tenant]/contact/page.tsx` | Same |
| `app/[tenant]/refund-policy/page.tsx` | Same |
| `app/[tenant]/order/placed/page.tsx` | Same |
| `app/home-client.tsx` (×2 `<MobileShell>` instances) | No change — school picker has no tenant context, so no logo |
| `app/orders/page.tsx` | No change — cross-tenant parent order list |
| `app/orders/[orderId]/order-detail-client.tsx` | No change — order may span tenants; keeping it logo-less avoids mis-branding |

All 7 tenant pages already fetch the tenant record (verified via grep) — adding the prop is a one-liner per page.

**Alternative considered:** Lifting `<MobileShell>` into `[tenant]/layout.tsx` to eliminate threading. Rejected because each page passes its own `bg` prop (paper vs parchment) and a layout-lift would require a new per-route bg coordination mechanism — larger surface than the 7 one-line caller edits.

---

## Edge cases

| Case | Behaviour |
|---|---|
| `logoUrl` is null/empty | Watermark `<img>` is not rendered — no broken image icon, no empty space |
| Logo is a tall portrait image | `object-contain` keeps it within the 96 × 96 box with no cropping |
| Logo is very light or very dark | 8% default may need 10–12% for light logos. Tune during implementation by viewing both NSBH and RGSH on desktop. |
| Canvas narrower than column (< 430 px window) | `sm:` guard means no decorations apply below 640 px — safe |
| Parchment-bg pages (home, order/placed) on desktop | Inner column bg = canvas bg, so the shadow is the only visual separator. Acceptable; this is the intended outcome for those routes. |
| Non-tenant routes (home, /orders/*) | Render with shadow + tip but no watermark — clean degradation |

---

## Out of scope

- No change to catalog grid, item PDP, checkout, or any other screen inside the 430 px column.
- No two-column or wider layout for desktop.
- No second crest in the bottom-left corner (single corner placement is more subtle).
- No pattern/texture on the canvas background (Option C from brainstorm was rejected).
- No school-name label bar across the top (Option C was rejected).

---

## Acceptance criteria

1. On a ≥ 640 px viewport, the column has a visible shadow and rounded corners.
2. When `tenant.logoUrl` is set, the logo appears near the top-right of the column (constrained to `max-w-3xl` overlay) at low opacity; when not set, that area is empty.
3. The tip line appears directly below the column on desktop (not after a viewport-height gap), absent on mobile.
4. Non-tenant routes (`/` school picker, `/orders/*`) render with shadow + tip but no watermark — no errors, no broken images.
5. The 430 px column width, its internal layout, and the parchment background are unchanged.
6. TypeScript check passes (`pnpm check-types:web`).
