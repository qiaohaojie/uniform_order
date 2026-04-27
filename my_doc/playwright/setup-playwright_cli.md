# Playwright CLI — Vibe-Coding Setup (For Claude Code)

> **You are Claude Code.** A human handed you this file and said "do it."
> Execute the **Tasks** section in order. Don't ask follow-up questions unless something blocks you.
> When finished, post the **Done Checklist** back to the user.

---

## Goal

Install and configure **Playwright CLI** for the project's web app in a way that is optimized for *vibe coding* — i.e. minimum context-window cost per test cycle.

Philosophy:

- Playwright CLI is the **default** functional-test tool. You read short JSON snapshots and filtered logs from disk, not screenshots streamed into context.
- The `chrome-devtools` MCP / `claude-in-chrome` MCP is the **fallback**, used only when there is a *visual / CSS* problem that a snapshot cannot describe.
- On a green test run you should see ~1 line of output. On a red run you should see only the failing assertion + filtered console errors.

---

## Task 0 — Detect project shape (do this first)

Before running anything, fill in these variables by inspecting the repo. Use them everywhere downstream.

| Var | How to detect | Example values |
|---|---|---|
| `WEB_DIR` | The directory of the web app to test. If monorepo, look in `apps/*`, `packages/*`, or `pnpm-workspace.yaml` / `turbo.json` / root `package.json#workspaces` for the frontend package. If single-app, use `.` (repo root). | `apps/web`, `packages/frontend`, `.` |
| `WEB_PKG` | The `name` field of `WEB_DIR/package.json`. Used for `--filter` / `-w` targeting. | `web`, `@acme/frontend` |
| `PKG_MGR` | Detect by lockfile: `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lockb` → bun, else npm. | `pnpm` |
| `IS_MONOREPO` | True if `pnpm-workspace.yaml`, `turbo.json`, or root `package.json#workspaces` exists. | `true` / `false` |
| `DEV_CMD` | The web app's dev script. Read `WEB_DIR/package.json#scripts.dev` (or `start`). | `next dev`, `vite`, `astro dev` |
| `DEV_PORT` | Port the dev server binds to. Next.js default 3000, Vite 5173, Astro 4321, SvelteKit 5173, Remix 3000. Check `next.config.*`, `vite.config.*`, or the framework default. | `3000` |
| `SCRIPTS_DIR` | `scripts/` at repo root if monorepo; `WEB_DIR/scripts/` otherwise. | `scripts/` |

Throughout this doc, treat `<WEB_DIR>`, `<WEB_PKG>`, `<PKG_MGR>`, `<DEV_CMD>`, `<DEV_PORT>`, `<SCRIPTS_DIR>` as substitutions.

**Package-manager command shorthand** — translate `<run-in-web>` based on `<PKG_MGR>` + `<IS_MONOREPO>`:

| `<PKG_MGR>` + monorepo | `<run-in-web> <script>` becomes |
|---|---|
| pnpm + mono | `pnpm --filter <WEB_PKG> <script>` |
| pnpm + single | `pnpm <script>` |
| yarn + mono (workspaces) | `yarn workspace <WEB_PKG> <script>` |
| yarn + single | `yarn <script>` |
| npm + mono | `npm run <script> -w <WEB_PKG>` |
| npm + single | `npm run <script>` |
| bun + mono | `bun --filter <WEB_PKG> run <script>` |
| bun + single | `bun run <script>` |

Same translation for `<exec-in-web> <bin>` (Playwright CLI invocations):

| `<PKG_MGR>` | `<exec-in-web> <bin>` becomes |
|---|---|
| pnpm | `pnpm --filter <WEB_PKG> exec <bin>` (mono) / `pnpm exec <bin>` (single) |
| yarn | `yarn workspace <WEB_PKG> <bin>` (mono) / `yarn <bin>` (single) |
| npm | `npm exec -w <WEB_PKG> -- <bin>` (mono) / `npx <bin>` (single) |
| bun | `bun --filter <WEB_PKG> exec <bin>` (mono) / `bunx <bin>` (single) |

If anything in Task 0 is ambiguous (e.g. multiple frontend packages), **ask the user once** before proceeding. Otherwise, infer and continue.

---

## Tasks

### 1. Install Playwright in `<WEB_DIR>`

```bash
<run-in-web> add -D @playwright/test
<exec-in-web> playwright install --with-deps chromium
```

> Only install **chromium** by default. WebKit + Firefox can be added later if the user asks.

### 2. Create `<WEB_DIR>/playwright.config.ts`

