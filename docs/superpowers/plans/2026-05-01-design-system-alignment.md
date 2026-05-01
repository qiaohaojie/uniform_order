# Design System Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the four gaps between the canonical `Design System.html` and the codebase: extract shared utilities, add the missing `SectionTitle` and `Spark` components, add CSS typography utilities, and fix inconsistent heading sizes in admin pages.

**Architecture:** New components (`SectionTitle`, `Spark`) and a shared utility (`shade`) follow the same file-per-component pattern used by `Btn`, `Chip`, etc. Typography utilities are plain CSS classes in `index.css`, consistent with the existing `.tnum` class. No data layer or routing changes.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS v4, pnpm workspaces. Type-checking (`pnpm check-types:web`) is the correctness gate — there is no test suite.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `apps/web/src/lib/ui.ts` | **Create** | `shade(hex, pct)` — colour lightness utility |
| `apps/web/src/components/section-title.tsx` | **Create** | `SectionTitle` — kicker + serif heading + rule |
| `apps/web/src/components/spark.tsx` | **Create** | `Spark` — SVG sparkline chart |
| `apps/web/src/index.css` | **Modify** | Add 6 `.type-*` typography utility classes |
| `apps/web/src/components/crest.tsx` | **Modify** | Remove local `shade`; import from `@/lib/ui` |
| `apps/web/src/components/garment.tsx` | **Modify** | Remove local `shade`; import from `@/lib/ui` |
| `apps/web/src/app/admin/[tenant]/dashboard/dashboard-client.tsx` | **Modify** | Remove inline `Spark`; import from `@/components/spark` |
| `apps/web/src/app/admin/[tenant]/settings/page.tsx` | **Modify** | 4× `h2` at 18px → `type-h2` (22px) |
| `apps/web/src/app/admin/[tenant]/reports/page.tsx` | **Modify** | 3× `h3` at 17px → `type-h2` (22px) |
| `apps/web/src/app/admin/[tenant]/orders/[orderId]/page.tsx` | **Modify** | "Pick Slip" → `type-h2`; 3× detail labels → `type-label` |

---

## Task 1: Extract `shade()` to shared utility

**Files:**
- Create: `apps/web/src/lib/ui.ts`
- Modify: `apps/web/src/components/crest.tsx`
- Modify: `apps/web/src/components/garment.tsx`

- [ ] **Step 1: Create `apps/web/src/lib/ui.ts`**

```ts
export function shade(hex: string, pct: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const f = pct < 0 ? 1 + pct / 100 : pct / 100;
  if (pct < 0) {
    r = Math.round(r * f);
    g = Math.round(g * f);
    b = Math.round(b * f);
  } else {
    r = Math.round(r + (255 - r) * f);
    g = Math.round(g + (255 - g) * f);
    b = Math.round(b + (255 - b) * f);
  }
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
```

- [ ] **Step 2: Update `apps/web/src/components/crest.tsx`**

Remove the local `shade` function (lines 3–20) and add an import at the top:

```ts
import { shade } from "@/lib/ui";
import type { Tenant } from "@/lib/data";
```

The rest of the file is unchanged. The file should start with:

```tsx
import { shade } from "@/lib/ui";
import type { Tenant } from "@/lib/data";

export function Crest({ tenant, size = 56, ring = true }: { tenant: Tenant; size?: number; ring?: boolean }) {
  // ... (unchanged)
```

- [ ] **Step 3: Update `apps/web/src/components/garment.tsx`**

Remove the local `shade` function (lines 3–21) and add an import at the top:

```ts
import { shade } from "@/lib/ui";
```

The file should start with:

```tsx
import { shade } from "@/lib/ui";

const ITEM_TO_SHAPE: Record<string, string> = {
  // ... (unchanged)
```

- [ ] **Step 4: Run type check**

```bash
pnpm check-types:web
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/ui.ts apps/web/src/components/crest.tsx apps/web/src/components/garment.tsx
git commit -m "refactor: extract shade() to shared lib/ui utility"
```

---

## Task 2: Add `SectionTitle` component

**Files:**
- Create: `apps/web/src/components/section-title.tsx`

