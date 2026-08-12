import { defineConfig, devices } from "playwright/test";

const baseURL = process.env.DEMO_BASE_URL ?? "http://localhost:3000";

// iPhone 13 viewport (read from Playwright's device registry so video size
// matches whatever Playwright emulates).
const iphone13Viewport = devices["iPhone 13"].viewport;

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
    // IMPORTANT: `video: "on"` alone records at ~800x450 (Playwright scales the
    // video down to fit an 800x800 box). For sales-ready recordings we want
    // Full HD on desktop and native viewport on mobile — set `video.size`
    // explicitly per project, never rely on the default.
    video: { mode: "on", size: { width: 1920, height: 1080 } },
    screenshot: "off",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "desktop",
      use: {
        viewport: { width: 1920, height: 1080 },
        // Explicit Full HD video size to match the desktop viewport. Inherits
        // from the top-level `use.video` but kept here for clarity — anyone
        // adding a new desktop-like project should copy this pattern.
        video: { mode: "on", size: { width: 1920, height: 1080 } },
      },
    },
    {
      // Force Chromium for iPhone 13 emulation — the default WebKit engine
      // refuses Secure-flagged cookies over http://localhost, so Better Auth
      // session cookies never get attached to navigations and every test
      // bounces back to /auth/sign-in.
      name: "mobile",
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        // Record at the iPhone 13 viewport so mobile videos look native.
        video: { mode: "on", size: iphone13Viewport },
      },
    },
  ],
  globalSetup: "./global-setup.ts",
});
