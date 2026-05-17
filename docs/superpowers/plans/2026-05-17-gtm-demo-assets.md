# GTM Demo Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete `GTM/` directory described in `docs/superpowers/specs/2026-05-17-gtm-demo-assets-design.md` — idempotent demo seed for two isolated tenants, cleanup script, walkthrough/playbook/route-map documentation, six numbered act scripts, and Playwright recording config.

**Architecture:** Two scenario tenants seeded into the existing Drizzle+neon-http schema using `db.batch` (never `transaction`). All deliverables live under `GTM/`. The only files modified outside `GTM/` are `apps/web/package.json` (4 `demo:*` scripts + `tsx` dev dep) and root `.gitignore` (video artifacts). Scripts refuse to run against non-localhost databases unless explicit override flags are passed.

**Tech Stack:** TypeScript, `tsx` (runtime TS), Drizzle ORM, `@neondatabase/serverless`, Playwright 1.59, pnpm workspaces, Node ≥20.6 (for `--env-file`).

**Branch:** `gtm-demo-assets` (worktree at `../uniform_order-gtm-demo`).

**Test strategy:** This is content + infrastructure; the repo has no test runner. Validation gates are (a) `pnpm --filter web demo:seed:dry` printing a coherent plan without writes, (b) `pnpm check-types:web` passing, (c) `npx playwright test --list -c GTM/product_demo/playwright/demo-recording.config.ts` parsing the spec, and (d) manual `--dry-run` then real seed against the local Neon dev DB.

---

## File Map

**New files under `GTM/`:**

| Path | Responsibility |
|---|---|
| `GTM/IMPLEMENTATION_NOTES.md` | App-level changes, safety guards, Neon Auth out-of-band step |
| `GTM/demo_data/README.md` | Quickstart for seed/cleanup |
| `GTM/demo_data/operator_run_guide.md` | Detailed manual: tables touched, demo accounts, rotation, safety |
| `GTM/demo_data/seed-demo.ts` | Idempotent seeder, flag-gated, localhost-default |
| `GTM/demo_data/cleanup-demo.ts` | Demo-namespace-scoped deleter, `--confirm` gated |
| `GTM/demo_data/.env.demo.example` | Required env var template |
| `GTM/demo_data/fixtures/demo-scenarios.json` | All tenant/catalog/order fixture data |
| `GTM/product_demo/product-walkthrough.md` | Investor/buyer narrative |
| `GTM/product_demo/demo-playbook.md` | Sales day-in-the-life script |
| `GTM/product_demo/route-map.md` | Demo-relevant route table |
| `GTM/product_demo/playwright/README.md` | Recording quickstart |
| `GTM/product_demo/playwright/demo-recording.config.ts` | Playwright config: desktop + mobile projects |
| `GTM/product_demo/playwright/global-setup.ts` | Pre-flight dev-server liveness check |
| `GTM/product_demo/playwright/record-demo.spec.ts` | Six `test.describe` blocks, one per act |
| `GTM/product_demo/recordings/README.md` | Recording how-to + troubleshooting |
| `GTM/product_demo/recordings/.gitkeep` | Preserve empty dir |
| `GTM/product_demo/recordings/00N_act*.md` × 6 | Per-act shot scripts |

**Modified files outside `GTM/`:**

| Path | Change |
|---|---|
| `apps/web/package.json` | Add `tsx` to `devDependencies`; add 4 `demo:*` scripts |
| `.gitignore` (repo root) | Append video output patterns |

**Never modified:** `apps/web/src/db/schema.ts`, `apps/web/src/db/index.ts`, `apps/web/src/lib/data.ts`, any application route or component code.

---

## Working Conventions

- All work happens in the worktree at `../uniform_order-gtm-demo` on branch `gtm-demo-assets`. Paths in this plan are repo-relative (i.e. `GTM/...` not `../uniform_order-gtm-demo/GTM/...`). The executing agent's cwd should be the worktree root.
- Commit at the end of each task. Commit messages follow conventional commits (`feat`, `chore`, `docs`).
- Never run headed Playwright; document commands for the human user to run from their own terminal.
- Never seed or cleanup against a non-localhost database during the build. All validation uses `--dry-run`.

---

## Task 1: Scaffold GTM directory + recordings .gitkeep

**Files:**
- Create: `GTM/demo_data/fixtures/` (directory)
- Create: `GTM/product_demo/playwright/` (directory)
- Create: `GTM/product_demo/recordings/` (directory)
- Create: `GTM/product_demo/recordings/.gitkeep`

- [ ] **Step 1: Create directory skeleton**

```bash
mkdir -p GTM/demo_data/fixtures
mkdir -p GTM/product_demo/playwright
mkdir -p GTM/product_demo/recordings
```

- [ ] **Step 2: Create the .gitkeep**

Write `GTM/product_demo/recordings/.gitkeep` as an empty file:
```
```

- [ ] **Step 3: Verify directory tree**

Run: `find GTM -type d | sort`
Expected output:
```
GTM
GTM/demo_data
GTM/demo_data/fixtures
GTM/product_demo
GTM/product_demo/playwright
GTM/product_demo/recordings
```

- [ ] **Step 4: Commit**

```bash
git add GTM/
git commit -m "chore(gtm): scaffold GTM directory skeleton"
```

---

## Task 2: Write fixture JSON (tenants, catalog, order template)

**Files:**
- Create: `GTM/demo_data/fixtures/demo-scenarios.json`

This file is the single source of truth for fixture data. The seed script reads it and emits DB writes.

- [ ] **Step 1: Write the fixture file**

Create `GTM/demo_data/fixtures/demo-scenarios.json` with this exact content:

```json
{
  "$schema": "fixture-v1",
  "tenants": [
    {
      "id": "demo-blank",
      "name": "Hawthorn Grammar",
      "short": "HWGM",
      "accent": "#1f3c88",
      "motto": "Steady, Strong, True",
      "address": "12 Glenferrie Road, Hawthorn VIC 3122",
      "shopHours": "Tue & Thu, 9:00 – 11:00",
      "shopEmail": "operator@demo.uniformorder.online",
      "timezone": "Australia/Melbourne",
      "isPubliclyListed": true,
      "stripeAccountId": "acct_demo_blank",
      "stripeChargesEnabled": true,
      "stripePayoutsEnabled": true,
      "platformApprovalStatus": "approved",
      "orderIdPrefix": "HWGM",
      "settings": { "workflowMode": "standard", "pickupEnabled": true, "shippingEnabled": false },
      "legal": {
        "policyMode": "text",
        "policyText": "Refunds available within 14 days of collection for unworn, unwashed items with original packaging. Custom-embroidered name labels are non-refundable.",
        "aclAcknowledged": true,
        "sellerOfRecordAcknowledged": true,
        "declarantName": "Demo Operator",
        "declarantRole": "Uniform Shop Coordinator"
      },
      "catalog": [
        { "id": "hwgm-polo-ss", "name": "Polo Shirt — Short Sleeve", "category": "Summer", "description": "Embroidered school crest, poly-cotton blend.", "variants": [{ "label": "Size 6–14", "price": "32.00", "sizes": ["6","8","10","12","14"] }, { "label": "Size 16–20", "price": "36.00", "sizes": ["16","18","20"] }] },
        { "id": "hwgm-summer-dress", "name": "Summer Dress", "category": "Summer", "description": "Box-pleat A-line, machine washable.", "variants": [{ "label": "Size 6–14", "price": "65.00", "sizes": ["6","8","10","12","14"] }] },
        { "id": "hwgm-jumper", "name": "Winter Jumper", "category": "Winter", "description": "Pure wool, school crest embroidered left chest.", "variants": [{ "label": "Size 8–16", "price": "85.00", "sizes": ["8","10","12","14","16"] }] },
        { "id": "hwgm-shorts-sport", "name": "Sports Shorts", "category": "Sports", "description": "Microfibre, elasticised waist.", "variants": [{ "label": "Sizes S–XL", "price": "28.00", "sizes": ["S","M","L","XL"] }] },
        { "id": "hwgm-hat", "name": "Bucket Hat", "category": "Summer", "description": "Wide brim, school colours.", "variants": [{ "label": "One size", "price": "18.00", "sizes": ["One size"] }] },
        { "id": "hwgm-name-labels", "name": "Name Labels (pack of 50)", "category": "Accessories", "description": "Custom embroidered, sewn-in tags. Non-refundable.", "variants": [{ "label": "Pack of 50", "price": "24.00", "sizes": ["Pack"] }] }
      ],
      "orders": []
    },
    {
      "id": "demo-academy",
      "name": "Riverside Academy",
      "short": "RVRA",
      "accent": "#7a1f2b",
      "motto": "Per Aspera Ad Astra",
      "address": "84 River Parade, Strathfield NSW 2135",
      "shopHours": "Mon, Wed & Fri, 8:30 – 12:00",
      "shopEmail": "operator@demo.uniformorder.online",
      "timezone": "Australia/Sydney",
      "isPubliclyListed": true,
      "stripeAccountId": "acct_demo_academy",
      "stripeChargesEnabled": true,
      "stripePayoutsEnabled": true,
      "platformApprovalStatus": "approved",
      "orderIdPrefix": "RVRA",
      "settings": { "workflowMode": "standard", "pickupEnabled": true, "shippingEnabled": false },
      "legal": {
        "policyMode": "text",
        "policyText": "Refunds available within 14 days for unworn, unwashed items with tags. Custom items (name labels, embroidered house shirts) are non-refundable.",
        "aclAcknowledged": true,
        "sellerOfRecordAcknowledged": true,
        "declarantName": "Demo Operator",
        "declarantRole": "P&C Uniform Coordinator"
      },
      "catalog": [
        { "id": "rvra-polo-ss", "name": "Polo Shirt — Short Sleeve", "category": "Summer", "description": "Embroidered crest, poly-cotton.", "variants": [{ "label": "Size 6–14", "price": "34.00", "sizes": ["6","8","10","12","14"] }, { "label": "Size 16–20", "price": "38.00", "sizes": ["16","18","20"] }] },
        { "id": "rvra-polo-ls", "name": "Polo Shirt — Long Sleeve", "category": "Winter", "description": "Embroidered crest, ribbed cuffs.", "variants": [{ "label": "Size 6–14", "price": "42.00", "sizes": ["6","8","10","12","14"] }, { "label": "Size 16–20", "price": "46.00", "sizes": ["16","18","20"] }] },
        { "id": "rvra-summer-dress", "name": "Summer Dress", "category": "Summer", "description": "Box-pleat, side pockets.", "variants": [{ "label": "Size 6–14", "price": "68.00", "sizes": ["6","8","10","12","14"] }] },
        { "id": "rvra-jumper", "name": "Winter Jumper", "category": "Winter", "description": "Pure wool, V-neck.", "variants": [{ "label": "Size 8–16", "price": "92.00", "sizes": ["8","10","12","14","16"] }] },
        { "id": "rvra-trousers", "name": "Formal Trousers", "category": "Formal", "description": "Pleated front, adjustable waist.", "variants": [{ "label": "Size 8–16", "price": "58.00", "sizes": ["8","10","12","14","16"] }] },
        { "id": "rvra-shorts-sport", "name": "Sports Shorts", "category": "Sports", "description": "Microfibre, elasticised.", "variants": [{ "label": "Sizes S–XL", "price": "28.00", "sizes": ["S","M","L","XL"] }] },
        { "id": "rvra-hat", "name": "Bucket Hat", "category": "Summer", "description": "Wide brim.", "variants": [{ "label": "One size", "price": "18.00", "sizes": ["One size"] }] },
        { "id": "rvra-house-bradman", "name": "House Shirt — Bradman", "category": "Sports", "description": "Gold house shirt. Non-refundable (custom).", "variants": [{ "label": "Sizes S–XL", "price": "32.00", "sizes": ["S","M","L","XL"] }] },
        { "id": "rvra-house-pharlap", "name": "House Shirt — Phar Lap", "category": "Sports", "description": "Green house shirt. Non-refundable.", "variants": [{ "label": "Sizes S–XL", "price": "32.00", "sizes": ["S","M","L","XL"] }] },
        { "id": "rvra-tie", "name": "School Tie", "category": "Formal", "description": "Polyester, crest weave.", "variants": [{ "label": "One size", "price": "22.00", "sizes": ["One size"] }] }
      ],
      "orders": [
        { "n": 1,  "fulfilment": "to_prepare", "payment": "paid",                "daysAgo": 0,  "parent": "Chloë Nguyen",                 "student": "Mia Nguyen",                  "year": "8",  "roll": "8B",  "lines": [["rvra-polo-ss","Size 6–14","10",2],["rvra-jumper","Size 8–16","10",1]] },
        { "n": 2,  "fulfilment": "to_prepare", "payment": "paid",                "daysAgo": 1,  "parent": "José O'Connor",                "student": "Liam O'Connor",               "year": "7",  "roll": "7A",  "lines": [["rvra-summer-dress","Size 6–14","10",1]] },
        { "n": 3,  "fulfilment": "to_prepare", "payment": "paid",                "daysAgo": 1,  "parent": "Søren Müller",                 "student": "Anika Müller",                "year": "9",  "roll": "9C",  "lines": [["rvra-trousers","Size 8–16","12",1],["rvra-tie","One size","One size",1]] },
        { "n": 4,  "fulfilment": "to_prepare", "payment": "paid",                "daysAgo": 2,  "parent": "Liu Mingsheng (李小明)",       "student": "Wei Liu",                     "year": "10", "roll": "10A", "lines": [["rvra-house-bradman","Sizes S–XL","M",1]] },
        { "n": 5,  "fulfilment": "to_prepare", "payment": "paid",                "daysAgo": 2,  "parent": "Aroha Te Rangi",               "student": "Tane Te Rangi",               "year": "8",  "roll": "8A",  "lines": [["rvra-shorts-sport","Sizes S–XL","M",2]] },
        { "n": 6,  "fulfilment": "to_prepare", "payment": "paid",                "daysAgo": 3,  "parent": "Miyuki Tanaka",                "student": "Haru Tanaka",                 "year": "7",  "roll": "7B",  "lines": [["rvra-polo-ls","Size 6–14","10",1],["rvra-jumper","Size 8–16","10",1]] },
        { "n": 7,  "fulfilment": "to_prepare", "payment": "paid",                "daysAgo": 3,  "parent": "Alexandra Catherine Featherstonehaugh-Williamson", "student": "Beatrix F-Williamson", "year": "11", "roll": "11C", "lines": [["rvra-trousers","Size 8–16","14",1]] },
        { "n": 8,  "fulfilment": "to_prepare", "payment": "paid",                "daysAgo": 4,  "parent": "Daniel Park",                  "student": "Eunseo Park",                 "year": "9",  "roll": "9B",  "lines": [["rvra-jumper","Size 8–16","12",1]] },
        { "n": 9,  "fulfilment": "ready",      "payment": "paid",                "daysAgo": 5,  "parent": "Priya Sharma",                 "student": "Aarav Sharma",                "year": "8",  "roll": "8C",  "lines": [["rvra-polo-ss","Size 6–14","12",2]] },
        { "n": 10, "fulfilment": "ready",      "payment": "paid",                "daysAgo": 5,  "parent": "Fatima Al-Hassan",             "student": "Layla Al-Hassan",             "year": "7",  "roll": "7C",  "lines": [["rvra-summer-dress","Size 6–14","8",1],["rvra-hat","One size","One size",1]] },
        { "n": 11, "fulfilment": "ready",      "payment": "paid",                "daysAgo": 6,  "parent": "James Watson",                 "student": "Henry Watson",                "year": "10", "roll": "10B", "lines": [["rvra-house-pharlap","Sizes S–XL","L",1]] },
        { "n": 12, "fulfilment": "ready",      "payment": "paid",                "daysAgo": 7,  "parent": "Emma Thompson",                "student": "Olivia Thompson",             "year": "9",  "roll": "9A",  "lines": [["rvra-trousers","Size 8–16","12",1],["rvra-polo-ls","Size 6–14","12",2]] },
        { "n": 13, "fulfilment": "ready",      "payment": "paid",                "daysAgo": 8,  "parent": "Mohammed Rahman",              "student": "Yusuf Rahman",                "year": "8",  "roll": "8A",  "lines": [["rvra-shorts-sport","Sizes S–XL","S",2],["rvra-polo-ss","Size 6–14","10",1]] },
        { "n": 14, "fulfilment": "ready",      "payment": "paid",                "daysAgo": 9,  "parent": "Lucia Romano",                 "student": "Marco Romano",                "year": "11", "roll": "11A", "lines": [["rvra-tie","One size","One size",1]] },
        { "n": 15, "fulfilment": "needs_attention", "payment": "paid",           "daysAgo": 10, "parent": "Hannah Goldberg",              "student": "Eli Goldberg",                "year": "9",  "roll": "9C",  "lines": [["rvra-jumper","Size 8–16","16",1]], "holdReason": "Size 16 jumper out of stock — restock ETA next week" },
        { "n": 16, "fulfilment": "needs_attention", "payment": "paid",           "daysAgo": 11, "parent": "Sina Faleolo",                 "student": "Talia Faleolo",               "year": "7",  "roll": "7A",  "lines": [["rvra-summer-dress","Size 6–14","6",1]], "holdReason": "Size 6 summer dress not available" },
        { "n": 17, "fulfilment": "needs_attention", "payment": "paid",           "daysAgo": 12, "parent": "Marcus Wright",                "student": "Sophia Wright",               "year": "10", "roll": "10C", "lines": [["rvra-house-bradman","Sizes S–XL","XL",1]], "holdReason": "House shirt XL on backorder" },
        { "n": 18, "fulfilment": "to_prepare", "payment": "pending",             "daysAgo": 1,  "parent": "Kevin Lee",                    "student": "Joshua Lee",                  "year": "8",  "roll": "8B",  "lines": [["rvra-polo-ss","Size 6–14","10",1]] },
        { "n": 19, "fulfilment": "to_prepare", "payment": "pending",             "daysAgo": 2,  "parent": "Rachel Cohen",                 "student": "Maya Cohen",                  "year": "9",  "roll": "9A",  "lines": [["rvra-trousers","Size 8–16","10",1]] },
        { "n": 20, "fulfilment": "to_prepare", "payment": "pending",             "daysAgo": 3,  "parent": "Vinh Tran",                    "student": "Khanh Tran",                  "year": "7",  "roll": "7B",  "lines": [["rvra-hat","One size","One size",2]] },
        { "n": 21, "fulfilment": "to_prepare", "payment": "pending",             "daysAgo": 4,  "parent": "Olga Petrova",                 "student": "Anastasia Petrova",           "year": "10", "roll": "10A", "lines": [["rvra-summer-dress","Size 6–14","12",1]] },
        { "n": 22, "fulfilment": "completed",  "payment": "paid",                "daysAgo": 6,  "parent": "Ahmed Hassan",                 "student": "Karim Hassan",                "year": "11", "roll": "11B", "lines": [["rvra-jumper","Size 8–16","14",1]] },
        { "n": 23, "fulfilment": "completed",  "payment": "paid",                "daysAgo": 8,  "parent": "Grace O'Brien",                "student": "Patrick O'Brien",             "year": "8",  "roll": "8C",  "lines": [["rvra-polo-ls","Size 6–14","10",2]] },
        { "n": 24, "fulfilment": "completed",  "payment": "paid",                "daysAgo": 10, "parent": "Yuki Sato",                    "student": "Ren Sato",                    "year": "9",  "roll": "9B",  "lines": [["rvra-trousers","Size 8–16","12",1],["rvra-tie","One size","One size",1]] },
        { "n": 25, "fulfilment": "completed",  "payment": "paid",                "daysAgo": 12, "parent": "Carlos Mendoza",               "student": "Diego Mendoza",               "year": "7",  "roll": "7A",  "lines": [["rvra-polo-ss","Size 6–14","8",2],["rvra-shorts-sport","Sizes S–XL","S",1]] },
        { "n": 26, "fulfilment": "completed",  "payment": "paid",                "daysAgo": 14, "parent": "Sienna Brooks",                "student": "Hudson Brooks",               "year": "10", "roll": "10B", "lines": [["rvra-house-pharlap","Sizes S–XL","M",1]] },
        { "n": 27, "fulfilment": "completed",  "payment": "paid",                "daysAgo": 16, "parent": "Mateo Silva",                  "student": "Isabella Silva",              "year": "8",  "roll": "8A",  "lines": [["rvra-summer-dress","Size 6–14","10",1]] },
        { "n": 28, "fulfilment": "completed",  "payment": "paid",                "daysAgo": 18, "parent": "Naledi Mokoena",               "student": "Thandi Mokoena",              "year": "11", "roll": "11A", "lines": [["rvra-jumper","Size 8–16","14",1],["rvra-polo-ls","Size 6–14","14",1]] },
        { "n": 29, "fulfilment": "completed",  "payment": "paid",                "daysAgo": 20, "parent": "Aaliyah Khan",                 "student": "Zayan Khan",                  "year": "7",  "roll": "7C",  "lines": [["rvra-polo-ss","Size 6–14","8",1],["rvra-hat","One size","One size",1]] },
        { "n": 30, "fulfilment": "completed",  "payment": "paid",                "daysAgo": 22, "parent": "Sophie Bernard",               "student": "Léo Bernard",                 "year": "9",  "roll": "9C",  "lines": [["rvra-trousers","Size 8–16","10",1]] },
        { "n": 31, "fulfilment": "completed",  "payment": "paid",                "daysAgo": 25, "parent": "Reuben Davis",                 "student": "Eliza Davis",                 "year": "10", "roll": "10C", "lines": [["rvra-summer-dress","Size 6–14","14",1],["rvra-hat","One size","One size",1]] },
        { "n": 32, "fulfilment": "completed",  "payment": "paid",                "daysAgo": 32, "parent": "Anaya Patel",                  "student": "Vihaan Patel",                "year": "8",  "roll": "8B",  "lines": [["rvra-jumper","Size 8–16","10",1]] },
        { "n": 33, "fulfilment": "completed",  "payment": "paid",                "daysAgo": 38, "parent": "Connor Murphy",                "student": "Saoirse Murphy",              "year": "9",  "roll": "9A",  "lines": [["rvra-polo-ls","Size 6–14","12",2]] },
        { "n": 34, "fulfilment": "completed",  "payment": "paid",                "daysAgo": 42, "parent": "Wendy Chen",                   "student": "Lucas Chen",                  "year": "7",  "roll": "7B",  "lines": [["rvra-polo-ss","Size 6–14","8",1]] },
        { "n": 35, "fulfilment": "completed",  "payment": "paid",                "daysAgo": 48, "parent": "Tomás Fernández",              "student": "Camila Fernández",            "year": "11", "roll": "11C", "lines": [["rvra-house-bradman","Sizes S–XL","S",1],["rvra-shorts-sport","Sizes S–XL","S",1]] },
        { "n": 36, "fulfilment": "completed",  "payment": "paid",                "daysAgo": 52, "parent": "Beatrice Holloway",            "student": "Theodore Holloway",           "year": "10", "roll": "10A", "lines": [["rvra-trousers","Size 8–16","12",1],["rvra-tie","One size","One size",1]] },
        { "n": 37, "fulfilment": "completed",  "payment": "paid",                "daysAgo": 58, "parent": "Hiroshi Yamamoto",             "student": "Akira Yamamoto",              "year": "8",  "roll": "8C",  "lines": [["rvra-summer-dress","Size 6–14","8",1]] },
        { "n": 38, "fulfilment": "completed",  "payment": "partially_refunded",  "daysAgo": 11, "parent": "Layla Ibrahim",                "student": "Zara Ibrahim",                "year": "9",  "roll": "9B",  "lines": [["rvra-jumper","Size 8–16","12",1],["rvra-polo-ss","Size 6–14","12",2]], "refund": { "amount": "34.00", "reason": "Polo shirt returned — wrong size, exchanged for size 14 in-store", "lineIndex": 1 } },
        { "n": 39, "fulfilment": "completed",  "payment": "partially_refunded",  "daysAgo": 19, "parent": "Patrick O'Sullivan",           "student": "Niamh O'Sullivan",            "year": "10", "roll": "10B", "lines": [["rvra-house-pharlap","Sizes S–XL","M",1],["rvra-shorts-sport","Sizes S–XL","M",1]], "refund": { "amount": "28.00", "reason": "Sports shorts had stitching defect — refunded, replacement to be issued", "lineIndex": 1 } },
        { "n": 40, "fulfilment": "completed",  "payment": "refunded",            "daysAgo": 28, "parent": "Erika Schmidt",                "student": "Felix Schmidt",               "year": "8",  "roll": "8A",  "lines": [["rvra-summer-dress","Size 6–14","10",1]], "refund": { "amount": "68.00", "reason": "Family withdrew — full refund processed", "lineIndex": 0 } }
      ]
    }
  ]
}
```

