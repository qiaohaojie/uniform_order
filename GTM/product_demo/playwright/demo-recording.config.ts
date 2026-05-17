import { defineConfig, devices } from "playwright/test";

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
