# Catalog Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the fake search-shaped `<div>` at `app/[tenant]/page.tsx:78-86` into a working client-side filter that searches by name + category, with cross-category behavior, accessible empty state, and a debounced screen-reader announcement.

**Architecture:** A single new `"use client"` component (`catalog-grid.tsx`) absorbs the search input, result-count line, grid, and empty state. The RSC `page.tsx` keeps the header/chips/bottom-nav and passes the **full** tenant catalog plus the URL-resolved `activeCat` to the client. The client computes `visible = q ? items.filter(matchFn) : items.filter(byChip)`. Chips remain server-rendered `<Link>` elements driven by `?cat=`.

**Tech Stack:** Next.js 16 App Router (RSC + client islands), Tailwind v4, TypeScript, no test framework — `pnpm check-types:web` is the correctness gate plus manual browser smoke.

**Spec:** `docs/superpowers/specs/2026-05-12-catalog-search-design.md`

**No test suite available** — this project has no Vitest/Jest/Playwright unit tests. Verification gates per task are (1) `pnpm check-types:web` passes and (2) explicit manual browser checks. Treat each manual check as a non-skippable verification step.

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `apps/web/src/components/icons.tsx` | Modify (append) | Add `ClearIcon` (×) — 14px stroke-based, matches existing `SearchIcon` style |
| `apps/web/src/app/[tenant]/catalog-grid.tsx` | Create | `"use client"`. Owns input state, filter, count line, grid, empty state, live region. Returns a React Fragment. |
| `apps/web/src/app/[tenant]/page.tsx` | Modify (lines 45, 78-86, 110-113, 116-142) | Drop the chip filter; drop the search `<div>`, the `<h3>`, and the grid; render `<CatalogGrid>` in their place. |

---

## Task 1: Add `ClearIcon` to the icon set

**Files:**
- Modify: `apps/web/src/components/icons.tsx` (append after `SearchIcon` at line 126)

- [ ] **Step 1: Append the `ClearIcon` component**

Open `apps/web/src/components/icons.tsx` and add after the closing `}` of `SearchIcon` (line 126):

```tsx
export function ClearIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M6 6 L18 18 M18 6 L6 18" strokeLinecap="round" />
    </svg>
  );
}
```

The stroke width, viewBox, and `IconProps` import match the rest of the file. Default size `14` matches the spec; default for other small icons (`ChevronRightIcon`, `LockIcon`) is also `14`.

- [ ] **Step 2: Verify the file still type-checks**

Run from repo root: `pnpm check-types:web`

Expected: passes with no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/icons.tsx
git commit -m "feat(icons): add ClearIcon for catalog search clear button"
```

---

## Task 2: Scaffold `catalog-grid.tsx` as a pure refactor (no behavior change yet)

This task moves the search div, the result-count h3, and the grid out of `page.tsx` and into a new client component **without** changing any rendered output. The static `<div>` search bar stays static in this task. Filter behavior is identical to today. We verify visually that nothing has changed before adding interactivity in Task 3.

**Files:**
- Create: `apps/web/src/app/[tenant]/catalog-grid.tsx`
- Modify: `apps/web/src/app/[tenant]/page.tsx` (lines 45, 78-86, 110-113, 116-142)

- [ ] **Step 1: Create the new client component file**

Create `apps/web/src/app/[tenant]/catalog-grid.tsx`:

```tsx
"use client";

import Link from "next/link";
import type { CatalogItem } from "@/lib/data";
import { GarmentVector } from "@/components/garment";
import { SearchIcon } from "@/components/icons";

type CatalogGridProps = {
  items: CatalogItem[];   // full tenant catalog (NOT chip-filtered)
  activeCat: string;
  tenantId: string;
  accent: string;
};

