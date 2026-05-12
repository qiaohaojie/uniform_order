# Catalog Search — Design

**Date:** 2026-05-12
**Author:** George (with Claude)
**Scope:** Parent shop, `apps/web/src/app/[tenant]/page.tsx` lines 78-86
**Linked gap:** `my_doc/NSBH/gap-analysis.md` — credibility-bug flag, "the catalog search bar is a `<div>` with no input"

## Problem

The parent-shop catalog page renders a search-shaped UI element at `app/[tenant]/page.tsx:78-86`:

```tsx
<div className="h-10 rounded-lg bg-white flex items-center px-3 gap-2 border" ...>
  <span><SearchIcon size={16} /></span>
  <span>Search uniforms</span>
</div>
```

It is a static `<div>`. No `<input>`, no handler, no state. Parents see a search affordance, tap it, and nothing happens. This is a credibility bug — the kind that signals "incomplete software" on first impression.

The competitor's Shopify site has a real search, though its relevance is broken (`q=blazer` returns 0 hits for a "Navy Jacket"). We can ship better behavior in ~30 lines.

## Goals

1. Convert the fake `<div>` into a working search input that filters the catalog grid.
2. Match the existing visual treatment (40px white pill, `var(--color-rule)` border, `SearchIcon` leading) so no design change is required.
3. Mobile-first hygiene: instant filter, proper keyboard, clear button, accessible label, live result-count announcement.
4. Ship behind no flag — straight to main.

## Non-goals

- Fuzzy matching, synonym maps, typo tolerance.
- Server-side `?q=` route or URL persistence.
- Search-result highlighting (mark matched substring).
- Keyboard shortcuts (e.g. `/` to focus).
- Analytics event for queries (defer until we want intent data).
- Changing the chip filter behavior.

## Decision: client-side substring filter

For 9-50 items of school uniforms — the realistic per-tenant ceiling — client-side filtering is the clear winner over a server-side `?q=` route:

| Aspect | Client-side filter | Server-side `?q=` |
|---|---|---|
| Latency per keystroke | <1ms | 50-200ms round-trip even on good wifi |
| Code surface | ~30 lines, one `useState` + `.filter()` | URL state + RSC re-fetch + debouncing |
| Bookmarkable | No (acceptable — parents don't share searches) | Yes |
| Data fetch | Already happens — RSC ships all items as props | Same fetch, round-tripped per keystroke |
| Mobile UX | Filters as you type | Janky without careful debouncing |

The page is already an RSC that passes the full filtered `items` array to the rendered grid. Adding a client wrapper around the search+grid region is the smallest viable change.

## Architecture

### File split

- **`page.tsx` (RSC, mostly unchanged):** keeps the header strip, chips, and bottom-nav. Stops rendering the search `<div>` and the grid `<div>` directly; renders a new `<CatalogGrid>` client component in their place.
- **`catalog-grid.tsx` (new, `"use client"`):** owns the search input, filter state, result-count line, the grid itself, and the empty state.

### Component contract

```ts
// app/[tenant]/catalog-grid.tsx
type CatalogGridProps = {
  items: CatalogItem[];     // chip-filtered (server-resolved by activeCat)
  allItems: CatalogItem[];  // full tenant catalog, for cross-category search
  activeCat: string;        // for "{activeCat} Uniform · N items"
  tenantId: string;
  accent: string;
};
```

Server passes both `items` and `allItems`. At 9-50 items per tenant the duplicate payload is <5KB JSON — trivial.

### Data flow

```
page.tsx (RSC)
  ├─ fetches tenant + catalog
  ├─ resolves activeCat from ?cat=
  ├─ items     = catalog.filter(i => i.cat === activeCat)
  ├─ allItems  = catalog
  └─ <CatalogGrid items={items} allItems={allItems} activeCat={activeCat} ... />

CatalogGrid (client)
  ├─ const [q, setQ] = useState("")
  ├─ const visible = q.trim()
  │     ? allItems.filter(matchFn(q))
  │     : items
  └─ renders <input>, count line, grid, empty state
```

## Behavior

### Match function

```ts
function matchFn(q: string) {
  const needle = q.trim().toLowerCase();
  return (it: CatalogItem) =>
    (it.name + " " + it.cat).toLowerCase().includes(needle);
}
```

Case-insensitive substring on `name + " " + category`. So:

- `"blazer"` → matches "Navy Blazer" (name).
- `"winter"` → matches all Winter items (category).
- `"summer shirt"` → matches "Summer Shirt - Short Sleeve" but NOT "Winter Shirt" (substring on the concatenation).

### Chip interaction

- **Empty query:** chips drive the grid (zero-JS server-rendered behavior).
- **Non-empty query:** search spans **all categories** — the chip is visually still highlighted but ignored. Result-count line switches to indicate cross-category mode.
- Rationale: chips are for browsing; search is for finding. If a parent types "blazer" while the "Summer" chip is active, returning zero results is hostile.

### Result-count line

Replaces the existing `<h3>{activeCat} Uniform</h3>` at lines 110-113:

- Empty query: `{activeCat} Uniform · {N} items` (unchanged from today)
- Non-empty query: `Results for "{q}" · {N} items in all categories`

### Empty state

When `q !== ""` and `visible.length === 0`, render in place of the grid:

```
No items match "{q}".
[Clear search] · [Browse all]
```

- `Clear search` → resets `q` to `""`, keeps the active chip.
- `Browse all` → resets `q` to `""` AND navigates to `/[tenant]` (drops `?cat=` so the default chip "Winter" takes over).

Plain text + two text buttons. No illustration. Matches the rest of the bespoke Tailwind tone.

## Input markup & mobile hygiene

```tsx
<div
  className="h-10 rounded-lg bg-white flex items-center px-3 gap-2 border"
  style={{ borderColor: "var(--color-rule)" }}
>
  <span style={{ color: "var(--color-ink-dim)" }} aria-hidden="true">
    <SearchIcon size={16} />
  </span>
  <input
    type="search"
    inputMode="search"
    enterKeyHint="search"
    autoCorrect="off"
    autoCapitalize="off"
    spellCheck={false}
    placeholder="Search uniforms"
    value={q}
    onChange={(e) => setQ(e.target.value)}
    aria-label="Search uniforms"
    className="flex-1 bg-transparent outline-none text-[13px]"
  />
  {q.length > 0 && (
    <button
      type="button"
      onClick={() => setQ("")}
      aria-label="Clear search"
      className="w-6 h-6 flex items-center justify-center rounded-full"
    >
      <ClearIcon size={14} />
    </button>
  )}
</div>
```

- Visual shell is identical to today's `<div>` (preserves §3.9 viewport-audit baseline).
- `type="search"` + `inputMode="search"` + `enterKeyHint="search"` triggers the right mobile keyboard with a "Search" return key.
- `autoCorrect`/`autoCapitalize`/`spellCheck` off — proper-noun item names ("Stewart House Polo") shouldn't get autocorrected.
- `ClearIcon` is a new 14px × icon in `components/icons.tsx` (or reuse if it exists — check during implementation).
- Clear button is a real `<button type="button">` — 24×24 visual hit, padded to 44×44 effective via parent's vertical padding. Matches §3.9 P1 floor.

## Accessibility

- `aria-label="Search uniforms"` on the input (placeholder is decorative; aria-label is canonical).
- `aria-hidden="true"` on the leading `SearchIcon` (decorative, label is on the input).
- `aria-label="Clear search"` on the × button.
- Live region announces result count when `q` changes:

```tsx
<span role="status" aria-live="polite" className="sr-only">
  {q.trim() === "" ? "" : `${visible.length} results for ${q}`}
</span>
```

- Focus ring on the input uses `:focus-visible` with `outlineColor: accent` (tenant-themed, matches existing pattern).
- Empty state is inline text + buttons inside the grid container — keyboard and screen readers see it without needing toast announcement.

## Why not...

- **...debouncing the filter?** Unnecessary at 50 items; the work is microseconds. Adding a debounce adds perceived lag.
- **...persisting query in `?q=`?** No real user demand for shareable search URLs at a single school of 9 SKUs. Cost (RSC re-fetch per keystroke OR `useRouter().replace` on every change) outweighs benefit.
- **...fuse.js for fuzzy matching?** Premature. Substring covers "blazer", "jumper" (if named "Jumper"), "polo", "shirt". If PostHog later shows misses on "trousers" → "Pants", add a synonym map then.
- **...mark/highlight matched substring in results?** Visual noise at this scale; the grid is already small enough that matches are scannable.

## Files touched

| File | Change |
|---|---|
| `apps/web/src/app/[tenant]/page.tsx` | Stop rendering the static search `<div>` (lines 78-86), the result-count `<h3>` (lines 110-113), and the grid (lines 116-142). Render `<CatalogGrid items={items} allItems={catalog} activeCat={activeCat} tenantId={tenant.id} accent={tenant.accent} />` in their place. Header strip, chips, and bottom-nav stay on the server. |
| `apps/web/src/app/[tenant]/catalog-grid.tsx` | **New.** `"use client"`. Owns input state, filter, result-count line, grid, empty state, live-region announcement. |
| `apps/web/src/components/icons.tsx` | Add `ClearIcon` (×). Confirmed absent from current exports (Shop/Orders/Kids/Profile/Cart/Back/Check/Plus/Pickup/Ship/ChevronRight/Lock/Search). |

Estimated diff: ~80 lines added, ~30 lines moved out of `page.tsx`.

## Verification

- **Manual smoke:**
  - Type "blazer" with each chip active → cross-category result.
  - Type partial item name → live filter.
  - Click × → clears, returns to chip view.
  - Type "xyz" → empty state with both action buttons.
  - Keyboard-only: Tab to input, type, Tab to clear, Tab to first card.
  - Mobile keyboard: confirm "Search" return key on iOS Safari and Android Chrome.
- **Type check:** `pnpm check-types:web` passes.
- **Print stylesheet (§3.7):** unaffected — input is not in the pick-slip DOM.
- **§3.9 viewport audit:** re-run on catalog page, confirm zero new tap-target P1s.
- **Screen reader smoke:** VoiceOver on iOS announces input, result-count live region updates on debounced typing.

## Risks

- **Empty-state copy is a marketing surface.** "No items match 'xyz'" is fine in v1 but worth A/B-testing later — Shopify's Horizon empty state is silent, ours can win here.
- **Cross-category-when-searching behavior may surprise** a parent who expects chip + search to compose. Mitigated by the explicit `"in all categories"` suffix on the result-count line. If user testing shows confusion, swap to chip-scoped search — it's a one-line change.
- **`allItems` doubles the page payload.** At 50 items × ~200 bytes JSON = 10KB total. Acceptable; would revisit if a tenant's catalog grew past ~200 SKUs (well beyond realistic uniform shop scale).

## Open questions

None blocking. The three substantive behavior calls (substring matching, cross-category-when-searching, no URL persistence) are decided above with rationales.

## Out of scope (deferred follow-ups)

- PostHog `catalog_search` event with `query`, `resultCount`, `tenantId` properties.
- Synonym map for common parent terminology mismatches.
- Recent-searches dropdown.
- Search-result substring highlight.
