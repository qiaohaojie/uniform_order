# Milestone M04: Donate page and refund policy

<!-- Self-contained hand-off for /gq-spec-build-grok. The build loop (and its subagents)
     should be able to act on THIS file + specs/context/ alone, without the planning chat.
     Plan must not silently redesign WHAT/WHY from the approved source spec. -->

## Status
pending            <!-- pending | in-progress | complete -->

## Wave
2

## Goal
Parents get the real-world donate instructions: drop a washed bag at the shop, do not photograph and list. Refund policy gains the ACL-safe preloved paragraph. No buy flow yet.

## Source requirements
- `specs/context/plan-preloved-shop.md` §4.2 Donate (Phase 1)
- §6 Parent: donate page + refund policy
- §8.3 ACL and refund policy (sold as worn; no change-of-mind; ACL if not as described)
- §10 Phase 1 items 5 and 9
- §11 P5
- §12 decisions 1 and 7 (shop model; ACL-safe copy, never a hard no-refunds flag)

## Scope
**In:**
- Page `/{tenant}/preloved/donate` when preloved is enabled: what to bring, refuse list from settings, where/when from `shopHours` / `address` / `collectionInstructions` (name unattended box if stored in collection instructions), rejects go to charity/recycling not returned by default
- Optional “I am dropping off a donation” note (name, student, bag count) — a message to operators, **not** a listing or payment
- Links from shop footer and (if cheap) landing; catalogue empty-state link is M05
- Per-tenant refund policy text/version: preloved clause as specified; checkout consent already exists — new version if policy text is versioned
- Generic platform template `apps/web/src/app/refund-policy/page.tsx` gets the same paragraph so self-hosters see it

**Out:**
- Parent self-listing, photos from parent, payment on donate
- Catalogue / cart (M05)
- Consignment form (Phase 2)
- Blanket “no refunds on second-hand” toggle

## Dependencies
**Depends on:** M01
**Blocks:** M05

**Context from dependencies:** M01 settings include refuse list, shop hours already on `tenants`. Parent shop is `apps/web/src/app/[tenant]/` with `MobileShell`. Refund policy per tenant at `apps/web/src/app/[tenant]/refund-policy/` and legal versions in `tenant_legal_versions`. Do not edit catalogue-grid (M05) except a footer/landing link if it already has a shared footer component.

## Relevant code & entry points
- `apps/web/src/app/[tenant]/preloved/donate/` — new
- `apps/web/src/app/[tenant]/refund-policy/`
- `apps/web/src/app/refund-policy/page.tsx`
- `apps/web/src/db/schema.ts` — `tenant_legal_versions` if bumping policy text
- Tenant footer / `landing-screen.tsx` for the donate link

## Acceptance criteria
- [ ] With preloved off, donate route is not offered in nav/footer (404 or hidden)
- [ ] With preloved on, donate page shows wash/current-uniform rules, refuse list (default includes hats/socks/swimwear), hours, address, and reject-to-charity copy
- [ ] Optional bag note can be submitted without creating a SKU or listing
- [ ] No parent photo upload, price field, or Stripe on this page
- [ ] Tenant refund policy includes sold-as-worn, no change-of-mind, ACL for not-as-described / not acceptable quality for a used garment
- [ ] `pnpm check-types:web` passes
- [ ] Playwright: open donate page on mobile viewport (~430px) and desktop; submit bag note

## Verification
- **Commands:** not configured · `pnpm check-types:web` · no test suite
- **Strategy:** `pnpm dev:web`; playwright-cli mobile + desktop on `/{tenant}/preloved/donate` and refund-policy.

## Architectural invariants
- Parents drop off; they do not list
- HeroUI OSS + existing tokens
- Do not weaken ACL with “no refunds at all”
- Seller of record remains the school

## Manual prerequisites
- [ ] M01 migration; tenant with preloved enabled for the UI check

## Autonomy contract
Follow the `autonomy-contract.md` reference shipped with the `gq-spec-build-grok` skill
(`references/autonomy-contract.md` in that skill's directory, project or user scope). In short:
make reversible decisions independently and **log them** (via `log-decision.sh` → `decisions/`); for irreversible /
security / cost / scope-changing / missing-secret situations, record a blocker and stop rather than guess.
Do **not** silently change product/gameplay/architecture decisions from the approved design.

## Decision logging
Any non-trivial choice made while building this milestone must be captured to the shared decision log
(stage `build:M04`). Subagents return decisions in schema-validated workflow output; the
orchestrating skill persists them via `.gq-spec/log-decision.sh`.
