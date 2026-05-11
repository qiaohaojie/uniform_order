# §3.8 — Accessibility audit, Phase B (fixes)

**Date:** 2026-05-11
**Tracks:** `docs/remaining_work.md` §3.8
**Phase A:** `docs/superpowers/audits/2026-05-11-a11y/findings.md`, merged in PR #23 (`15b90cb`)
**Phase A plan:** `docs/superpowers/plans/2026-05-11-a11y-audit-phase-a.md`
**Sibling phasing reference:** §3.9 mobile-viewport audit Phase A/B

## Problem

Phase A surfaced 3 ship-blocking axe findings on the parent flow and recorded one deferred manual check:

- **A1 (P0)** — `<select>` for "Year" on `/checkout` lacks a programmatic label. Root cause: `FieldLabel` in `apps/web/src/app/[tenant]/checkout/checkout-screen.tsx:558` is a styled `<div>`, not a `<label htmlFor>`. Six checkout fields rely on this component (`Student name`, `Year`, `Roll class`, `Parent / guardian name`, `Mobile`, `Email (receipt)`). Year fails axe `select-name`; the other 5 currently pass axe by accident (axe's input-name rule has more permissive fallbacks than `select-name`) but are no better-labelled.
- **A2 (P1)** — Stripe's `.__PrivateStripeElement-input` outer wrapper (injected by `@stripe/stripe-js` into our DOM, not inside the cross-origin iframe) is `aria-hidden="true"` yet remains focusable. Axe rule `aria-hidden-focus`.
- **A3 (P1)** — "Welcome" eyebrow on `/` uses `var(--color-gold)` (`#B08A3E`) on parchment (`#FAF6EE`) → 2.97:1, below the 4.5:1 normal-text minimum. 11 px bold counts as normal, not large.
- **Deferred** — manual keyboard-only walkthrough of the 6 parent-flow screens was skipped in Phase A. Keyboard completability of the parent flow remains unverified.

Phase B closes all four items in a single PR.

## Scope

**In scope:**
- Fix A1 by converting `FieldLabel` into a semantic `<label htmlFor>` and labelling all 6 checkout fields.
- Fix A3 by introducing a `--color-gold-text` token dark enough to clear 4.5:1 on parchment, and switching the home eyebrow (plus any other small-bold-gold text surfaced during the fix) to it. The existing `--color-gold` is retained for accents/strokes/large decorative use.
- Fix A2 by upgrading `@stripe/stripe-js` and re-verifying; fall back to a documented `.exclude('.__PrivateStripeElement-input')` only if the upgrade does not resolve it.
- Perform the deferred keyboard walkthrough, recording per-screen findings in `keyboard-walkthrough.md` against the spec's checklist template. Any task-blocking findings become supplemental P1s (A4+) and get fix commits in the same PR.
- Re-run `audit.mjs`, write the results to `axe/after/`, and append a "Fixes shipped (Phase B)" section to `findings.md` showing P0 + P1 = 0.
- Flip §3.8 to ✅ in `docs/remaining_work.md` and move the full write-up to `docs/completed.md`.

**Out of scope:**
- Axe `incomplete` observations from Phase A (bypass landmarks, color-contrast unknown-bg). Documented as observations, not ship-blockers; tracked for post-launch.
- Stripe Payment Element iframe contents — still upstream-owned and excluded at axe time.
- Re-auditing admin or platform portals.
- Screen-reader walkthrough (still declined per Phase A spec).

## Method

### A1 — FieldLabel becomes a real `<label>`

Change `FieldLabel` from `function FieldLabel({ children }: { children: React.ReactNode })` to accept `htmlFor: string`. Replace the `<div>` with `<label>`. Add stable `id` props to each of the 6 inputs/selects and wire `FieldLabel htmlFor={...}` to the matching id. The 6 ids follow the existing field key (`studentName`, `year`, `rollClass`, `parentName`, `parentMobile`, `parentEmail`) for clarity.

Why DRY at the component level rather than `aria-label` per field: (a) a real `<label>` is what screen-readers and click-target heuristics both want; (b) one component change vs. six attribute additions; (c) the 5 passing-by-accident fields silently upgrade to "properly labelled" without touching them individually.

### A3 — `--color-gold-text` darker variant

Add `--color-gold-text` to `apps/web/src/index.css` under the existing `@theme` block, sibling to `--color-gold: #B08A3E`. Target value: **`#8C6A28`** (computed ≈ 4.7:1 against parchment `#FAF6EE`, clears the 4.5:1 normal-text minimum with margin). The value is verified during execution by direct contrast computation before commit (see Correctness gates).

Three small-bold-gold parent-flow eyebrows switch to `var(--color-gold-text)`:

- `apps/web/src/app/home-client.tsx:99` (home "Welcome" eyebrow — the A3 finding)
- `apps/web/src/app/home-client.tsx:188` (second small-bold-gold eyebrow on home)
- `apps/web/src/app/orders/[orderId]/order-detail-client.tsx:220` (parent order-status page eyebrow)

Out-of-scope under §3.8 (parent-flow audit) but flagged here for traceability: `apps/web/src/components/admin/pick-slip.tsx:164` uses the same small-bold-gold pattern in an admin component. Deferred to a future admin a11y audit; not changed in this PR to keep parent and admin contrast policies separately auditable.

Other `--color-gold` uses across the codebase (accent strokes, chips, large decorative uses) are untouched.

### A2 — Stripe upgrade then re-verify

Upgrade `@stripe/stripe-js` in `apps/web/package.json` from `^9.4.0` to whatever the current latest minor is at the time of execution. (`@stripe/connect-js` is a separate concern — leave it pinned unless its peer changes force a bump.) After `pnpm install`, smoke-test checkout end-to-end: card entry with test number `4242 4242 4242 4242`, submit, confirmation page. Then re-run `audit.mjs`.

If A2 is gone post-upgrade: the upgrade commit alone closes it. If A2 persists: the same commit additionally adds `.exclude('.__PrivateStripeElement-input')` to `audit.mjs` with an inline comment citing the upstream rationale and (if findable) the relevant Stripe GitHub issue URL.

### Keyboard walkthrough

Execute the spec's per-screen checklist over all 6 parent-flow screens:
- Tab order matches visual reading order
- Visible focus ring on every interactive element
- Esc closes any overlay / drawer / dialog
- No keyboard trap (Tab eventually leaves the screen)
- Enter / Space activates buttons and links as expected

Capture findings in `docs/superpowers/audits/2026-05-11-a11y/keyboard-walkthrough.md`, one section per screen, each box explicitly ticked or marked failing with notes. If any check fails task-blockingly, add the finding to `findings.md` as A4+ and add a corresponding fix commit before the re-audit commit.

### Closing the audit

Re-run `audit.mjs` producing 6 new JSON files in `docs/superpowers/audits/2026-05-11-a11y/axe/after/`. Append a "Fixes shipped (Phase B)" section to `findings.md` listing before/after counts per screen and confirming P0 + P1 = 0. Flip §3.8 to ✅ in `docs/remaining_work.md` and migrate the section to `docs/completed.md` with the standard Phase A + Phase B write-up.

## File map

- **Modify:** `apps/web/src/app/[tenant]/checkout/checkout-screen.tsx` — `FieldLabel` signature + 6 input/select `id` attributes.
- **Modify:** `apps/web/src/index.css` — add `--color-gold-text` token.
- **Modify:** `apps/web/src/app/home-client.tsx` — lines 99 and 188, switch inline `color:var(--color-gold)` to `var(--color-gold-text)`.
- **Modify:** `apps/web/src/app/orders/[orderId]/order-detail-client.tsx` — line 220, same swap.
- **Modify:** `apps/web/package.json` (+ `pnpm-lock.yaml`) — bump `@stripe/stripe-js`.
- **Modify (conditional):** `docs/superpowers/audits/2026-05-11-a11y/audit.mjs` — `.exclude('.__PrivateStripeElement-input')` only if upgrade doesn't resolve A2.
- **Create:** `docs/superpowers/audits/2026-05-11-a11y/keyboard-walkthrough.md`.
- **Create:** `docs/superpowers/audits/2026-05-11-a11y/axe/after/*.json` (6 files).
- **Modify:** `docs/superpowers/audits/2026-05-11-a11y/findings.md` — append "Fixes shipped (Phase B)" section.
- **Modify:** `docs/remaining_work.md` — flip §3.8 to ✅, remove from outstanding list.
- **Modify:** `docs/completed.md` — add §3.8 write-up.

## Commit shape (target sequence)

1. `fix(a11y): A1 — FieldLabel becomes a semantic <label htmlFor>`
2. `fix(a11y): A3 — introduce --color-gold-text for small-text gold`
3. `fix(a11y): A2 — upgrade @stripe/stripe-js, re-verify aria-hidden-focus`
4. `chore(a11y): keyboard walkthrough — 6 screens` (plus any A4+ fix commits if walkthrough surfaces task-blockers)
5. `chore(a11y): re-audit — P0+P1 = 0; close §3.8`

PR title: `feat(a11y): §3.8 fixes — WCAG 2.1 A+AA pass + keyboard walkthrough`. `feat`, not `chore`: Phase B ships user-facing accessibility improvements.

## Correctness gates

- `pnpm check-types:web` clean after each code commit (1, 2, 3, and any A4+ fix commits).
- After commit 2 (A3): direct contrast computation confirms the chosen `--color-gold-text` hex resolves to ≥ 4.5:1 against `#FAF6EE`. Result recorded inline in the commit message or in `findings.md`. This is a local gate independent of the axe re-run.
- Manual checkout smoke test after commit 3 (Stripe upgrade): card mounts, validates, confirms a test-card payment, lands on `/order/placed`.
- Keyboard walkthrough markdown contains 6 sections, each with all 5 checks explicitly ticked or marked failing.
- Before re-running `audit.mjs` in commit 5: confirm `auth-storage.json` still resolves an authenticated `/checkout` (audit script aborts with a pointer to `setup-auth.mjs` if the session has expired). Avoids the failure mode where stale auth produces 401-driven a11y noise rather than real findings.
- Re-audit JSON in commit 5: P0 = 0, P1 = 0 across all 6 screens. Any unexpected new finding blocks the PR.

## Known risks

- **Stripe minor bump can shift Element CSS or behavior.** Mitigation: end-to-end smoke test in commit 3 is the gate; if the upgrade breaks card mounting, revert the bump and fall back to exclude-only for A2.
- **`--color-gold-text` may look heavier than `--color-gold`** in some places. Mitigation: token is opt-in; only the home eyebrow (and any other small-text-gold the audit surfaces) switches. Large/decorative gold uses are untouched.
- **Keyboard walkthrough surfacing new P1s mid-PR.** Mitigation: design accommodates it — additional fix commits slot in before the re-audit commit. If volume is high (>3 new findings), reassess whether to split into a separate PR; recorded as a tripwire, not a likely outcome given the codebase's reliance on native semantic HTML.
- **`auth-storage.json` (Neon Auth dev session) may have expired** between Phase A capture and Phase B re-audit. Mitigation: re-run `setup-auth.mjs` per Phase A's documented procedure.

## Out of scope (explicit)

- Automated a11y in CI. Still post-launch territory.
- Lighthouse a11y score. Same rationale as Phase A.
- Component-level a11y unit tests.
- Admin or platform portal audit.
- Stripe iframe contents.
