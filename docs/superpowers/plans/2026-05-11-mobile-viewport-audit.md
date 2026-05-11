# Mobile viewport audit — implementation plan (Phase A: audit only)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended for this plan — Playwright session + background dev server + reused order id must persist across all tasks, which fights subagent-per-task isolation). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a findings document for §3.9 — walk the parent-purchase critical path at three target viewports, identify ship-blocking breakage by the spec's four-rule filter, and open an audit-only PR for George to review before any fixes are written.

**Architecture:** Drive a headed Chromium via the `playwright-cli` skill against a local `pnpm dev:web`. Seed one Stripe-test-paid order via the parent flow on the first viewport, reuse its order id for the placed-screen captures across the other two viewports. Save 18 PNGs + 18 DOM snapshots, then write `findings.md` applying the spec's four-rule critical-breakage filter. No source code is modified in this phase.

**Tech Stack:** Playwright CLI (via skill), Chromium, Next.js 16 dev server, Stripe test mode (for placed-screen seed), Bash + jq for DOM snapshot post-processing.

**Spec:** `docs/superpowers/specs/2026-05-11-mobile-viewport-audit.md`.

**Correctness gate:** This phase changes no source code. The gate is artefact presence: 18 PNGs + a `findings.md` with a populated observations bucket and a (possibly empty) findings table. `pnpm check-types:web` is run once after the worktree is set up to confirm baseline cleanliness, and once at PR time to confirm no incidental damage.

**Out of scope for this plan:** Writing or applying any fixes, the re-capture / diff phase, or any code change in `apps/web/src/`. Those belong to the Phase B plan, which will be drafted only after George approves this audit's findings.

---

## File map (Phase A)

This phase creates only documentation + image artefacts. No `apps/web/` files are touched.

- **Create directory:** `docs/superpowers/audits/2026-05-11-mobile/baseline/` — 18 PNGs.
- **Create directory:** `docs/superpowers/audits/2026-05-11-mobile/dom/` — 18 DOM-snapshot JSON files (for the Bash post-processing in Task 4).
- **Create:** `docs/superpowers/audits/2026-05-11-mobile/findings.md` — the audit document.
- **Modify:** `docs/remaining_work.md` — §3.9 entry collapses to a pointer at the audit document.

---

## Task 1: Set up the audit worktree + verify baseline

**Files:**
- New worktree at `.claude/worktrees/mobile-viewport-audit` on branch `worktree-mobile-viewport-audit` (created by the tooling, not committed).

- [ ] **Step 1: Create the worktree**

Use the `superpowers:using-git-worktrees` skill from the same controller running this plan. The native `EnterWorktree` tool will create `.claude/worktrees/mobile-viewport-audit` on a new branch. After this step, your working directory is the worktree root.

- [ ] **Step 2: Seed the Next.js codegen files**

Next.js 16 generates `apps/web/next-env.d.ts` and `apps/web/.next/dev/types/routes.d.ts` on first `next dev` run. New worktrees don't have these yet. Copy them from the primary worktree:

```bash
cp /Volumes/T7/georgeqiao/dev/uniform_order/apps/web/next-env.d.ts apps/web/next-env.d.ts
mkdir -p apps/web/.next/dev/types
cp /Volumes/T7/georgeqiao/dev/uniform_order/apps/web/.next/dev/types/routes.d.ts apps/web/.next/dev/types/routes.d.ts
```

- [ ] **Step 3: Install deps**

```bash
pnpm install --frozen-lockfile
```

Expected: completes in <60s, "Done" footer.

- [ ] **Step 4: Verify baseline typecheck**

```bash
pnpm check-types:web
```

Expected: exit 0, no errors. If this fails, stop and report — something is wrong with the seed step.

- [ ] **Step 5: Create the audit directories**

```bash
mkdir -p docs/superpowers/audits/2026-05-11-mobile/baseline
mkdir -p docs/superpowers/audits/2026-05-11-mobile/dom
```

No commit yet — directories without files don't track in git.

