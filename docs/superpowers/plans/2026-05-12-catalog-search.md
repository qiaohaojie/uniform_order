# Catalog Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the fake search-shaped `<div>` at `app/[tenant]/page.tsx:78-86` into a working client-side filter that searches by name + category, with cross-category behavior, accessible empty state, and a debounced screen-reader announcement.

**Architecture:** A single new `"use client"` component (`catalog-grid.tsx`) absorbs the search input, result-count line, grid, and empty state. The RSC `page.tsx` keeps the header/chips/bottom-nav and passes the **full** tenant catalog plus the URL-resolved `activeCat` to the client. The client computes `visible = q ? items.filter(matchFn) : items.filter(byChip)`. Chips remain server-rendered `<Link>` elements driven by `?cat=`.

**Tech Stack:** Next.js 16 App Router (RSC + client islands), Tailwind v4, TypeScript, no test framework — `pnpm check-types:web` is the correctness gate plus manual browser smoke.

**Spec:** `docs/superpowers/specs/2026-05-12-catalog-search-design.md`

**No test suite available** — this project has no Vitest/Jest/Playwright unit tests. Verification gates per task are (1) `pnpm check-types:web` passes and (2) explicit manual browser checks. Treat each manual check as a non-skippable verification step.

**Out-of-scope quirks you'll see while working** (do not fix in this plan):
- The cart-icon badge in the header renders a hardcoded `6` at `page.tsx:70`. It's stub UI awaiting cart-count wiring; not in scope for this work. Leave it alone.

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

This task moves the search div, the result-count h3, **and the chips block** out of `page.tsx` and into a new client component **without** changing any rendered output. The static `<div>` search bar stays static in this task. Filter behavior is identical to today. We verify visually that nothing has changed before adding interactivity in Task 3.

