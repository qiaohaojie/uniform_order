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

const TENANT = process.env.PRELOVED_TENANT ?? "imhs";
const OPERATOR_EMAIL =
  process.env.OPERATOR_EMAIL ?? "uniformshop@imhs.demo.uniformorder.online";
const ITEM_ID = process.env.PRELOVED_ITEM_ID ?? "polo";
const ITEM_NAME = process.env.PRELOVED_ITEM_NAME ?? "Sports Polo Shirt";
const SIZE = process.env.PRELOVED_SIZE ?? "10";
const CONDITION = "good";

function pooledRow(page: Page) {
  return page.locator(
    `[data-testid="stock-row"][data-source-item-id="${ITEM_ID}"][data-size="${SIZE}"][data-condition="${CONDITION}"]`,
  );
}

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

async function chooseSelect(page: Page, testId: string, optionName: string | RegExp) {
  await page.getByTestId(testId).click();
  const option =
    typeof optionName === "string"
      ? page.getByRole("option", { name: optionName, exact: true })
      : page.getByRole("option", { name: optionName });
  await expect(option).toBeVisible();
  await option.click();
}

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

async function ensurePrelovedEnabled(page: Page) {
  await page.goto(`/admin/${TENANT}/settings`);
  const toggle = page.getByRole("switch", { name: "Enable preloved" });
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute("aria-checked")) !== "true") {
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await page.getByRole("button", { name: "Save preloved settings" }).click();
  }
  await expect(page.getByRole("link", { name: "Preloved" })).toBeVisible({
    timeout: 15_000,
  });
}

async function acceptSize10PoloGood(page: Page) {
  await page.goto(`/admin/${TENANT}/preloved/intake`);
  await expect(page.getByTestId("intake-desk")).toBeVisible();
  await chooseSelect(page, "intake-item", ITEM_NAME);
  await chooseSelect(page, "intake-size", SIZE);
  await page.getByTestId("intake-condition").getByText("Good", { exact: true }).click();
  await expect(page.getByTestId("intake-price").locator("input")).not.toHaveValue("");
  await page.getByTestId("intake-accept").click();
  await expect(page.getByTestId("intake-success")).toContainText(/Accepted/i);
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