---

## Task 2: Start the dev server + seed one test-paid order

**Files:**
- No commits yet. This task prepares runtime state for Task 3.

The placed-screen capture needs a real paid order in the dev DB. We seed one once and reuse its id across all three viewports' placed-screen captures.

- [ ] **Step 1: Start the dev server in the background**

```bash
pnpm dev:web
```

Run in the background. Wait for the line `▲ Next.js 16.x.x  - ready started server on …localhost:3000` before proceeding. If you have a `run_in_background` Bash option, use it.

- [ ] **Step 2: Confirm the dev server is reachable**

```bash
curl -sf -o /dev/null http://localhost:3000 && echo OK || echo FAIL
```

Expected: `OK`. If `FAIL`, wait 5 seconds and retry up to 6 times. If still failing, stop and report.

- [ ] **Step 3: Walk the parent flow once at iPhone SE viewport to create a paid order**

Use the `playwright-cli` skill. Open Chromium at viewport 375 × 667. Steps in order, taking one screenshot per step into `docs/superpowers/audits/2026-05-11-mobile/baseline/`:

1. `goto http://localhost:3000` → screenshot `home-iphone-se.png`.
2. Click the "Northbridge School" card (tenant slug `nsbh`).
3. On `/nsbh` → screenshot `catalog-iphone-se.png`.
4. Click the first product card.
5. On `/nsbh/item/<id>` → screenshot `item-iphone-se.png`.
6. Pick a size, click "Add to cart" (or equivalent CTA).
7. Navigate to `/nsbh/cart` → screenshot `cart-iphone-se.png`.
8. Click "Checkout".
9. On `/nsbh/checkout` → screenshot `checkout-iphone-se.png`.
10. Fill the form with `parentName=Audit Parent`, `parentEmail=audit@example.com`, `parentMobile=0400000000`, `studentName=Audit Kid`, `studentYear=Year 5`, `studentRoll=AUD01`, `delivery=pickup`, accept the policy checkbox.
11. Complete the Stripe Payment Element with test card `4242 4242 4242 4242`, any future expiry (e.g. `12/34`), any CVC (`123`), any zip (`2000`). Wait for the redirect.
12. On `/nsbh/order/placed?orderId=…` → record the order id from the URL into a shell variable `AUDIT_ORDER_ID` (or just remember it). Screenshot `placed-iphone-se.png`.

If Stripe test keys are NOT configured locally (the dev server logs an error during payment), fall back: query the dev DB for any existing paid order id (`psql $DATABASE_URL -c "select id from orders where status='new' or status='packing' or status='ready' limit 1;"`) and use that. The placed screen accepts the id via the URL.

- [ ] **Step 4: Sanity-check the placed-screen capture**

Open `docs/superpowers/audits/2026-05-11-mobile/baseline/placed-iphone-se.png`. Confirm it shows: order id, "thank you" message, student name, items, total. If it shows an error or empty state, stop and report — the seed didn't work.

---

## Task 3: Capture the remaining 12 baseline screenshots

