# Mobile viewport fixes — implementation plan (Phase B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended — the re-capture step needs the same long-lived dev server + Playwright session that Phase A used, which fights subagent-per-task isolation). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the three rule-#2 (small tap target) fixes from Phase A's findings (F1 cart quantity steppers, F2 catalog-header cart icon, F3 item-header cart icon), re-capture the same 18 screenshots into an `after/` set, confirm the three rule-#2 selectors no longer appear, and push the fixes to PR #22 alongside the audit.

**Architecture:** Three tiny tap-target adjustments via Tailwind class edits. No DOM-shape changes, no new components, no functional behaviour change — only the rendered `getBoundingClientRect` height of each control grows from < 24 px to ≥ 28 px. Re-run the Phase A `capture.mjs` script to produce `after/` PNGs + DOM snapshots; the same rule-#2 jq check that surfaced F1/F2/F3 must return zero matches against them.

**Tech Stack:** Tailwind CSS v4 (no config changes), Playwright (already in workspace devDependencies from Phase A), Bash + jq for the rule-#2 re-check.

**Spec / source:** `docs/superpowers/audits/2026-05-11-mobile/findings.md`. The Phase B plan corrects one finding-table mislabel: F3 targets the **cart icon in the item-page topbar** (`a.w-9 flex justify-end relative` at `interactive.tsx:235`), not the back link (which is already correctly sized `w-9 h-9` at `interactive.tsx:221`).

**Correctness gate:** `pnpm check-types:web` clean + the re-run of the rule-#2 jq check produces zero matches against the three flagged selectors (`button.w-6.text-center`, `a.relative.text-white` on catalog, `a.w-9.flex` on item).

---

## File map (Phase B)

