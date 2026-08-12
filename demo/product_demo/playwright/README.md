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
pnpm exec playwright test -c ../../demo/product_demo/playwright/demo-recording.config.ts
```

> **Note:** the agent does not run this command — headed Playwright must be run from your own terminal so the browser window can render.

## Record one act

```bash
cd apps/web
pnpm exec playwright test -c ../../demo/product_demo/playwright/demo-recording.config.ts --grep "Act 3"
```

## Record desktop only

```bash
pnpm exec playwright test -c ../../demo/product_demo/playwright/demo-recording.config.ts --project=desktop
```

## Viewports

- `desktop` — 1920 × 1080, Chromium headed.
- `mobile` — iPhone 13 emulation (390 × 844), Chromium headed.

## Selector brittleness

The spec uses `getByRole` and `getByLabel` where the UI exposes accessible names. Where it doesn't, `getByText` is used and the line is marked with `// Brittle:`. If a recording fails after a UI change, search the spec for `Brittle:` comments and update.

## Output

Videos: `demo/product_demo/recordings/output/<project>/<test-id>/video.webm`. Gitignored.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Pre-flight: server not responding` | dev server not running | `pnpm --filter web dev` in another terminal |
| Sign-in fails on Acts 2/4/5/6 | Neon Auth user missing or password mismatch | See `demo_data/operator_run_guide.md` |
| Acts 3/4/5/6 fail mid-flow | UI selector changed | Update the `Brittle:`-marked selector in `record-demo.spec.ts` |
| No video produced | Headless mode accidentally on | `headless: false` in config (default) |
| Recording sped up | Default `slowMo` overridden | Config sets `slowMo: 300`; verify env not overriding |
