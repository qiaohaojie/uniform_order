/**
 * Shared Playwright helpers for M03/M04/M05/M06 preloved specs.
 *
 * Auth uses GET /api/dev/login (NODE_ENV=development). Operator email must
 * match the tenant shop email (seed default below).
 */
import { expect, type Locator, type Page } from "playwright/test";

export const TENANT = process.env.PRELOVED_TENANT ?? "imhs";
export const OPERATOR_EMAIL =
  process.env.OPERATOR_EMAIL ?? "uniformshop@imhs.demo.uniformorder.online";
export const ITEM_ID = process.env.PRELOVED_ITEM_ID ?? "polo";
export const ITEM_NAME = process.env.PRELOVED_ITEM_NAME ?? "Sports Polo Shirt";
export const SIZE = process.env.PRELOVED_SIZE ?? "10";
export const CONDITION = "good";

export function pooledRow(page: Page) {
  return page.locator(
    `[data-testid="stock-row"][data-source-item-id="${ITEM_ID}"][data-size="${SIZE}"][data-condition="${CONDITION}"]`,
  );
}

export async function chooseSelect(
  page: Page,
  testId: string,
  optionName: string | RegExp,
) {
  await page.getByTestId(testId).click();
  const option =
    typeof optionName === "string"
      ? page.getByRole("option", { name: optionName, exact: true })
      : page.getByRole("option", { name: optionName });
  await expect(option).toBeVisible();
  await option.click();
}

export async function devLogin(page: Page, callbackPath: string) {
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

const ADMIN_VIEWPORT = { width: 1440, height: 900 };

async function openPrelovedSettings(page: Page) {
  // AdminShell is a 240px sidebar + content. Parent-shop tests may have set
  // ~430px first; at that width the enable switch click does not toggle.
  await page.setViewportSize(ADMIN_VIEWPORT);
  await page.goto(`/admin/${TENANT}/settings`);
  const toggle = page.getByRole("switch", { name: "Enable preloved" });
  await expect(toggle).toBeVisible();
  return toggle;
}

function prelovedEnabledSwitch(page: Page) {
  return page.getByTestId("preloved-enabled-switch").or(
    page.getByRole("switch", { name: "Enable preloved" }),
  );
}

async function persistPrelovedEnabled(page: Page, enabled: boolean) {
  const toggle = prelovedEnabledSwitch(page);
  await expect(toggle).toBeVisible();
  const want = enabled ? "true" : "false";
  if ((await toggle.getAttribute("aria-checked")) === want && enabled) {
    // Enable path still PATCHes so the refund clause is persisted.
  }
  const res = await page.request.patch(`/api/tenant/${TENANT}/preloved`, {
    data: { prelovedEnabled: enabled },
  });
  if (!res.ok()) {
    throw new Error(
      `PATCH prelovedEnabled=${enabled} failed: ${res.status()} ${await res.text()}`,
    );
  }
  await page.reload();
  await expect(prelovedEnabledSwitch(page)).toHaveAttribute("aria-checked", want);
}

function gstFreeCheckbox(page: Page) {
  return page
    .locator("label")
    .filter({ hasText: "Treat donated preloved as GST-free" })
    .locator('input[type="checkbox"]');
}

async function readDonatedGstFree(page: Page): Promise<boolean> {
  return gstFreeCheckbox(page).isChecked();
}

export async function ensurePrelovedDisabled(page: Page) {
  await openPrelovedSettings(page);
  await persistPrelovedEnabled(page, false);
  await expect(page.getByRole("link", { name: "Preloved" })).toHaveCount(0, {
    timeout: 15_000,
  });
}

export async function ensurePrelovedEnabled(
  page: Page,
): Promise<{ donatedGstFree: boolean }> {
  await openPrelovedSettings(page);
  await persistPrelovedEnabled(page, true);
  const donatedGstFree = await readDonatedGstFree(page);
  await expect(page.getByRole("link", { name: "Preloved" })).toBeVisible({
    timeout: 15_000,
  });
  return { donatedGstFree };
}

export async function acceptSize10PoloGood(page: Page) {
  await page.goto(`/admin/${TENANT}/preloved/intake`);
  await expect(page.getByTestId("intake-desk")).toBeVisible();
  await chooseSelect(page, "intake-item", ITEM_NAME);
  await chooseSelect(page, "intake-size", SIZE);
  await page.getByTestId("intake-condition").getByText("Good", { exact: true }).click();
  await expect(page.getByTestId("intake-price").locator("input")).not.toHaveValue("");
  await page.getByTestId("intake-accept").click();
  await expect(page.getByTestId("intake-success")).toContainText(/Accepted/i);
}

export function parseMoney(text: string): number {
  const match = text.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  if (!match) {
    throw new Error(`could not parse money from ${JSON.stringify(text)}`);
  }
  return Number(match[1]);
}

export async function setVisitedCookie(page: Page) {
  if (page.url() === "about:blank") {
    await page.goto(`/${TENANT}`);
  }
  const { hostname } = new URL(page.url());
  await page.context().addCookies([
    {
      name: `uo:visited:${TENANT}`,
      value: "1",
      domain: hostname,
      path: `/${TENANT}`,
    },
  ]);
}

export async function openCatalog(page: Page, cat?: string) {
  await setVisitedCookie(page);
  const path = cat ? `/${TENANT}?cat=${encodeURIComponent(cat)}` : `/${TENANT}`;
  await page.goto(path);
  const browse = page.getByRole("button", { name: /Browse Catalogue/i });
  if ((await browse.count()) > 0) {
    await browse.click();
    await expect(page.getByTestId("shop-filter-chip").first()).toBeVisible();
    if (cat) await page.goto(path);
  }
  await expect(page.getByTestId("shop-filter-chip").first()).toBeVisible();
}

export async function readStockQty(page: Page): Promise<number> {
  await page.goto(`/admin/${TENANT}/preloved/stock`);
  await expect(page.getByTestId("preloved-stock-page")).toBeVisible();
  const row = pooledRow(page);
  if ((await row.count()) === 0) return 0;
  const text = (await row.getByTestId("stock-qty").innerText()).trim();
  const qty = Number(text);
  if (!Number.isInteger(qty) || qty < 0) {
    throw new Error(`stock-qty was not a non-negative integer: ${JSON.stringify(text)}`);
  }
  return qty;
}

export async function ensureInStockSku(page: Page): Promise<number> {
  const qty = await readStockQty(page);
  if (qty >= 1) return qty;
  await acceptSize10PoloGood(page);
  const after = await readStockQty(page);
  expect(after).toBeGreaterThanOrEqual(1);
  return after;
}

export function skuCard(page: Page): Locator {
  return page.locator(
    `[data-testid="preloved-card"][data-size="${SIZE}"][data-condition="${CONDITION}"]`,
    { hasText: ITEM_NAME },
  );
}

export async function addNewPolo(page: Page): Promise<number> {
  await page.goto(`/${TENANT}/item/${ITEM_ID}`);
  const add = page.getByRole("button", { name: /Add to cart/i });
  await expect(add).toBeVisible();
  const sizeBtn = page.getByRole("button", { name: SIZE, exact: true });
  if ((await sizeBtn.count()) > 0) await sizeBtn.click();
  const price = parseMoney(await add.innerText());
  await add.click();
  await expect(page).toHaveURL(new RegExp(`/${TENANT}/cart`));
  return price;
}
