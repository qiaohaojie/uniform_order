# Act 6 — Admin configuration

## Purpose
Show that the school operator owns their own configuration — branding, refund policy, catalog — without needing platform support.

## Persona
School operator — signed in as `operator@demo.uniformorder.online`.

## Starting URL
`/admin/demo-academy/settings`, then `/admin/demo-academy/catalog`.

## Seed prerequisite
- `tenantSettings` seeded with `workflowMode='standard'`.
- Refund policy v1 seeded; `currentLegalVersionId` set on tenant.
- Catalog with at least one polo + variants seeded.

## Step-by-step

| Step | Action | Narration | Expected screen |
|---|---|---|---|
| 1 | Open `/admin/demo-academy/settings` | "The operator owns their own catalog." | Settings page |
| 2 | Show workflow mode dropdown (don't change) | (silent) | Dropdown shows `standard` preselected |
| 3 | Click into refund policy editor | "Refund policy is versioned." | Editor shows v1 text |
| 4 | Show version history | "Every order stores the version the parent acknowledged at checkout. If the policy changes, old orders stay anchored to the version that was current when they paid." | Version list shows v1 |
| 5 | Navigate to `/admin/demo-academy/catalog` | "Drag to reorder, click to edit prices, paste in a size guide." | Catalog list |
| 6 | Drag a polo card to top of list | (silent — pace) | Card moves; `sortOrder` persists on save |
| 7 | Click into a variant → edit price → revert | (silent) | Price input editable |
| 8 | Open size guide tab on an item | "No tickets to us." | Size guide table |

## Timing
~3:00.

## Visual success criteria
- Workflow mode dropdown shows `standard` as the selected value.
- Refund policy editor renders the seeded `policyText` ("Refunds available within 14 days for unworn, unwashed items with tags…").
- Drag-reorder interaction is visible (card lifts, others shift).
- Variant price input accepts edits.

## Possible failure modes
- **Drag handle invisible / drag doesn't trigger** — browser zoom should be 100%; refresh the page; check `@dnd-kit` is loaded (DevTools network tab).
- **Workflow mode change rejected** — seed sets `standard`; if the dropdown shows a different value, re-seed.

## Re-record command
```bash
npx playwright test -c GTM/product_demo/playwright/demo-recording.config.ts --grep "Act 6"
```

## Cleanup
None per-act. Final teardown via `pnpm --filter web demo:cleanup:confirm`.