- [ ] **Step 1: Create `apps/web/src/components/section-title.tsx`**

```tsx
type SectionTitleProps = {
  title: string;
  kicker?: string;
  sub?: string;
  accent?: string;
};

export function SectionTitle({
  title,
  kicker,
  sub,
  accent = "var(--color-gold)",
}: SectionTitleProps) {
  return (
    <div style={{ marginBottom: 20 }}>
      {kicker && (
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "1.4px",
            textTransform: "uppercase",
            color: accent,
          }}
        >
          {kicker}
        </div>
      )}
      <h2
        style={{
          fontFamily: "var(--font-serif)",
          fontWeight: 500,
          fontSize: 28,
          color: "var(--color-ink)",
          margin: "6px 0",
          letterSpacing: "-0.3px",
        }}
      >
        {title}
      </h2>
      {sub && (
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            color: "var(--color-ink-dim)",
            lineHeight: 1.5,
          }}
        >
          {sub}
        </div>
      )}
      <div style={{ height: 1, background: "var(--color-rule)", marginTop: 12 }} />
    </div>
  );
}
```

- [ ] **Step 2: Run type check**

```bash
pnpm check-types:web
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/section-title.tsx
git commit -m "feat: add SectionTitle component matching design system spec"
```

---

## Task 3: Extract `Spark` component and update dashboard

**Files:**
- Create: `apps/web/src/components/spark.tsx`
- Modify: `apps/web/src/app/admin/[tenant]/dashboard/dashboard-client.tsx`

- [ ] **Step 1: Create `apps/web/src/components/spark.tsx`**

```tsx
export function Spark({
  data,
  w = 120,
  h = 32,
  color = "var(--color-navy)",
}: {
  data: number[];
  w?: number;
  h?: number;
  color?: string;
}) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
```

- [ ] **Step 2: Update `dashboard-client.tsx`**

At the top of `apps/web/src/app/admin/[tenant]/dashboard/dashboard-client.tsx`, add the import:

```tsx
"use client";
import Link from "next/link";
import type { Tenant } from "@/lib/data";
import type { SalesData, AdminOrder } from "@/lib/admin-data";
import { Chip } from "@/components/chip";
import { Spark } from "@/components/spark";
```

Then remove the entire local `Spark` function definition (lines 7–22 of the current file):

```tsx
// DELETE this entire block:
function Spark({ data, w = 80, h = 28, color }: { data: number[]; w?: number; h?: number; color: string }) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
```

All existing `<Spark .../>` JSX call sites in `dashboard-client.tsx` remain unchanged — they already pass explicit `w`, `h`, and `color` props.

- [ ] **Step 3: Run type check**

```bash
pnpm check-types:web
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/spark.tsx apps/web/src/app/admin/[tenant]/dashboard/dashboard-client.tsx
git commit -m "feat: extract Spark to shared component; remove inline definition from dashboard"
```

---

## Task 4: Add typography utility classes to `index.css`

**Files:**
- Modify: `apps/web/src/index.css`

- [ ] **Step 1: Append typography utilities to `apps/web/src/index.css`**

After the existing `.tnum` rule, add:

```css
.type-display {
  font-family: var(--font-serif);
  font-size: 44px;
  font-weight: 500;
  letter-spacing: -0.6px;
  line-height: 1.1;
}

.type-h1 {
  font-family: var(--font-serif);
  font-size: 28px;
  font-weight: 500;
  letter-spacing: -0.3px;
}

.type-h2 {
  font-family: var(--font-serif);
  font-size: 22px;
  font-weight: 500;
}

.type-body {
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 400;
}

.type-label {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.type-mono {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 600;
}
```

The complete `index.css` after the edit:

```css
@import "tailwindcss";
@import "@heroui/styles/css";
@import "@heroui-pro/react/css";

@theme {
  --color-navy: #0E2A47;
  --color-navy-deep: #081A2D;
  --color-navy-soft: #1B3A5F;
  --color-parchment: #FAF6EE;
  --color-paper: #FDFBF6;
  --color-ink: #15212F;
  --color-ink-dim: #56657A;
  --color-rule: #E5DFD2;
  --color-gold: #B08A3E;
  --color-sage: #5C7A55;
  --color-alert: #B23A2A;
  --color-success: #2F6B3D;

  --font-serif: var(--font-newsreader);
  --font-sans: var(--font-inter);
  --font-mono: var(--font-jetbrains);
}

html, body {
  margin: 0;
  padding: 0;
  font-family: var(--font-sans);
  color: var(--color-ink);
  background: var(--color-parchment);
}

* { box-sizing: border-box; }

.tnum { font-feature-settings: "tnum"; font-variant-numeric: tabular-nums; }

.type-display {
  font-family: var(--font-serif);
  font-size: 44px;
  font-weight: 500;
  letter-spacing: -0.6px;
  line-height: 1.1;
}

.type-h1 {
  font-family: var(--font-serif);
  font-size: 28px;
  font-weight: 500;
  letter-spacing: -0.3px;
}

.type-h2 {
  font-family: var(--font-serif);
  font-size: 22px;
  font-weight: 500;
}

.type-body {
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 400;
}

.type-label {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.type-mono {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 600;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/index.css
git commit -m "feat: add canonical type-* typography utility classes to index.css"
```

---

## Task 5: Fix settings page heading sizes

**Files:**
- Modify: `apps/web/src/app/admin/[tenant]/settings/page.tsx`

There are 4 `h2` headings in this file, each at `font-serif text-[18px] font-medium`. Replace all with `type-h2`.

- [ ] **Step 1: Update "Shop details" heading (line 31)**

```tsx
// Before:
<h2 className="font-serif text-[18px] font-medium mb-4" style={{ color: "var(--color-ink)" }}>
  Shop details
</h2>

// After:
<h2 className="type-h2 mb-4" style={{ color: "var(--color-ink)" }}>
  Shop details
</h2>
```

- [ ] **Step 2: Update "Fulfilment" heading (line 95)**

```tsx
// Before:
<h2 className="font-serif text-[18px] font-medium mb-4" style={{ color: "var(--color-ink)" }}>
  Fulfilment
</h2>

// After:
<h2 className="type-h2 mb-4" style={{ color: "var(--color-ink)" }}>
  Fulfilment
</h2>
```

- [ ] **Step 3: Update "Stripe Connect" heading (line 143)**

```tsx
// Before:
<h2 className="font-serif text-[18px] font-medium mb-1" style={{ color: "var(--color-ink)" }}>
  Stripe Connect
</h2>

// After:
<h2 className="type-h2 mb-1" style={{ color: "var(--color-ink)" }}>
  Stripe Connect
</h2>
```

- [ ] **Step 4: Update "Email notifications" heading (line 184)**

```tsx
// Before:
<h2 className="font-serif text-[18px] font-medium mb-4" style={{ color: "var(--color-ink)" }}>
  Email notifications
</h2>

// After:
<h2 className="type-h2 mb-4" style={{ color: "var(--color-ink)" }}>
  Email notifications
</h2>
```

- [ ] **Step 5: Run type check**

```bash
pnpm check-types:web
```

Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/admin/[tenant]/settings/page.tsx
git commit -m "fix: update settings page section headings to type-h2 (22px)"
```

---

## Task 6: Fix reports page heading sizes

**Files:**
- Modify: `apps/web/src/app/admin/[tenant]/reports/page.tsx`

There are 3 `h3` headings at `font-serif text-[17px] font-medium`. Replace with `type-h2`.

- [ ] **Step 1: Update "Monthly revenue" heading (line 77)**

```tsx
// Before:
<h3 className="font-serif text-[17px] font-medium m-0" style={{ color: "var(--color-ink)" }}>
  Monthly revenue
</h3>

// After:
<h3 className="type-h2 m-0" style={{ color: "var(--color-ink)" }}>
  Monthly revenue
</h3>
```

- [ ] **Step 2: Update "Revenue by category" heading (line 115)**

```tsx
// Before:
<h3 className="font-serif text-[17px] font-medium m-0 mb-4" style={{ color: "var(--color-ink)" }}>
  Revenue by category
</h3>

// After:
<h3 className="type-h2 m-0 mb-4" style={{ color: "var(--color-ink)" }}>
  Revenue by category