Use this exact config — it is tuned for low-context output. Substitute `<DEV_PORT>` and `<DEV_CMD>` from Task 0.

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/e2e",
	outputDir: "./tests/.artifacts",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: process.env.CI ? 2 : undefined,

	// Quiet reporter for vibe coding. Failures still print full diagnostics.
	// JSON report on disk is what Claude reads when it needs detail.
	reporter: [
		["line"],
		["json", { outputFile: "tests/.artifacts/report.json" }],
		["html", { outputFolder: "tests/.artifacts/html", open: "never" }],
	],

	use: {
		baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:<DEV_PORT>",
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		video: "off",
	},

	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],

	webServer: {
		command: "<DEV_CMD>",
		url: "http://localhost:<DEV_PORT>",
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
		stdout: "ignore",
		stderr: "pipe",
	},
});
```

> The `webServer.command` runs from `<WEB_DIR>`. If the dev server is normally launched from repo root in a monorepo (e.g. `pnpm dev` proxying via Turborepo), use that command instead.

### 3. Create the test directory + a smoke test

```
<WEB_DIR>/tests/
├── e2e/
│   └── smoke.spec.ts
└── .artifacts/         # gitignored output (snapshots, traces, json reports)
```

**`<WEB_DIR>/tests/e2e/smoke.spec.ts`:**

```ts
import { expect, test } from "@playwright/test";

test("home page renders", async ({ page }) => {
	const errors: string[] = [];
	page.on("pageerror", (e) => errors.push(e.message));
	page.on("console", (msg) => {
		if (msg.type() === "error") errors.push(msg.text());
	});

	await page.goto("/");
	await expect(page).toHaveTitle(/.+/);
	expect(errors, errors.join("\n")).toEqual([]);
});
```

### 4. Add the gitignore entry

Append to `<WEB_DIR>/.gitignore` (create the file if missing):

```
# Playwright
/tests/.artifacts/
/playwright-report/
/test-results/
```

### 5. Add scripts

**`<WEB_DIR>/package.json`** — add to `scripts`. The `test:e2e:errors` path to `playwright-errors.mjs` must be relative to `<WEB_DIR>`. If `<SCRIPTS_DIR>` is at repo root, that's typically `../../scripts/playwright-errors.mjs` (monorepo) or `./scripts/playwright-errors.mjs` (single-app).

```jsonc
{
	"scripts": {
		"test:e2e": "playwright test",
		"test:e2e:ui": "playwright test --ui",
		"test:e2e:debug": "playwright test --debug",
		"test:e2e:errors": "playwright test --reporter=line --quiet || node <RELATIVE_PATH_TO_SCRIPTS>/playwright-errors.mjs"
	}
}
```

**Root `package.json`** (only if `IS_MONOREPO`) — add to `scripts`:

```jsonc
{
	"scripts": {
		"test:e2e": "<run-in-web> test:e2e"
	}
}
```

### 6. Create the error-extractor helper

**`<SCRIPTS_DIR>/playwright-errors.mjs`** — the `reportPath` must point to the report relative to repo root (or wherever the script is invoked from). Adjust the path constant for your `<WEB_DIR>`.

```js
#!/usr/bin/env node
// Reads <WEB_DIR>/tests/.artifacts/report.json after a failing playwright run
// and prints ONLY the failing tests' titles + first error line.
// Designed to keep Claude Code's context window small.

import fs from "node:fs";
import path from "node:path";

// Set this to the report path relative to repo root.
const REPORT_PATH = "<WEB_DIR>/tests/.artifacts/report.json";

const reportPath = path.resolve(REPORT_PATH);
if (!fs.existsSync(reportPath)) {
	console.error(`No report.json found at ${REPORT_PATH}. Run the e2e tests first.`);
	process.exit(1);
}

const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const failures = [];

function walk(suite) {
	for (const s of suite.suites ?? []) walk(s);
	for (const spec of suite.specs ?? []) {
		for (const t of spec.tests ?? []) {
			for (const r of t.results ?? []) {
				if (r.status !== "passed" && r.status !== "skipped") {
					failures.push({
						title: spec.title,
						file: spec.file,
						error: (r.error?.message ?? "unknown").split("\n")[0],
					});
				}
			}
		}
	}
}
for (const s of report.suites ?? []) walk(s);

if (!failures.length) {
	console.log("All tests passed.");
	process.exit(0);
}

console.log(`${failures.length} failing test(s):`);
for (const f of failures) {
	console.log(`  ✗ ${f.file} :: ${f.title}`);
	console.log(`    → ${f.error}`);
}
process.exit(1);
```

Make it executable:

```bash
chmod +x <SCRIPTS_DIR>/playwright-errors.mjs
```

### 7. Configure Claude Code permissions

Edit **`.claude/settings.local.json`** (preferred — gitignored, per-developer) or `.claude/settings.json` (project-wide). **Merge** these entries into any existing `permissions.allow` array — do not overwrite other settings or plugin entries already present.

```jsonc
{
	"permissions": {
		"allow": [
			"Bash(<run-in-web> test:e2e*)",
			"Bash(<exec-in-web> playwright*)",
			"Bash(node <SCRIPTS_DIR>/playwright-errors.mjs*)"
		]
	}
}
```

If `IS_MONOREPO` and you added a root `test:e2e` script, also allow `Bash(<PKG_MGR> test:e2e*)` (or `Bash(<PKG_MGR> run test:e2e*)` for npm/yarn/bun).

### 8. Create the Playwright vibe-coding skill

Create **`.claude/skills/playwright-vibe/SKILL.md`** with the YAML frontmatter and content below. Substitute `<run-in-web>` / `<exec-in-web>` / `<SCRIPTS_DIR>` / `<WEB_DIR>` with the resolved values from Task 0 so the skill is self-contained.

```markdown
---
name: playwright-vibe
description: Run and debug end-to-end tests for the web app with minimum context-window cost. Use whenever the user asks to write, run, debug, or fix an E2E / browser / Playwright test, OR when the user says "test the page" / "verify the UI works" / "check that X navigates to Y" without naming a tool. Prefer this over the chrome-devtools or claude-in-chrome MCPs for any *functional* check. Switch to those MCPs only for *visual* problems (layout looks off, CSS bug, alignment) where the snapshot cannot describe what's wrong.
---

