# Desktop Frame for Parent Shop — Design Spec

**Date:** 2026-05-13
**Status:** Approved
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
| Logo watermark | `tenant.logoUrl` rendered as an `<img>` in the top-right corner of the canvas, 96 × 96 px, `object-contain`, `8% opacity`, `pointer-events-none`. Not rendered when `logoUrl` is null/empty. |
| Tip line | `"Open on your phone for the best experience"` — small text centred below the column, `hidden sm:block` so it never shows on a real phone. Styled in `--color-gold` at reduced opacity. |
| Canvas background | Unchanged — `var(--color-parchment)` (`#FAF6EE`). |

### Breakpoint behaviour

- **< 430 px (real phone):** Column fills the viewport. No shadow, no watermark, no tip. Identical to today.
- **430 px – 640 px:** Column centred at full width; no decorations yet (narrow tablet edge case).
- **≥ 640 px (desktop / landscape tablet):** Full treatment — shadow, watermark, tip line.

The `sm:` Tailwind breakpoint (640 px) is used for the `≥ desktop` condition throughout.

---

## Component changes

### `components/mobile-shell.tsx`

Add one optional prop:

```ts
logoUrl?: string
```

Render the canvas decorations inside the outer div when on desktop:

- The outer `div` gains `relative` positioning so the watermark `<img>` can be absolutely positioned.
- The watermark `<img>` is placed `absolute top-4 right-4 sm:block hidden w-24 h-24 object-contain opacity-[0.08] pointer-events-none select-none`.
- The tip `<p>` sits below the inner column (as a sibling, not inside it): `hidden sm:block text-center text-xs text-[--color-gold] opacity-50 mt-3 tracking-wide`.
- The inner column div gains `sm:shadow-[0_4px_32px_rgba(8,26,45,0.14),0_1px_6px_rgba(8,26,45,0.07)] sm:rounded-[10px]` (no rounding on full-bleed phones).

### Callers — thread `logoUrl`

Every layout file that renders `<MobileShell>` must thread `tenant.logoUrl`. Current callers:

| File | Change |
|---|---|
| `app/[tenant]/layout.tsx` | Fetch `tenant` (already done for other props), pass `logoUrl={tenant.logoUrl ?? undefined}` |

No other files render `MobileShell` today; confirm with a grep before closing.

---

## Edge cases

| Case | Behaviour |
|---|---|
| `logoUrl` is null/empty | Watermark `<img>` is not rendered — no broken image icon, no empty space |
| Logo is a tall portrait image | `object-contain` keeps it within the 96 × 96 box with no cropping |
| Logo is very light / white | Still visible at 8% opacity on parchment background — no fix needed; this is the school's brand choice |
| Canvas narrower than the column (e.g., 400 px window) | `sm:` guard means no decorations apply below 640 px — safe |

---

## Out of scope

- No change to catalog grid, item PDP, checkout, or any other screen inside the 430 px column.
- No two-column or wider layout for desktop.
- No second crest in the bottom-left corner (opted for single corner placement to keep it subtle).
- No pattern/texture on the canvas background (Option C was rejected).
- No school-name label bar across the top (Option C was rejected).

---

## Acceptance criteria

1. On a ≥ 640 px viewport, the column has a visible shadow and rounded corners.
2. When `tenant.logoUrl` is set, the logo appears top-right at low opacity; when not set, the corner is empty.
3. The tip line appears below the column on desktop, absent on mobile.
4. The 430 px column width, its internal layout, and the parchment background are unchanged.
5. TypeScript check passes (`pnpm check-types:web`).