</h3>
```

- [ ] **Step 3: Update "GST summary (BAS-ready)" heading (line 147)**

```tsx
// Before:
<h3 className="font-serif text-[17px] font-medium m-0 mb-4" style={{ color: "var(--color-ink)" }}>
  GST summary (BAS-ready)
</h3>

// After:
<h3 className="type-h2 m-0 mb-4" style={{ color: "var(--color-ink)" }}>
  GST summary (BAS-ready)
</h3>
```

- [ ] **Step 4: Run type check**

```bash
pnpm check-types:web
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/admin/[tenant]/reports/page.tsx
git commit -m "fix: update reports page headings to type-h2 (22px)"
```

---

## Task 7: Fix order detail page typography

**Files:**
- Modify: `apps/web/src/app/admin/[tenant]/orders/[orderId]/page.tsx`

Two fixes: "Pick Slip" heading uses inline Tailwind classes instead of the utility; the three field labels (Student, Parent, Fulfilment) are at 10px instead of the spec's 11px.

- [ ] **Step 1: Update "Pick Slip" heading (line 94–98)**

```tsx
// Before:
<div
  className="font-serif text-[22px] font-medium leading-tight"
  style={{ color: "var(--color-ink)" }}
>
  Pick Slip
</div>

// After:
<div
  className="type-h2 leading-tight"
  style={{ color: "var(--color-ink)" }}
>
  Pick Slip
</div>
```

- [ ] **Step 2: Update "Student" field label (line 120–123)**

```tsx
// Before:
<div
  className="text-[10px] font-bold tracking-[0.6px] uppercase mb-1"
  style={{ color: "var(--color-ink-dim)" }}
>
  Student
</div>

// After:
<div
  className="type-label mb-1"
  style={{ color: "var(--color-ink-dim)" }}
>
  Student
</div>
```

- [ ] **Step 3: Update "Parent" field label (line 133–136)**

```tsx
// Before:
<div
  className="text-[10px] font-bold tracking-[0.6px] uppercase mb-1"
  style={{ color: "var(--color-ink-dim)" }}
>
  Parent
</div>

// After:
<div
  className="type-label mb-1"
  style={{ color: "var(--color-ink-dim)" }}
>
  Parent
</div>
```

- [ ] **Step 4: Update "Fulfilment" field label (line 146–149)**

```tsx
// Before:
<div
  className="text-[10px] font-bold tracking-[0.6px] uppercase mb-1"
  style={{ color: "var(--color-ink-dim)" }}
>
  Fulfilment
</div>

// After:
<div
  className="type-label mb-1"
  style={{ color: "var(--color-ink-dim)" }}
>
  Fulfilment
</div>
```

- [ ] **Step 5: Run type check**

```bash
pnpm check-types:web
```

Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/admin/[tenant]/orders/[orderId]/page.tsx
git commit -m "fix: update order detail page to use type-h2 and type-label utilities"
```

---

## Task 8: Final verification

- [ ] **Step 1: Run full type check**

```bash
pnpm check-types:web
```

Expected: zero errors.

- [ ] **Step 2: Spot-check via dev server**

```bash
pnpm dev:web
```

Visit these routes and confirm:
- `http://localhost:3000/admin/nsbh/settings` — Section headings should be 22px (visibly larger than before)
- `http://localhost:3000/admin/nsbh/reports` — Section headings match settings
- `http://localhost:3000/admin/nsbh/orders/NSBH-04298` — "Pick Slip" at 22px; Student/Parent/Fulfilment labels at 11px
- `http://localhost:3000/admin/nsbh/dashboard` — Spark line still renders correctly
- `http://localhost:3000/nsbh` — Parent portal unchanged (no visual regressions)
- `http://localhost:3000/nsbh/cart` — Unchanged

- [ ] **Step 3: Verify no remaining inline `shade` or local `Spark` definitions**

```bash
grep -r "function shade" apps/web/src --include="*.tsx" --include="*.ts"
```

Expected: no output (shade only in `lib/ui.ts`).

```bash
grep -rn "function Spark" apps/web/src --include="*.tsx" --include="*.ts"
```

Expected: no output (Spark only in `components/spark.tsx`).
