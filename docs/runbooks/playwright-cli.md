# playwright-cli — bind before driving a web app

Web drive, self-ver capture, and live UI proof use **playwright-cli** (process
`0700` / `0800`). The Playwright **test runner** (`@playwright/test`) is a
separate project dependency added later by `e2e-setup`. This gate is the CLI
that an agent uses to click, screenshot, and record video.

## Hard gate

Run from the repo root before driving a browser or capturing chrome:

```bash
bash .gq-spec/check-playwright-cli.sh
```

Exit 0 prints `playwright-cli: OK <bin> <version>`. Any other exit code means
**stop**: do not switch to a browser MCP, a screenshot of a mock, or a guessed
flow. Install first, then continue.

`.gq-spec/bootstrap.sh` runs this check and reports it. A failing check is a
warning at bootstrap time and a hard stop at drive / self-ver time (process
`0200` Step 3b).

## What “ready” means

| Check | How |
| --- | --- |
| Binary | `playwright-cli` on PATH, or `npx --no-install playwright-cli` already in the tree |
| Commands | `--help` lists `screenshot`, `resize`, `video-start`, `video-stop`, `snapshot` |
| Browser | `install-browser --list` shows Chromium |

The check never runs `npx -y` (that would install as a side effect).

## Install (all agents — same machine)

Global CLI (preferred; one install serves Cursor, Claude Code, Codex, Grok):

```bash
npm install -g @playwright/cli@latest
playwright-cli --version
playwright-cli install-browser chromium
bash .gq-spec/check-playwright-cli.sh
```

If global npm is not allowed, add `@playwright/cli` as a **devDependency** of
the app workspace and re-run the check (`npx --no-install` will then resolve).
Do not silently fall back to Playwright MCP or a different driver.

Paid/Pro licence is not required. Network install still needs a live registry.

## Verify

```bash
bash .gq-spec/check-playwright-cli.sh
playwright-cli --help | grep -E 'screenshot|video-start|resize'
```

A live drive still needs a running app (`scripts/dev-local.sh` or the repo
`dev` script) and this worktree's origin (process `0100`). The CLI gate does
not start the app.

Before any **video**, read `300_Lesson_Learned/Playwright/` (1080p default,
explicit `video.size`, WebKit Secure-cookie auth-drop).

Owner: process **0200** (gate) and **0700** / **0800** (drive and capture).
