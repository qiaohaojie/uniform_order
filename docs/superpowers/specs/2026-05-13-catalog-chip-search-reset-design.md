# Spec: Catalog chip + search interaction fix (§Issue #27)

**Date:** 2026-05-13
**Status:** Approved

## Problem

When a parent has an active search query in `CatalogGrid`, the category chips remain fully visible and highlighted via the URL-driven `activeCat` prop. Clicking a chip only updates `?cat=` but does not clear the local `q` state — so the grid keeps showing cross-category search results while the chip appears "selected". The visual disconnect misleads parents into thinking the chip filter is composing with the search.

## Solution — Option C

Two simultaneous changes to `apps/web/src/app/[tenant]/catalog-grid.tsx`:

### 1. Dim chips during active search

Wrap the chip strip container with `opacity-50` when `q.length > 0`. This gives parents a visual cue that chips are in a "reset search" mode before they click.

```
q.length > 0 → chip row: opacity-50
q.length === 0 → chip row: opacity-100 (default)
```

No change to individual chip active/inactive styling — the dimming is a uniform layer over the row.

### 2. Chips reset search on click

Convert chip elements from `<Link>` to `<button>`. On click, each button:
1. Calls `setQ("")` — clears local search state
2. Calls `router.push(`/${tenantId}?cat=${c}`, { scroll: false })` — navigates to that category

`useRouter` is imported from `next/navigation` (already used elsewhere in the project).

After the click: `q` is empty, `activeCat` reflects the selected chip, chips return to full opacity, grid shows the chip-scoped category. The UX signal is: clicking a dimmed chip means "exit search and browse this category".

## Scope

- **File changed:** `apps/web/src/app/[tenant]/catalog-grid.tsx` only
- **New state:** none
- **New props:** none
- **Routing:** no changes — `activeCat` remains URL-driven as before

## What doesn't change

- The `×` clear button in the search input retains its existing `clearSearch` behaviour (clears query, keeps current category).
- The empty-state "Clear search" button is unchanged.
- The result-count line logic (`"Results for X"` vs `"${activeCat} Uniform"`) is unchanged.
- Chip active styling (accent fill when `c === activeCat`) is unchanged.

## Acceptance criteria

1. When `q.length > 0`, the chip row is visually dimmed (opacity ~50%).
2. Clicking any chip while a query is active clears the query and navigates to that category.
3. After clicking a chip, the grid immediately shows only items in the clicked category (no stale search results).
4. When `q` is empty, chips behave identically to before this change (full opacity, correct active highlight).
5. `pnpm check-types:web` passes.
