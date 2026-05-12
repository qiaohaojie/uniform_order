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

The competitor's Shopify site has a real search, though its relevance is broken (`q=blazer` returns 0 hits for a "Navy Jacket"). We can ship better behavior in a single client component (~80 lines including a11y plumbing — see §Files touched).

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

- **`page.tsx` (RSC, mostly unchanged):** keeps the header strip, chips (still server-rendered `<Link>` elements driven by `?cat=`), and bottom-nav. Stops rendering the search `<div>`, the result-count `<h3>`, and the grid directly; renders a new `<CatalogGrid>` client component in their place.
- **`catalog-grid.tsx` (new, `"use client"`):** owns the search input, filter state, result-count line, the grid itself, and the empty state. **Returns a React Fragment, not a wrapping `<div>`** — MobileShell is a flex-column and each region (search wrapper, h3 wrapper, grid) needs to remain a sibling flex child to preserve its own `flex-shrink-0` / `flex-1` behavior.

### Component contract

```ts
// app/[tenant]/catalog-grid.tsx
type CatalogGridProps = {
  items: CatalogItem[];   // full tenant catalog (NOT chip-filtered)
  activeCat: string;      // for chip-scoped no-search view + count label
  tenantId: string;
  accent: string;
};
```

The client component does both filters: chip-scope when query is empty, cross-category when query is non-empty. Chip navigation stays server-driven (the `<Link href="?cat=...">` chips in `page.tsx` are untouched), so the URL remains the source of truth for `activeCat`.

### Data flow

```
page.tsx (RSC)
  ├─ fetches tenant + catalog (full)
  ├─ resolves activeCat from ?cat=
  └─ <CatalogGrid items={catalog} activeCat={activeCat} ... />

CatalogGrid (client)
  ├─ const [q, setQ] = useState("")
  ├─ const visible = q.trim()
  │     ? items.filter(matchFn(q))                  // search → all categories
  │     : items.filter(i => i.cat === activeCat)    // no search → chip-scoped
  └─ renders <> input · count line · grid · empty state </>
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
[Clear search]
```

`Clear search` resets `q` to `""`, returning the user to the chip-scoped view (whichever chip is currently active). One button only — a second "Browse all" CTA would be misleading because `DEFAULT_CATEGORY = "Winter"` means there's no "no chip active" state to land on. Plain text + one text button. No illustration. Matches the rest of the bespoke Tailwind tone.

## Input markup & mobile hygiene

```tsx
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
    className="flex-1 bg-transparent outline-none text-[13px] focus-visible:outline-none"
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
- `type="text"` + `inputMode="search"` + `enterKeyHint="search"` triggers the right mobile keyboard with a "Search" return key. **We deliberately use `type="text"`, not `type="search"`**, because WebKit/Chromium add a browser-native × clear button on `type="search"` that would collide with our custom × button. `inputMode="search"` alone gives the correct mobile keyboard without the native UI.
- `autoCorrect`/`autoCapitalize`/`spellCheck` off — proper-noun item names ("Stewart House Polo") shouldn't get autocorrected.
- Focus ring: the input's own `:focus-visible` is suppressed (`focus-visible:outline-none` on the input); the **wrapper** `<div>` gets a `focus-within:` ring instead, so the visible 40px pill lights up when the input is focused. Use a fixed neutral colour (`focus-within:ring-2 focus-within:ring-offset-1 focus-within:ring-[var(--color-ink)]`) — not the tenant accent. Inline `style={}` cannot target pseudo-classes like `:focus-visible`, and the existing chips don't use accent-coloured focus rings either, so consistency holds.
- `ClearIcon` is a new 14px × icon added to `components/icons.tsx` (confirmed absent — see §Files touched).
- Clear button is a real `<button type="button">` — 24×24 visual hit, padded to 44×44 effective via parent's vertical padding. Matches §3.9 P1 floor.

## Accessibility

- `aria-label="Search uniforms"` on the input (placeholder is decorative; aria-label is canonical).
- `aria-hidden="true"` on the leading `SearchIcon` (decorative, label is on the input).
- `aria-label="Clear search"` on the × button.
- Live region announces result count when typing settles. The filter itself runs synchronously on every keystroke (no debounce — §Why-not), but the announcement is debounced ~300ms via a separate `useEffect` so screen readers don't get a stream of mid-word counts ("1 result for b… 1 result for bl… 0 results for blu…"). Implementation sketch:

```tsx
const [announced, setAnnounced] = useState("");
useEffect(() => {
  const t = setTimeout(() => {
    setAnnounced(q.trim() === "" ? "" : `${visible.length} results for ${q}`);
  }, 300);
  return () => clearTimeout(t);
}, [q, visible.length]);

