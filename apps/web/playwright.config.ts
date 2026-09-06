import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "playwright/test";

/**
 * M03 operator intake → stock qty. E2e never boots the app (process 0500).
 * Bind this worktree: PLAYWRIGHT_BASE_URL, then `.dev-local/web.url`, then PORT.
 */
function resolveBaseURL(): string {
  const fromEnv = process.env.PLAYWRIGHT_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  for (const candidate of [
    resolve(process.cwd(), ".dev-local/web.url"),
    resolve(process.cwd(), "../.dev-local/web.url"),
  ]) {
    if (!existsSync(candidate)) continue;
    const url = readFileSync(candidate, "utf8").trim();
    if (url) return url.replace(/\/$/, "");
  }

  const port = process.env.PORT ?? process.env.WEB_PORT ?? "3000";
  return `http://127.0.0.1:${port}`;
}

export default defineConfig({
  testDir: "./tests/preloved",
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: resolveBaseURL(),
    browserName: "chromium",
    viewport: { width: 1440, height: 900 },
    screenshot: "off",
    video: "off",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
});
