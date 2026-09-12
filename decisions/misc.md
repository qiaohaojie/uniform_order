# Decisions — misc

> Auto-routed shard of the decision log (see `../DECISION.md`). New entries
> appended by `.gq-spec/log-decision.sh`. Find any decision via
> `decisions/INDEX.md` or `grep -r <term> decisions/`.

## HeroUI OSS only — this repo is open source
- **ID:** 2f31cd1c-3da8-42f8-811c-d1a826994860
- **Date:** 2026-09-06T09:10:32Z
- **Stage:** onboard
- **Decision:** Use @heroui/react (OSS) only. Never install @heroui-pro/react or any @heroui-pro/* package. Process 0200 Step 3a (heroui-pro MCP hard gate) does not apply in this repo. Use OSS HeroUI docs/skills. New interactive UI stays on OSS primitives plus existing Tailwind tokens.
- **Why:** Uniform Order is an open-source product. Pro is a paid licence and must not ship in this codebase. George confirmed this as a standing project exception so agents stop recommending Pro.
- **Alternatives:** Follow the default app-process hard gate (heroui-pro MCP + @heroui-pro/react); keep OSS in app and Pro only in private forks.
- **Pros:** Licence-safe for public GitHub; agents stop re-asking; matches current package.json.
- **Cons:** No Pro components (charts, advanced forms). Default process 0200 Step 3a must be overridden in AGENTS.md/CLAUDE.md.
- **Risks / known issues:** A 0000 rerun refreshes the managed block and re-states the Pro MCP line; the override section after the managed block must stay. Agents that only read the managed block could still try Pro.
- **Links:** AGENTS.md (Project exception + override); CLAUDE.md (same); apps/web/package.json (@heroui/react, no @heroui-pro/react)

## Write-off records leftover qty only; qty 0 is already cleared
- **ID:** 47952782-a864-44b0-abce-b2b840917e02
- **Date:** 2026-09-11T14:50:39Z
- **Stage:** build:followup
- **Decision:** writeOffPrelovedSku writes leftover qty_on_hand as written_off. Qty already 0 throws PrelovedWriteOffNotEligibleError (409). It no longer reconstructs written_off from accepted-this-listing.
- **Why:** Paid CAS zeros qty without an intake sold event. Summing accepted-this-listing on retry counted sold units as written off.
- **Alternatives:** Subtract paid decrements (table has no per-SKU qty); insert written_off qty 0; keep accepted-sum retry for missing events.
- **Pros:** Sold units cannot be audited as written off. Happy-path leftover write-off unchanged.
- **Cons:** A qty update that succeeds and then drops the event no longer backfills written_off qty from accepted.
- **Risks / known issues:** Webhook paid-without-order still leaves qty 0 with no order line; that path is already cleared, not written off.
- **Links:** apps/web/src/db/preloved-queries.ts writeOffPrelovedSku; specs/_logs/OPEN_QUESTIONS.md M06 write-off retry

## Operator inbox lists preloved_donation_notes under Preloved
- **ID:** 34541772-a789-4bf5-af09-96db59566a0a
- **Date:** 2026-09-11T14:50:39Z
- **Stage:** build:followup
- **Decision:** Admin tab Inbox at /admin/[tenant]/preloved/inbox fetches GET /api/tenant/:tenantId/preloved/donation-notes. Client covers loading, error+retry, empty, and list. Notes remain messages, not SKUs.
- **Why:** M04 persisted bag notes without a SELECT/admin list. Spec calls them a message to operators.
- **Alternatives:** RSC-only page with loading.tsx; email the shop; mark-as-read.
- **Pros:** Operators can read drop-off notes. Empty/loading/error are first-class.
- **Cons:** No unread state or archive in this slice.
- **Risks / known issues:** Inbox lists the newest 200 notes only.
- **Links:** apps/web/src/app/admin/[tenant]/preloved/inbox; apps/web/src/app/api/tenant/[tenantId]/preloved/donation-notes/route.ts

## Atomic SKIP LOCKED sold-line write; BestEffort rethrows
- **ID:** d27665d9-7a2a-49be-88f4-c859129a94c8
- **Date:** 2026-09-12T16:27:21Z
- **Stage:** build:phase2
- **Decision:** Claim consignment units with FOR UPDATE SKIP LOCKED and write consignment_sold_lines in one neon-http statement. recordConsignmentSoldLinesBestEffort retries three times then rethrows so webhook/POST cannot 200 after a lost insert.
- **Why:** neon-http forbids db.transaction. The old row_number join let two qty-1 sales target the same oldest unit; the UPDATE/INSERT split plus swallowed BestEffort could mark items sold with no remittance row while Stripe saw 200.
- **Alternatives:** Keep two statements and only rethrow; per-item UPDATE loop; advisory lock only without SKIP LOCKED
- **Pros:** Concurrent sales take the next unlocked unit; claim+ledger commit together; unique item index and orphan UNION remain as replay backstops
- **Cons:** Commission math is now SQL ROUND to match splitSaleCommission; LATERAL LIMIT depends on Postgres
- **Risks / known issues:** If SKIP LOCKED+LIMIT s.need is rejected by this Postgres, the write fails loudly (5xx) instead of silently dropping
- **Links:** apps/web/src/db/preloved-queries.ts;apps/web/src/app/api/stripe/webhook/route.ts;apps/web/tests/preloved/m09-payout-csv.spec.ts