# Playwright Vibe-Coding Workflow

Goal: minimal tokens per cycle. Trust the green dot; only read the noise when something fails.

## Default loop

1. Make code changes.
2. Run: `<run-in-web> test:e2e`
3. Read the **last 5–10 lines** of stdout. If you see `passed`, stop. Don't read the report.
4. On failure:
   - Run: `node <SCRIPTS_DIR>/playwright-errors.mjs` to get the one-line summary per failing test.
   - Only `Read` `<WEB_DIR>/tests/.artifacts/report.json` if you need the full stack trace, and use `offset`/`limit` to scope the read.
   - Trace files live in `<WEB_DIR>/tests/.artifacts/` — open with `<exec-in-web> playwright show-trace <path>` only if asked.

## Writing a new test

- Place specs in `<WEB_DIR>/tests/e2e/<feature>.spec.ts`.
- Prefer **role-based locators**: `page.getByRole('button', { name: /submit/i })`.
- Avoid CSS selectors and screenshot assertions for functional tests.
- Always attach a `pageerror` + `console.error` listener and assert the array is empty (see `smoke.spec.ts`).

## When NOT to use this

Switch to the Chrome DevTools MCP (`mcp__claude-in-chrome__*`) only when:
- The test passes but the UI looks wrong (alignment, color, spacing).
- You need to inspect computed CSS or live-tweak Tailwind classes.
- You're hunting a visual regression that has no functional symptom.

For everything else — navigation, form submission, auth flow, data rendering, error states — Playwright CLI is the answer.

## Commands cheatsheet

| Need | Command |
|---|---|
| Run all e2e tests | `<run-in-web> test:e2e` |
| Run one file | `<run-in-web> test:e2e tests/e2e/smoke.spec.ts` |
| Run by name | `<run-in-web> test:e2e -g "home page"` |
| Open last HTML report | `<exec-in-web> playwright show-report tests/.artifacts/html` |
| Update snapshots | `<run-in-web> test:e2e --update-snapshots` |
| Filtered errors only | `node <SCRIPTS_DIR>/playwright-errors.mjs` |
| Headed (debug) | `<run-in-web> test:e2e:debug` |

## Token-discipline rules

- Never paste the full HTML of a page into chat. Use a Playwright assertion instead.
- Never `Read` a trace file directly — it's binary.
- If `report.json` is > 200 lines, run `playwright-errors.mjs` instead of reading it.
- Do not start a long-running `playwright test --ui` session unless the user asked for interactive mode.
```

### 9. Update root CLAUDE.md

Append a section to `CLAUDE.md` at repo root (create if missing) so the convention is discoverable in every session:

```markdown
## Browser Testing

For functional E2E checks on the web app, use **Playwright CLI** (`<run-in-web> test:e2e`), not the `chrome-devtools` / `claude-in-chrome` MCP. The Playwright workflow is documented in the `playwright-vibe` skill (`.claude/skills/playwright-vibe/SKILL.md`).

Use the Chrome MCP only for *visual* problems (CSS, layout, alignment) where a snapshot can't describe the issue.
```

### 10. Verify

Run, in order:

```bash
<run-in-web> test:e2e
```

Expected: smoke test passes, output is one line per test plus a summary.

If the dev server isn't already running, the `webServer` block in `playwright.config.ts` will start it. First run can take ~30s.

---

## Done Checklist

When finished, reply to the user with this filled in. Include the resolved Task 0 values at the top so the user can verify your detection.

```
Detected:
  WEB_DIR    = ...
  WEB_PKG    = ...
  PKG_MGR    = ...
  IS_MONOREPO = ...
  DEV_CMD    = ...
  DEV_PORT   = ...
  SCRIPTS_DIR = ...
```

- [ ] `@playwright/test` installed in `<WEB_DIR>`
- [ ] `chromium` browser installed
- [ ] `<WEB_DIR>/playwright.config.ts` created
- [ ] `<WEB_DIR>/tests/e2e/smoke.spec.ts` created and **passing**
- [ ] `<SCRIPTS_DIR>/playwright-errors.mjs` created and executable
- [ ] Scripts added to `<WEB_DIR>/package.json` (and root `package.json` if monorepo)
- [ ] `.gitignore` updated for test artifacts
- [ ] `.claude/settings.local.json` (or `settings.json`) permissions merged in
- [ ] `.claude/skills/playwright-vibe/SKILL.md` created with substitutions resolved
- [ ] `CLAUDE.md` updated with the Browser Testing note
- [ ] Smoke test green: `<run-in-web> test:e2e`

If any step failed, report which one and why. Don't silently skip.
