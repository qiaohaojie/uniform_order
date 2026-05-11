# §3.8 — Accessibility audit (parent flow)

**Date:** 2026-05-11
**Tracks:** `docs/remaining_work.md` §3.8
**Author:** brainstorm session 2026-05-11
**Sibling work:** mirrors `docs/superpowers/specs/2026-05-11-mobile-viewport-audit.md` (§3.9)

## Problem

No automated accessibility checks run today. `remaining_work.md` §3.8 names three minimums — keyboard nav through the parent flow, `aria-label`s on icon-only buttons, contrast on the burgundy `#7A1F2B` accent — but they've never been measured. A payment site collecting student PII should not ship without at least one structured pass at WCAG 2.1 A + AA, and the burgundy accent in particular is a known contrast risk.

## Scope

**In scope:** the six parent-purchase critical-path screens (the same set §3.9 audited):

1. `/` — parent home / school picker
2. `/[tenant]` — catalog
3. `/[tenant]/item/[itemId]` — item detail
4. `/[tenant]/cart` — cart
5. `/[tenant]/checkout` — checkout (**authenticated** — closes the §3.9 known gap)
6. `/[tenant]/order/placed` — placed confirmation

**Out of scope:**
- Admin portal (`/admin/[tenant]/*`). Operators are signed-in staff on their own equipment; an a11y issue there is supportable manually post-launch.
- Platform portal (`/platform/*`). Same reasoning.
- Transactional emails (`OrderConfirmation`, `OrderReady`). Tracked separately if a parent reports an issue.
- Screen-reader walkthrough (VoiceOver, NVDA). Declined during brainstorm — high time cost, low expected yield on a site this small. Reconsider post-launch if a parent reports.
- Multiple viewports. Single viewport (iPhone SE 375 × 667, matching §3.9 baseline). Axe rules are largely viewport-independent at non-tiny sizes.

## Method

**Tooling:** Playwright (already in workspace devDependencies from §3.9) + `@axe-core/playwright` (new dep). Axe-core run with the rule tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`. Output is JSON per screen.

**Manual overlay:** keyboard-only walkthrough of each of the 6 screens. Tab / Shift-Tab through every interactive element; verify visible focus ring; verify Esc dismisses overlays; verify Enter / Space activates correctly; note any trap or off-screen focus jump. Findings recorded in `keyboard-walkthrough.md`.

**Authenticated checkout:** Better-Auth dev session captured once via a one-off helper script:

1. Developer runs `node docs/superpowers/audits/2026-05-11-a11y/setup-auth.mjs` (headed Playwright, no automation of the sign-in itself).
2. Script opens `/auth/sign-in`, then waits for the developer to complete sign-in interactively (whatever the dev environment is configured for — magic-link via console log, Google OAuth, etc.). Detection: poll for a session cookie on the current origin, or a known post-sign-in URL.
3. On success, script saves the resulting cookies + origin storage to `auth-storage.json` in the audit dir and exits.
4. `auth-storage.json` is gitignored; `audit.mjs` loads it via Playwright's `storageState` option on every run.
5. If the file is missing, `audit.mjs` prints the setup pointer and exits non-zero.

This keeps the audit reproducible without ever encoding a credential into the repo. Re-running Phase B requires the captured session to still be valid (Better-Auth sessions default to long expiry — ample for our use); otherwise the developer re-runs `setup-auth.mjs`. As a side benefit, this closes §3.9's known gap (anonymous capture of `/checkout` showed the sign-in card, not the form).

## Severity bar

| Severity | Definition | Ship-block? |
|---|---|---|
| **P0** | axe `critical` (keyboard trap, ARIA hidden focusable, missing form label on payment/checkout input, button without accessible name, etc.) | Yes |
| **P1** | axe `serious` + any keyboard finding that blocks task completion (focus order that skips a required field, contrast < 4.5:1 on actionable text, button reachable only by mouse) | Yes |
| **Observation** | axe `moderate`/`minor`, contrast on decorative or non-essential text, heading-order quirks, redundant landmarks, decorative SVG name issues, dev-only quirks | No — fix post-launch if reported |

**Burgundy accent (`#7A1F2B`) specific check:** before running axe, compute contrast ratios for `#7A1F2B` against `--color-parchment` (`#FAF6EE`), `--color-paper` (`#FDFBF6`), and `#fff`. Any actionable text (button label, link) below 4.5:1 is P1. Decorative usage (e.g. accent strokes on dividers) is acceptable.