// ...
<span role="status" aria-live="polite" className="sr-only">{announced}</span>
```

- Focus ring: see §Input markup — the wrapper pill gets a `focus-within:` ring on a neutral colour. Tenant accent is not used for focus rings (consistency with chips).
- Empty state is inline text + button inside the grid container — keyboard and screen readers see it without needing toast announcement.

## Why not...

- **...debouncing the filter?** Unnecessary at 50 items; the work is microseconds. Adding a debounce adds perceived lag.
- **...persisting query in `?q=`?** No real user demand for shareable search URLs at a single school of 9 SKUs. Cost (RSC re-fetch per keystroke OR `useRouter().replace` on every change) outweighs benefit.
- **...fuse.js for fuzzy matching?** Premature. Substring covers "blazer", "jumper" (if named "Jumper"), "polo", "shirt". If PostHog later shows misses on "trousers" → "Pants", add a synonym map then.
- **...mark/highlight matched substring in results?** Visual noise at this scale; the grid is already small enough that matches are scannable.

## Files touched

| File | Change |
|---|---|
| `apps/web/src/app/[tenant]/page.tsx` | Stop rendering the static search `<div>` (lines 78-86), the result-count `<h3>` (lines 110-113), and the grid (lines 116-142). Stop computing the chip-filtered `items` variable (line 45); pass the full `catalog` array instead. Render `<CatalogGrid items={catalog} activeCat={activeCat} tenantId={tenant.id} accent={tenant.accent} />` in their place. Header strip, chips, and bottom-nav stay on the server. |
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
  - WebKit native × suppression: confirm only one × shows (our custom button), not a native browser one.
- **Type check:** `pnpm check-types:web` passes.
- **Print stylesheet (§3.7):** unaffected — input is not in the pick-slip DOM.
- **§3.9 viewport audit:** re-run on catalog page, confirm zero new tap-target P1s and that the focus-within ring on the search pill meets the visible-focus criterion.
- **Screen reader smoke:** VoiceOver on iOS announces the input on focus; live region announces the result count ~300ms after typing settles (not on every keystroke).

## Risks

- **Empty-state copy is a marketing surface.** "No items match 'xyz'" is fine in v1 but worth A/B-testing later — Shopify's Horizon empty state is silent, ours can win here.
- **Cross-category-when-searching behavior may surprise** a parent who expects chip + search to compose. Mitigated by the explicit `"in all categories"` suffix on the result-count line. If user testing shows confusion, swap to chip-scoped search — it's a one-line change (drop the ternary branch in `visible`).
- **Page payload grows from chip-slice to full catalog.** At ~9-50 items per tenant, the additional JSON is ~5-10KB total. Acceptable; would revisit if a tenant's catalog grew past ~200 SKUs (well beyond realistic uniform shop scale).

## Open questions

None blocking. The three substantive behavior calls (substring matching, cross-category-when-searching, no URL persistence) are decided above with rationales.

## Out of scope (deferred follow-ups)

- PostHog `catalog_search` event with `query`, `resultCount`, `tenantId` properties.
- Synonym map for common parent terminology mismatches.
- Recent-searches dropdown.
- Search-result substring highlight.