**Files:**
- Append-only writes to `docs/superpowers/audits/2026-05-11-mobile/baseline/` (12 PNGs) and `…/dom/` (18 JSON, one per capture, retroactively including Task 2's iPhone SE set).

The iPhone SE captures (6) were taken in Task 2 Step 3. Now capture the same six screens at the other two viewports. For each viewport, replay the navigation without re-paying — use the stored order id for the placed screen.

- [ ] **Step 1: Android landscape captures (740 × 360)**

Set viewport to 740 × 360. For each route below, navigate and screenshot:

| Route | Filename |
|---|---|
| `http://localhost:3000` | `home-android-landscape.png` |
| `http://localhost:3000/nsbh` | `catalog-android-landscape.png` |
| `http://localhost:3000/nsbh/item/<same-id-as-task-2>` | `item-android-landscape.png` |
| `http://localhost:3000/nsbh/cart` (the localStorage cart from Task 2 may have been cleared by the new browser context — re-add one item by clicking add-to-cart on the item page first) | `cart-android-landscape.png` |
| `http://localhost:3000/nsbh/checkout` | `checkout-android-landscape.png` |
| `http://localhost:3000/nsbh/order/placed?orderId=<AUDIT_ORDER_ID>` | `placed-android-landscape.png` |

- [ ] **Step 2: iPad split-view (wide) captures (507 × 820)**

Set viewport to 507 × 820. Repeat the six routes from Step 1, suffix `-ipad-split` instead:

| Route | Filename |
|---|---|
| `http://localhost:3000` | `home-ipad-split.png` |
| `http://localhost:3000/nsbh` | `catalog-ipad-split.png` |
| `http://localhost:3000/nsbh/item/<id>` | `item-ipad-split.png` |
| `http://localhost:3000/nsbh/cart` (re-add one item if needed) | `cart-ipad-split.png` |
| `http://localhost:3000/nsbh/checkout` | `checkout-ipad-split.png` |
| `http://localhost:3000/nsbh/order/placed?orderId=<AUDIT_ORDER_ID>` | `placed-ipad-split.png` |

- [ ] **Step 3: DOM snapshots for the four-rule filter**

For each of the 18 captures, also write a DOM snapshot JSON next to the screenshot. The shape:

```json
{
  "screen": "checkout",
  "viewport": "iphone-se",
  "viewportPx": [375, 667],
  "documentScrollWidth": <number>,
  "documentScrollHeight": <number>,
  "viewportWidth": <number>,
  "interactiveElements": [
    { "selector": "button.primary", "rectPx": [x, y, w, h], "visible": true, "clipped": false }
  ]
}
```

Capture via Playwright's `page.evaluate(...)`:

```js
({
  documentScrollWidth: document.documentElement.scrollWidth,
  documentScrollHeight: document.documentElement.scrollHeight,
  viewportWidth: window.innerWidth,
  interactiveElements: Array.from(document.querySelectorAll(
    'button, a, input, select, textarea, [role=button], [role=link]'
  )).map(el => {
    const r = el.getBoundingClientRect();
    const inViewport = r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
    return {
      selector: el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + (el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).slice(0,3).join('.')}` : ''),
      rectPx: [r.left, r.top, r.width, r.height],
      visible: inViewport,
      smallestDim: Math.min(r.width, r.height)
    };
  })
})
```

Write each result to `docs/superpowers/audits/2026-05-11-mobile/dom/<screen>-<viewport>.json`.

- [ ] **Step 4: Sanity-check captures**

```bash
ls docs/superpowers/audits/2026-05-11-mobile/baseline/ | wc -l
ls docs/superpowers/audits/2026-05-11-mobile/dom/ | wc -l
```

Both should print `18`. If either is short, identify the missing pair and re-capture before continuing.

---

## Task 4: Apply the four-rule filter, write the findings document

**Files:**
- Create: `docs/superpowers/audits/2026-05-11-mobile/findings.md`

- [ ] **Step 1: Programmatic horizontal-scroll check**

For each DOM snapshot, flag the capture if `documentScrollWidth > viewportWidth + 1` (the +1 absorbs sub-pixel rounding). This is rule #1 from the spec.

```bash
for f in docs/superpowers/audits/2026-05-11-mobile/dom/*.json; do
  jq -r 'if (.documentScrollWidth > .viewportWidth + 1) then "[H-SCROLL] \(.screen) @ \(.viewport): scrollWidth=\(.documentScrollWidth) viewportWidth=\(.viewportWidth)" else empty end' "$f"
done
```

Capture the output. Each line is a candidate P0 finding under rule #1.

- [ ] **Step 2: Programmatic small-tap-target check**

For each DOM snapshot, flag any visible interactive element with `smallestDim < 24` (px). Rule #2 threshold per the spec ("critical only" — not the 44 px WCAG ideal).

```bash
for f in docs/superpowers/audits/2026-05-11-mobile/dom/*.json; do
  jq -r --arg name "$(basename "$f" .json)" '
    .interactiveElements
    | map(select(.visible == true and .smallestDim < 24))
    | map("[TAP<24] \($name): \(.selector) — \(.smallestDim)px")
    | .[]
  ' "$f"
done
```

Capture the output. Each line is a candidate P0 finding under rule #2.

- [ ] **Step 3: Manual visual review for rules #3 and #4**

For each of the 18 baseline PNGs, open it and judge:
- **Rule #3 — content unreachable.** Is there a modal, drawer, or block whose primary action sits outside the viewport, with no scroll inside that block?
- **Rule #4 — layout collapse.** Has a multi-column layout collapsed to zero columns where it shouldn't? Is body text below ~11 px? Does a card visibly overflow its parent?

Record each judgment as either a finding or an observation (out-of-scope items go to the observations bucket).

- [ ] **Step 4: Write the findings document**

Create `docs/superpowers/audits/2026-05-11-mobile/findings.md` with this exact skeleton — populate the rows from Steps 1-3:

```markdown
# Mobile viewport audit — findings (2026-05-11)

**Spec:** `docs/superpowers/specs/2026-05-11-mobile-viewport-audit.md`
**Plan (Phase A):** `docs/superpowers/plans/2026-05-11-mobile-viewport-audit.md`
**Captured:** 2026-05-11
**Baseline screenshots:** `docs/superpowers/audits/2026-05-11-mobile/baseline/`
**DOM snapshots:** `docs/superpowers/audits/2026-05-11-mobile/dom/`

## Findings (ship-blocking under the spec's four-rule filter)

| # | Severity | Screen | Viewport | Symptom | Root-cause hypothesis | Proposed fix (specific component + change) |
|---|---|---|---|---|---|---|
| <fill from Steps 1-3, one row per finding. If none, leave the table headers and write `_No findings._` directly below._> |

## Observations (out of scope per the spec; recorded for future polish)

- <one bullet per noted-but-not-fixed item: cramped spacing, tap targets 24-44 px, fonts that feel too large, etc.>

## How to read this

- **P0** = visibly broken on screen (clear layout failure, missing content, horizontal scroll).
- **P1** = functionally broken but not visually obvious (e.g., button is < 24 px and untappable, or a control is clipped behind another).
- Both P0 and P1 are ship-blocking under the spec's "critical only" definition.
- Anything outside the four-rule filter is in **Observations**, not **Findings**.
```

Be specific in "Proposed fix" — name the file and either the className, attribute, or rule change. Example: `apps/web/src/app/[tenant]/page.tsx: change catalog grid from grid-cols-2 to grid-cols-1 at < 380px via a max-[379px]:grid-cols-1 utility`.

If Steps 1-3 produce no rule-matching findings, the table renders as `_No findings._` — that itself is a valid PR-able audit outcome.

---

## Task 5: Stop the dev server + update remaining_work.md

**Files:**
- Modify: `docs/remaining_work.md` (the §3.9 entry).

- [ ] **Step 1: Stop the dev server**

Kill the background `pnpm dev:web` process. (If you launched via `run_in_background`, terminate that task.)

- [ ] **Step 2: Update remaining_work.md §3.9**

Replace the current §3.9 block in `docs/remaining_work.md`:

```
### 3.9 Mobile shell viewport edge cases

`MobileShell` caps at 430px. Verify behaviour on iPhone SE (375px), Android landscape, and iPad split-view.
```

with:

```
### 3.9 Mobile shell viewport edge cases — audit complete; fixes pending

Audit done 2026-05-11. See `docs/superpowers/audits/2026-05-11-mobile/findings.md` for the findings + observations. Fix phase (Phase B plan) is drafted only after the findings are approved.
```

---

## Task 6: Commit and open the audit PR

**Files:**
- All of `docs/superpowers/audits/2026-05-11-mobile/` (18 PNGs + 18 JSON + findings.md).
- `docs/superpowers/plans/2026-05-11-mobile-viewport-audit.md` (this plan).
- `docs/superpowers/specs/2026-05-11-mobile-viewport-audit.md` (already committed on main; included if it's on the worktree base).
- `docs/remaining_work.md` updated entry.

- [ ] **Step 1: Re-run the typecheck gate**

```bash
pnpm check-types:web
```

Expected: clean. (We touched no `apps/web/` files, so this should pass trivially. If it fails, something unrelated regressed — stop and report.)

- [ ] **Step 2: Stage and commit**

```bash
git add docs/superpowers/audits/2026-05-11-mobile/ docs/remaining_work.md
git commit -m "$(cat <<'EOF'
docs: §3.9 mobile viewport audit — baselines + findings

Phase A of the §3.9 audit:
- 18 baseline screenshots (3 viewports × 6 parent-flow screens).
- 18 DOM snapshots driving the horizontal-scroll + small-tap-target
  rules from the spec.
- findings.md with the populated table (or "_No findings._") + the
  observations bucket.

No source code changes. The fix phase (Phase B plan) is drafted only
after George reviews and approves findings.md.
EOF
)"
```

- [ ] **Step 3: Push the branch**

```bash
git push -u origin worktree-mobile-viewport-audit
```

- [ ] **Step 4: Open the PR**

```bash
gh pr create --base main --title "audit(mobile): §3.9 viewport edge-cases — baselines + findings" --body "$(cat <<'EOF'
## Summary

Phase A of the §3.9 mobile-viewport audit (spec: `docs/superpowers/specs/2026-05-11-mobile-viewport-audit.md`). No source code changes — this PR only adds the baseline artefacts + findings document.

- 18 baseline screenshots at iPhone SE (375×667), Android landscape (740×360), iPad split-view (507×820) for the six parent-purchase critical-path screens (home → catalog → item → cart → checkout → placed).
- 18 DOM snapshots used by the rule-#1 (horizontal scroll) and rule-#2 (tap target < 24 px) programmatic checks from the spec.
- `findings.md` with the populated table (or `_No findings._`) and the observations bucket.

Stripe test mode was used to seed one paid order on iPhone SE; the same order id was reused for the placed-screen captures at the other two viewports.

## Review checklist for George

- [ ] Scan `docs/superpowers/audits/2026-05-11-mobile/findings.md`.
- [ ] Spot-check 3–4 screenshots in `baseline/` that the captures look right (no broken images, no auth-redirected anonymous-user screens, placed screen has real order data).
- [ ] Approve the findings → Phase B plan is drafted next.
- [ ] Reject / amend findings → I revise this PR.

## What is NOT in this PR

- Any source code change in `apps/web/`.
- Any fix for items in the findings table — those are Phase B.
- Re-capture / before-after diffs — those are Phase B.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Report the PR URL**

Print the PR URL returned by `gh pr create`. End of Phase A.

---

## Self-review checklist (run after Task 6)

- [ ] Spec coverage:
  - Spec viewports → Tasks 2-3 cover all three exactly.
  - Spec screens → Tasks 2-3 cover all six exactly.
  - Spec "critical breakage" four rules → Task 4 Steps 1-3 cover rules #1 (programmatic), #2 (programmatic), #3 (manual), #4 (manual).
  - Spec acceptance criteria #1 (18 baselines stored) → Task 3 + Task 6.
  - Spec acceptance criteria #2 (findings doc exists with observations + findings table) → Task 4 Step 4.
  - Spec acceptance criteria #3-#5 (fixes, types clean after fixes, PR description) — explicitly Phase B; not in this plan.
- [ ] Confirm `pnpm check-types:web` is run twice (Task 1 Step 4 + Task 6 Step 1).
- [ ] Confirm no step references `"paid"` order status (we use the real `new` / `packing` / `ready` enum values when querying the dev DB).
- [ ] Confirm the dev server is started in Task 2 and stopped in Task 5 — i.e., there is no orphaned background process at PR time.

If any item fails, fix the relevant task inline.