**Stripe Payment Element:** iframe contents are not in scope. Stripe asserts WCAG 2.1 AA conformance upstream; we audit the surrounding form (labels, error region, submit button) and accept their iframe as tested.

## Phasing

**Two-phase, mirroring §3.9.**

### Phase A — audit (this spec → plan → PR)

- Add `@axe-core/playwright` dep.
- New dir `docs/superpowers/audits/2026-05-11-a11y/` with `audit.mjs`, `setup-auth.mjs`, per-screen axe JSON in `axe/`, `findings.md`, `keyboard-walkthrough.md`, `auth-setup.md` (instructions). `auth-storage.json` is gitignored.
- `findings.md` table lists P0s + P1s with: screen, WCAG SC reference (e.g. `2.1.1 Keyboard`), axe rule id (e.g. `button-name`), element selector, affected viewports, proposed fix shape.
- `remaining_work.md` §3.8 entry rewritten to "audit complete; fixes pending" pattern (same as §3.9 Phase A).
- PR title: `feat(a11y): §3.8 audit — WCAG 2.1 A+AA pass on parent flow`.

### Phase B — fixes (drafted only after Phase A findings reviewed)

- One commit per P0/P1 fix; small Tailwind / aria-label / focus-management changes typical of an a11y pass.
- Re-run `audit.mjs` producing `axe/after/<screen>.json`. Diff against Phase A: P0 + P1 violation counts drop to zero.
- `findings.md` gets a "Fixes shipped (Phase B)" section, same shape as §3.9's.
- §3.8 collapses to ✅ in `remaining_work.md`; full write-up in `completed.md`.

If Phase A finds zero P0 + zero P1, Phase B collapses to a single docs commit closing §3.8 in the same PR. We don't know the finding count up front, so the phasing keeps Phase A shippable on its own.

## File map (Phase A)

- **Add dep:** `@axe-core/playwright` at the workspace root `package.json` devDependencies. (Existing `playwright@1.59.1` already lives there from §3.9; co-locate.) Pin to a release compatible with playwright 1.59.
- **Create dir:** `docs/superpowers/audits/2026-05-11-a11y/` containing:
  - `audit.mjs` — main runner.
  - `setup-auth.mjs` — one-time storage-state capture.
  - `axe/` — 6 JSON result files.
  - `findings.md`, `keyboard-walkthrough.md`, `auth-setup.md`.
- **Modify:** `.gitignore` — add `auth-storage.json` for this audit dir.
- **Modify:** `docs/remaining_work.md` §3.8 — flip to "audit complete; fixes pending".

## Correctness gate (Phase A)

- `audit.mjs` exits 0 and writes 6 axe JSON files.
- `findings.md` accurately summarises the JSON (no claim of "0 P0" if a P0 row exists in the data).
- `pnpm check-types:web` clean (the audit dir is outside `apps/web/src` so should be a no-op — confirm).
- PR opened, ready for George to read findings before drafting Phase B.

## Known risks

- Better-Auth dev session captured via `setup-auth.mjs` may expire between Phase A and Phase B if days pass between merges. Easy to refresh — re-run the setup script.
- Stripe Card Element may report axe `incomplete` for the iframe contents (axe can't inspect cross-origin frames). These are noise; document and ignore.
- The §3.9 audit script's tenant + sample cart injection pattern should be reused, not reinvented. Plan will reference the existing `capture.mjs` for the navigation + cart-seeding helpers.

## Out of scope (explicit)

- Automated a11y in CI. The audit is one-shot before launch; CI integration is post-launch §4.x territory if at all.
- Performance / Lighthouse a11y score. Lighthouse uses axe under the hood but adds noise from perf + best-practices categories. We run axe directly.
- Component-level unit a11y tests (e.g. testing-library a11y matchers per component). Out of scope for an audit; could come later as a code-hygiene initiative.
