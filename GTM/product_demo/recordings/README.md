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