(Note: numeric prices are JSON strings to match Drizzle `numeric()` columns. The seed script applies GST = subtotal / 11 at runtime, so totals are computed not hardcoded.)

- [ ] **Step 2: Validate JSON parses**

Run: `node -e "JSON.parse(require('fs').readFileSync('GTM/demo_data/fixtures/demo-scenarios.json','utf8')); console.log('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add GTM/demo_data/fixtures/demo-scenarios.json
git commit -m "feat(gtm): add demo scenario fixtures (2 tenants, 40 orders)"
```

---

## Task 3: Add `tsx` to apps/web devDependencies

**Files:**
- Modify: `apps/web/package.json` (devDependencies section)

`tsx` is needed to run the seed and cleanup scripts. The repo doesn't have it today.

- [ ] **Step 1: Add tsx**

Run: `pnpm --filter web add -D tsx`

- [ ] **Step 2: Verify it landed**

Run: `grep -A1 '"tsx"' apps/web/package.json`
Expected: a `"tsx": "^X.Y.Z"` line under devDependencies.

- [ ] **Step 3: Verify lockfile updated**

Run: `git diff --stat pnpm-lock.yaml apps/web/package.json`
Expected: both files show changes.

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(deps): add tsx for demo seed scripts"
```

---

## Task 4: Write seed script — header, flag parsing, safety guards

**Files:**
- Create: `GTM/demo_data/seed-demo.ts`

This task creates the script up to the point where it has parsed flags and validated the environment. No DB calls yet.

- [ ] **Step 1: Create the seed script with header + guards**

Write `GTM/demo_data/seed-demo.ts`:

```ts
/**
 * GTM demo seed script
 *
 * Idempotent. Seeds two isolated demo tenants (demo-blank, demo-academy).
 * Production tenants (nsbh, rgsh) are never touched.
 *
 * Run via:
 *   pnpm --filter web demo:seed:dry   # dry-run, no writes
 *   pnpm --filter web demo:seed       # actual seed
 *
 * See GTM/demo_data/README.md and GTM/demo_data/operator_run_guide.md.
 */
import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";

import * as schema from "../../apps/web/src/db/schema";

const DEMO_TENANT_IDS = ["demo-blank", "demo-academy"] as const;
type DemoTenantId = (typeof DEMO_TENANT_IDS)[number];

type Flags = {
  dryRun: boolean;
  reset: boolean;
  allowRemote: boolean;
  iKnowWhatImDoing: boolean;
  only: DemoTenantId | "blank" | "academy" | undefined;
};

function parseFlags(): Flags {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
      reset: { type: "boolean", default: false },
      "allow-remote": { type: "boolean", default: false },
      "i-know-what-im-doing": { type: "boolean", default: false },
      only: { type: "string" },
    },
  });
  return {
    dryRun: Boolean(values["dry-run"]),
    reset: Boolean(values.reset),
    allowRemote: Boolean(values["allow-remote"]),
    iKnowWhatImDoing: Boolean(values["i-know-what-im-doing"]),
    only: values.only as Flags["only"],
  };
}

const PROD_HOST_PATTERNS = ["prod", "production", "super-cell-03401356"];

function abortWithGuard(reason: string, remediation: string): never {
  console.error(`\n✗ SAFETY GUARD TRIPPED: ${reason}`);
  console.error(`  Remediation: ${remediation}`);
  console.error(`  Run aborted; no DB connection attempted.\n`);
  process.exit(1);
}

function checkSafety(databaseUrl: string, flags: Flags) {
  let host = "";
  try {
    host = new URL(databaseUrl).host;
  } catch {
    abortWithGuard(
      "DATABASE_URL is not a valid URL",
      "Set DATABASE_URL in GTM/demo_data/.env.demo to a postgres connection string."
    );
  }

  const isLocal = host.includes("localhost") || host.startsWith("127.0.0.1");
  if (!isLocal && !flags.allowRemote) {
    abortWithGuard(
      `DATABASE_URL host '${host}' is not localhost`,
      "Pass --allow-remote to seed a remote DB. Recommended only for ephemeral dev branches."
    );
  }

  const matchesProd = PROD_HOST_PATTERNS.some((p) => host.includes(p));
  if (matchesProd && !flags.iKnowWhatImDoing) {
    abortWithGuard(
      `DATABASE_URL host '${host}' matches prod pattern`,
      "This seed must never run against production. If you are absolutely certain, pass --i-know-what-im-doing."
    );
  }

  if (process.env.NODE_ENV === "production" && !flags.iKnowWhatImDoing) {
    abortWithGuard(
      "NODE_ENV is set to 'production'",
      "Unset NODE_ENV or set it to 'development' before running the seed. If you really mean it, pass --i-know-what-im-doing."
    );
  }
}