> **⚠️ Spec deviation — flagged for visibility:** The spec §Architecture says "page.tsx keeps the header strip, **chips**, and bottom-nav." This plan moves the chips into `CatalogGrid` instead. **Reason:** the chips render *between* the search wrapper and the result-count line in the existing layout. To keep `CatalogGrid` a single Fragment (per §Architecture's other requirement), all three regions must be sibling flex children inside the same component — splitting into two CatalogGrid pieces around the chips would create two client islands for no semantic gain. Chips remain navigation `<Link>` elements driven by `?cat=` — their URL-driven semantics are unchanged whether they render in an RSC or a client component. No behavioural loss; spec is only deviated on *which file* the chips live in.

**Files:**
- Create: `apps/web/src/app/[tenant]/catalog-grid.tsx`
- Modify: `apps/web/src/app/[tenant]/page.tsx` (lines 45, 78-86, 88-108, 110-113, 115-142, and unused imports)

- [ ] **Step 1: Create the new client component file**

Create `apps/web/src/app/[tenant]/catalog-grid.tsx` with the final-correct code (no later patches required):

```tsx
"use client";

import Link from "next/link";
import type { CatalogItem } from "@/lib/data";
import { CATEGORIES } from "@/lib/data";
import { GarmentVector } from "@/components/garment";
import { SearchIcon } from "@/components/icons";

type CatalogGridProps = {
  items: CatalogItem[];   // full tenant catalog (NOT chip-filtered)
  activeCat: string;
  tenantId: string;
  accent: string;
};

export function CatalogGrid({ items, activeCat, tenantId, accent }: CatalogGridProps) {
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
    </>
  );
}
```

- [ ] **Step 2: Modify `page.tsx` to render `<CatalogGrid>` in place of the moved blocks**

Open `apps/web/src/app/[tenant]/page.tsx`. The chips block (lines 88-108) moves into `CatalogGrid` per the deviation note at the top of this task — `catalog-grid.tsx` already includes it in Step 1's code block.

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

**Delete lines 88-108** (the entire chips block, including its `{/* Category chips */}` comment).

**Delete lines 110-113** (the result-count `<h3>` wrapper block):

```tsx
      <div className="px-4 pt-3 pb-2 flex-shrink-0 flex items-baseline gap-2">
        <h3 className="font-serif text-[18px] font-medium m-0">{activeCat} Uniform</h3>
        <span className="text-[11px]" style={{ color: "var(--color-ink-dim)" }}>· {items.length} items</span>
      </div>
```

**Delete lines 115-142** (the grid block, including its `{/* Grid */}` comment).

**Insert** `<CatalogGrid ... />` where the deleted search block used to be (immediately after the closing `</div>` of the tenant-themed header strip):

```tsx
      <CatalogGrid
        items={catalog}
        activeCat={activeCat}
        tenantId={tenant.id}
        accent={tenant.accent}
      />
```

**Clean up unused imports** at the top of `page.tsx`:
- Remove `SearchIcon` from the `@/components/icons` import line (still used? — verify with `grep -n "SearchIcon" apps/web/src/app/[tenant]/page.tsx`; if no remaining usage, drop it).
- Remove `CATEGORIES` from the `@/lib/data` import on line 3 if no remaining usage (same `grep` check).

After deletions, the body of `page.tsx`'s `return` should look like:

```tsx
  return (
    <MobileShell bg="var(--color-paper)">
      {/* Tenant-themed header strip */}
      <div className="text-white px-4 pt-1 pb-3.5 flex-shrink-0" style={{ background: tenant.accent }}>
        {/* ... unchanged header content (Crest, school name, kid line, cart badge) ... */}
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

- [ ] **Step 1: Add React state, the input ref, and the `ClearIcon` import**

At the top of `catalog-grid.tsx`, replace the existing icon import line with:

```tsx
import { SearchIcon, ClearIcon } from "@/components/icons";
```

And add the React hooks import (place it as the first import in the file, above the others, conventional order):

```tsx
import { useRef, useState } from "react";
```

> **Note on hook imports across tasks:** Task 5 will add `useEffect` to this same import line. When Task 5 runs, the line should end up as `import { useEffect, useRef, useState } from "react";`. Doing it as a single combined import line each task avoids duplicate-import errors.

Inside the function body, add at the top:

```tsx
export function CatalogGrid({ items, activeCat, tenantId, accent }: CatalogGridProps) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const clearSearch = () => {
    setQ("");
    inputRef.current?.focus();
  };
  const visible = items.filter((i) => i.cat === activeCat);
  // ... rest unchanged for now
```

The `clearSearch` helper centralises focus restoration so both the × button (this task) and the empty-state Clear button (Task 4) reuse it. After clearing, the × button unmounts; if it had focus, the focus would be orphaned to `<body>` and keyboard users would lose their place. `inputRef.current?.focus()` returns focus to the input, where the user can keep typing.

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
            ref={inputRef}
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
              onClick={clearSearch}
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
- After clicking ×, focus returns to the input (caret visible, focus-within ring stays on). Verify with keyboard: Tab to ×, press Enter, then immediately type a character — it should land in the input without an extra Tab.
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
            onClick={clearSearch}
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
7. **Click "Clear search" in the empty state:** Query clears, grid returns to chip-scoped view, **focus returns to the search input** (verify by immediately typing — should land in the input without an extra Tab).
8. **Click × button while typing:** Same — clears query, focus returns to the input.
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

- [ ] **Step 1: Add `useEffect` to the React import and announcement state**

In `catalog-grid.tsx`, update the React import — combine `useEffect` into the existing line (do **not** add a second import line). After this step the line should read exactly:

```tsx
import { useEffect, useRef, useState } from "react";
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

Note: `sr-only` ships with Tailwind v4 by default (this project uses Tailwind v4 per CLAUDE.md), so it should work out of the box. Only if the smoke test in Step 4 shows the text rendering visibly should you fall back to the literal equivalent: `className="absolute w-px h-px p-0 m-[-1px] overflow-hidden whitespace-nowrap border-0"`.

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
