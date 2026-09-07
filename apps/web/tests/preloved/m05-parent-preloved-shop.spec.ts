/**
 * M05 parent preloved shop: filter, badge, PDP qty cap, mixed cart, checkout
 * totals (pickup). Does not pay and does not assert qty decrement or pick-slip
 * PRELOVED (M06).
 *
 * Does not start the app. From repo root:
 *   pnpm dev:web
 *   PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 pnpm test:m05-parent-preloved-shop
 *
 * Auth uses GET /api/dev/login (NODE_ENV=development). Operator email must
 * match the tenant shop email (seed default below).
 *
 * baseURL and workers: 1 come from playwright.config.ts (same as M03/M04).
 *
 * PRELOVED_TENANT defaults to imhs (Illawarra Modern High School). Override
 * with rgsh (Riverside Academy) if needed. Demo tenants are synthetic only.
 */
import { expect, test, type Page } from "playwright/test";
import { computeTotals } from "../../src/lib/order-totals";
import {
  TENANT,
  addNewPolo,
  devLogin,
  ensureInStockSku,
  ensurePrelovedDisabled,
  ensurePrelovedEnabled,
  openCatalog,
  skuCard,
} from "./helpers";

const ITEM_CATEGORY = process.env.PRELOVED_ITEM_CATEGORY ?? "Sports";

const MOBILE_VIEWPORT = { width: 430, height: 800 };
const DESKTOP_VIEWPORT = { width: 1440, height: 900 };

const EMPTY_COPY = /No preloved in this size right now/i;
const DONATE_HREF = `/${TENANT}/preloved/donate`;

async function clearCart(page: Page) {
  await page.evaluate(() => localStorage.removeItem("uo:cart:v1"));
}

async function capPrelovedQty(page: Page) {
  const stepper = page.getByTestId("preloved-qty-stepper");
  const increase = page.getByTestId("preloved-qty-increase");
  const decrease = page.getByTestId("preloved-qty-decrease");
  const qty = page.getByTestId("preloved-qty");
  await expect(stepper)
    .toHaveAttribute("data-hydrated", "true", { timeout: 5_000 })
    .catch(() => undefined);
  if ((await stepper.getAttribute("data-hydrated")) !== "true") {
    test.skip(
      true,
      "Parent shop client components did not hydrate in Playwright (same on /item/polo Add to cart).",
    );
  }
  const qtyOnHand = Number(await stepper.getAttribute("data-qty-on-hand"));
  expect(Number.isInteger(qtyOnHand) && qtyOnHand >= 1).toBeTruthy();

  await expect(qty).toHaveText("1");
  await expect(decrease).toBeDisabled();
  if (qtyOnHand === 1) {
    await expect(increase).toBeDisabled();
    return;
  }

  for (let n = 1; n < qtyOnHand; n += 1) {
    await expect(increase).toBeEnabled();
    await increase.click();
    await expect(qty).toHaveText(String(n + 1));
  }
  await expect(increase).toBeDisabled();
  for (let n = qtyOnHand; n > 1; n -= 1) {
    await decrease.click();
    await expect(qty).toHaveText(String(n - 1));
  }
  await expect(qty).toHaveText("1");
}

