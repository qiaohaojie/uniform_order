# Catalog Chip + Search Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the visual/behavioural mismatch between active search query and category chip state in the parent shop catalog.

**Architecture:** Single-file change to `catalog-grid.tsx`. Chips convert from `<Link>` to `<button>` elements; clicking while a query is active clears the query and navigates. The chip row dims to 50% opacity when a query is active to signal "click to reset search".

**Tech Stack:** Next.js App Router, `useRouter` from `next/navigation`, Tailwind CSS v4.

---

### Task 1: Convert chips to reset-aware buttons and dim during active search

**Files:**
- Modify: `apps/web/src/app/[tenant]/catalog-grid.tsx`

**Reference — current chip strip (lines 80–99):**
```tsx
<div className="px-4 pt-2.5 pb-1 flex gap-2 overflow-x-auto flex-shrink-0 [&::-webkit-scrollbar]:hidden">
  {CATEGORIES.map((c) => {
    const on = c === activeCat;
    return (
      <Link
        key={c}
        href={`/${tenantId}?cat=${c}`}
        scroll={false}
        className="h-[30px] px-3 rounded-full inline-flex items-center text-[12px] font-semibold flex-shrink-0 border"
        style={{
          borderColor: on ? accent : "var(--color-rule)",
          background: on ? accent : "#fff",
          color: on ? "#fff" : "var(--color-ink)",
        }}
      >
        {c}
      </Link>
    );
  })}
</div>
```

- [ ] **Step 1: Add `useRouter` to the import line**

In `apps/web/src/app/[tenant]/catalog-grid.tsx`, change line 3 from:
```tsx
import { useEffect, useRef, useState } from "react";
```
to:
```tsx
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
```

- [ ] **Step 2: Instantiate the router inside the component**

After the existing `const clearSearch = ...` block (around line 23), add:
```tsx
const router = useRouter();
```

- [ ] **Step 3: Replace the chip strip**

Replace the entire chip strip block (lines 80–99) with:
```tsx
{/* Category chips — dimmed while search is active; click resets search */}
<div
  className="px-4 pt-2.5 pb-1 flex gap-2 overflow-x-auto flex-shrink-0 [&::-webkit-scrollbar]:hidden transition-opacity"
  style={{ opacity: q.length > 0 ? 0.5 : 1 }}
>
  {CATEGORIES.map((c) => {
    const on = c === activeCat;
    return (
      <button
        key={c}
        type="button"
        onClick={() => {
          setQ("");
          router.push(`/${tenantId}?cat=${c}`, { scroll: false });
        }}
        className="h-[30px] px-3 rounded-full inline-flex items-center text-[12px] font-semibold flex-shrink-0 border"
        style={{
          borderColor: on ? accent : "var(--color-rule)",
          background: on ? accent : "#fff",
          color: on ? "#fff" : "var(--color-ink)",
        }}
      >
        {c}
      </button>
    );
  })}
</div>
```

- [ ] **Step 4: Run type-check**

```bash
cd /path/to/repo && pnpm check-types:web
```

Expected: no errors. If errors appear, they will name the exact lines; fix them before continuing.

- [ ] **Step 5: Manually verify the fix**

```bash
pnpm dev:web
```

1. Visit `http://localhost:3000/nsbh`
2. Type "blazer" in the search box — grid shows Navy Blazer (Winter item), chip row dims to ~50% opacity.
3. Click the "Summer" chip — search clears, grid shows Summer items, Summer chip is fully opaque and highlighted.
4. Verify: with an empty search box, all chips are full opacity and clicking them navigates without clearing anything.
5. Verify: the `×` clear button in the search box still works (clears query, keeps current category).

- [ ] **Step 6: Close issue #27 and commit**

```bash
git add apps/web/src/app/[tenant]/catalog-grid.tsx
git commit -m "fix(catalog): chips dim + reset search on click (closes #27)"
```
