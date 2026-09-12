/**
 * M05 hydration gap: parent-shop client islands must hydrate in Playwright.
 *
 * Does not start the app. From repo root:
 *   pnpm dev:web
 *   PLAYWRIGHT_BASE_URL=http://127.0.0.1:<port> pnpm test:m05-parent-hydration
 *
 * Bound to demo-academy by the package script (live Neon has no imhs). Hard-fails
 * if data-hydrated stays false — unlike m05-parent-preloved-shop which soft-skips.
 *
 * baseURL and workers: 1 come from playwright.config.ts.
 */
import { expect, test, type Page } from "playwright/test";
import {
  ITEM_ID,
  TENANT,
  devLogin,
  ensureInStockSku,
  ensurePrelovedEnabled,
  openCatalog,
  skuCard,
} from "./helpers";

const MOBILE_VIEWPORT = { width: 430, height: 800 };
const HYDRATE_TIMEOUT_MS = 15_000;

async function clearCart(page: Page) {
  if (page.url() === "about:blank" || !page.url().includes(TENANT)) {
    await page.goto(`/${TENANT}`);
  }
  await page.evaluate(() => localStorage.removeItem("uo:cart:v1"));
}

async function openInStockPrelovedPdp(page: Page) {
  await ensureInStockSku(page);
  await openCatalog(page, "Preloved");
  const card = skuCard(page);
  await expect(card).toBeVisible();
  const href = await card.getAttribute("href");
  expect(href).toMatch(new RegExp(`/${TENANT}/preloved/[0-9a-f-]+`, "i"));
  await page.goto(href!);
  await expect(page.getByTestId("preloved-sku-page")).toBeVisible();
}

test.describe("M05 parent-shop hydration", () => {
  test.describe.configure({ mode: "serial" });

  test("preloved qty stepper hydrates and Add to cart navigates", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(MOBILE_VIEWPORT);
    await devLogin(page, `/admin/${TENANT}/settings`);
    await ensurePrelovedEnabled(page);
    await clearCart(page);
    await openInStockPrelovedPdp(page);

    const stepper = page.getByTestId("preloved-qty-stepper");
    await expect(stepper).toBeVisible();
    await expect(stepper).toHaveAttribute("data-hydrated", "true", {
      timeout: HYDRATE_TIMEOUT_MS,
    });

    const qtyOnHand = Number(await stepper.getAttribute("data-qty-on-hand"));
    expect(Number.isInteger(qtyOnHand) && qtyOnHand >= 1).toBeTruthy();

    const increase = page.getByTestId("preloved-qty-increase");
    const decrease = page.getByTestId("preloved-qty-decrease");
    const qty = page.getByTestId("preloved-qty");
    await expect(qty).toHaveText("1");
    await expect(decrease).toBeDisabled();

    if (qtyOnHand === 1) {
      await expect(increase).toBeDisabled();
    } else {
      await expect(increase).toBeEnabled();
      await increase.click();
      await expect(qty).toHaveText("2");
      await decrease.click();
      await expect(qty).toHaveText("1");
    }

    await page.getByTestId("preloved-add-to-cart").click();
    await expect(page).toHaveURL(new RegExp(`/${TENANT}/cart`));
    await expect(
      page.locator('[data-testid="cart-line"][data-preloved="true"]'),
    ).toHaveCount(1);
  });

  test("new catalogue Add to cart hydrates and navigates", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize(MOBILE_VIEWPORT);
    await clearCart(page);
    await page.goto(`/${TENANT}/item/${ITEM_ID}`);

    const add = page.getByRole("button", { name: /Add to cart/i });
    await expect(add).toBeVisible();
    // Client onClick must fire; dead SSR leaves us on the PDP.
    await expect
      .poll(
        async () => {
          await add.click({ trial: true }).catch(() => undefined);
          return add.isEnabled();
        },
        { timeout: HYDRATE_TIMEOUT_MS },
      )
      .toBe(true);

    const sizeBtn = page.getByRole("button", { name: "10", exact: true });
    if ((await sizeBtn.count()) > 0) await sizeBtn.click();
    await add.click();
    await expect(page).toHaveURL(new RegExp(`/${TENANT}/cart`), {
      timeout: HYDRATE_TIMEOUT_MS,
    });
    await expect(
      page.locator('[data-testid="cart-line"][data-preloved="false"]'),
    ).toHaveCount(1);
  });
});
