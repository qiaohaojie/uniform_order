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
import { test, expect } from "playwright/test";

const OPERATOR_EMAIL = process.env.DEMO_OPERATOR_EMAIL ?? "operator@demo.uniformorder.online";
const OPERATOR_PASSWORD = process.env.DEMO_OPERATOR_PASSWORD ?? "DemoPass123!";

async function signIn(page: import("playwright/test").Page, email: string, password: string) {
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
    await page
      .getByRole("link", { name: /checkout/i })
      .or(page.getByRole("button", { name: /checkout/i }))
      .click();
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
