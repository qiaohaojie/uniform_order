/**
 * Platform owner console: approve, assign DB slug, turn the shop on.
 * School operators must not see /platform.
 *
 * Does not start the app. From repo root:
 *   pnpm dev:web
 *   PLAYWRIGHT_BASE_URL=… pnpm test:platform-portal
 *
 * Auth uses GET /api/dev/login (NODE_ENV=development).
 * PLATFORM_ADMIN_EMAIL must be in PLATFORM_ADMIN_EMAILS.
 */
import { expect, test, type Page } from "playwright/test";

const PLATFORM_ADMIN_EMAIL =
  process.env.PLATFORM_ADMIN_EMAIL ?? "platformadmin@demo.uniformorder.online";
const OPERATOR_EMAIL =
  process.env.OPERATOR_EMAIL ?? "operator@demo.uniformorder.online";

async function devLogin(page: Page, email: string, callbackPath: string) {
  const callbackURL = encodeURIComponent(callbackPath);
  await page.goto(`/api/dev/login?email=${encodeURIComponent(email)}&callbackURL=${callbackURL}`);
  await page.waitForURL((url) => !url.pathname.startsWith("/api/dev/login"));
  if (page.url().includes("/auth/") || page.url().includes("sign-in")) {
    throw new Error(
      "Dev login did not establish a session. Use pnpm dev:web (NODE_ENV=development).",
    );
  }
}

function uniqueSlug() {
  return `e2e${Date.now().toString(36).slice(-7)}`;
}

test.describe("Platform console auth", () => {
  test("unauthenticated visitors are sent to sign-in", async ({ page }) => {
    await page.goto("/platform");
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });

  test("school operators cannot open /platform", async ({ page }) => {
    await devLogin(page, OPERATOR_EMAIL, "/platform");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByTestId("platform-shell")).toHaveCount(0);
  });
});

test.describe("Platform owner onboarding", () => {
  test("create slug, approve, turn shop on, then delete unused school", async ({ page, browser }) => {
    const slug = uniqueSlug();
    const name = `E2E Platform ${slug}`;

    await devLogin(page, PLATFORM_ADMIN_EMAIL, "/platform/tenants");
    await expect(page.getByTestId("platform-shell")).toBeVisible();
    await expect(page.getByTestId("platform-tenants-page")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tenant schools" })).toBeVisible();

    await page.getByTestId("platform-provision").click();
    await expect(page.getByTestId("platform-step-identity")).toBeVisible();

    await page.getByTestId("platform-identity-name").fill(name);
    await page.getByTestId("platform-identity-slug").fill(slug);
    await page.getByTestId("platform-identity-submit").click();

    await expect(page).toHaveURL(new RegExp(`[?&]id=${slug}`));
    await page.goto(`/platform/tenants/${slug}`);
    await expect(page.getByTestId("platform-shop-status")).toBeVisible();
    await expect(page.getByTestId("platform-slug")).toHaveText(slug);
    await expect(page.getByTestId("platform-approval-status")).toContainText("Pending");

    await page.getByTestId("platform-approve").click();
    await expect(page.getByTestId("platform-approval-status")).toContainText("shop off", {
      timeout: 15_000,
    });

    await page.getByTestId("platform-shop-live").click();
    await expect(page.getByTestId("platform-approval-status")).toContainText("Live", {
      timeout: 15_000,
    });

    const anon = await browser.newContext();
    const parent = await anon.newPage();
    try {
      await parent.goto(`/${slug}`);
      await expect(parent.getByText(name).first()).toBeVisible({ timeout: 15_000 });
    } finally {
      await anon.close();
    }

    await page.getByTestId("platform-delete-tenant-start").click();
    await page.getByTestId("platform-delete-tenant").click();
    await expect(page.getByTestId("platform-tenants-page")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(`[data-slug="${slug}"]`)).toHaveCount(0);
  });

  test("reserved slug is rejected", async ({ page }) => {
    await devLogin(page, PLATFORM_ADMIN_EMAIL, "/platform/tenants/new");
    await expect(page.getByTestId("platform-step-identity")).toBeVisible();
    await page.getByTestId("platform-identity-name").fill("Should Not Save");
    await page.getByTestId("platform-identity-slug").fill("admin");
    await page.getByTestId("platform-identity-submit").click();
    await expect(page.getByTestId("platform-identity-error")).toContainText("Reserved");
    await expect(page).toHaveURL(/\/platform\/tenants\/new/);
  });
});
