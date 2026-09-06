/**
 * M04 parent donate + bag note + refund clause.
 *
 * Does not start the app. From repo root:
 *   pnpm dev:web
 *   PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 pnpm test:m04-donate-refund
 *
 * Auth uses GET /api/dev/login (NODE_ENV=development). Operator email must
 * match the tenant shop email (seed default below).
 *
 * baseURL and workers: 1 come from playwright.config.ts (same as M03).
 */
import { expect, test, type Page } from "playwright/test";

const TENANT = process.env.PRELOVED_TENANT ?? "imhs";
const OPERATOR_EMAIL =
  process.env.OPERATOR_EMAIL ?? "uniformshop@imhs.demo.uniformorder.online";

const SOLD_AS_WORN = /sold as worn/i;
const NO_CHANGE_OF_MIND = /change of mind is not offered/i;
const ACL_SENTENCE = /Australian Consumer Law/i;
const CHARITY_RECYCLING = /charity or textile recycling/i;

const MOBILE_VIEWPORT = { width: 430, height: 800 };
const DESKTOP_VIEWPORT = { width: 1440, height: 900 };

async function devLogin(page: Page, callbackPath: string) {
  const callbackURL = encodeURIComponent(callbackPath);
  const email = encodeURIComponent(OPERATOR_EMAIL);
  await page.goto(`/api/dev/login?email=${email}&callbackURL=${callbackURL}`);
  await page.waitForURL((url) => !url.pathname.startsWith("/api/dev/login"));
  if (page.url().includes("/auth/") || page.url().includes("sign-in")) {
    throw new Error(
      "Dev login did not establish an admin session. Use pnpm dev:web (NODE_ENV=development) and an operator shop email.",
    );
  }
}

async function openPrelovedSettings(page: Page) {
  await page.goto(`/admin/${TENANT}/settings`);
  const toggle = page.getByRole("switch", { name: "Enable preloved" });
  await expect(toggle).toBeVisible();
  return toggle;
}

async function savePrelovedSettings(page: Page) {
  await page.getByRole("button", { name: "Save preloved settings" }).click();
  await expect(page.getByRole("button", { name: "Save preloved settings" })).toBeEnabled();
}

async function ensurePrelovedDisabled(page: Page) {
  const toggle = await openPrelovedSettings(page);
  if ((await toggle.getAttribute("aria-checked")) === "true") {
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await savePrelovedSettings(page);
  }
  await expect(page.getByRole("link", { name: "Preloved" })).toHaveCount(0, {
    timeout: 15_000,
  });
}

async function ensurePrelovedEnabled(page: Page) {
  const toggle = await openPrelovedSettings(page);
  if ((await toggle.getAttribute("aria-checked")) !== "true") {
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
  }
  // Always PATCH so the ACL clause is persisted on tenant_legal_versions.
  await savePrelovedSettings(page);
  await expect(page.getByRole("link", { name: "Preloved" })).toBeVisible({
    timeout: 15_000,
  });
}

async function openShopFooter(page: Page) {
  await page.goto(`/${TENANT}`);
  await expect(page.getByRole("navigation", { name: "Tenant policies" })).toBeVisible();
}

async function expectDonatePageCopy(page: Page) {
  await expect(page.getByTestId("donate-page")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Donate preloved" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What not to bring" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Refuse list" })).toBeVisible();
  await expect(page.getByText("Shop hours")).toBeVisible();
  await expect(page.getByText("Address", { exact: true })).toBeVisible();
  await expect(page.getByText(CHARITY_RECYCLING)).toBeVisible();
}

test.describe("M04 donate + bag note + refund clause", () => {
  test.describe.configure({ mode: "serial" });

  test("with preloved off, Donate is hidden and the donate route is 404", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await devLogin(page, `/admin/${TENANT}/settings`);
    await ensurePrelovedDisabled(page);

    await openShopFooter(page);
    await expect(page.getByTestId("footer-donate-link")).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: "Tenant policies" }).getByRole("link", { name: "Donate" }),
    ).toHaveCount(0);

    const response = await page.goto(`/${TENANT}/preloved/donate`);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByTestId("donate-page")).toHaveCount(0);
  });

  test("with preloved on, donate is visible at 430px and 1440px, bag note succeeds, refund clause shows", async ({
    page,
  }) => {
    await devLogin(page, `/admin/${TENANT}/settings`);
    await ensurePrelovedEnabled(page);

    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(`/${TENANT}/preloved/donate`);
    await expectDonatePageCopy(page);

    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.reload();
    await expectDonatePageCopy(page);

    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(`/${TENANT}/preloved/donate`);
    await expect(page.getByTestId("donate-page")).toBeVisible();
    await page.getByTestId("donate-note-parent").locator("input").fill("M04 Playwright Parent");
    await page.getByTestId("donate-note-student").locator("input").fill("M04 Playwright Student");
    await page.getByTestId("donate-note-bags").locator("input").fill("1");
    await page.getByTestId("donate-note-submit").click();
    await expect(page.getByTestId("donate-note-success")).toBeVisible();

    await page.goto(`/${TENANT}/refund-policy`);
    await expect(page.getByRole("heading", { name: "Refund policy" })).toBeVisible();
    const policyBody = page.getByTestId("refund-policy-text");
    await expect(policyBody).toContainText(SOLD_AS_WORN);
    await expect(policyBody).toContainText(NO_CHANGE_OF_MIND);
    await expect(policyBody).toContainText(ACL_SENTENCE);
  });
});