export function CatalogGrid({ items, activeCat, tenantId }: CatalogGridProps) {
  const visible = items.filter((i) => i.cat === activeCat);

  return (
    <>
      {/* Search (still static in this task; wired up in Task 3) */}
      <div className="px-4 pt-3.5 pb-1.5 flex-shrink-0">
        <div
          className="h-10 rounded-lg bg-white flex items-center px-3 gap-2 border"
          style={{ borderColor: "var(--color-rule)" }}
        >
          <span style={{ color: "var(--color-ink-dim)" }}><SearchIcon size={16} /></span>
          <span className="text-[13px]" style={{ color: "var(--color-ink-dim)" }}>Search uniforms</span>
        </div>
      </div>

      {/* Result-count line */}
      <div className="px-4 pt-3 pb-2 flex-shrink-0 flex items-baseline gap-2">
        <h3 className="font-serif text-[18px] font-medium m-0">{activeCat} Uniform</h3>
        <span className="text-[11px]" style={{ color: "var(--color-ink-dim)" }}>· {visible.length} items</span>
      </div>

      {/* Grid */}
      <div className="flex-1 px-4 pb-3 grid grid-cols-2 gap-3 content-start">
        {visible.map((it) => {
          const minP = Math.min(...it.variants.map((v) => v.price));
          const maxP = Math.max(...it.variants.map((v) => v.price));
          return (
            <Link
              key={it.id}
              href={`/${tenantId}/item/${it.id}`}
              className="bg-white rounded-[10px] border overflow-hidden block"
              style={{ borderColor: "var(--color-rule)" }}
            >
              <GarmentVector itemId={it.id} accent="currentColor" size={120} className="w-full h-auto block" />
              <div className="px-2.5 pt-2 pb-2.5">
                <div className="font-serif text-[13px] font-medium leading-[1.2] line-clamp-2 min-h-8" style={{ color: "var(--color-ink)" }}>
                  {it.name}
                </div>
                <div className="mt-1.5 text-[12px] font-semibold tnum" style={{ color: "var(--color-ink)" }}>
                  ${minP}
                  {minP !== maxP && (
                    <span className="font-normal" style={{ color: "var(--color-ink-dim)" }}> – ${maxP}</span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
```

Note: the existing grid in `page.tsx:127` passes `accent={tenant.accent}` to `GarmentVector`. We need to preserve that. The `accent` prop is in `CatalogGridProps`; restore the binding:

Replace this line in the file you just created:

```tsx
              <GarmentVector itemId={it.id} accent="currentColor" size={120} className="w-full h-auto block" />
```

With:

```tsx
              <GarmentVector itemId={it.id} accent={accent} size={120} className="w-full h-auto block" />
```

And update the function signature to destructure `accent`:

```tsx
export function CatalogGrid({ items, activeCat, tenantId, accent }: CatalogGridProps) {
```

- [ ] **Step 2: Modify `page.tsx` to render `<CatalogGrid>` in place of the moved blocks**

Open `apps/web/src/app/[tenant]/page.tsx`.

**Add import** at the top of the imports block (after the existing `BottomNav` import on line 11):

```tsx
import { CatalogGrid } from "./catalog-grid";
```

**Delete line 45** (the chip-filtered local variable — the client will do this now):

```tsx
  const items = catalog.filter((i) => i.cat === activeCat);
```

**Delete lines 77-86** (the static search div block, including its `{/* Search */}` comment):

```tsx
      {/* Search */}
      <div className="px-4 pt-3.5 pb-1.5 flex-shrink-0">
        <div
          className="h-10 rounded-lg bg-white flex items-center px-3 gap-2 border"
          style={{ borderColor: "var(--color-rule)" }}
        >
          <span style={{ color: "var(--color-ink-dim)" }}><SearchIcon size={16} /></span>
          <span className="text-[13px]" style={{ color: "var(--color-ink-dim)" }}>Search uniforms</span>
        </div>
      </div>
```

**Delete lines 110-113** (the result-count `<h3>` wrapper block):

```tsx
      <div className="px-4 pt-3 pb-2 flex-shrink-0 flex items-baseline gap-2">
        <h3 className="font-serif text-[18px] font-medium m-0">{activeCat} Uniform</h3>
        <span className="text-[11px]" style={{ color: "var(--color-ink-dim)" }}>· {items.length} items</span>
      </div>
```

**Delete lines 115-142** (the grid block, including its `{/* Grid */}` comment).

**Insert** `<CatalogGrid ... />` where the deleted search block used to be (immediately after the closing `</div>` of the tenant-themed header strip, before the `{/* Category chips */}` comment):

```tsx
      <CatalogGrid
        items={catalog}
        activeCat={activeCat}
        tenantId={tenant.id}
        accent={tenant.accent}
      />
```

Wait — the chips region currently sits between the search and the grid. After the move, the structure inside `<MobileShell>` should be:

```
<MobileShell>
  <div /* tenant-themed header strip */>...</div>
  <CatalogGrid /* renders: search wrapper, count line, grid, empty state */ />
  <div /* Category chips */>...</div>
  <BottomNav />
</MobileShell>
```

But that places chips BELOW the grid, which is wrong. The original order is: header, search, chips, h3, grid. To preserve that order with CatalogGrid owning {search, h3, grid}, we have to either:
- (a) Keep chips inside CatalogGrid (but the spec says chips stay server-rendered)
- (b) Split CatalogGrid into two pieces (search wrapper above chips; count+grid below) — adds complexity
- (c) Place CatalogGrid AFTER the chips, and have CatalogGrid render only the count line + grid + empty state; keep the search wrapper in `page.tsx` as a server-rendered fragment that uses a separate small client component just for the input

The simplest is **(d) keep the original visual order by re-ordering CatalogGrid's responsibility**: chips render between the search and the h3, so split CatalogGrid into two adjacent fragments around the chips. That contradicts the "single Fragment" design.

Resolution: **make the chips part of `CatalogGrid`'s render**, but keep them as plain server-style `<Link>` elements (Next's `Link` works inside client components — it just renders an `<a>` for `<Link>` with no special server requirement). The "chips remain server-rendered" line in the spec is about URL navigation semantics, not about which component renders them. Confirm by re-reading the spec — §Architecture says "chips (still server-rendered `<Link>` elements driven by `?cat=`)". A `<Link>` inside a client component still behaves identically: it's a client-routed navigation that updates `?cat=` in the URL, and the RSC re-renders on the next request. No semantic loss.

**Updated plan for Task 2 Step 2:** also move the chips block (lines 89-108) into `catalog-grid.tsx`, and delete it from `page.tsx`. Update `catalog-grid.tsx` to render chips between the search wrapper and the result-count line.

Add this `CATEGORIES` import to `catalog-grid.tsx`:

```tsx
import { CATEGORIES } from "@/lib/data";
```

And insert this block in `catalog-grid.tsx` between the search wrapper and the result-count line:

```tsx
      {/* Category chips */}
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

In `page.tsx`, also delete the chips block (lines 88-108) and the unused `CATEGORIES` import on line 3 if no other usage remains in `page.tsx` (verify with a grep of the file before deleting the import).

Also remove the now-unused `SearchIcon` import from `page.tsx`'s import on line 9.

After deletions, the body of `page.tsx`'s `return` should look like:

```tsx
  return (
    <MobileShell bg="var(--color-paper)">
      {/* Tenant-themed header strip */}
      <div className="text-white px-4 pt-1 pb-3.5 flex-shrink-0" style={{ background: tenant.accent }}>
        {/* ... unchanged header content ... */}
      </div>

      <CatalogGrid
        items={catalog}
        activeCat={activeCat}
        tenantId={tenant.id}
        accent={tenant.accent}
      />

      <BottomNav active="shop" shopHref={`/${tenant.id}`} accent={tenant.accent} />
    </MobileShell>
  );
```

- [ ] **Step 3: Verify the page still type-checks**

Run from repo root: `pnpm check-types:web`

Expected: passes. If you see an "unused import" error, remove the offending line from `page.tsx`.

- [ ] **Step 4: Visual smoke (mandatory — no behavior should have changed)**

Run: `pnpm dev:web`

Open `http://localhost:3000/nsbh` in a browser. Verify:
- The header strip looks identical to before (Crest, school name, cart badge).
- A static-looking search pill is below the header (still not interactive — that's Task 3).
- Category chips render below the search pill in the same order ("Summer", "Winter", etc.).
- Clicking a chip navigates to `?cat=Summer` and the chip highlight follows the URL.
- The result-count line ("{activeCat} Uniform · N items") shows the correct N for the active chip.
- The 2-column grid renders all items in the active chip with garment SVGs, name, and price range.
- The bottom nav shows.

If anything differs from the pre-task state, stop and investigate. This task is a pure refactor — any visible change is a regression.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/[tenant]/catalog-grid.tsx apps/web/src/app/[tenant]/page.tsx
git commit -m "refactor([tenant]/page): extract CatalogGrid client component

Pure move of search wrapper, chips, result-count line, and grid into a
new \"use client\" component. No behavior change — wires up to the same
chip-filtered visible array as before. Sets up Task 3 (real search input)
and Task 4 (filter logic) without touching layout or styling."
```

---

## Task 3: Replace the static search `<div>` with a real `<input>` + clear button

Now we wire up the interactive search input and the clear button. The filter logic stays simple in this task — same chip-scoped behavior as Task 2 regardless of what's typed. Task 4 adds the real filter.

**Files:**
- Modify: `apps/web/src/app/[tenant]/catalog-grid.tsx`

- [ ] **Step 1: Add React state and the `ClearIcon` import**

At the top of `catalog-grid.tsx`, after the existing imports, add:

```tsx
import { useState } from "react";
import { SearchIcon, ClearIcon } from "@/components/icons";
```

Remove the duplicate `SearchIcon` import (replace the existing single-import line). After this step the icon import line should read:

```tsx
import { SearchIcon, ClearIcon } from "@/components/icons";
```

Inside the function body, add at the top:

```tsx
export function CatalogGrid({ items, activeCat, tenantId, accent }: CatalogGridProps) {
  const [q, setQ] = useState("");
  const visible = items.filter((i) => i.cat === activeCat);
  // ... rest unchanged for now
```

- [ ] **Step 2: Replace the static search-pill block with an interactive one**

In `catalog-grid.tsx`, find the search wrapper block:

```tsx
      {/* Search (still static in this task; wired up in Task 3) */}
      <div className="px-4 pt-3.5 pb-1.5 flex-shrink-0">
        <div
          className="h-10 rounded-lg bg-white flex items-center px-3 gap-2 border"
          style={{ borderColor: "var(--color-rule)" }}
        >
          <span style={{ color: "var(--color-ink-dim)" }}><SearchIcon size={16} /></span>
          <span className="text-[13px]" style={{ color: "var(--color-ink-dim)" }}>Search uniforms</span>
        </div>
      </div>
```

Replace with:

```tsx
      {/* Search */}
      <div className="px-4 pt-3.5 pb-1.5 flex-shrink-0">
        <div
          className="h-10 rounded-lg bg-white flex items-center px-3 gap-2 border focus-within:ring-2 focus-within:ring-offset-1 focus-within:ring-[var(--color-ink)]"
          style={{ borderColor: "var(--color-rule)" }}
        >
          <span style={{ color: "var(--color-ink-dim)" }} aria-hidden="true">
            <SearchIcon size={16} />
          </span>
          <input
            type="text"
            inputMode="search"
            enterKeyHint="search"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Search uniforms"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search uniforms"
            className="flex-1 bg-transparent outline-none text-[13px] focus-visible:outline-none placeholder:text-[color:var(--color-ink-dim)]"
          />
          {q.length > 0 && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Clear search"
              className="w-6 h-6 flex items-center justify-center rounded-full"
              style={{ color: "var(--color-ink-dim)" }}
            >
              <ClearIcon size={14} />
            </button>
          )}
        </div>
      </div>
```

Key choices encoded here:
- `type="text"` not `type="search"` — avoids WebKit's native × clear button collision with our custom one.
- `inputMode="search"` + `enterKeyHint="search"` triggers the mobile "Search" return key.
- `placeholder:text-[color:var(--color-ink-dim)]` mirrors the original placeholder color.
- `focus-within:ring-*` is on the wrapper pill so the visible 40px container lights up on focus; the input's own focus outline is suppressed so we don't get two rings.
- Clear button is a real `<button type="button">` with `aria-label`.

- [ ] **Step 3: Type check**

Run: `pnpm check-types:web`

Expected: passes.

- [ ] **Step 4: Manual smoke**

Run `pnpm dev:web` (skip if already running) and visit `/nsbh`. Verify:
- The search pill now accepts focus on click/tap. Focus ring appears around the pill.
- Typing into the input updates the visible text (state is wired). The × button appears as soon as you type a character.
- Clicking the × button clears the input and hides itself.
- The filter behavior is **unchanged** — the grid still shows whatever the active chip dictates regardless of what you type (Task 4 fixes this).
- On a mobile device (or DevTools mobile emulator with a touch keyboard), confirm the on-screen keyboard shows "Search" on its return key (this verifies `inputMode="search"` + `enterKeyHint="search"`).
- No browser-native × clear icon appears inside the input (verifies `type="text"` choice).
- Keyboard navigation: Tab into the input, type, Tab to the × button (when present), Enter on × clears.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/[tenant]/catalog-grid.tsx
git commit -m "feat(catalog): wire up real search input with clear button

Replaces the static search-shaped <div> with a working <input> + custom
× clear button. Uses type=text + inputMode=search to avoid WebKit's
native clear-button collision. Focus ring on the wrapper pill via
focus-within:. Filter logic still chip-scoped — Task 4 adds the real
filter behavior."
```

---

## Task 4: Add the real filter logic + dynamic result-count line + empty state

Now the search actually filters. Cross-category when q is non-empty; chip-scoped when q is empty. Result-count line updates to reflect mode. Empty state renders when no matches.

**Files:**
- Modify: `apps/web/src/app/[tenant]/catalog-grid.tsx`

- [ ] **Step 1: Add the match function and update the `visible` computation**

In `catalog-grid.tsx`, replace the line:

```tsx
  const visible = items.filter((i) => i.cat === activeCat);
```

with:

```tsx
  const query = q.trim().toLowerCase();
  const visible = query
    ? items.filter((it) => (it.name + " " + it.cat).toLowerCase().includes(query))
    : items.filter((i) => i.cat === activeCat);
```

Encoded behavior:
- Empty/whitespace query → chip-scoped (current behavior).
- Non-empty query → spans all categories, matches against `name + " " + category` case-insensitively.

- [ ] **Step 2: Update the result-count line to reflect search mode**

In `catalog-grid.tsx`, find the result-count block:

```tsx
      {/* Result-count line */}
      <div className="px-4 pt-3 pb-2 flex-shrink-0 flex items-baseline gap-2">
        <h3 className="font-serif text-[18px] font-medium m-0">{activeCat} Uniform</h3>
        <span className="text-[11px]" style={{ color: "var(--color-ink-dim)" }}>· {visible.length} items</span>
      </div>
```

Replace with:

```tsx
      {/* Result-count line */}
      <div className="px-4 pt-3 pb-2 flex-shrink-0 flex items-baseline gap-2">
        <h3 className="font-serif text-[18px] font-medium m-0">
          {query ? `Results for "${q.trim()}"` : `${activeCat} Uniform`}
        </h3>
        <span className="text-[11px]" style={{ color: "var(--color-ink-dim)" }}>
          · {visible.length} {visible.length === 1 ? "item" : "items"}
          {query ? " in all categories" : ""}
        </span>
      </div>
```

Pluralisation tweak (`item` vs `items`) included while we're here — small polish, no separate task warranted.

- [ ] **Step 3: Add the empty-state branch**

In `catalog-grid.tsx`, find the grid block:

```tsx
      {/* Grid */}
      <div className="flex-1 px-4 pb-3 grid grid-cols-2 gap-3 content-start">
        {visible.map((it) => {
          // ...
        })}
      </div>
```

Wrap the grid in an empty-state ternary. Replace the whole block above with:

```tsx
      {/* Grid or empty state */}
      {visible.length === 0 && query ? (
        <div className="flex-1 px-4 pb-3 flex flex-col items-start gap-3 pt-2">
          <p className="text-[13px] m-0" style={{ color: "var(--color-ink)" }}>
            No items match &ldquo;{q.trim()}&rdquo;.
          </p>
          <button
            type="button"
            onClick={() => setQ("")}
            className="text-[13px] underline font-semibold"
            style={{ color: "var(--color-ink)" }}
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="flex-1 px-4 pb-3 grid grid-cols-2 gap-3 content-start">
          {visible.map((it) => {
            const minP = Math.min(...it.variants.map((v) => v.price));
            const maxP = Math.max(...it.variants.map((v) => v.price));
            return (
              <Link
                key={it.id}
                href={`/${tenantId}/item/${it.id}`}
                className="bg-white rounded-[10px] border overflow-hidden block"
                style={{ borderColor: "var(--color-rule)" }}
              >
                <GarmentVector itemId={it.id} accent={accent} size={120} className="w-full h-auto block" />
                <div className="px-2.5 pt-2 pb-2.5">
                  <div className="font-serif text-[13px] font-medium leading-[1.2] line-clamp-2 min-h-8" style={{ color: "var(--color-ink)" }}>
                    {it.name}
                  </div>
                  <div className="mt-1.5 text-[12px] font-semibold tnum" style={{ color: "var(--color-ink)" }}>
                    ${minP}
                    {minP !== maxP && (
                      <span className="font-normal" style={{ color: "var(--color-ink-dim)" }}> – ${maxP}</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
```

The empty state only shows when there's an active query AND no results. An empty active-chip slice (which shouldn't happen given current data, but in principle could) still renders the empty grid container — that matches today's behavior.

- [ ] **Step 4: Type check**

Run: `pnpm check-types:web`

Expected: passes.

- [ ] **Step 5: Manual smoke**

Run `pnpm dev:web` and visit `/nsbh`. Verify:

1. **No query, default chip:** Title reads `Winter Uniform · N items`. Grid shows all Winter items.
2. **No query, change chip to Summer:** Title reads `Summer Uniform · N items`. Grid shows all Summer items.
3. **Type "blazer" while Summer chip is active:** Title switches to `Results for "blazer" · 1 item in all categories` (or similar — depends on the catalog). The grid shows the Blazer even though it's a Winter item. Cross-category behavior is verified.
4. **Type partial name** (e.g. "shir"): live filter, multiple matches across categories.
5. **Type a category name** (e.g. "winter"): matches all Winter items by category text.
6. **Type "xyz" (no matches):** empty state renders with the "No items match 'xyz'." copy and a "Clear search" button.
7. **Click "Clear search" in the empty state:** Query clears, grid returns to chip-scoped view.
8. **Click × button while typing:** Same — clears query.
9. **Singular pluralisation:** type something matching exactly 1 item; verify "· 1 item" (not "items").
10. **Quotes in copy:** title shows curly quotes around the query (the `&ldquo;` / `&rdquo;` entities render as `"..."`).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/[tenant]/catalog-grid.tsx
git commit -m "feat(catalog): real search filter + empty state

Search filters by name + category (case-insensitive substring) across
ALL categories when a query is present; chips drive the grid only when
the query is empty. Result-count line switches copy to indicate
cross-category mode. Empty state renders an inline 'No items match'
message with a Clear search button when no results."
```

---

## Task 5: Accessibility — debounced screen-reader live region

The filter is sync; the announcement is debounced ~300ms so screen readers don't get a stream of mid-word counts.

**Files:**
- Modify: `apps/web/src/app/[tenant]/catalog-grid.tsx`

- [ ] **Step 1: Add `useEffect` import and announcement state**

In `catalog-grid.tsx`, update the React import:

```tsx
import { useEffect, useState } from "react";
```

Inside `CatalogGrid`, after the existing `useState` line, add:

```tsx
  const [announced, setAnnounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      setAnnounced(query === "" ? "" : `${visible.length} results for ${q.trim()}`);
    }, 300);
    return () => clearTimeout(t);
  }, [q, query, visible.length]);
```

- [ ] **Step 2: Add the live region to the JSX**

In `catalog-grid.tsx`, find the search wrapper's outer div (the one with `px-4 pt-3.5 pb-1.5 flex-shrink-0`). Immediately AFTER the closing `</div>` of the inner pill (the wrapper with `h-10 rounded-lg ...`), but still INSIDE the outer wrapper, add:

```tsx
          <span role="status" aria-live="polite" className="sr-only">
            {announced}
          </span>
```

So the search wrapper now looks like:

```tsx
      {/* Search */}
      <div className="px-4 pt-3.5 pb-1.5 flex-shrink-0">
        <div
          className="h-10 rounded-lg bg-white flex items-center px-3 gap-2 border focus-within:ring-2 focus-within:ring-offset-1 focus-within:ring-[var(--color-ink)]"
          style={{ borderColor: "var(--color-rule)" }}
        >
          {/* ... unchanged input, icons, clear button ... */}
        </div>
        <span role="status" aria-live="polite" className="sr-only">
          {announced}
        </span>
      </div>
```

Note: `sr-only` is a Tailwind utility provided by the default v4 install. If `pnpm check-types:web` flags it as missing or the smoke test shows the text rendering visibly, verify the project's globals — search for `sr-only` in `apps/web/src/index.css` or its Tailwind config. (If absent, add the standard equivalent: `className="absolute w-px h-px p-0 m-[-1px] overflow-hidden whitespace-nowrap border-0"`.)

- [ ] **Step 3: Type check**

Run: `pnpm check-types:web`

Expected: passes.

- [ ] **Step 4: Manual smoke**

1. Inspect the DOM in browser DevTools after typing. Confirm the `<span role="status" aria-live="polite">` exists and its text content updates ~300ms after the last keystroke (not on every keystroke).
2. Confirm the span is not visible (off-screen via `sr-only`).
3. Optional: enable VoiceOver (Cmd+F5 on macOS), focus the input, type quickly. Verify the announcement comes once at the end of typing, not on every key.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/[tenant]/catalog-grid.tsx
git commit -m "feat(catalog): a11y — debounced live-region for result count

Screen readers get a single announcement ~300ms after typing settles,
not on every keystroke. Filter itself remains synchronous — only the
aria-live announcement is debounced. sr-only span hidden from sighted
users."
```

---

## Task 6: Final verification pass

This is a checkpoint task — no new code, just structured verification of all spec requirements before merging.

- [ ] **Step 1: Type-check the whole monorepo**

Run: `pnpm check-types`

Expected: passes across all packages.

- [ ] **Step 2: Build the production bundle**

Run: `pnpm build:web`

Expected: build succeeds without errors. Watch for any "use client" / serialization warnings about `CatalogGrid` props.

- [ ] **Step 3: Walk the spec's §Verification checklist explicitly**

Run `pnpm dev:web` and confirm each of the following from the spec at `docs/superpowers/specs/2026-05-12-catalog-search-design.md`:

- [ ] Type "blazer" with each chip active → cross-category result every time.
- [ ] Type partial item name → live filter.
- [ ] Click × → clears, returns to chip view.
- [ ] Type "xyz" → empty state with the "Clear search" button.
- [ ] Keyboard-only: Tab to input, type, Tab to × button, Enter clears, Tab to first card.
- [ ] Mobile keyboard (iOS Safari or Android Chrome via real device): "Search" return key visible.
- [ ] Only one × visible at all times (no WebKit-native one collides with our custom button).
- [ ] Focus-within ring on the search pill is visible and meets WCAG visible-focus criterion (clear 2px ring with offset).
- [ ] Print stylesheet (§3.7): print the orders board pick-slips and confirm the search input does not appear in the printed output. (It shouldn't — it's not in the pick-slip DOM, but verify.)
- [ ] §3.9 viewport audit: visually re-walk the parent shop catalog page on iPhone SE viewport (375×667) and confirm no new tap-target P1s. The 24×24 × button has 8px of vertical padding from the parent's `pt-3.5 pb-1.5`, giving an effective ≥40px hit-target.
- [ ] Screen reader smoke (VoiceOver on iOS or NVDA on Windows): announcement fires ~300ms after typing settles, not on every keystroke.

- [ ] **Step 4: Optional — open a PR**

If working off a feature branch, push and open a PR. Otherwise the work is on `main` and ready.

```bash
git log --oneline -6
```

Expected output (most recent commits, top to bottom):

```
<hash> feat(catalog): a11y — debounced live-region for result count
<hash> feat(catalog): real search filter + empty state
<hash> feat(catalog): wire up real search input with clear button
<hash> refactor([tenant]/page): extract CatalogGrid client component
<hash> feat(icons): add ClearIcon for catalog search clear button
<hash> docs(spec): catalog-search — review fixes (7 defects + 3 simplifications)
```

If the order is correct and all type-checks/builds pass, the implementation is done.

---

## Spec Coverage Map

| Spec section | Implemented in |
|---|---|
| §Decision — client-side substring | Task 4 Step 1 |
| §Architecture — file split | Task 2 |
| §Architecture — Fragment, no wrapping div | Task 2 Step 1 (`<>...</>`) |
| §Component contract — single `items` prop | Task 2 Step 1 |
| §Match function | Task 4 Step 1 |
| §Chip interaction (cross-category when q≠"") | Task 4 Step 1 |
| §Result-count line | Task 4 Step 2 |
| §Empty state (single button) | Task 4 Step 3 |
| §Input markup & mobile hygiene | Task 3 Step 2 |
| §`type="text"` not `type="search"` | Task 3 Step 2 |
| §Focus-within ring on wrapper | Task 3 Step 2 |
| §A11y — aria-label, aria-hidden, button label | Task 3 Step 2 |
| §A11y — debounced live region | Task 5 |
| §`ClearIcon` icon | Task 1 |
| §Verification | Task 6 |
