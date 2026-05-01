# Design System Alignment

**Date:** 2026-05-01  
**Spec file:** `docs/superpowers/specs/2026-05-01-design-system-alignment-design.md`  
**Reference:** `my_doc/UI_prototypes/project/Design System.html` + `design-system/tokens.jsx` + `design-system/components.jsx`

---

## Context

The canonical design system (`Design System.html`) defines color tokens, typography scale, and UI primitives for UniformOrder. The codebase already has a solid foundation — all 12 color tokens and font references are correctly wired in `index.css`, and seven primitive components (`Btn`, `Chip`, `Crest`, `DoubleRule`, `GarmentVector`, `PlatformMark`, `AdminShell`) match the spec.

Four gaps remain:

1. `SectionTitle` is missing as a shared component — admin pages inline a non-standard variant at incorrect sizes.
2. `Spark` is defined inline in `dashboard-client.tsx` rather than as a shared component.
3. `shade()` is copy-pasted in both `crest.tsx` and `garment.tsx`.
4. No canonical CSS typography utilities exist; pages hand-roll sizes with no shared reference.

---

## Goals

- Every UI surface uses the same type scale, spacing, and component primitives as the design system.
- A developer adding a new admin page has a clear component to reach for (`SectionTitle`) instead of inventing their own heading pattern.
- No logic is duplicated (`shade`, `Spark`).
- The change is purely structural — no visual regressions on parent portal screens, which are already aligned.

---

## Out of Scope

- Changes to the parent portal shopping flow (already aligned).
- New features or data layer changes.
- HeroUI component adoption (separate decision).
- Super-admin portal (not yet built in this codebase).

---

## Design

### Part 1 — Shared `shade()` utility

**File:** `apps/web/src/lib/ui.ts`

Export a single `shade(hex: string, pct: number): string` function. Both `crest.tsx` and `garment.tsx` import from `@/lib/ui` instead of defining it locally. No behaviour change.

```ts
export function shade(hex: string, pct: number): string { ... }
```

---

### Part 2 — `SectionTitle` component

**File:** `apps/web/src/components/section-title.tsx`

Matches the design system spec exactly. Used as the canonical section header for all admin page content areas.

**Props:**
| Prop | Type | Default | Notes |
|---|---|---|---|
| `title` | `string` | required | Rendered as Newsreader 28/500 |
| `kicker` | `string?` | — | Inter 11/700, uppercase, 1.4px tracking, accent colour |
| `sub` | `string?` | — | Inter 13/400, ink-dim, lineHeight 1.5 |
| `accent` | `string?` | `var(--color-gold)` | Kicker text colour; pass tenant accent for tenant-scoped sections |

**Visual anatomy:**
```
[KICKER TEXT]          ← Inter 11/700, uppercase, gold by default
Section Title          ← Newsreader 28/500, ink, tracking -0.3px
Optional sub-text.     ← Inter 13, ink-dim, lineHeight 1.5
────────────────────   ← 1px rule, rule colour, marginTop 12
```

**Usage in admin pages:**

Replace every inline `kicker + title + rule` pattern in admin content pages with `<SectionTitle kicker="..." title="..." sub="..." />`. Sub-section `h2` headings within page content (not full SectionTitle) use `font-serif text-[22px] font-medium` (H2 spec).

Pages to update: `settings/page.tsx`, `upload/page.tsx`, `reports/page.tsx`, `catalog/page.tsx`, `orders/page.tsx`, `orders/[orderId]/page.tsx`. Dashboard page uses `AdminTopbar` only and needs no SectionTitle changes.

---

### Part 3 — `Spark` component

**File:** `apps/web/src/components/spark.tsx`

Extracted from `dashboard-client.tsx`. Identical rendering — SVG polyline, strokeWidth 1.5, round line caps and joins.

**Props:**
| Prop | Type | Default |
|---|---|---|
| `data` | `number[]` | required |
| `w` | `number?` | 120 |
| `h` | `number?` | 32 |
| `color` | `string?` | `var(--color-navy)` |

`dashboard-client.tsx` replaces its local `Spark` definition with `import { Spark } from "@/components/spark"`.

---

### Part 4 — Typography utilities in `index.css`

Six canonical utility classes added under `@layer utilities`. These encode the exact spec values so pages don't hand-roll sizes.

| Class | Font | Size | Weight | Notes |
|---|---|---|---|---|
| `.type-display` | Newsreader | 44px | 500 | tracking -0.6px, lineHeight 1.1 |
| `.type-h1` | Newsreader | 28px | 500 | tracking -0.3px |
| `.type-h2` | Newsreader | 22px | 500 | — |
| `.type-body` | Inter | 14px | 400 | — |
| `.type-label` | Inter | 11px | 700 | uppercase, tracking 1px |
| `.type-mono` | JetBrains Mono | 14px | 600 | — |

Existing pages that already use correct values won't be touched. Only clear mismatches (e.g., admin sub-headings at 18px) are corrected.

---

## Files Changed

| File | Change |
|---|---|
| `apps/web/src/lib/ui.ts` | **New** — exports `shade()` |
| `apps/web/src/components/section-title.tsx` | **New** — `SectionTitle` component |
| `apps/web/src/components/spark.tsx` | **New** — `Spark` component |
| `apps/web/src/index.css` | **Modified** — add 6 typography utility classes |
| `apps/web/src/components/crest.tsx` | **Modified** — import `shade` from `@/lib/ui` |
| `apps/web/src/components/garment.tsx` | **Modified** — import `shade` from `@/lib/ui` |
| `apps/web/src/app/admin/[tenant]/dashboard/dashboard-client.tsx` | **Modified** — use shared `Spark` |
| `apps/web/src/app/admin/[tenant]/settings/page.tsx` | **Modified** — use `SectionTitle` |
| `apps/web/src/app/admin/[tenant]/upload/page.tsx` | **Modified** — use `SectionTitle` |
| `apps/web/src/app/admin/[tenant]/reports/page.tsx` | **Modified** — use `SectionTitle` |
| `apps/web/src/app/admin/[tenant]/catalog/page.tsx` | **Modified** — use `SectionTitle` |
| `apps/web/src/app/admin/[tenant]/orders/page.tsx` | **Modified** — use `SectionTitle` |
| `apps/web/src/app/admin/[tenant]/orders/[orderId]/page.tsx` | **Modified** — use `SectionTitle` |
| `apps/web/src/app/admin/[tenant]/dashboard/page.tsx` | No change — uses `AdminTopbar` only; no inline section headers |

---

## Success Criteria

- `pnpm check-types:web` passes with zero errors.
- No visual change to the parent portal (mobile shopping flow).
- All admin section headers share the same visual appearance — kicker + Newsreader title + rule.
- No remaining inline `Spark` or `shade` definitions outside `@/components/spark` and `@/lib/ui`.
- New pages can be built by composing `SectionTitle`, `Btn`, `Chip`, `Crest`, `DoubleRule`, `Spark` without inventing new patterns.