async function main() {
  const flags = parseFlags();
  console.log("─".repeat(60));
  console.log("UniformOrder demo seed");
  console.log(`  dryRun:           ${flags.dryRun}`);
  console.log(`  reset:            ${flags.reset}`);
  console.log(`  allowRemote:      ${flags.allowRemote}`);
  console.log(`  only:             ${flags.only ?? "all"}`);
  console.log("─".repeat(60));

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    abortWithGuard(
      "DATABASE_URL is not set",
      "Copy GTM/demo_data/.env.demo.example to GTM/demo_data/.env.demo and fill DATABASE_URL."
    );
  }
  checkSafety(databaseUrl, flags);

  console.log("✓ Safety guards passed.");
  console.log(`  (Stopping early — DB write logic added in Task 5+.)`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Smoke-test the script can be loaded by tsx**

Run from repo root: `cd apps/web && pnpm exec tsx --help >/dev/null && echo "tsx OK"`
Expected: `tsx OK`

- [ ] **Step 3: Smoke-test the safety guard fires when DATABASE_URL is unset**

Run: `cd apps/web && pnpm exec tsx ../../GTM/demo_data/seed-demo.ts --dry-run`
Expected: exit code 1, message containing `SAFETY GUARD TRIPPED: DATABASE_URL is not set`.

- [ ] **Step 4: Commit**

```bash
git add GTM/demo_data/seed-demo.ts
git commit -m "feat(gtm): seed script header + safety guards"
```

---

## Task 5: Seed script — fixture loading + tenant/settings/legal upserts

**Files:**
- Modify: `GTM/demo_data/seed-demo.ts`

This task adds tenant, settings, and legal-version writes. It does **not** yet add catalog or orders.

- [ ] **Step 1: Add fixture types and loader near the top of the file**

Insert after the `const PROD_HOST_PATTERNS` line:

```ts
// ─── Fixture types ───────────────────────────────────────────────────────────
type FixtureVariant = { label: string; price: string; sizes: string[] };
type FixtureCatalogItem = {
  id: string;
  name: string;
  category: string;
  description?: string;
  variants: FixtureVariant[];
};
type FixtureLegal = {
  policyMode: "text" | "url";
  policyText?: string;
  policyUrl?: string;
  aclAcknowledged: boolean;
  sellerOfRecordAcknowledged: boolean;
  declarantName: string;
  declarantRole: string;
};
type FixtureSettings = {
  workflowMode: "standard" | "simple";
  pickupEnabled: boolean;
  shippingEnabled: boolean;
};
type FixtureOrder = {
  n: number;
  fulfilment: "to_prepare" | "ready" | "needs_attention" | "completed";
  payment: "pending" | "paid" | "partially_refunded" | "refunded";
  daysAgo: number;
  parent: string;
  student: string;
  year: string;
  roll: string;
  lines: Array<[string, string, string, number]>; // [itemId, variantLabel, size, qty]
  holdReason?: string;
  refund?: { amount: string; reason: string; lineIndex: number };
};
type FixtureTenant = {
  id: DemoTenantId;
  name: string;
  short: string;
  accent: string;
  motto: string;
  address: string;
  shopHours: string;
  shopEmail: string;
  timezone: string;
  isPubliclyListed: boolean;
  stripeAccountId: string;
  stripeChargesEnabled: boolean;
  stripePayoutsEnabled: boolean;
  platformApprovalStatus: string;
  orderIdPrefix: string;
  settings: FixtureSettings;
  legal: FixtureLegal;
  catalog: FixtureCatalogItem[];
  orders: FixtureOrder[];
};
type Fixture = { tenants: FixtureTenant[] };

function loadFixture(): Fixture {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const path = resolve(__dirname, "fixtures/demo-scenarios.json");
  return JSON.parse(readFileSync(path, "utf8")) as Fixture;
}
```

- [ ] **Step 2: Replace `main()` with the version that writes tenants/settings/legal**

Replace the entire `async function main()` block with:

```ts
async function main() {
  const flags = parseFlags();
  console.log("─".repeat(60));
  console.log("UniformOrder demo seed");
  console.log(`  dryRun:           ${flags.dryRun}`);
  console.log(`  reset:            ${flags.reset}`);
  console.log(`  allowRemote:      ${flags.allowRemote}`);
  console.log(`  only:             ${flags.only ?? "all"}`);
  console.log("─".repeat(60));

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    abortWithGuard(
      "DATABASE_URL is not set",
      "Copy GTM/demo_data/.env.demo.example to GTM/demo_data/.env.demo and fill DATABASE_URL."
    );
  }
  checkSafety(databaseUrl, flags);
  console.log("✓ Safety guards passed.");

  const fixture = loadFixture();
  const wantedTenants = fixture.tenants.filter((t) => {
    if (!flags.only) return true;
    if (flags.only === "blank") return t.id === "demo-blank";
    if (flags.only === "academy") return t.id === "demo-academy";
    return t.id === flags.only;
  });

  if (flags.dryRun) {
    console.log("\n[DRY RUN] Would seed:");
    for (const t of wantedTenants) {
      console.log(`  tenant ${t.id} — ${t.catalog.length} items, ${t.orders.length} orders`);
    }
    console.log("\n[DRY RUN] No DB connection opened.");
    return;
  }

  const sqlClient = neon(databaseUrl);
  const db = drizzle(sqlClient, { schema });

  for (const t of wantedTenants) {
    console.log(`\n→ Seeding tenant ${t.id} (${t.name})`);
    await seedTenant(db, t, flags);
  }

  console.log("\n✓ Seed complete.");
}
```

- [ ] **Step 3: Add `seedTenant` covering tenant row, settings, legal**

Insert before `async function main()`:

```ts
type Db = ReturnType<typeof drizzle<typeof schema>>;

async function seedTenant(db: Db, t: FixtureTenant, flags: Flags) {
  // Tenant upsert
  await db
    .insert(schema.tenants)
    .values({
      id: t.id,
      name: t.name,
      short: t.short,
      accent: t.accent,
      motto: t.motto,
      address: t.address,
      shopHours: t.shopHours,
      shopEmail: t.shopEmail,
      timezone: t.timezone,
      isPubliclyListed: t.isPubliclyListed,
      stripeAccountId: t.stripeAccountId,
      stripeChargesEnabled: t.stripeChargesEnabled,
      stripePayoutsEnabled: t.stripePayoutsEnabled,
      platformApprovalStatus: t.platformApprovalStatus,
      platformApprovedAt: new Date(),
      platformApprovedBy: "demo-seed",
    })
    .onConflictDoUpdate({
      target: schema.tenants.id,
      set: {
        name: t.name,
        short: t.short,
        accent: t.accent,
        motto: t.motto,
        address: t.address,
        shopHours: t.shopHours,
        shopEmail: t.shopEmail,
        timezone: t.timezone,
        isPubliclyListed: t.isPubliclyListed,
        stripeAccountId: t.stripeAccountId,
        stripeChargesEnabled: t.stripeChargesEnabled,
        stripePayoutsEnabled: t.stripePayoutsEnabled,
        platformApprovalStatus: t.platformApprovalStatus,
        updatedAt: new Date(),
      },
    });
  console.log(`  ✓ tenant row`);

  // Settings upsert
  await db
    .insert(schema.tenantSettings)
    .values({
      tenantId: t.id,
      workflowMode: t.settings.workflowMode,
      pickupEnabled: t.settings.pickupEnabled,
      shippingEnabled: t.settings.shippingEnabled,
    })
    .onConflictDoUpdate({
      target: schema.tenantSettings.tenantId,
      set: {
        workflowMode: t.settings.workflowMode,
        pickupEnabled: t.settings.pickupEnabled,
        shippingEnabled: t.settings.shippingEnabled,
        updatedAt: new Date(),
      },
    });
  console.log(`  ✓ tenant settings`);

  // Legal version: insert if not exists for (tenantId, version=1)
  const existing = await db
    .select({ id: schema.tenantLegalVersions.id })
    .from(schema.tenantLegalVersions)
    .where(eq(schema.tenantLegalVersions.tenantId, t.id))
    .limit(1);

  let legalVersionId: string;
  if (existing.length > 0) {
    legalVersionId = existing[0].id;
  } else {
    const [inserted] = await db
      .insert(schema.tenantLegalVersions)
      .values({
        tenantId: t.id,
        version: 1,
        policyMode: t.legal.policyMode,
        policyText: t.legal.policyText ?? null,
        policyUrl: t.legal.policyUrl ?? null,
        aclAcknowledged: t.legal.aclAcknowledged,
        sellerOfRecordAcknowledged: t.legal.sellerOfRecordAcknowledged,
        declarantName: t.legal.declarantName,
        declarantRole: t.legal.declarantRole,
        enteredByUserId: "00000000-0000-0000-0000-000000000000",
        enteredByEmail: "demo-seed@uniformorder.online",
      })
      .returning({ id: schema.tenantLegalVersions.id });
    legalVersionId = inserted.id;
  }

  // Link tenant → current legal version
  await db
    .update(schema.tenants)
    .set({ currentLegalVersionId: legalVersionId })
    .where(eq(schema.tenants.id, t.id));
  console.log(`  ✓ legal version (id ${legalVersionId.slice(0, 8)}…)`);

  // Catalog/orders deferred to Task 6/7
  void flags;
}
```

- [ ] **Step 4: Type-check the seed file in isolation**

Run: `cd apps/web && pnpm exec tsc --noEmit --target ES2022 --module esnext --moduleResolution bundler --strict --skipLibCheck --esModuleInterop ../../GTM/demo_data/seed-demo.ts 2>&1 | head -30`
Expected: zero output (clean). If errors appear, fix them inline before commit.

- [ ] **Step 5: Dry-run smoke test (without DB)**

Set `DATABASE_URL=postgresql://test@localhost/test` temporarily:
```bash
cd apps/web && DATABASE_URL='postgresql://test@localhost:5432/test' pnpm exec tsx ../../GTM/demo_data/seed-demo.ts --dry-run
```
Expected: output ends with `[DRY RUN] No DB connection opened.` and lists both tenants.

- [ ] **Step 6: Commit**

```bash
git add GTM/demo_data/seed-demo.ts
git commit -m "feat(gtm): seed tenant rows, settings, and legal version"
```

---

## Task 6: Seed script — catalog items + variants

**Files:**
- Modify: `GTM/demo_data/seed-demo.ts`

- [ ] **Step 1: Add `seedCatalog` helper**

Insert immediately before `async function main()`:

```ts
async function seedCatalog(db: Db, t: FixtureTenant) {
  let sortOrder = 0;
  for (const item of t.catalog) {
    await db
      .insert(schema.catalogItems)
      .values({
        id: item.id,
        tenantId: t.id,
        name: item.name,
        category: item.category,
        description: item.description ?? null,
        active: true,
        sortOrder: sortOrder++,
      })
      .onConflictDoUpdate({
        target: schema.catalogItems.id,
        set: {
          name: item.name,
          category: item.category,
          description: item.description ?? null,
          active: true,
          sortOrder: sortOrder - 1,
          updatedAt: new Date(),
        },
      });

    // Variants: delete-then-insert (no natural key)
    await db.delete(schema.catalogVariants).where(eq(schema.catalogVariants.itemId, item.id));
    if (item.variants.length > 0) {
      await db.insert(schema.catalogVariants).values(
        item.variants.map((v) => ({
          itemId: item.id,
          label: v.label,
          price: v.price,
          sizes: v.sizes,
          active: true,
        }))
      );
    }
  }
  console.log(`  ✓ catalog (${t.catalog.length} items)`);
}
```

- [ ] **Step 2: Call `seedCatalog` from `seedTenant`**

In `seedTenant`, replace the line `void flags;` with:

```ts
  await seedCatalog(db, t);
  if (t.orders.length > 0) {
    // Order seeding added in Task 7
  }
  void flags;
```

- [ ] **Step 3: Type-check**

Run: `pnpm check-types:web`
Expected: no errors related to `GTM/demo_data/seed-demo.ts`. (If the file is outside the tsconfig include and isn't checked, that's expected — tsx will catch issues at runtime.)

- [ ] **Step 4: Dry-run still works**

Run: `cd apps/web && DATABASE_URL='postgresql://test@localhost:5432/test' pnpm exec tsx ../../GTM/demo_data/seed-demo.ts --dry-run`
Expected: clean dry-run output, two tenants listed.

- [ ] **Step 5: Commit**

```bash
git add GTM/demo_data/seed-demo.ts
git commit -m "feat(gtm): seed catalog items and variants"
```

---

## Task 7: Seed script — orders, lines, events, notifications, refunds

**Files:**
- Modify: `GTM/demo_data/seed-demo.ts`

- [ ] **Step 1: Add price lookup + GST helper**

Insert immediately before `async function seedCatalog`:

```ts
function lookupPrice(t: FixtureTenant, itemId: string, variantLabel: string): number {
  const item = t.catalog.find((i) => i.id === itemId);
  if (!item) throw new Error(`Fixture refers to unknown item ${itemId} in tenant ${t.id}`);
  const variant = item.variants.find((v) => v.label === variantLabel);
  if (!variant) throw new Error(`Fixture refers to unknown variant '${variantLabel}' on ${itemId}`);
  return Number(variant.price);
}

function itemName(t: FixtureTenant, itemId: string): string {
  const item = t.catalog.find((i) => i.id === itemId);
  return item?.name ?? itemId;
}

function pad(n: number, width: number): string {
  return n.toString().padStart(width, "0");
}

function money(n: number): string {
  return n.toFixed(2);
}

const GST_DIVISOR = 11;
```

- [ ] **Step 2: Add `seedOrders` helper**

Insert immediately before `async function main()`:

```ts
async function seedOrders(db: Db, t: FixtureTenant) {
  // Delete existing demo orders for this tenant (cascade clears lines/events/notifications/refunds)
  const existing = await db
    .select({ id: schema.orders.id })
    .from(schema.orders)
    .where(eq(schema.orders.tenantId, t.id));
  if (existing.length > 0) {
    await db.delete(schema.orders).where(eq(schema.orders.tenantId, t.id));
  }

  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  for (const o of t.orders) {
    const orderId = `${t.orderIdPrefix}-${pad(o.n, 5)}`;
    const createdAt = new Date(now - o.daysAgo * oneDay);

    // Compute totals
    let subtotal = 0;
    const lineRows = o.lines.map(([itemId, variantLabel, size, qty]) => {
      const unit = lookupPrice(t, itemId, variantLabel);
      const lineTotal = unit * qty;
      subtotal += lineTotal;
      return {
        orderId,
        itemId,
        itemName: itemName(t, itemId),
        variantLabel,
        size,
        qty,
        unitPrice: money(unit),
        lineTotal: money(lineTotal),
      };
    });
    const total = subtotal; // GST-inclusive convention
    const gst = subtotal / GST_DIVISOR;

    // Build order row
    const refundedCents = o.refund ? Math.round(Number(o.refund.amount) * 100) : 0;

    const readyAt =
      o.fulfilment === "ready" || o.fulfilment === "completed"
        ? new Date(createdAt.getTime() + 1 * oneDay)
        : null;
    const completedAt =
      o.fulfilment === "completed"
        ? new Date(createdAt.getTime() + 2 * oneDay)
        : null;

    await db.insert(schema.orders).values({
      id: orderId,
      tenantId: t.id,
      parentName: o.parent,
      parentEmail: "parent@demo.uniformorder.online",
      parentMobile: "+61400000000",
      studentName: o.student,
      studentYear: o.year,
      studentRoll: o.roll,
      fulfilmentMethod: "pickup",
      fulfilmentStatus: o.fulfilment,
      completionType: o.fulfilment === "completed" ? "collected" : null,
      deliveryFee: "0",
      subtotal: money(subtotal),
      gst: money(gst),
      total: money(total),
      refundedAmountCents: refundedCents,
      stripePaymentIntentId: `pi_demo_${orderId}`,
      stripeRef: `ch_demo_${orderId}`,
      paymentStatus: o.payment,
      refundPolicyAcceptedAt: createdAt,
      readyAt,
      completedAt,
      createdAt,
      updatedAt: completedAt ?? readyAt ?? createdAt,
    });

    // Lines — capture IDs in insertion order so refund linking is deterministic
    let insertedLineIds: string[] = [];
    if (lineRows.length > 0) {
      const inserted = await db
        .insert(schema.orderLines)
        .values(lineRows)
        .returning({ id: schema.orderLines.id });
      insertedLineIds = inserted.map((r) => r.id);
    }

    // Events
    const events: Array<typeof schema.orderEvents.$inferInsert> = [];
    if (o.payment === "paid" || o.payment === "partially_refunded" || o.payment === "refunded") {
      events.push({
        orderId,
        tenantId: t.id,
        eventType: "order_paid",
        createdAt,
      });
    }
    if (o.fulfilment === "ready" || o.fulfilment === "completed") {
      events.push({
        orderId,
        tenantId: t.id,
        eventType: "status_changed",
        fromStatus: "to_prepare",
        toStatus: "ready",
        createdAt: readyAt!,
      });
      events.push({
        orderId,
        tenantId: t.id,
        eventType: "ready_email_sent",
        createdAt: readyAt!,
      });
    }
    if (o.fulfilment === "completed") {
      events.push({
        orderId,
        tenantId: t.id,
        eventType: "status_changed",
        fromStatus: "ready",
        toStatus: "completed",
        createdAt: completedAt!,
      });
    }
    if (o.fulfilment === "needs_attention") {
      events.push({
        orderId,
        tenantId: t.id,
        eventType: "status_changed",
        fromStatus: "to_prepare",
        toStatus: "needs_attention",
        reason: o.holdReason ?? null,
        createdAt: new Date(createdAt.getTime() + oneDay),
      });
      events.push({
        orderId,
        tenantId: t.id,
        eventType: "hold_email_sent",
        createdAt: new Date(createdAt.getTime() + oneDay),
      });
    }
    if (o.refund) {
      events.push({
        orderId,
        tenantId: t.id,
        eventType: "refund_created",
        reason: o.refund.reason,
        createdAt: new Date((completedAt ?? createdAt).getTime() + oneDay),
      });
    }
    if (events.length > 0) {
      await db.insert(schema.orderEvents).values(events);
    }

    // Notification events
    const notifs: Array<typeof schema.orderNotificationEvents.$inferInsert> = [];
    if (o.fulfilment === "ready" || o.fulfilment === "completed") {
      notifs.push({
        orderId,
        tenantId: t.id,
        type: "ready",
        status: "sent",
        recipientEmail: "parent@demo.uniformorder.online",
        providerMessageId: `msg_demo_${orderId}_ready`,
        idempotencyKey: `demo_${orderId}_ready`,
        triggeredBy: "system",
        sentAt: readyAt,
      });
    }
    if (o.fulfilment === "needs_attention") {
      notifs.push({
        orderId,
        tenantId: t.id,
        type: "hold",
        status: "sent",
        recipientEmail: "parent@demo.uniformorder.online",
        providerMessageId: `msg_demo_${orderId}_hold`,
        idempotencyKey: `demo_${orderId}_hold`,
        triggeredBy: "system",
        sentAt: new Date(createdAt.getTime() + oneDay),
      });
    }
    if (o.refund) {
      notifs.push({
        orderId,
        tenantId: t.id,
        type: "refund",
        status: "sent",
        recipientEmail: "parent@demo.uniformorder.online",
        providerMessageId: `msg_demo_${orderId}_refund`,
        idempotencyKey: `demo_${orderId}_refund`,
        triggeredBy: "system",
        sentAt: new Date((completedAt ?? createdAt).getTime() + oneDay),
      });
    }
    if (notifs.length > 0) {
      await db.insert(schema.orderNotificationEvents).values(notifs);
    }

    // Refunds — link to the captured line ID at the fixture-specified index
    if (o.refund) {
      const targetLineId = insertedLineIds[o.refund.lineIndex] ?? null;
      await db.insert(schema.orderRefunds).values({
        orderId,
        lineId: targetLineId,
        amount: o.refund.amount,
        reason: o.refund.reason,
        stripeRefundId: `re_demo_${orderId}_001`,
        createdAt: new Date((completedAt ?? createdAt).getTime() + oneDay),
      });
    }
  }
  console.log(`  ✓ orders (${t.orders.length})`);
}
```

- [ ] **Step 2: Call `seedOrders` from `seedTenant`**

In `seedTenant`, replace the block:
```ts
  if (t.orders.length > 0) {
    // Order seeding added in Task 7
  }
  void flags;
```
With:
```ts
  if (t.orders.length > 0) {
    await seedOrders(db, t);
  }
```

- [ ] **Step 3: Dry-run still works**

Run: `cd apps/web && DATABASE_URL='postgresql://test@localhost:5432/test' pnpm exec tsx ../../GTM/demo_data/seed-demo.ts --dry-run`
Expected: dry-run output unchanged (lists 2 tenants, no DB connection).

- [ ] **Step 4: Commit**

```bash
git add GTM/demo_data/seed-demo.ts
git commit -m "feat(gtm): seed orders, lines, events, notifications, refunds"
```

---

## Task 8: Cleanup script

**Files:**
- Create: `GTM/demo_data/cleanup-demo.ts`

- [ ] **Step 1: Write the cleanup script**

Create `GTM/demo_data/cleanup-demo.ts`:

```ts
/**
 * GTM demo cleanup script
 *
 * Deletes only rows scoped to demo tenants (demo-blank, demo-academy).
 * Production tenants are never touched.
 *
 * Always prints a plan first. Requires --confirm to execute.
 */
import { parseArgs } from "node:util";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";

import * as schema from "../../apps/web/src/db/schema";

const DEMO_TENANT_IDS = ["demo-blank", "demo-academy"] as const;
const PROD_HOST_PATTERNS = ["prod", "production", "super-cell-03401356"];

function parseFlags() {
  const { values } = parseArgs({
    options: {
      confirm: { type: "boolean", default: false },
      "allow-remote": { type: "boolean", default: false },
      "i-know-what-im-doing": { type: "boolean", default: false },
    },
  });
  return {
    confirm: Boolean(values.confirm),
    allowRemote: Boolean(values["allow-remote"]),
    iKnowWhatImDoing: Boolean(values["i-know-what-im-doing"]),
  };
}

function abortWithGuard(reason: string, remediation: string): never {
  console.error(`\n✗ SAFETY GUARD TRIPPED: ${reason}`);
  console.error(`  Remediation: ${remediation}\n`);
  process.exit(1);
}

function checkSafety(databaseUrl: string, flags: ReturnType<typeof parseFlags>) {
  let host = "";
  try {
    host = new URL(databaseUrl).host;
  } catch {
    abortWithGuard("DATABASE_URL is not a valid URL", "Set DATABASE_URL in GTM/demo_data/.env.demo.");
  }
  const isLocal = host.includes("localhost") || host.startsWith("127.0.0.1");
  if (!isLocal && !flags.allowRemote) {
    abortWithGuard(
      `DATABASE_URL host '${host}' is not localhost`,
      "Pass --allow-remote to clean a remote DB. Strongly discouraged."
    );
  }
  const matchesProd = PROD_HOST_PATTERNS.some((p) => host.includes(p));
  if (matchesProd && !flags.iKnowWhatImDoing) {
    abortWithGuard(
      `DATABASE_URL host '${host}' matches prod pattern`,
      "Cleanup must never run against production. If you are absolutely certain, pass --i-know-what-im-doing."
    );
  }
  if (process.env.NODE_ENV === "production" && !flags.iKnowWhatImDoing) {
    abortWithGuard("NODE_ENV is 'production'", "Unset or pass --i-know-what-im-doing.");
  }
}

async function main() {
  const flags = parseFlags();
  console.log("─".repeat(60));
  console.log("UniformOrder demo cleanup");
  console.log(`  confirm:          ${flags.confirm}`);
  console.log(`  tenants targeted: ${DEMO_TENANT_IDS.join(", ")}`);
  console.log("─".repeat(60));

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) abortWithGuard("DATABASE_URL not set", "See .env.demo.example.");
  checkSafety(databaseUrl, flags);

  const sqlClient = neon(databaseUrl);
  const db = drizzle(sqlClient, { schema });

  // Count what would be deleted (per-tenant)
  console.log("\nDeletion plan:");
  for (const tenantId of DEMO_TENANT_IDS) {
    const orders = await db
      .select({ id: schema.orders.id })
      .from(schema.orders)
      .where(eq(schema.orders.tenantId, tenantId));
    const items = await db
      .select({ id: schema.catalogItems.id })
      .from(schema.catalogItems)
      .where(eq(schema.catalogItems.tenantId, tenantId));
    const legal = await db
      .select({ id: schema.tenantLegalVersions.id })
      .from(schema.tenantLegalVersions)
      .where(eq(schema.tenantLegalVersions.tenantId, tenantId));
    console.log(
      `  ${tenantId}: ${orders.length} orders, ${items.length} catalog items, ${legal.length} legal versions`
    );
  }

  if (!flags.confirm) {
    console.log("\n[PLAN ONLY] Pass --confirm to execute.");
    return;
  }

  console.log("\nExecuting cleanup...");
  for (const tenantId of DEMO_TENANT_IDS) {
    // Null out tenants.currentLegalVersionId so the FK doesn't block legal_versions deletion
    await db
      .update(schema.tenants)
      .set({ currentLegalVersionId: null })
      .where(eq(schema.tenants.id, tenantId));

    // Cascades clean: orders → lines/events/notifications/refunds; catalog → variants
    await db.delete(schema.orders).where(eq(schema.orders.tenantId, tenantId));
    await db.delete(schema.catalogItems).where(eq(schema.catalogItems.tenantId, tenantId));
    await db.delete(schema.tenantLegalVersions).where(eq(schema.tenantLegalVersions.tenantId, tenantId));
    await db.delete(schema.tenantSettings).where(eq(schema.tenantSettings.tenantId, tenantId));
    await db.delete(schema.auditEvents).where(eq(schema.auditEvents.tenantId, tenantId));
    await db.delete(schema.tenants).where(eq(schema.tenants.id, tenantId));
    console.log(`  ✓ ${tenantId} removed`);
  }
  console.log("\n✓ Cleanup complete.");
}

main().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Smoke-test guard fires when DATABASE_URL missing**

Run: `cd apps/web && pnpm exec tsx ../../GTM/demo_data/cleanup-demo.ts`
Expected: exit 1, message about DATABASE_URL not set.

- [ ] **Step 3: Smoke-test plan-only mode**

Run: `cd apps/web && DATABASE_URL='postgresql://test@localhost:5432/test' pnpm exec tsx ../../GTM/demo_data/cleanup-demo.ts 2>&1 | head -10`
Expected: prints plan, mentions `[PLAN ONLY]`, does not error on DB connection (or errors only when actually querying — that's acceptable for this smoke check).

- [ ] **Step 4: Commit**

```bash
git add GTM/demo_data/cleanup-demo.ts
git commit -m "feat(gtm): cleanup script with --confirm gate"
```

---

## Task 9: Wire package.json scripts + .env.demo.example + .gitignore

**Files:**
- Modify: `apps/web/package.json`
- Create: `GTM/demo_data/.env.demo.example`
- Modify: `.gitignore` (repo root)

- [ ] **Step 1: Add demo scripts to apps/web/package.json**

In `apps/web/package.json`, add to the `"scripts"` object (after `"print-qa"`):

```json
    "demo:seed:dry": "tsx --env-file=../../GTM/demo_data/.env.demo ../../GTM/demo_data/seed-demo.ts --dry-run",
    "demo:seed": "tsx --env-file=../../GTM/demo_data/.env.demo ../../GTM/demo_data/seed-demo.ts",
    "demo:cleanup": "tsx --env-file=../../GTM/demo_data/.env.demo ../../GTM/demo_data/cleanup-demo.ts",
    "demo:cleanup:confirm": "tsx --env-file=../../GTM/demo_data/.env.demo ../../GTM/demo_data/cleanup-demo.ts --confirm"
```

- [ ] **Step 2: Create .env.demo.example**

Write `GTM/demo_data/.env.demo.example`:

```
# UniformOrder demo seed environment
# Copy to .env.demo and fill in the values for your local dev DB.
# .env.demo is gitignored — never commit real credentials.

# Required: connection string to your LOCAL Neon dev DB.
# The seed script refuses non-localhost hosts unless --allow-remote is passed.
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/uniformorder_dev

# Demo accounts (must be created manually in Neon Auth UI first — see operator_run_guide.md).
DEMO_OPERATOR_EMAIL=operator@demo.uniformorder.online
DEMO_OPERATOR_PASSWORD=DemoPass123!
DEMO_PARENT_EMAIL=parent@demo.uniformorder.online
DEMO_PARENT_PASSWORD=DemoPass123!
DEMO_PLATFORM_ADMIN_EMAIL=platformadmin@demo.uniformorder.online
DEMO_PLATFORM_ADMIN_PASSWORD=DemoPass123!

# Optional: if set, ~3 demo orders will be attributed to this Neon Auth user UUID
# so the parent portal demo (/orders/[orderId]) shows order history.
# Find this UUID in the Neon Auth dashboard after creating the parent user.
DEMO_PARENT_USER_ID=

# Optional: override the base URL used by Playwright recording.
DEMO_BASE_URL=http://localhost:3000
```

- [ ] **Step 3: Update root .gitignore**

Append to `.gitignore`:

```
# GTM demo assets — generated artifacts and secrets
GTM/product_demo/recordings/output/
GTM/demo_data/.env.demo
*.webm
*.mp4
```

- [ ] **Step 4: Verify scripts surface in pnpm**

Run: `pnpm --filter web run 2>&1 | grep demo`
Expected: lines for `demo:seed:dry`, `demo:seed`, `demo:cleanup`, `demo:cleanup:confirm`.

- [ ] **Step 5: Verify .env.demo would be ignored**

Create a throwaway `GTM/demo_data/.env.demo` (one line, anything):
```bash
echo "TEST=1" > GTM/demo_data/.env.demo
git status --short GTM/demo_data/.env.demo
```
Expected: no output (file is ignored). Clean up: `rm GTM/demo_data/.env.demo`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json GTM/demo_data/.env.demo.example .gitignore
git commit -m "chore(gtm): wire demo:* scripts, env example, gitignore patterns"
```

---

## Task 10: demo_data/README.md

**Files:**
- Create: `GTM/demo_data/README.md`

The README is a quickstart for engineers who have just cloned the repo and want to run a demo. Keep it tight.

- [ ] **Step 1: Write the README**

Write `GTM/demo_data/README.md`:

```markdown
# UniformOrder demo seed — quickstart

Idempotent seed for two isolated demo tenants:

- `demo-blank` — Hawthorn Grammar, empty workspace for live onboarding (Scenario A)
- `demo-academy` — Riverside Academy, ~40 orders across all states (Scenario B)

Production tenants `nsbh` and `rgsh` are never touched.

## Prerequisites

1. Local Neon dev DB up to date with all migrations applied (`apps/web/drizzle/`).
2. Node ≥20.6 (for `--env-file` support).
3. `pnpm install` has been run (adds `tsx`).
4. Three Neon Auth users created manually via the auth UI (one time, per machine):
   - `operator@demo.uniformorder.online`
   - `parent@demo.uniformorder.online`
   - `platformadmin@demo.uniformorder.online` (must also appear in `PLATFORM_ADMIN_EMAILS` env var)

   See `operator_run_guide.md` for the full procedure.

## Setup

```bash
cp GTM/demo_data/.env.demo.example GTM/demo_data/.env.demo
# Edit GTM/demo_data/.env.demo and set DATABASE_URL to your local dev DB
```

`.env.demo` is gitignored.

## Run a dry-run seed

```bash
pnpm --filter web demo:seed:dry
```

Prints the planned operations, opens no DB connection.

## Run the actual seed

```bash
pnpm --filter web demo:seed
```

Idempotent — re-running produces the same end state. Adds `--reset` to wipe existing demo data first:

```bash
pnpm --filter web demo:seed -- --reset
```

Seed only one tenant:

```bash
pnpm --filter web demo:seed -- --only=blank
pnpm --filter web demo:seed -- --only=academy
```

## Verify

After seeding, visit the local dev server:

- `http://localhost:3000/demo-academy` — parent shop with full catalog
- `http://localhost:3000/admin/demo-academy` — operator dashboard, ~40 orders
- `http://localhost:3000/demo-blank` — empty workspace for onboarding scenario

Log in as `operator@demo.uniformorder.online` (password from `.env.demo`) to reach admin routes.

## Clean up

Plan-only (default):

```bash
pnpm --filter web demo:cleanup
```

Execute:

```bash
pnpm --filter web demo:cleanup:confirm
```

Cleanup only touches rows scoped to `demo-blank` and `demo-academy`.

## Safety guards

The seed and cleanup scripts both refuse to run against non-localhost DBs by default and refuse to run against the prod Neon project (`super-cell-03401356`) under any normal circumstances. Override flags exist but are clearly named (`--allow-remote`, `--i-know-what-im-doing`). See `operator_run_guide.md` §Safety.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `DATABASE_URL is not set` | `.env.demo` missing or empty | Copy `.env.demo.example` and fill `DATABASE_URL` |
| `host 'X' is not localhost` | DATABASE_URL points to a remote DB | Use your local Neon dev DB. If you really need remote, pass `--allow-remote`. |
| `host 'X' matches prod pattern` | DATABASE_URL points to prod | Stop. Use a dev DB. |
| Orders FK violation on parent user | `DEMO_PARENT_USER_ID` is set but user doesn't exist in `neon_auth.user` | Create the Neon Auth user first, or clear `DEMO_PARENT_USER_ID`. |
| Cleanup leaves rows behind | Cascade FKs missing on a custom local schema | Re-apply migrations from `apps/web/drizzle/`. |
```

- [ ] **Step 2: Commit**

```bash
git add GTM/demo_data/README.md
git commit -m "docs(gtm): demo_data quickstart README"
```

---

## Task 11: demo_data/operator_run_guide.md

**Files:**
- Create: `GTM/demo_data/operator_run_guide.md`

This is the detailed manual for the human operator (you, the founder) running demos.

- [ ] **Step 1: Write the operator guide**

Write `GTM/demo_data/operator_run_guide.md` with these sections (full prose; this is content, not code — write coherent paragraphs under each heading):

```markdown
# Operator run guide — UniformOrder demo seed

Audience: the person running a live demo (founder, sales engineer). This document covers everything the `README.md` quickstart does not: which tables get touched, what the seeded data looks like, how to verify it visually, how to rotate credentials, and what NOT to do.

## What the seed creates

[Describe in plain prose:]
- 2 tenant rows (`tenants`): `demo-blank` (Hawthorn Grammar), `demo-academy` (Riverside Academy). Both flagged publicly listed + platform-approved. Stripe Connect fields populated with `acct_demo_*` values that are coherent but never used against the real Stripe API.
- 2 tenant settings rows (`tenant_settings`): both `standard` workflow mode, pickup-only.
- 2 legal versions (`tenant_legal_versions`): each tenant's `currentLegalVersionId` points at version 1.
- 16 catalog items total (`catalog_items`): 6 in Hawthorn, 10 in Riverside.
- ~24 catalog variants (`catalog_variants`).
- 40 orders in `demo-academy` (`orders`) with IDs `RVRA-00001` through `RVRA-00040`. 0 orders in `demo-blank`.
- ~70 order lines (`order_lines`).
- ~100 order events (`order_events`): order_paid, status_changed, ready_email_sent, hold_email_sent, refund_created.
- ~30 notification events (`order_notification_events`) with `status='sent'` and `providerMessageId='msg_demo_*'`.
- 3 refunds (`order_refunds`) with `stripeRefundId='re_demo_*'`.

No rows are written to `neon_auth.user` — that schema is owned by Neon Auth and must be populated out-of-band.

## Out-of-band step: create Neon Auth demo users

This is a **one-time setup per machine**. The seed cannot create login users.

1. Visit `http://localhost:3000/auth/sign-up`.
2. Create the three accounts listed in `.env.demo.example`. Use password `DemoPass123!` for all three (or change in `.env.demo`).
3. For the platform-admin account: also add the email to your local `PLATFORM_ADMIN_EMAILS` env var.
4. Optionally: open the Neon dashboard, navigate to the Auth tab, copy the UUID of the parent account, and paste it into `.env.demo` as `DEMO_PARENT_USER_ID`. Re-running the seed will attribute ~3 orders to that user so the parent portal demo shows order history.

These users persist in the Neon Auth database across seed runs. The cleanup script does not delete them (we don't own that schema). To remove them, use the Neon Auth admin UI directly.

## Verifying from the UI

After `pnpm --filter web demo:seed`:

1. `http://localhost:3000/admin/demo-academy` — sign in as operator. Dashboard shows orders summed by status.
2. `http://localhost:3000/admin/demo-academy/orders` — Kanban with columns for to_prepare / ready / completed / needs_attention. Cards bear Unicode parent names (李小明 for parent of student Wei Liu, etc.).
3. `http://localhost:3000/admin/demo-academy/reports` — last 30 days should show ~14 completed orders.
4. `http://localhost:3000/admin/demo-academy/catalog` — 10 items, variants editable.
5. `http://localhost:3000/demo-academy` — parent-facing catalog.
6. `http://localhost:3000/demo-blank/` — clean catalog (6 items, no orders).

## Targeting a remote demo staging DB

Strongly discouraged for routine use; the seed is designed for localhost. If you have a Neon dev branch you want to seed:

```bash
DATABASE_URL='postgresql://...your-branch-host...' \
  pnpm --filter web demo:seed -- --allow-remote
```

This bypasses the localhost guard but still refuses if the host matches any prod pattern. Always run `--dry-run` first.

## What NOT to do

- Never run with the prod `DATABASE_URL` even with `--i-know-what-im-doing`. The flag exists for edge cases (e.g. a misnamed dev branch); the production Neon project is `super-cell-03401356` and is hard-coded into the guard list.
- Never commit `.env.demo` (gitignored, but double-check before pushing).
- Never use the demo accounts for real testing of new features — they're for demo runs only. Use your real dev account.
- Never edit fixture data in `demo-scenarios.json` immediately before a demo. Test the seed first.
- Never run `cleanup` against a DB that has had real customer data seeded into demo tenants. The cleanup is namespace-scoped, but if you mixed real and demo, you'll lose real data.

## Rotating demo passwords

1. Update Neon Auth user passwords via the auth UI.
2. Update `.env.demo` to match.
3. Commit a `.env.demo.example` change if the canonical password changes.

## Regenerating data before a demo

```bash
pnpm --filter web demo:cleanup:confirm
pnpm --filter web demo:seed
```

The seed is deterministic — re-running produces identical names, totals, dates relative to "now". This matters for reproducible recordings.

## Safety guards (full list)

The seed/cleanup scripts abort if:

1. `DATABASE_URL` is unset.
2. Host is not localhost AND `--allow-remote` was not passed.
3. Host matches `{prod, production, super-cell-03401356}` AND `--i-know-what-im-doing` was not passed.
4. `NODE_ENV === 'production'` AND `--i-know-what-im-doing` was not passed.
```

- [ ] **Step 2: Commit**

```bash
git add GTM/demo_data/operator_run_guide.md
git commit -m "docs(gtm): operator run guide with safety + verification"
```

---

## Task 12: product-walkthrough.md

**Files:**
- Create: `GTM/product_demo/product-walkthrough.md`

Investor/buyer narrative. The agent writes coherent prose under each heading using the facts below.

- [ ] **Step 1: Write the walkthrough**

Write `GTM/product_demo/product-walkthrough.md` with these sections. The bullet points are facts that **must** appear; the agent writes connective prose.

```markdown
# UniformOrder — product walkthrough

## 1. The problem

[Prose covering:]
- AU schools currently use paper order forms (sample: `my_doc/UI_prototypes/project/uploads/Uniform_Online_Order_Form.pdf`) or one-off spreadsheets.
- The uniform shop is typically run by a P&C committee or one part-time staffer with limited tooling.
- Pain points: manual reconciliation, lost forms, parents writing cheques, no audit trail, GST tracking done by hand.
- Result: weeks of admin per term, errors compound at the start of each school year.

## 2. The platform

[Prose covering:]
- Multi-tenant SaaS, one tenant per school.
- Parent shop (mobile-first, max 430px) → catalog browse → cart → checkout → confirmation.
- School operator desktop admin → orders Kanban → catalog management → reports.
- Platform console (in design) → tenant approval, oversight.

## 3. Personas

[Brief profile of each:]
- **Platform admin (us):** approves new schools, monitors Stripe Connect, manages billing.
- **School operator:** the P&C volunteer or uniform shop staffer. Fulfils orders, manages catalog, reads reports.
- **Parent:** orders for their child(ren). Returns occasionally; convenience matters more than features.

## 4. End-to-end workflow

[Linear narrative through:]
1. School onboards (platform admin approves; school operator configures branding, refund policy, catalog).
2. Parents browse `/[tenant]`, add to cart, check out via Stripe Connect (school is seller of record).
3. Operator processes Kanban: to_prepare → ready → completed. Prints pick slip, sends ready email.
4. Refunds processed in-app (Stripe Connect refund webhook reconciles).
5. End of month / term: operator exports CSV for P&C reporting and GST/BAS reconciliation.

## 5. Feature deep-dives (with implementation status)

For each feature, label clearly as ✓ implemented, 🚧 planned, or 🚧 not currently implemented.

### Invite-based auth — ✓ implemented
[Brief: Neon Auth, magic-link sign-in for parents, email-based RBAC for operators (`tenants.shopEmail`), platform admin via `PLATFORM_ADMIN_EMAILS` env var. RBAC helpers in `apps/web/src/lib/auth/authorization.ts`.]

### Tenant configuration — ✓ implemented
[Brief: branding (name, accent, motto, logo), legal/refund policy versioning, workflow mode toggle, hours/address/email, Stripe Connect status.]

### Catalog management — ✓ implemented
[Brief: items + variants + sizes JSONB, drag-reorder, per-item size guide, category, image URL, active toggle. Image upload via UploadThing gated on platform approval.]

### Parent ordering — ✓ implemented
[Brief: mobile-first MobileShell, cart in localStorage (`uo:cart:v1`), DB order on payment success, refund policy acknowledgement required at checkout, Stripe Payment Element with Apple/Google Pay.]

### Order management — ✓ implemented
[Brief: Kanban board, transitions with audit events (executeTransition helper), pick slip print, ready/hold/refund emails, refund creation hits Stripe Connect API + records `orderRefunds`.]

### Reports & CSV export — ✓ implemented
[Brief: configurable date range (capped at 30 days for board view; 60 days available in reports), CSV export with GST-inclusive AUD totals.]

### Refund policy versioning — ✓ implemented
[Brief: `tenantLegalVersions` table, version number, ACL acknowledgement, seller-of-record declaration, parent acknowledgement timestamped at order checkout via `refund_policy_accepted_at`.]

### Audit events — ✓ implemented
[Brief: append-only `audit_events` table, 12-event taxonomy, actor email + role + tenant + payload, indexed by tenant/time and target.]

### BAS export — 🚧 planned, not currently implemented
[Brief: the CSV export carries GST per order. A dedicated BAS-format export (quarterly summary, ATO field codes) is on the roadmap. Today's workflow: operator exports CSV, accountant pivots into BAS manually.]

### Bulk upload — 🚧 planned, partial route exists
[Brief: route shell exists at `/admin/[tenant]/bulk`, full CSV-import flow planned for v1.1.]

### Platform portal — 🚧 in design
[Brief: per `docs/superpowers/specs/2026-05-09-platform-portal-design.md`. DB-backed tenant listing, approval workflow, billing oversight. Today's `/platform` route is a stub.]

## 6. Compliance & trust

[Prose covering:]
- **Data sovereignty:** AU-hosted (Neon Sydney region, prod project `super-cell-03401356`).
- **PII minimisation:** no date of birth, no payment data stored (Stripe holds card details). Parent contact = name, email, mobile.
- **Auditability:** `audit_events` table covers all operator state-changing actions. `order_events` covers order lifecycle.
- **RBAC:** three-tier (platform admin / operator / parent) enforced via `authorization.ts` helpers on every server action and API route.
- **Refund-policy versioning:** every order stores `legalVersionId` referencing the policy version the parent acknowledged.
- **Retention:** orders retained indefinitely (school records). No automated purge; planned policy for v1.2.

## 7. Demo narrative arc

[Single page covering:]
- **Before:** paper forms, spreadsheets, lost orders, no GST visibility.
- **Product moment:** parent places an order on their phone in under 90 seconds; operator clicks one button to mark it ready; the ready email lands; the CSV at month-end is BAS-ready (with one manual pivot today, planned native export).
- **Business outcome:** P&C saves ~20 hours/term, error rate near zero, reconciliation moves from "all weekend" to "one afternoon".
- **Expansion:** every AU independent school + every state-system uniform shop. ~9,400 schools nationally. Cross-sell: house shirts, sportswear, formal events.

## 8. Closing claims (labels mandatory)

Every claim made aloud during the demo must be labelled in this section as ✓ live / 🚧 planned / 🚧 positioning. The walkthrough should be read alongside `demo-playbook.md` so the live narration stays calibrated.
```

- [ ] **Step 2: Commit**

```bash
git add GTM/product_demo/product-walkthrough.md
git commit -m "docs(gtm): product walkthrough with implementation-status labels"
```

---

## Task 13: route-map.md

**Files:**
- Create: `GTM/product_demo/route-map.md`

- [ ] **Step 1: Write the route map**

Write `GTM/product_demo/route-map.md`:

```markdown
# Demo route map

Routes referenced by the demo playbook, with role gating, seed dependencies, and recording notes. Paths reflect the actual `apps/web/src/app/` structure as of 2026-05-17.

## Public

| Path | Role | Purpose | Seed dep | Screenshot moment |
|---|---|---|---|---|
| `/` | public | Parent home — school picker | reads `lib/data.ts` `TENANTS` (static); demo tenants currently absent until platform-portal DB migration lands | Mention as known limitation; demo tenants reached via direct URL |
| `/[tenant]` (`demo-blank`, `demo-academy`) | parent | Catalog browse, mobile-first | catalog seeded | Act 3 opening shot |
| `/[tenant]/item/[itemId]` | parent | Item detail + variants + size guide | variants + size guide seeded (size guide null for now) | Act 3 — variant picker |
| `/[tenant]/cart` | parent | Cart (localStorage) | none (client state) | Act 3 — review step |
| `/[tenant]/checkout` | parent | Stripe Payment Element + refund policy ack | tenant Stripe Connect fields populated | Act 3 — payment step (fake Stripe in default mode; real test-mode is opt-in) |
| `/[tenant]/refund-policy` | parent | Tenant refund policy text | `tenantLegalVersions` row seeded | Act 6 — referenced when toggling policy editor |
| `/[tenant]/contact` | parent | Contact info | tenant address/email/hours seeded | Optional Act 1 polish shot |
| `/orders/[orderId]` | parent (own orders) | Parent order detail page | requires `DEMO_PARENT_USER_ID` to be set + ~3 attributed orders | Optional Act 3 closing shot |

## School operator

| Path | Role | Purpose | Seed dep | Screenshot moment |
|---|---|---|---|---|
| `/admin/[tenant]` | operator | Dashboard, KPIs | 40 orders mixed states | Act 2 opening |
| `/admin/[tenant]/orders` | operator | Kanban board | orders + events seeded | Act 2 + Act 4 |
| `/admin/[tenant]/orders/[orderId]` | operator | Order detail + actions (mark ready, print, refund) | one order pre-selected (`RVRA-00003`) | Act 4 — transition demo |
| `/admin/[tenant]/catalog` | operator | Catalog management | catalog + variants seeded | Act 6 — drag-reorder + variant edit |
| `/admin/[tenant]/reports` | operator | CSV export + GST view | completed orders within range | Act 5 |
| `/admin/[tenant]/settings` | operator | Workflow mode, refund policy, branding | tenant + settings + legal seeded | Act 6 |
| `/admin/[tenant]/bulk` | operator | Bulk upload (🚧 partial) | none | Mention only — not part of demo flow |

## Platform admin

| Path | Role | Purpose | Seed dep | Screenshot moment |
|---|---|---|---|---|
| `/platform` | platform admin | Console root | `PLATFORM_ADMIN_EMAILS` env contains demo admin | Act 1 opening (currently stub — design spec referenced) |
| `/platform/tenants` | platform admin | Tenant list | demo tenants in DB | Act 1 — show approval state |
| `/platform/billing` | platform admin | Billing overview (🚧 in design) | n/a | Mention only |

## Risks & dependencies

- **`/` parent home** still reads from `lib/data.ts` static `TENANTS`. Until the platform-portal DB migration lands, the parent shop picker will not surface demo tenants. The playbook directs the prospect to direct tenant URLs during Act 3.
- **`/[tenant]/checkout`** renders the Stripe Payment Element using `stripeAccountId='acct_demo_*'`. In default demo mode this Element will fail to load a real Stripe account; the playbook narration explicitly stops at "this is where the parent enters their card" and does not attempt a real charge unless the operator has swapped in a Connect test-mode account ID beforehand.
- **`/admin/[tenant]/reports`** caps the order range at 60 days. The seed places orders within 60 days; do not seed with arbitrary `daysAgo` values beyond that.
- **`/orders/[orderId]`** requires the requesting Neon Auth user to match `orders.userId`. Without `DEMO_PARENT_USER_ID`, the parent-portal route returns 404 for seeded orders.
```

- [ ] **Step 2: Commit**

```bash
git add GTM/product_demo/route-map.md
git commit -m "docs(gtm): route map with seed deps and known risks"
```

---

## Task 14: demo-playbook.md

**Files:**
- Create: `GTM/product_demo/demo-playbook.md`

The sales day-in-the-life script. Largest content file. Agent writes prose using the structure and facts below.

- [ ] **Step 1: Write the playbook**

Write `GTM/product_demo/demo-playbook.md`:

```markdown
# UniformOrder demo playbook

This is the sales / investor demo script. Run it against the seeded `demo-academy` tenant unless noted. Total runtime: ~18 minutes core + ~5 minutes Q&A buffer.

## Demo goal

[Prose: convince the audience — typically a P&C committee or school business manager — that UniformOrder removes the paper-form workflow with measurable time savings, full audit trail, and BAS-ready reporting. For investors: demonstrate the workflow is end-to-end, multi-tenant, AU-compliant.]

## Target audiences

- P&C committee (~5 people, mix of tech-comfortable parents)
- School business manager (1:1)
- Investor / partner (1:1 or small panel)

The playbook is calibrated for the P&C committee narrative. Branch points for the other audiences are flagged inline.

## Required setup (pre-demo checklist)

- [ ] Seed run completed within last hour: `pnpm --filter web demo:seed`
- [ ] Dev server up: `pnpm --filter web dev` on `http://localhost:3000`
- [ ] Demo Neon Auth users present (see `demo_data/operator_run_guide.md`)
- [ ] Browser zoom 100%, font size default
- [ ] Two windows open: desktop (1920×1080) and phone emulator (390×844 in Chrome devtools)
- [ ] Notifications silenced; Slack closed
- [ ] Audio source confirmed if recording

## Demo accounts (handy reference)

| Email | Role | Used in |
|---|---|---|
| `platformadmin@demo.uniformorder.online` | Platform admin | Act 1 |
| `operator@demo.uniformorder.online` | Operator (both tenants) | Acts 2, 4, 5, 6 |
| `parent@demo.uniformorder.online` | Parent | Act 3 (sign-in version) |

## Timing matrix

| Act | Runtime | Cumulative |
|---|---|---|
| 1. Setup & login | 2 min | 2:00 |
| 2. Operator dashboard | 3 min | 5:00 |
| 3. Live parent order | 3 min | 8:00 |
| 4. Order management | 4 min | 12:00 |
| 5. Reports & exports | 3 min | 15:00 |
| 6. Admin configuration | 3 min | 18:00 |
| Q&A buffer | 5 min | 23:00 |

## Act 1 — Setup & login

**Persona:** Platform admin.
**Route:** `/platform` → `/platform/tenants`.

[Narration: open the platform console. Show the tenant list. Highlight the approval state column for `demo-academy` and `demo-blank`. Quick line about Stripe Connect status — both tenants are approved, payouts enabled.]

**Click targets:**
1. Open `http://localhost:3000/platform` — already signed in as platform admin.
2. Navigate to `/platform/tenants`.
3. Click `demo-academy` row → tenant detail.

**Narration lines (verbatim):**
- "This is the platform console — where we approve schools. A real onboarding from sign-up to first parent order takes about 15 minutes."
- "Here's Riverside Academy. They were approved last week. Once Stripe Connect verification clears, they're live."

**Fallback if route looks stub-y:** "The full console is in design — what you see today is the data model and the routes; the UI polish ships next sprint."

**Expected outcome:** audience understands multi-tenancy and that we operate as the platform layer.

## Act 2 — Operator dashboard

**Persona:** School operator (sign in as `operator@demo.uniformorder.online`).
**Route:** `/admin/demo-academy` → `/admin/demo-academy/orders`.

[Narration: scan the dashboard KPIs. Open the Kanban. Highlight Unicode names rendering correctly. Filter by year level. Click into one order.]

**Click targets:**
1. Sign in as operator (use password from `.env.demo`).
2. Land on `/admin/demo-academy`.
3. Click "Orders" in sidebar → Kanban.
4. Hover the "Needs Attention" column header → "3 orders waiting on stock".
5. Click into `RVRA-00015` (Hannah Goldberg / Eli Goldberg) — see the hold reason.

**Narration lines:**
- "This is what the uniform shop coordinator sees on Monday morning. Eight orders to pick today, three waiting on stock, six already ready for collection."
- "The shop runs Mon/Wed/Fri 8:30 to noon. Between sessions the Kanban is their work plan."
- "When stock runs short — like this Year 9 jumper in size 16 — the operator marks it 'Needs Attention' with a reason, and the parent gets an automated hold email."

**Expected outcome:** audience sees realistic state distribution, not a clean empty demo.

## Act 3 — Live parent order

**Persona:** Parent (operator's own device, phone viewport).
**Route:** `/demo-blank` (clean tenant) or `/demo-academy` for richer catalog. Default: use `/demo-academy`.

**Participation moment:** if the prospect has a phone handy, hand them the URL and let them place a test order. Otherwise drive from your own device.

[Narration: open the parent shop in the mobile viewport. Browse the catalog. Tap a polo shirt → size 10. Add to cart. Add a jumper. Open cart. Tap Checkout. Show the refund-policy acknowledgement. Stop at the Stripe Payment Element.]

**Click targets:**
1. `http://localhost:3000/demo-academy` on phone viewport.
2. Tap "Polo Shirt — Short Sleeve" → size 10 → Add to cart.
3. Back, tap "Winter Jumper" → size 12 → Add to cart.
4. Tap cart icon → review.
5. Tap "Checkout" → fill student name "Demo Student", year 8, roll 8A.
6. Tick refund policy.
7. **Stop at Payment Element render.**

**Narration lines:**
- "From a parent's perspective: it's a phone-shaped shop. They pick the polo, the jumper, tap checkout, accept the refund policy."
- "Stripe handles payment. We never see card details. Apple Pay and Google Pay are first-class — most parents finish checkout in under 90 seconds end-to-end."

**Fallback if Stripe Element fails to load:** "In live demos we stop here — the test card flow needs a real Stripe Connect test account. For our pilot schools we set this up during onboarding."

**Live-Stripe variant (optional):** if the operator has swapped in a real Connect test account ID for `demo-blank` before the demo, complete payment with test card `4242 4242 4242 4242`, any future expiry, any CVC. The order will land in the operator's Kanban within ~2 seconds via the Stripe webhook.

**Expected outcome:** prospect feels the speed and simplicity. If they participated, they're invested.

## Act 4 — Order management

**Persona:** Operator.
**Route:** `/admin/demo-academy/orders/RVRA-00003`.

[Narration: open a to_prepare order. Mark it Ready. Show the ready email being sent (notification event row appears). Print the pick slip. Then open a completed order and refund one line.]

**Click targets:**
1. Click `RVRA-00003` (Søren Müller / Anika Müller, trousers + tie).
2. Click "Mark Ready" → confirm.
3. Click "Print Pick Slip".
4. Back to Kanban → click `RVRA-00038` (Layla Ibrahim / Zara Ibrahim, partially refunded).
5. Click the refunded line → show refund history + reason.

**Narration lines:**
- "When the order's picked, one click marks it Ready. The parent gets the collection email and the audit log captures who clicked, when, from what IP."
- "Refunds work the same — one click on a line, type a reason, the Stripe Connect refund fires, the customer gets a refund email. Reconciliation is automatic."
- "All of this is in the audit log. If a P&C member asks 'who marked this Ready last Thursday', we can answer."

**Expected outcome:** audience sees the workflow is one-click + auditable.

## Act 5 — Reports & exports

**Persona:** Operator.
**Route:** `/admin/demo-academy/reports`.

[Narration: open reports. Show the last 30 days. Highlight GST-inclusive totals. Click Export CSV. Open the CSV in a spreadsheet on a second screen.]

**Click targets:**
1. Navigate to `/admin/demo-academy/reports`.
2. Set range = last 30 days.
3. Note total revenue, GST collected.
4. Click "Export CSV" → save → open in spreadsheet app.
5. Show GST column matches subtotal/11.

**Narration lines:**
- "At month-end, the operator pulls a CSV. GST is broken out — Riverside's accountant pivots this straight into BAS today, and we're shipping native BAS export next quarter."
- "Every refunded line is flagged. Reconciling against the bank statement takes about an afternoon now instead of a weekend."

**Fallback if CSV won't open inline:** simply scroll the on-screen report and describe.

**Expected outcome:** audience sees compliance / accounting workflow.

## Act 6 — Admin configuration

**Persona:** Operator.
**Route:** `/admin/demo-academy/settings`, `/admin/demo-academy/catalog`.

[Narration: open settings. Show workflow mode toggle (standard vs simple). Open refund policy editor — note version history. Open catalog management — show drag-reorder, variant prices, size guide.]

**Click targets:**
1. Settings → workflow mode dropdown.
2. Settings → refund policy editor → show current version + history.
3. Catalog → drag a polo to top of list.
4. Catalog → edit a variant price.
5. Catalog → open size guide tab.

**Narration lines:**
- "The operator owns their own catalog. No tickets to us. Drag to reorder, click to edit prices, paste in a size guide."
- "Refund policy is versioned. Every order stores the version the parent acknowledged at checkout. If the policy changes, old orders stay anchored to the version that was current when they paid."

**Expected outcome:** audience sees operator independence + compliance posture.

## Objection handling

| Objection | Response |
|---|---|
| "We already use [X spreadsheet / Google Forms]." | "What does your end-of-term reconciliation look like? How long does it take?" Then: "We replace that weekend with about an afternoon." |
| "What about data security / PII?" | AU-hosted (Neon Sydney). Stripe holds card data. We hold name/email/mobile + order history. No DOB, no addresses unless shipping enabled. Full audit log. SOC2 roadmap. |
| "Setup time?" | ~15 min from school approval to first parent order. We help with the first catalog import. |
| "Stripe Connect — what's the fee?" | School pays Stripe AU rates directly (~1.7% + 30c). We don't take a cut on payments. Platform fee is flat monthly per school. |
| "GST / BAS handling?" | CSV with GST column today; native BAS export next quarter. We're working with two accountants on the export format. |
| "Refund policy compliance (ACL)?" | Built in. Every order acknowledges the current policy version. Versioning preserves the wording that was live at order time. |
| "What if Stripe is down?" | Checkout fails gracefully; cart persists; we don't lose orders. Webhook idempotency on receipt. |
| "Inventory?" | Out of scope by design — schools don't run on inventory systems, they order in batches. We track per-order quantity, not stock levels. |

## Discovery questions to ask the prospect

- "Walk me through what happens when a Year 7 parent orders a uniform today."
- "How does the uniform shop know when to restock?"
- "Where does the money flow — through the P&C account, the school's general account, or third-party?"
- "What's the worst thing that's happened at the end of a term?"

## Participation moment script

In Act 3, if the prospect has a phone:
> "Open `http://demo.local:3000/demo-academy` on your phone — same wifi. Order yourself a polo. We'll see it in the operator dashboard in about two seconds."

(Adapt URL to whatever's reachable from their device — if the dev server isn't exposed on the LAN, narrate the flow on your own phone instead.)

## Closing script

[Prose covering:]
- Summary of what was demoed.
- Specific time savings claim with caveat ("based on conversations with three pilot schools").
- Clear next step: scoping call + pilot quote.
- One sentence on the roadmap (BAS export, platform portal, sportswear cross-sell).

## Post-demo follow-up checklist

- [ ] Send follow-up email within 24h with the recording link (if recorded).
- [ ] Include `product-walkthrough.md` as a PDF attachment if asked.
- [ ] Schedule pilot scoping call.
- [ ] Log demo in CRM with the answers to the four discovery questions.
- [ ] Note any new objections — add to this playbook.
- [ ] Reset demo data before next demo: `pnpm --filter web demo:cleanup:confirm && pnpm --filter web demo:seed`.
```

- [ ] **Step 2: Commit**

```bash
git add GTM/product_demo/demo-playbook.md
git commit -m "docs(gtm): full demo playbook with 6 acts and objection handling"
```

---

## Task 15: Act script files (001 + 002)

**Files:**
- Create: `GTM/product_demo/recordings/001_act1_setup_and_login.md`
- Create: `GTM/product_demo/recordings/002_act2_operator_dashboard.md`

Each act script has identical structure: Purpose, Persona, Starting URL, Seed prerequisite, Click sequence, Narration (timed), Visual success criteria, Failure modes, Re-record command, Cleanup notes. Two acts per task to keep tasks bite-sized.

- [ ] **Step 1: Write `001_act1_setup_and_login.md`**

```markdown
# Act 1 — Setup & login

## Purpose
Open the demo with the platform-admin perspective: multi-tenancy, approval gate, Stripe Connect status.

## Persona
Platform admin — `platformadmin@demo.uniformorder.online`.

## Starting URL
`http://localhost:3000/platform`

## Seed prerequisite
- Both demo tenants seeded (`pnpm --filter web demo:seed`).
- `PLATFORM_ADMIN_EMAILS` env var contains `platformadmin@demo.uniformorder.online`.

## Step-by-step

| Step | Action | Narration | Expected screen |
|---|---|---|---|
| 1 | Open `/platform` | "This is the platform console — where new schools get approved." | Console root with tenant count |
| 2 | Click "Tenants" → `/platform/tenants` | "Here are our schools. Two demo tenants today." | Tenant table, 2 rows |
| 3 | Click `demo-academy` row | "Riverside Academy was approved last week. Stripe Connect verified, payouts enabled." | Tenant detail |
| 4 | Hover Stripe status badge | "Once Stripe Connect verification clears, they can take payments." | Tooltip / status pill |

## Timing
~2:00. Pace: slow scan, deliberate hover.

## Visual success criteria
- `/platform/tenants` shows both `demo-blank` and `demo-academy` rows.
- Stripe status column shows "Charges enabled / Payouts enabled" for both.
- Approval status column shows "approved" for both.

## Possible failure modes
- **Tenants list empty** — seed not run, or DATABASE_URL points at wrong DB. Run `pnpm --filter web demo:seed:dry` to confirm.
- **Redirect to `/auth/sign-in`** — current Neon Auth session is not in `PLATFORM_ADMIN_EMAILS`. Add the email and restart `pnpm dev`.
- **`/platform` route stubby / blank** — expected. Narrate around: "The full console is in design — current sprint."

## Re-record command
```bash
npx playwright test -c GTM/product_demo/playwright/demo-recording.config.ts --grep "Act 1"
```

## Cleanup
None per-act. Final teardown via `pnpm --filter web demo:cleanup:confirm`.
```

- [ ] **Step 2: Write `002_act2_operator_dashboard.md`**

```markdown
# Act 2 — Operator dashboard

## Purpose
Show what the uniform shop coordinator sees on a working morning: realistic mix of orders, status distribution, Unicode parent names.

## Persona
School operator — `operator@demo.uniformorder.online`.

## Starting URL
`/auth/sign-in` (signed out) → `/admin/demo-academy` after sign-in.

## Seed prerequisite
- `demo-academy` seeded with 40 orders.
- Operator Neon Auth user exists (`operator@demo.uniformorder.online`).
- `tenants.shopEmail` for `demo-academy` matches the operator's email (seeded as such).

## Step-by-step

| Step | Action | Narration | Expected screen |
|---|---|---|---|
| 1 | Sign in as operator | "This is the shop coordinator signing in for the day." | Dashboard |
| 2 | Read KPI tiles | "Eight to prepare, six ready for collection, three on hold." | KPI tiles populated |
| 3 | Click "Orders" sidebar item | "Their Monday-morning work plan." | Kanban board |
| 4 | Scan to_prepare column | "Names render in any script — we've got Chloë Nguyen, José O'Connor, 李小明." | 8 cards |
| 5 | Hover "Needs Attention" column | "Three orders waiting on stock." | 3 cards |
| 6 | Click `RVRA-00015` | "Year 9 jumper, size 16. Stock comes in next week. Parent already got the hold email." | Order detail with hold reason |

## Timing
~3:00. Pace: emphasise the Unicode moment (~5s pause on the name).

## Visual success criteria
- Dashboard KPIs sum to 40.
- Kanban shows correct status distribution (8/6/14+3 needs_attention/14 completed in current view, depending on filters).
- Unicode parent names render without `?` boxes or `[object Object]`.
- Order detail shows the hold reason text.

## Possible failure modes
- **Kanban shows 0 cards** — order seed step failed. Re-run `pnpm --filter web demo:seed -- --reset --only=academy`.
- **Unicode names show as `?`** — DB collation issue on local Postgres. Confirm Neon uses UTF8 (it does by default).
- **Sign-in redirects back to sign-in** — operator email mismatch between Neon Auth user and `tenants.shopEmail`. Check `.env.demo` and the operator Neon Auth user email match.

## Re-record command
```bash
npx playwright test -c GTM/product_demo/playwright/demo-recording.config.ts --grep "Act 2"
```

## Cleanup
None per-act.
```

- [ ] **Step 3: Commit**

```bash
git add GTM/product_demo/recordings/001_act1_setup_and_login.md GTM/product_demo/recordings/002_act2_operator_dashboard.md
git commit -m "docs(gtm): act scripts 1-2 (setup, operator dashboard)"
```

---

## Task 16: Act script files (003–006)

**Files:**
- Create: `GTM/product_demo/recordings/003_act3_live_parent_order.md`
- Create: `GTM/product_demo/recordings/004_act4_order_management.md`
- Create: `GTM/product_demo/recordings/005_act5_reports_exports_gst.md`
- Create: `GTM/product_demo/recordings/006_act6_admin_configuration.md`

Same structure as Acts 1–2. Content per file:

- [ ] **Step 1: Write `003_act3_live_parent_order.md`**

Content follows the same template (Purpose / Persona / URL / Seed dep / Steps table / Timing / Success criteria / Failure modes / Re-record / Cleanup). Use these specifics:

- **Persona:** Parent (any device — phone viewport preferred).
- **Starting URL:** `/demo-academy` on phone viewport (390×844 in Chrome devtools).
- **Seed prerequisite:** catalog seeded, both tenants have items.
- **Steps:** open shop → tap polo → size 10 → add to cart → back → tap jumper → size 12 → add → cart → checkout → fill student info → tick refund policy → reach Payment Element.
- **Success criteria:** cart shows 2 lines, total + GST visible, Stripe Element renders.
- **Failure modes:** Stripe Element fails to load with `acct_demo_blank` (expected — narrate around it); cart not persisting (clear localStorage if needed: `localStorage.removeItem('uo:cart:v1')`).
- **Participation moment:** if prospect has phone on same wifi, hand them the URL (see playbook).
- **Live-Stripe opt-in mode:** documented; operator must swap `acct_demo_blank` for a real Connect test account ID before the demo.

- [ ] **Step 2: Write `004_act4_order_management.md`**

- **Persona:** Operator.
- **Starting URL:** `/admin/demo-academy/orders` → `RVRA-00003` detail.
- **Seed prerequisite:** orders in `to_prepare` and `completed/partially_refunded` states.
- **Steps:** open `RVRA-00003` → click "Mark Ready" → confirm → see status change → click "Print Pick Slip" → preview opens → close → back to Kanban → open `RVRA-00038` → see refund history.
- **Success criteria:** status transitions visible in audit pane (`order_events` row added); pick slip print preview renders student name + lines; refund row shows reason and amount.
- **Failure modes:** transition action button disabled (auth or status mismatch — check that order is `to_prepare` and operator email matches `tenants.shopEmail`); pick slip preview fails (browser print blocked — narrate around).

- [ ] **Step 3: Write `005_act5_reports_exports_gst.md`**

- **Persona:** Operator.
- **Starting URL:** `/admin/demo-academy/reports`.
- **Seed prerequisite:** ~14 completed orders in last 30 days.
- **Steps:** open reports → confirm range = "Last 30 days" → note revenue + GST totals → click "Export CSV" → file downloads → open in Numbers/Excel on second screen → highlight GST column.
- **Success criteria:** revenue total > $0 and matches sum of completed orders in last 30 days; GST column = subtotal / 11 per row; CSV opens cleanly with UTF-8 names intact.
- **Failure modes:** "no orders in range" (re-run seed; orders may be outside 30-day window if the run is days old); CSV opens with `?` for Unicode names (ensure CSV is opened as UTF-8 in your spreadsheet app).

- [ ] **Step 4: Write `006_act6_admin_configuration.md`**

- **Persona:** Operator.
- **Starting URL:** `/admin/demo-academy/settings`.
- **Seed prerequisite:** `tenantSettings` seeded; refund policy v1 seeded.
- **Steps:** open settings → workflow mode dropdown (don't change) → click into refund policy editor → show current version + version history → close → navigate to `/admin/demo-academy/catalog` → drag a polo to top → click into a variant → edit price (revert) → open size guide tab.
- **Success criteria:** workflow mode dropdown shows `standard` selected; refund policy editor shows v1 with seeded text; catalog drag interaction visible; variant price input editable.
- **Failure modes:** drag handle not visible (zoom 100%, refresh); workflow mode change rejected (seed sets `standard`, dropdown should preselect).

For all four files, end with the same **Re-record command** pattern (`--grep "Act N"`) and a **Cleanup** note ("None per-act; final teardown via `pnpm --filter web demo:cleanup:confirm`.").

- [ ] **Step 5: Commit**

```bash
git add GTM/product_demo/recordings/003_act3_live_parent_order.md \
        GTM/product_demo/recordings/004_act4_order_management.md \
        GTM/product_demo/recordings/005_act5_reports_exports_gst.md \
        GTM/product_demo/recordings/006_act6_admin_configuration.md
git commit -m "docs(gtm): act scripts 3-6 (parent order, mgmt, reports, config)"
```

---

## Task 17: Playwright recording config

**Files:**
- Create: `GTM/product_demo/playwright/demo-recording.config.ts`

- [ ] **Step 1: Write the config**

```ts
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.DEMO_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: ".",
  testMatch: /record-demo\.spec\.ts$/,
  timeout: 5 * 60 * 1000, // 5 min per test (acts are slow-paced)
  fullyParallel: false, // record sequentially for predictable video output
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  outputDir: "../recordings/output",
  use: {
    baseURL,
    headless: false,
    launchOptions: { slowMo: 300 },
    video: "on",
    screenshot: "off",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "desktop",
      use: {
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["iPhone 13"],
      },
    },
  ],
  globalSetup: "./global-setup.ts",
});
```

- [ ] **Step 2: Write the global setup**

Create `GTM/product_demo/playwright/global-setup.ts`:

```ts
/**
 * Pre-flight: verify the dev server is responding before tests start.
 */
export default async function globalSetup() {
  const baseURL = process.env.DEMO_BASE_URL ?? "http://localhost:3000";
  console.log(`\n[demo-recording] Pre-flight: GET ${baseURL}`);
  try {
    const res = await fetch(baseURL, { signal: AbortSignal.timeout(5000) });
    if (!res.ok && res.status !== 404 && res.status !== 200) {
      throw new Error(`Got status ${res.status}`);
    }
    console.log(`[demo-recording] Pre-flight: server responding (${res.status}).\n`);
  } catch (err) {
    console.error(`\n✗ Dev server not responding at ${baseURL}.`);
    console.error(`  Start it with:  pnpm --filter web dev`);
    console.error(`  Or override the URL:  DEMO_BASE_URL=http://your-host:port npx playwright test ...`);
    console.error(`  Original error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}
```

- [ ] **Step 3: Validate config parses**

Run from repo root: `cd apps/web && pnpm exec playwright test --list -c ../../GTM/product_demo/playwright/demo-recording.config.ts 2>&1 | head -20`

Expected (will error because `record-demo.spec.ts` doesn't exist yet — that's fine for now): error mentioning the spec file not found, but no syntax error from the config itself.

- [ ] **Step 4: Commit**

```bash
git add GTM/product_demo/playwright/demo-recording.config.ts GTM/product_demo/playwright/global-setup.ts
git commit -m "feat(gtm): Playwright recording config (desktop + mobile, video on)"
```

---

## Task 18: Playwright recording spec (six acts)

**Files:**
- Create: `GTM/product_demo/playwright/record-demo.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
/**
 * Demo recording spec — six acts as test.describe blocks.
 * Each act produces one video per project (desktop, mobile).
 *
 * Selectors prefer getByRole/getByLabel. Where the existing UI lacks
 * accessible names, getByText is used with a brittleness comment.
 *
 * Credentials come from .env.demo via the --env-file flag passed to the
 * config (set DEMO_BASE_URL there or via process env).
 */
import { test, expect } from "@playwright/test";

const OPERATOR_EMAIL = process.env.DEMO_OPERATOR_EMAIL ?? "operator@demo.uniformorder.online";
const OPERATOR_PASSWORD = process.env.DEMO_OPERATOR_PASSWORD ?? "DemoPass123!";
const PARENT_EMAIL = process.env.DEMO_PARENT_EMAIL ?? "parent@demo.uniformorder.online";
const PARENT_PASSWORD = process.env.DEMO_PARENT_PASSWORD ?? "DemoPass123!";

async function signIn(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/auth/sign-in");
  // Brittle: form field naming depends on Neon Auth UI. Adjust if it changes.
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForLoadState("networkidle");
}

test.describe("Act 1 — Setup & login", () => {
  test("platform admin views tenants", async ({ page }) => {
    await page.goto("/platform");
    await page.waitForLoadState("networkidle");
    await page.goto("/platform/tenants");
    await expect(page.getByText("demo-academy")).toBeVisible({ timeout: 15_000 });
    await page.getByText("demo-academy").first().click();
    await page.waitForTimeout(2000); // dwell for narration
  });
});

test.describe("Act 2 — Operator dashboard", () => {
  test("operator scans Kanban", async ({ page }) => {
    await signIn(page, OPERATOR_EMAIL, OPERATOR_PASSWORD);
    await page.goto("/admin/demo-academy");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await page.goto("/admin/demo-academy/orders");
    await expect(page.getByText(/Chloë|Nguyen|José|李小明/).first()).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(3000);
    // Open RVRA-00015 (needs_attention)
    await page.getByText("RVRA-00015").click();
    await page.waitForTimeout(2000);
  });
});

test.describe("Act 3 — Live parent order", () => {
  test("parent builds cart and reaches checkout", async ({ page }) => {
    await page.goto("/demo-academy");
    await page.waitForLoadState("networkidle");
    // Brittle: relies on catalog card text. If catalog labels change, update.
    await page.getByText(/Polo Shirt — Short Sleeve/i).first().click();
    await page.waitForTimeout(1500);
    // Pick a size button (brittle: assumes button text matches "10")
    await page.getByRole("button", { name: "10", exact: true }).first().click();
    await page.getByRole("button", { name: /add to cart/i }).click();
    await page.waitForTimeout(1500);
    await page.goto("/demo-academy/cart");
    await page.waitForTimeout(2000);
    await page.getByRole("link", { name: /checkout/i }).or(page.getByRole("button", { name: /checkout/i })).click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000); // dwell on checkout
  });
});

test.describe("Act 4 — Order management", () => {
  test("operator transitions order and views refund", async ({ page }) => {
    await signIn(page, OPERATOR_EMAIL, OPERATOR_PASSWORD);
    await page.goto("/admin/demo-academy/orders/RVRA-00003");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    // Brittle: button text varies. Adjust if labelled differently.
    await page.getByRole("button", { name: /mark ready/i }).click();
    await page.waitForTimeout(2000);
    // Refund act:
    await page.goto("/admin/demo-academy/orders/RVRA-00038");
    await page.waitForTimeout(3000);
  });
});

test.describe("Act 5 — Reports & exports", () => {
  test("operator exports CSV", async ({ page }) => {
    await signIn(page, OPERATOR_EMAIL, OPERATOR_PASSWORD);
    await page.goto("/admin/demo-academy/reports");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    // Trigger download (Playwright auto-resolves the path)
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /export csv/i }).click(),
    ]);
    const path = await download.path();
    console.log(`[Act 5] CSV downloaded to ${path}`);
    await page.waitForTimeout(2000);
  });
});

test.describe("Act 6 — Admin configuration", () => {
  test("operator tours settings and catalog", async ({ page }) => {
    await signIn(page, OPERATOR_EMAIL, OPERATOR_PASSWORD);
    await page.goto("/admin/demo-academy/settings");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    await page.goto("/admin/demo-academy/catalog");
    await page.waitForTimeout(3000);
    // Click a catalog item to show variant editor (brittle: card click target)
    await page.getByText(/Polo Shirt — Short Sleeve/i).first().click();
    await page.waitForTimeout(3000);
  });
});
```

- [ ] **Step 2: Validate config + spec list cleanly**

Run: `cd apps/web && pnpm exec playwright test --list -c ../../GTM/product_demo/playwright/demo-recording.config.ts 2>&1 | tail -20`

Expected: lists 12 tests (6 acts × 2 projects). If selectors error at list-time, fix; runtime selector errors are out of scope (the user runs the actual recording).

- [ ] **Step 3: Commit**

```bash
git add GTM/product_demo/playwright/record-demo.spec.ts
git commit -m "feat(gtm): Playwright spec with 6 acts (record-demo.spec.ts)"
```

---

## Task 19: Playwright + recordings READMEs

**Files:**
- Create: `GTM/product_demo/playwright/README.md`
- Create: `GTM/product_demo/recordings/README.md`

- [ ] **Step 1: Write `playwright/README.md`**

```markdown
# Demo recording — Playwright

Reproducible video capture of the six demo acts. Outputs to `../recordings/output/<project>/<test>/video.webm`.

## Pre-flight

1. Seed demo data: `pnpm --filter web demo:seed`
2. Start dev server in one terminal: `pnpm --filter web dev`
3. Confirm reachable: `curl -fsSL http://localhost:3000 >/dev/null && echo OK`
4. `.env.demo` exists and contains `DEMO_OPERATOR_PASSWORD`, `DEMO_PARENT_PASSWORD`.

## Record both projects

```bash
cd apps/web
pnpm exec playwright test -c ../../GTM/product_demo/playwright/demo-recording.config.ts
```

> **Note:** the agent does not run this command — headed Playwright must be run from your own terminal so the browser window can render.

## Record one act

```bash
cd apps/web
pnpm exec playwright test -c ../../GTM/product_demo/playwright/demo-recording.config.ts --grep "Act 3"
```

## Record desktop only

```bash
pnpm exec playwright test -c ../../GTM/product_demo/playwright/demo-recording.config.ts --project=desktop
```

## Viewports

- `desktop` — 1920 × 1080, Chromium headed.
- `mobile` — iPhone 13 emulation (390 × 844), Chromium headed.

## Selector brittleness

The spec uses `getByRole` and `getByLabel` where the UI exposes accessible names. Where it doesn't, `getByText` is used and the line is marked with `// Brittle:`. If a recording fails after a UI change, search the spec for `Brittle:` comments and update.

## Output

Videos: `GTM/product_demo/recordings/output/<project>/<test-id>/video.webm`. Gitignored.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Pre-flight: server not responding` | dev server not running | `pnpm --filter web dev` in another terminal |
| Sign-in fails on Acts 2/4/5/6 | Neon Auth user missing or password mismatch | See `demo_data/operator_run_guide.md` |
| Acts 3/4/5/6 fail mid-flow | UI selector changed | Update the `Brittle:`-marked selector in `record-demo.spec.ts` |
| No video produced | Headless mode accidentally on | `headless: false` in config (default) |
| Recording sped up | Default `slowMo` overridden | Config sets `slowMo: 300`; verify env not overriding |
```

- [ ] **Step 2: Write `recordings/README.md`**

```markdown
# Demo recordings

Per-act recording scripts (`001_*.md` through `006_*.md`) and generated video output.

## Generated artifacts

Generated `.webm` files land in `output/<project>/<test>/video.webm`. **Never committed** — see root `.gitignore`. To share, upload manually to your preferred host.

## Full record run

```bash
cd apps/web
pnpm --filter web dev   # Terminal 1: dev server
# Terminal 2:
cd apps/web
pnpm exec playwright test -c ../../GTM/product_demo/playwright/demo-recording.config.ts
```

## Re-record one act

```bash
pnpm exec playwright test -c ../../GTM/product_demo/playwright/demo-recording.config.ts --grep "Act 3"
```

## Browser / OS settings for clean recordings

- 100% browser zoom.
- macOS: disable cursor highlight; quit Slack and any notification-producing apps.
- Default font size, no high-contrast mode.
- DND on.

## Cleanup generated videos

```bash
rm -rf GTM/product_demo/recordings/output/
```

## Security

- Don't record with real PII visible in any tab.
- The spec uses demo accounts only; no production data is touched.
- Credentials are read from `.env.demo` and never logged.
```

- [ ] **Step 3: Commit**

```bash
git add GTM/product_demo/playwright/README.md GTM/product_demo/recordings/README.md
git commit -m "docs(gtm): Playwright + recordings READMEs"
```

---

## Task 20: IMPLEMENTATION_NOTES.md

**Files:**
- Create: `GTM/IMPLEMENTATION_NOTES.md`

Top-level notes file documenting all app-level changes and safety guarantees.

- [ ] **Step 1: Write the file**

```markdown
# GTM/ — implementation notes

This directory contains all demo / sales / recording assets for UniformOrder. The contents are additive; the only application-level changes outside `GTM/` are:

## App-level changes

### `apps/web/package.json`

Added four scripts and one dev dependency:

```json
"demo:seed:dry":          "tsx --env-file=../../GTM/demo_data/.env.demo ../../GTM/demo_data/seed-demo.ts --dry-run",
"demo:seed":              "tsx --env-file=../../GTM/demo_data/.env.demo ../../GTM/demo_data/seed-demo.ts",
"demo:cleanup":           "tsx --env-file=../../GTM/demo_data/.env.demo ../../GTM/demo_data/cleanup-demo.ts",
"demo:cleanup:confirm":   "tsx --env-file=../../GTM/demo_data/.env.demo ../../GTM/demo_data/cleanup-demo.ts --confirm"
```

`tsx` added to `devDependencies` for runtime TypeScript execution. Production builds are unaffected.

### Root `.gitignore`

Added:

```
GTM/product_demo/recordings/output/
GTM/demo_data/.env.demo
*.webm
*.mp4
```

`.env.demo` ignore is scoped to that path so application-level `.env*` rules elsewhere are unaffected.

## No changes to

- `apps/web/src/db/schema.ts`
- `apps/web/src/db/queries.ts`
- `apps/web/src/db/index.ts`
- `apps/web/src/lib/data.ts` (the static `TENANTS` / `CATALOG` maps remain untouched; demo tenants are DB-only)
- Any `apps/web/src/app/` route or component
- Any existing migration in `apps/web/drizzle/`

## Out-of-band Neon Auth step

`neonAuthUsers` lives in the `neon_auth` schema, owned by Neon Auth. The seed cannot create login users. Operators must create the three demo accounts manually (see `demo_data/operator_run_guide.md`):

- `operator@demo.uniformorder.online`
- `parent@demo.uniformorder.online`
- `platformadmin@demo.uniformorder.online`

Cleanup does not touch these users — they persist across seed cycles and are removed manually via the Neon Auth admin UI if needed.

## Fake Stripe references

Demo orders carry `stripePaymentIntentId='pi_demo_*'` and `stripeRef='ch_demo_*'`. Demo refunds carry `stripeRefundId='re_demo_*'`. These never resolve against real Stripe.

To exclude demo data from any future reconciliation query, filter by:
- `orders.stripePaymentIntentId NOT LIKE 'pi_demo_%'`, or
- `orders.tenantId NOT IN ('demo-blank', 'demo-academy')`.

The second form is preferred — it doesn't depend on Stripe ref hygiene.

## Safety guarantees

The seed and cleanup scripts both abort before opening any DB connection if:

1. `DATABASE_URL` is unset.
2. Host is not localhost, and `--allow-remote` was not passed.
3. Host matches `{prod, production, super-cell-03401356}` (the prod Neon project), and `--i-know-what-im-doing` was not passed.
4. `NODE_ENV === 'production'`, and `--i-know-what-im-doing` was not passed.

Cleanup is **strictly scoped** by `tenantId IN ('demo-blank','demo-academy')` and prints a deletion plan before any write. `--confirm` is required to execute.

## Idempotency contract

Re-running `pnpm --filter web demo:seed` against a previously seeded DB produces the same end-state. Implementation:

- `tenants`, `tenantSettings`, `catalogItems` use `ON CONFLICT DO UPDATE` on natural keys.
- `catalogVariants`, `orders`, `orderLines`, `orderEvents`, `orderNotificationEvents`, `orderRefunds` are delete-then-insert per tenant or per order — clean because they lack natural keys.
- `tenantLegalVersions` is insert-once (the first run creates version 1; subsequent runs find the existing version).

Use `--reset` to nuke and re-seed (cleaner for fixture changes).

## Schema dependencies

If `apps/web/src/db/schema.ts` changes, the seed/cleanup may need updates. Symbols referenced:

- Tables: `tenants`, `tenantSettings`, `tenantLegalVersions`, `catalogItems`, `catalogVariants`, `orders`, `orderLines`, `orderEvents`, `orderNotificationEvents`, `orderRefunds`, `auditEvents`.
- Enums: `orderFulfilmentStatusEnum`, `orderPaymentStatusEnum`, `orderCompletionTypeEnum`, `orderFulfilmentMethodEnum`, `workflowModeEnum`, `notificationTypeEnum`, `notificationStatusEnum`, `orderEventTypeEnum`, `policyModeEnum`.

If any of these symbols are renamed, the seed will fail to compile / load via tsx and the error will be obvious.

## Migration tooling note

The seed uses runtime Drizzle ORM via the same `@neondatabase/serverless` HTTP client the app uses (`db.batch`, never `transaction`). It does NOT use `drizzle-kit`, which avoids the websocket blocker documented in the `project_drizzle_kit_websocket_blocker` memory.

## Known limitation: parent home picker

`app/page.tsx` reads the school list from `lib/data.ts` static `TENANTS`, not the DB. Until the platform-portal DB migration lands (see `docs/superpowers/specs/2026-05-09-platform-portal-design.md`), demo tenants are not visible on `/`. The playbook directs prospects to direct tenant URLs (`/demo-blank`, `/demo-academy`) during Act 3.

## Live Stripe in Act 3 (opt-in)

Default demo runs the checkout flow up to the Stripe Payment Element render and narrates around the actual charge. For a fully working test payment:

1. Create a Stripe Connect test account via the Stripe dashboard.
2. Manually update `demo-blank` (or `demo-academy`) `tenants.stripeAccountId` to the real test-mode account ID via the platform console UI or a one-off SQL update.
3. The Element will render real test-card forms; test card `4242 4242 4242 4242` (any future expiry, any CVC) completes the order. Webhook (`/api/stripe/webhook`) handles `payment_intent.succeeded` and the operator Kanban updates within ~2 seconds.

Restore the fake account ID after the demo by re-running `pnpm --filter web demo:seed -- --reset`.
```

- [ ] **Step 2: Commit**

```bash
git add GTM/IMPLEMENTATION_NOTES.md
git commit -m "docs(gtm): top-level implementation notes + safety guarantees"
```

---

## Task 21: Final validation

**Files:** none modified

- [ ] **Step 1: Tree audit**

Run: `find GTM -type f | sort`

Expected (exact set):
```
GTM/IMPLEMENTATION_NOTES.md
GTM/demo_data/.env.demo.example
GTM/demo_data/README.md
GTM/demo_data/cleanup-demo.ts
GTM/demo_data/fixtures/demo-scenarios.json
GTM/demo_data/operator_run_guide.md
GTM/demo_data/seed-demo.ts
GTM/product_demo/demo-playbook.md
GTM/product_demo/playwright/README.md
GTM/product_demo/playwright/demo-recording.config.ts
GTM/product_demo/playwright/global-setup.ts
GTM/product_demo/playwright/record-demo.spec.ts
GTM/product_demo/product-walkthrough.md
GTM/product_demo/recordings/.gitkeep
GTM/product_demo/recordings/001_act1_setup_and_login.md
GTM/product_demo/recordings/002_act2_operator_dashboard.md
GTM/product_demo/recordings/003_act3_live_parent_order.md
GTM/product_demo/recordings/004_act4_order_management.md
GTM/product_demo/recordings/005_act5_reports_exports_gst.md
GTM/product_demo/recordings/006_act6_admin_configuration.md
GTM/product_demo/recordings/README.md
GTM/product_demo/route-map.md
```

- [ ] **Step 2: Type-check**

Run: `pnpm check-types:web`
Expected: passes. (Seed/cleanup files live outside `apps/web/tsconfig.json` `include`, so they're not type-checked here — that's intentional. Their TS validation comes from tsx at runtime.)

- [ ] **Step 3: Fixture JSON valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('GTM/demo_data/fixtures/demo-scenarios.json','utf8')); console.log('OK')"`
Expected: `OK`.

- [ ] **Step 4: Seed dry-run succeeds without DB**

Run: `cd apps/web && DATABASE_URL='postgresql://test@localhost:5432/test' pnpm exec tsx ../../GTM/demo_data/seed-demo.ts --dry-run`
Expected: clean dry-run output listing both tenants, ends with "[DRY RUN] No DB connection opened."

- [ ] **Step 5: Playwright spec lists cleanly**

Run: `cd apps/web && pnpm exec playwright test --list -c ../../GTM/product_demo/playwright/demo-recording.config.ts 2>&1 | tail -20`
Expected: lists 12 tests (6 acts × 2 projects), no syntax errors.

- [ ] **Step 6: Verify ignored files aren't committed**

Run: `git status --ignored | grep -E '(\.env\.demo$|output/|\.webm|\.mp4)' || echo "Clean"`
Expected: any of those patterns appear in the ignored list (not in the to-be-committed list), or `Clean` if there are no such files yet.

- [ ] **Step 7: Worktree summary commit**

```bash
git log --oneline gtm-demo-assets ^main | head -30
```
Confirm one commit per task (~21 commits) plus the spec commit at the start of the branch. No squashing — the per-task history is useful.

- [ ] **Step 8: Push branch (only if user requests)**

Per the project's git safety rules, do not push until the user asks. Report status:

```
GTM build complete on branch gtm-demo-assets (worktree ../uniform_order-gtm-demo).
N commits ahead of main. Ready to push or open a PR when you say.
```

---

## Self-review checklist

After implementing every task:

- [ ] All 22 files in §File Map exist
- [ ] All 4 demo:* scripts in `apps/web/package.json`
- [ ] `tsx` in `apps/web/package.json` devDependencies
- [ ] `.gitignore` contains the four new patterns
- [ ] `pnpm check-types:web` passes
- [ ] `--dry-run` seed runs cleanly
- [ ] Playwright config parses
- [ ] No production-pattern hosts are EVER reached during the build (only the test `postgresql://test@localhost:5432/test` URL)
- [ ] Each commit message ends with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` when an agent does the work