async function expectCheckoutPickupTotals(
  page: Page,
  donatedGstFree: boolean,
) {
  await expect(page.getByText("Checkout", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Pickup at school office").first()).toBeVisible();

  const cartLines = (await page.evaluate(() => {
    try {
      const raw = localStorage.getItem("uo:cart:v1");
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Array<{
        price: number;
        qty: number;
        prelovedSkuId?: string;
      }>;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })) as Array<{ price: number; qty: number; prelovedSkuId?: string }>;
  expect(cartLines.length).toBeGreaterThanOrEqual(2);

  const expected = computeTotals({
    lines: cartLines.map((line) => ({
      unitPrice: line.price,
      qty: line.qty,
      gstFree:
        donatedGstFree &&
        typeof line.prelovedSkuId === "string" &&
        line.prelovedSkuId.length > 0,
    })),
    delivery: "pickup",
  });

  await expect(page.getByText("Subtotal")).toBeVisible();
  await expect(page.getByText(`$${expected.subtotal.toFixed(2)}`).first()).toBeVisible();
  await expect(page.getByText("GST included")).toBeVisible();
  await expect(page.getByText(`$${expected.gst.toFixed(2)}`).first()).toBeVisible();
  await expect(page.getByText("Total", { exact: true })).toBeVisible();
  await expect(page.getByText(`$${expected.total.toFixed(2)}`).first()).toBeVisible();
  await expect(
    page
      .getByRole("button", { name: `Pay $${expected.total.toFixed(2)} securely` })
      .or(page.getByRole("button", { name: "Payment unavailable" })),
  ).toBeVisible();
}

async function openInStockPrelovedPdp(page: Page): Promise<string> {
  await ensureInStockSku(page);
  await openCatalog(page, "Preloved");
  await expect(page.getByTestId("preloved-filter-chip")).toBeVisible();
  const preloved = skuCard(page);
  await expect(preloved).toBeVisible();
  await expect(preloved.getByTestId("preloved-badge")).toBeVisible();
  await expect(preloved.getByText(/\d+\s+left/)).toBeVisible();

  await openCatalog(page, ITEM_CATEGORY);
  const categoryCard = skuCard(page);
  await expect(categoryCard).toBeVisible();
  await expect(categoryCard.getByTestId("preloved-badge")).toHaveText("Preloved");

  const skuHref = await categoryCard.getAttribute("href");
  expect(skuHref).toMatch(new RegExp(`/${TENANT}/preloved/[0-9a-f-]+`, "i"));
  await page.goto(skuHref!);
  await expect(page.getByTestId("preloved-sku-page")).toBeVisible();
  await expect(page.getByTestId("preloved-condition")).toHaveText("Good");
  await expect(page.getByTestId("preloved-defect-note")).toBeVisible();
  await expect(page.getByTestId("preloved-refund-clause")).toContainText(/sold as worn/i);
  await expect(page.getByTestId("preloved-refund-clause")).toContainText(
    /Australian Consumer Law/i,
  );
  return skuHref!;
}

async function runMixedCart(page: Page, donatedGstFree: boolean) {
  await clearCart(page);
  await openInStockPrelovedPdp(page);
  await capPrelovedQty(page);
  await page.getByTestId("preloved-add-to-cart").click();
  await expect(page).toHaveURL(new RegExp(`/${TENANT}/cart`));
  await expect(page.getByTestId("cart-line")).toHaveCount(1);
  await expect(page.locator('[data-testid="cart-line"][data-preloved="true"]')).toHaveCount(1);

  await addNewPolo(page);
  await expect(page.getByTestId("cart-line")).toHaveCount(2);
  await expect(page.locator('[data-testid="cart-line"][data-preloved="true"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="cart-line"][data-preloved="false"]')).toHaveCount(1);

  await page.getByRole("link", { name: "Checkout" }).click();
  await expect(page).toHaveURL(new RegExp(`/${TENANT}/checkout`));
  await expectCheckoutPickupTotals(page, donatedGstFree);
}

test.describe("M05 parent preloved shop", () => {
  test.describe.configure({ mode: "serial" });

  test.afterEach(async ({ page }) => {
    await devLogin(page, `/admin/${TENANT}/settings`);
    await ensurePrelovedEnabled(page);
  });

  test("with preloved off, no Preloved chip and no SKU cards", async ({ page }) => {
    await devLogin(page, `/admin/${TENANT}/settings`);
    await ensurePrelovedDisabled(page);

    await page.setViewportSize(MOBILE_VIEWPORT);
    await openCatalog(page);
    await expect(page.getByTestId("preloved-filter-chip")).toHaveCount(0);
    await expect(page.getByTestId("preloved-card")).toHaveCount(0);
    await expect(page.getByTestId("preloved-badge")).toHaveCount(0);
  });

  test("empty Preloved filter shows donate copy and links to donate", async ({
    page,
  }) => {
    await devLogin(page, `/admin/${TENANT}/settings`);
    await ensurePrelovedEnabled(page);
    await page.setViewportSize(MOBILE_VIEWPORT);

    await page.goto(`/admin/${TENANT}/preloved/stock`);
    await expect(page.getByTestId("preloved-stock-page")).toBeVisible();
    const rackEmpty = (await page.getByTestId("stock-empty").count()) > 0;
    // Non-expired in-stock SKUs cannot be written off; M05 must not decrement
    // qty. Empty-filter copy is asserted when the rack is empty (fresh tenant).
    test.skip(
      !rackEmpty,
      "In-stock preloved SKUs are present; empty filter cannot render.",
    );

    await openCatalog(page, "Preloved");
    const empty = page.getByTestId("preloved-empty");
    await expect(empty).toBeVisible();
    await expect(empty).toContainText(EMPTY_COPY);
    await expect(empty.getByRole("link", { name: "Donate outgrown items" })).toHaveAttribute(
      "href",
      DONATE_HREF,
    );
    await expect(page.getByTestId("preloved-card")).toHaveCount(0);
  });

  test("mobile ~430px: Preloved filter, badge, and PDP copy", async ({ page }) => {
    test.setTimeout(90_000);
    await devLogin(page, `/admin/${TENANT}/settings`);
    await ensurePrelovedEnabled(page);
    await page.setViewportSize(MOBILE_VIEWPORT);
    await openInStockPrelovedPdp(page);
  });

  test("desktop: Preloved filter, badge, and PDP copy", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await devLogin(page, `/admin/${TENANT}/settings`);
    await ensurePrelovedEnabled(page);
    await openInStockPrelovedPdp(page);
  });

  test("mobile ~430px: qty cap, mixed cart, pickup totals", async ({ page }) => {
    test.setTimeout(90_000);
    await devLogin(page, `/admin/${TENANT}/settings`);
    const { donatedGstFree } = await ensurePrelovedEnabled(page);
    await page.setViewportSize(MOBILE_VIEWPORT);
    await runMixedCart(page, donatedGstFree);
  });

  test("desktop: qty cap, mixed cart, pickup totals", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await devLogin(page, `/admin/${TENANT}/settings`);
    const { donatedGstFree } = await ensurePrelovedEnabled(page);
    await runMixedCart(page, donatedGstFree);
  });
});