- **Modify:** `apps/web/src/app/[tenant]/cart/cart-screen.tsx` (F1 — `h-7` parent + `h-full w-7` on the two `<button>`s).
- **Modify:** `apps/web/src/app/[tenant]/page.tsx` (F2 — wrap the cart `<Link>` in `w-9 h-9 flex items-center justify-center`).
- **Modify:** `apps/web/src/app/[tenant]/item/[itemId]/interactive.tsx` (F3 — add `h-9 items-center` to the existing `w-9 flex justify-end`).
- **Create directory:** `docs/superpowers/audits/2026-05-11-mobile/after/` — 18 post-fix PNGs.
- **Modify:** `docs/superpowers/audits/2026-05-11-mobile/findings.md` — flip the three findings to "Fixed", add an "After" column / paragraph, correct the F3 element label.
- **Modify:** `docs/remaining_work.md` — §3.9 collapses to a one-line pointer at `completed.md`.
- **Modify:** `docs/completed.md` — add §4.24 entry for the §3.9 audit + fixes.
- **Modify:** `docs/superpowers/audits/2026-05-11-mobile/dom/` — overwritten in place with the post-fix DOM snapshots (the `after/` PNGs are new, but the DOM JSON files share the same path with the baselines since the capture script writes there; the re-capture re-writes them, so we'll **copy them to `after-dom/`** before re-running, see Task 5).

---

## Task 1: F1 — cart quantity steppers grow to 28 × 28 px

**Files:**
- Modify: `apps/web/src/app/[tenant]/cart/cart-screen.tsx:90-111`

The current stepper container is `h-[26px]` and contains two `<button class="w-6 text-center text-[13px]">…</button>` controls. The buttons have no explicit height, so their `getBoundingClientRect` reports the content height (≈ 19.5 px) — below the spec's 24 px critical threshold. Fix: bump the parent to `h-7` (28 px) and add `h-full w-7` to both buttons so each button's rendered tap surface is 28 × 28.

- [ ] **Step 1: Edit the parent container height**

In `apps/web/src/app/[tenant]/cart/cart-screen.tsx`, change line 90 from:

```tsx
                    className="flex items-center border rounded-md h-[26px]"
```

to:

```tsx
                    className="flex items-center border rounded-md h-7"
```

- [ ] **Step 2: Edit the decrease button**

In `apps/web/src/app/[tenant]/cart/cart-screen.tsx`, change line 96 from:

```tsx
                      className="w-6 text-center text-[13px]"
```

to:

```tsx
                      className="w-7 h-full text-center text-[13px]"
```

- [ ] **Step 3: Edit the increase button**

In `apps/web/src/app/[tenant]/cart/cart-screen.tsx`, change line 106 from:

```tsx
                      className="w-6 text-center text-[13px]"
```

to:

```tsx
                      className="w-7 h-full text-center text-[13px]"
```

- [ ] **Step 4: Type-check**

```bash
pnpm check-types:web
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/[tenant]/cart/cart-screen.tsx"
git commit -m "fix(cart): quantity steppers ≥ 28 px tap target (F1)

The qty +/- buttons rendered at 24 × 19.5 px on their smallest
dimension — below the 24 px critical threshold from §3.9. Bump the
stepper parent to h-7 (28 px) and give the buttons h-full w-7 so
their bounding rect is 28 × 28. No visual change to the glyph or
overall row spacing."
```

---

## Task 2: F2 — catalog header cart icon gets a 36 × 36 tap surface

**Files:**
- Modify: `apps/web/src/app/[tenant]/page.tsx:63`

The cart link in the catalog topbar wraps a 22 × 22 `<CartIcon />` and a badge with `className="relative text-white"`. With no explicit width or height, the link's `getBoundingClientRect` matches the icon at 22 × 22 — below the 24 px threshold. Fix: add `w-9 h-9 flex items-center justify-center` so the link itself is 36 × 36 while the icon and badge stay visually unchanged.

- [ ] **Step 1: Edit the link className**

In `apps/web/src/app/[tenant]/page.tsx`, change line 63 from:

```tsx
          <Link href={`/${tenant.id}/cart`} className="relative text-white" aria-label="Cart">
```

to:

```tsx
          <Link href={`/${tenant.id}/cart`} className="relative text-white w-9 h-9 flex items-center justify-center" aria-label="Cart">
```

- [ ] **Step 2: Type-check**

```bash
pnpm check-types:web
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/[tenant]/page.tsx"
git commit -m "fix(catalog): header cart link ≥ 36 × 36 tap target (F2)

The cart icon link in the tenant-shop topbar rendered at 22 × 22 px
(matching the icon glyph). Wrap it in w-9 h-9 flex items-center
justify-center so the link itself is 36 × 36, restoring a proper
tap target while leaving the icon's visual size unchanged."
```

---

## Task 3: F3 — item-page header cart icon grows to 36 × 36 (corrected from "back link")

**Files:**
- Modify: `apps/web/src/app/[tenant]/item/[itemId]/interactive.tsx:235`

The findings.md F3 row originally labelled this as the back link. Re-reading the source: the back link at `interactive.tsx:221` is already `w-9 h-9` and renders correctly. The actual element flagged by the DOM snapshot (`a.w-9.flex` selector, 36 × 22 rect) is the **cart icon link** in the same topbar — at `interactive.tsx:235`, currently `w-9 flex justify-end relative`. Without an explicit height, the link collapses to the 22 px icon height. Add `h-9 items-center` to give it the 36 × 36 tap surface.

- [ ] **Step 1: Edit the cart link className**

In `apps/web/src/app/[tenant]/item/[itemId]/interactive.tsx`, change line 235 from:

```tsx
        className="w-9 flex justify-end relative"
```

to:

```tsx
        className="w-9 h-9 flex items-center justify-end relative"
```

- [ ] **Step 2: Type-check**

```bash
pnpm check-types:web
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/[tenant]/item/[itemId]/interactive.tsx"
git commit -m "fix(item): header cart link ≥ 36 × 36 tap target (F3)

Phase A findings.md flagged a.w-9.flex with smallest dim 22 px. The
selector matched the cart icon in the item topbar (not the back
link, which is already w-9 h-9). Add h-9 items-center to the cart
link so its rendered rect is 36 × 36."
```

---

## Task 4: Stop any orphaned dev server + start a fresh one

**Files:**
- None — this is runtime state only.

The capture script needs `pnpm dev:web` running on port 3000. If Phase A's dev server is still attached, kill it first and start fresh so the three new class changes are picked up. The Next.js dev server hot-reloads CSS, but a hard restart is safer for a one-shot re-capture.

- [ ] **Step 1: Kill any existing Next.js dev server**

```bash
ps -ef | grep -E "next dev|next-server" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
sleep 1
ps -ef | grep -E "next dev|next-server" | grep -v grep | head -3 || echo stopped
```

Expected: `stopped` (or no output).

- [ ] **Step 2: Start the dev server in the background**

Start `pnpm dev:web` in the background (use `run_in_background: true` if your Bash tool supports it).

- [ ] **Step 3: Wait until ready**

```bash
for i in 1 2 3 4 5 6 7 8 9 10; do
  code=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:3000 || echo down)
  if [ "$code" = "200" ]; then echo "ready ($i s)"; break; fi
  sleep 3
done
```

Expected: `ready` within ~30 s. If it never returns 200, stop and report — check the background task output for an env-var error (Phase A worktree should still have `apps/web/.env.local` copied from the primary worktree; if it doesn't, copy it again with `cp /Volumes/T7/georgeqiao/dev/uniform_order/apps/web/.env.local apps/web/.env.local`).

---

## Task 5: Re-run the capture script into `after/` (preserving the baselines)

**Files:**
- Create directory: `docs/superpowers/audits/2026-05-11-mobile/after/`
- Read-modify: `docs/superpowers/audits/2026-05-11-mobile/capture.mjs` (one-line constant change to point at `after/`, then revert OR commit as part of capture step)
- Modify-in-place: `docs/superpowers/audits/2026-05-11-mobile/dom/*.json` (overwritten with post-fix snapshots — the originals are already in the git history from the Phase A commit, so the diff IS the comparison artefact)

The capture.mjs script writes PNGs to `baseline/` and DOM JSON to `dom/`. For Phase B's re-capture we want:
- New PNGs in a sibling `after/` directory (so we can diff against `baseline/` visually).
- New DOM JSON overwriting `dom/` (the git diff against `dom/` on the previous commit gives us the rule-#2 comparison without needing a second JSON tree).

The cleanest way is to pass the output dir as a CLI argument. Modify the script briefly, run it, then either revert or keep the new arg-handling.

- [ ] **Step 1: Create the after/ directory**

```bash
mkdir -p docs/superpowers/audits/2026-05-11-mobile/after
```

- [ ] **Step 2: Edit capture.mjs to accept a CLI arg for the PNG output dir**

In `docs/superpowers/audits/2026-05-11-mobile/capture.mjs`, change:

```js
const BASELINE = join(OUT_DIR, "baseline");
```

to:

```js
const BASELINE = join(OUT_DIR, process.argv[2] ?? "baseline");
```

This keeps the default behaviour intact (no arg → still writes to `baseline/`) and lets us pass `after` for Phase B. The DOM-snapshot directory stays at `dom/` — its post-fix contents are the comparison artefact.

- [ ] **Step 3: Re-run the capture, writing PNGs to `after/`**

```bash
node docs/superpowers/audits/2026-05-11-mobile/capture.mjs after 2>&1 | tail -25
```

Expected output ends with `✓ All 18 captures complete.` and lists each of the 18 captures. Verify:

```bash
ls docs/superpowers/audits/2026-05-11-mobile/after/ | wc -l
ls docs/superpowers/audits/2026-05-11-mobile/dom/ | wc -l
```

Both should print `18`.

---

## Task 6: Verify the three rule-#2 findings are gone

**Files:**
- None — read-only verification.

- [ ] **Step 1: Re-run the rule-#2 jq check**

```bash
echo "=== Rule #2 re-check on post-fix DOM snapshots ==="
for f in docs/superpowers/audits/2026-05-11-mobile/dom/*.json; do
  jq -r --arg name "$(basename "$f" .json)" '
    .interactiveElements
    | map(select(.visible == true and .smallestDim > 0 and .smallestDim < 24))
    | map("[TAP<24] \($name): \(.selector) — \(.smallestDim | tostring | .[:6])px")
    | .[]
  ' "$f"
done | sort -u
```

- [ ] **Step 2: Confirm the three flagged selectors are absent**

The three Phase A selectors that MUST NOT appear in the output:

1. `button.w-6.text-center` on any `cart-*` capture.
2. `a.relative.text-white` on any `catalog-*` capture.
3. `a.w-9.flex` on any `item-*` capture.

Any lines that DO appear with other selectors (e.g. wide text links at 20 px height — already classified as observations in Phase A) are acceptable — those are not the fixes we shipped.

If any of the three Phase A selectors is still listed, stop and report. Don't proceed.

- [ ] **Step 3: Re-run rule #1 to confirm no regression**

```bash
echo "=== Rule #1 re-check: horizontal scrollbar ==="
for f in docs/superpowers/audits/2026-05-11-mobile/dom/*.json; do
  jq -r 'if (.documentScrollWidth > .viewportWidth + 1) then "[H-SCROLL] \(.screen) @ \(.viewport): scrollWidth=\(.documentScrollWidth) viewportWidth=\(.viewportWidth)" else empty end' "$f"
done
```

Expected: zero output (no horizontal-scroll regression introduced by the fixes). If any line appears, stop and report — one of the size bumps caused an overflow.

---

## Task 7: Stop the dev server, update findings.md with "Fixed" status

**Files:**
- Modify: `docs/superpowers/audits/2026-05-11-mobile/findings.md`

- [ ] **Step 1: Stop the dev server**

```bash
ps -ef | grep -E "next dev|next-server" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
```

- [ ] **Step 2: Edit findings.md — flip the three findings to "Fixed"**

Add a new section just below the existing `## Findings` table (and before `## Observations`). Use this exact markdown:

```markdown
## Fixes shipped (Phase B)

All three Phase A findings are resolved. Post-fix captures live in `docs/superpowers/audits/2026-05-11-mobile/after/`; the rule-#2 jq check returns zero matches for the three flagged selectors. Rule #1 (horizontal scrollbar) is unchanged at zero matches.

| # | Fix commit | Element | Before (smallest dim) | After (smallest dim) | Class change |
|---|---|---|---|---|---|
| F1 | <fill from `git log --oneline --grep "F1"`> | Cart qty steppers (`apps/web/src/app/[tenant]/cart/cart-screen.tsx`) | 24 × 19.5 px | 28 × 28 px | parent `h-[26px]` → `h-7`; buttons `w-6` → `w-7 h-full` |
| F2 | <fill from `git log --oneline --grep "F2"`> | Catalog header cart link (`apps/web/src/app/[tenant]/page.tsx`) | 22 × 22 px | 36 × 36 px | added `w-9 h-9 flex items-center justify-center` |
| F3 | <fill from `git log --oneline --grep "F3"`> | Item header **cart** link — corrected from "back link" (`apps/web/src/app/[tenant]/item/[itemId]/interactive.tsx`) | 36 × 22 px | 36 × 36 px | added `h-9 items-center` |
```

Replace the three `<fill from `git log --oneline --grep "FN"`>` placeholders with the actual short commit SHAs from `git log --oneline -5`.

- [ ] **Step 3: Correct the F3 element label in the original findings table**

In the same `findings.md`, edit row F3 of the `## Findings` table. Change the "Symptom" / "Selector" / "Source" cells from the original "back-arrow link" wording to:

```
| F3 | P1 | item | iphone-se, android-landscape, ipad-split | The cart-icon link in the item-page topbar is 36 × 22 px. Smallest dimension 22 px, below the 24 px threshold. (Note: original audit row mislabelled this as the back arrow; verified in Phase B against `interactive.tsx:235`, the cart link — the back arrow at `:221` is already `w-9 h-9` and was never flagged.) | `a.w-9.flex` (cart link, `interactive.tsx:235`) | 36 × 22 px | `apps/web/src/app/[tenant]/item/[itemId]/interactive.tsx` | Added `h-9 items-center` to the existing `w-9 flex justify-end`. |
```

- [ ] **Step 4: Stage**

```bash
git add docs/superpowers/audits/2026-05-11-mobile/findings.md docs/superpowers/audits/2026-05-11-mobile/after/ docs/superpowers/audits/2026-05-11-mobile/dom/ docs/superpowers/audits/2026-05-11-mobile/capture.mjs
```

Do not commit yet — the audit-doc commit happens in Task 9 alongside the §3.9 status update.

---

## Task 8: Update `remaining_work.md` and `completed.md`

**Files:**
- Modify: `docs/remaining_work.md` (§3.9 entry).
- Modify: `docs/completed.md` (insert new §4.24).

- [ ] **Step 1: Collapse §3.9 in `remaining_work.md`**

In `docs/remaining_work.md`, find the §3.9 block (currently the "audit complete; fixes pending" entry from Phase A) and replace it with a one-liner pointer. The replacement block (find the existing first line and the body, replace with this):

Current text:

```
### 3.9 Mobile shell viewport edge cases — audit complete; fixes pending

Audit done 2026-05-11. See `docs/superpowers/audits/2026-05-11-mobile/findings.md` for the findings + observations (0 P0s, 3 P1s — all small-tap-target issues on the cart quantity steppers, the catalog header cart-icon link, and the item-page back link). Fix phase (Phase B plan) is drafted only after the findings are approved.
```

Replace with:

```
### 3.9 Mobile shell viewport edge cases ✅

Done 2026-05-11. Three rule-#2 small-tap-target P1s identified by Phase A audit and fixed in Phase B (cart qty steppers → 28×28, catalog header cart link → 36×36, item header cart link → 36×36). Rule #1 (horizontal scrollbar) and rules #3-#4 had zero findings at any of the three viewports. See `completed.md` §4.24.
```

- [ ] **Step 2: Add §4.24 to `completed.md`**

In `docs/completed.md`, find the existing `### 4.23 Batch print pick slips on the orders page (§3.7 code half) ✅` section. Insert the new §4.24 block immediately after `### 4.23`'s closing `Files: …` line and before the `---` / `## Outstanding items` heading.

The new block to insert verbatim:

```markdown

### 4.24 Mobile viewport edge cases — audit + fixes (§3.9) ✅

**Source:** `remaining_work.md` §3.9 — audit + fixes shipped 2026-05-11. Spec: `docs/superpowers/specs/2026-05-11-mobile-viewport-audit.md`; Phase A plan: `docs/superpowers/plans/2026-05-11-mobile-viewport-audit.md`; Phase B plan: `docs/superpowers/plans/2026-05-11-mobile-viewport-fixes.md`; findings + before/after artefacts: `docs/superpowers/audits/2026-05-11-mobile/`.

Two-phase: **Phase A** (PR #22 audit) captured 18 baseline screenshots + 18 DOM snapshots across iPhone SE (375 × 667), Android landscape (740 × 360), and iPad split-view (507 × 820) for the six parent-purchase critical-path screens. Programmatic rule-#1 (horizontal scrollbar) and rule-#2 (smallest dim < 24 px) checks plus a manual visual review for rules #3–#4. Output: zero P0s, three rule-#2 P1s — all small-tap-target issues on icon-only / quantity controls.

**Phase B** (this PR — merged into PR #22 as additional commits) applied three Tailwind class adjustments and re-captured the same 18 screenshots into `after/`:

- **F1** Cart qty steppers in `app/[tenant]/cart/cart-screen.tsx` — stepper container `h-[26px]` → `h-7`; both `<button>`s `w-6` → `w-7 h-full`. Smallest dim 19.5 px → 28 px.
- **F2** Catalog header cart link in `app/[tenant]/page.tsx` — added `w-9 h-9 flex items-center justify-center` to the `<Link>` so the link itself is 36 × 36 (icon stays 22 px). 22 × 22 → 36 × 36.
- **F3** Item header cart link in `app/[tenant]/item/[itemId]/interactive.tsx` — added `h-9 items-center` to the existing `w-9 flex justify-end`. (Phase A findings row mislabelled this as the back link; the back link at the same file's line 221 was already `w-9 h-9`.) 36 × 22 → 36 × 36.

Rule-#1 / #3 / #4 unchanged at zero matches post-fix; the three pre-fix rule-#2 selectors no longer appear in the `after/`-state DOM snapshots.

**Known gap, not closed:** `/[tenant]/checkout` is gated by Better-Auth, so the original captures showed the sign-in page rather than the actual checkout form. The checkout layout itself remains unaudited at the three target viewports until an authenticated capture pass is run. Logged as an observation in `findings.md`; not blocking ship since the surrounding screens (cart, sign-in card, placed) audit clean.

Files: `apps/web/src/app/[tenant]/cart/cart-screen.tsx`, `apps/web/src/app/[tenant]/page.tsx`, `apps/web/src/app/[tenant]/item/[itemId]/interactive.tsx`, `docs/superpowers/audits/2026-05-11-mobile/` (18 baseline + 18 after PNGs, 18 DOM snapshots, `findings.md`, `capture.mjs`).
```

Be sure the inserted block has the leading blank line so it doesn't merge with §4.23.

- [ ] **Step 3: Type-check + stage**

```bash
pnpm check-types:web
git add docs/remaining_work.md docs/completed.md
```

Expected: typecheck clean (docs files don't affect TS, but run anyway).

Do not commit yet — the commit happens in Task 9 alongside Task 7's staged docs changes.

---

## Task 9: Commit, push, and update PR #22

**Files:**
- All staged from Tasks 5, 7, 8.

- [ ] **Step 1: Commit the after/ captures + findings + docs**

```bash
git status --short
git commit -m "$(cat <<'EOF'
docs: §3.9 mobile viewport fixes — after-captures + findings update

Phase B of §3.9. The three rule-#2 P1s from Phase A's findings are
fixed in the three preceding commits; this commit lands the audit
artefacts:

- after/ — 18 post-fix screenshots, same six screens × three
  viewports as Phase A's baseline/.
- dom/ — overwritten with the post-fix DOM snapshots. The rule-#2
  jq re-check returns zero matches for the three flagged selectors.
- findings.md — adds a "Fixes shipped (Phase B)" section with
  before/after sizes, corrects the F3 element label (cart link, not
  back link).
- capture.mjs — accepts an optional CLI arg to pick the PNG output
  directory (defaults to baseline/ for unchanged behaviour).

Closes §3.9 in remaining_work.md; full write-up in completed.md
§4.24. Known gap: /[tenant]/checkout sign-in wall still blocks
authenticated-checkout layout audit (logged in observations).
EOF
)"
```

- [ ] **Step 2: Push the branch (already tracked from Phase A)**

```bash
git push 2>&1 | tail -5
```

Expected: pushes 4 new commits (F1, F2, F3, docs+after-captures) onto the existing `worktree-mobile-viewport-audit` branch.

- [ ] **Step 3: Update PR #22 title and body**

The PR was opened in Phase A as "audit only". With the fixes attached it's now the full §3.9 work. Edit:

```bash
gh pr edit 22 --title "feat(mobile): §3.9 viewport audit + fixes" --body "$(cat <<'EOF'
## Summary

Closes `docs/remaining_work.md` §3.9 (mobile-shell viewport edge cases). Two-phase work — audit first (commits up through `78b059e`), then three small-tap-target fixes + re-capture (commits after).

### Phase A — audit

- 18 baseline screenshots at **iPhone SE (375 × 667)**, **Android landscape (740 × 360)**, and **iPad split-view (507 × 820)** for the six parent-purchase critical-path screens (home → catalog → item → cart → checkout → placed).
- 18 DOM snapshots driving rule-#1 (horizontal scroll) and rule-#2 (tap target < 24 px) programmatic checks.
- Manual visual review for rules #3 (content unreachable) and #4 (layout collapse).
- Findings: **0 P0s, 3 P1s** (all rule-#2 small-tap-target issues).

### Phase B — fixes

- **F1** cart qty steppers → 28 × 28 (`apps/web/src/app/[tenant]/cart/cart-screen.tsx`).
- **F2** catalog header cart link → 36 × 36 (`apps/web/src/app/[tenant]/page.tsx`).
- **F3** item header cart link → 36 × 36 (`apps/web/src/app/[tenant]/item/[itemId]/interactive.tsx`). Phase A findings.md mislabelled F3 as the back link — corrected in Phase B; the back link was already 36 × 36 and was never broken.

Post-fix re-capture: 18 PNGs in `after/`, DOM snapshots overwritten in `dom/`. Rule-#2 jq re-check returns zero matches for the three flagged selectors; rule-#1 unchanged at zero matches; no rule-#4 regression.

### Known gap (not closed)

`/[tenant]/checkout` is auth-gated. The captures show the sign-in card, not the actual checkout form. Audit the authenticated-checkout layout in a follow-up if any real concern shows up after launch — logged in `findings.md` observations.

## Test plan

- [x] `pnpm check-types:web` — clean after each of F1/F2/F3 + after the docs commit.
- [x] Rule-#2 jq check against `dom/` post-fix returns no `button.w-6.text-center` / `a.relative.text-white` (catalog) / `a.w-9.flex` (item) hits.
- [x] Rule-#1 horizontal-scroll check still returns zero matches.
- [ ] Visual spot-check of any 3–4 `after/` PNGs vs `baseline/` confirms the tap targets look right (icon sizes unchanged, button surfaces larger).
- [ ] Manual real-device sanity on iPhone SE if available (optional — not blocking).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Print the PR URL and end**

```bash
gh pr view 22 --json url -q .url
```

End of Phase B. The PR is ready for George to review the fixes alongside the audit.

---

## Self-review checklist (run after Task 9)

- [ ] **F1, F2, F3 each shipped in a separate commit** (per Phase A spec's "one commit per fix" rule).
- [ ] **18 post-fix PNGs in `after/`** + 18 DOM snapshots overwritten in `dom/`.
- [ ] Rule-#2 jq re-check returns no `button.w-6.text-center`, no `a.relative.text-white` on catalog, no `a.w-9.flex` on item.
- [ ] Rule-#1 horizontal-scroll re-check returns zero matches (no overflow regression introduced by the size bumps).
- [ ] `findings.md` has a "Fixes shipped (Phase B)" section with three rows + corrected F3 label.
- [ ] `remaining_work.md` §3.9 reduced to a single ✅ line; `completed.md` has the new §4.24 block.
- [ ] PR #22 title and body updated to reflect Phase A + Phase B combined.

If any item fails, fix the relevant task inline.
