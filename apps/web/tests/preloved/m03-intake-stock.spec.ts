/**
 * M03 desktop flow: enable preloved → accept size-10 polo Good twice →
 * Stock shows a single pooled row whose qty is 1 then 2 (or +1 then +2 if
 * that SKU already had stock).
 *
 * Does not start the app. From repo root:
 *   pnpm dev:web
 *   PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 pnpm test:m03-intake-stock
 *
 * Auth uses GET /api/dev/login (NODE_ENV=development). Operator email must
 * match the tenant shop email (seed default below).
 */
import { expect, test, type Page } from "playwright/test";
import {
  TENANT,
  acceptSize10PoloGood,
  devLogin,
  ensurePrelovedEnabled,
  pooledRow,
} from "./helpers";

async function readQty(page: Page): Promise<number> {
  const row = pooledRow(page);
  if ((await row.count()) === 0) return 0;
  const text = (await row.getByTestId("stock-qty").innerText()).trim();
  const qty = Number(text);
  if (!Number.isInteger(qty) || qty < 0) {
    throw new Error(`stock-qty was not a non-negative integer: ${JSON.stringify(text)}`);
  }
  return qty;
}

async function openStock(page: Page) {
  const stockTab = page.getByRole("tab", { name: "Stock" }).or(page.getByRole("link", { name: "Stock" }));
  if ((await stockTab.count()) > 0) {
    await stockTab.first().click();
  } else {
    await page.goto(`/admin/${TENANT}/preloved/stock`);
  }
  await expect(page).toHaveURL(new RegExp(`/admin/${TENANT}/preloved/stock`));
  await expect(page.getByTestId("preloved-stock-page")).toBeVisible();
}

test.describe("M03 operator accept → stock qty", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("accept size-10 polo Good twice pools onto one stock row (qty 1 then 2)", async ({
    page,
  }) => {
    await devLogin(page, `/admin/${TENANT}/settings`);
    await ensurePrelovedEnabled(page);

    await page.goto(`/admin/${TENANT}/preloved/stock`);
    await expect(page.getByTestId("preloved-stock-page")).toBeVisible();
    const qtyBefore = await readQty(page);

    await acceptSize10PoloGood(page);
    await openStock(page);
    await expect(pooledRow(page)).toHaveCount(1);
    await expect(pooledRow(page).getByTestId("stock-qty")).toHaveText(String(qtyBefore + 1));

    await acceptSize10PoloGood(page);
    await openStock(page);
    await expect(pooledRow(page)).toHaveCount(1);
    await expect(pooledRow(page).getByTestId("stock-qty")).toHaveText(String(qtyBefore + 2));
  });
});
