/**
 * Shared Playwright helpers for M03/M04/M05/M06 preloved specs.
 *
 * Auth uses GET /api/dev/login (NODE_ENV=development). Operator email must
 * match the tenant shop email (seed default below).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import Stripe from "stripe";
import { expect, type Locator, type Page } from "playwright/test";

export const TENANT = process.env.PRELOVED_TENANT ?? "imhs";
export const OPERATOR_EMAIL =
  process.env.OPERATOR_EMAIL ?? "uniformshop@imhs.demo.uniformorder.online";
export const ITEM_ID = process.env.PRELOVED_ITEM_ID ?? "polo";
export const ITEM_NAME = process.env.PRELOVED_ITEM_NAME ?? "Sports Polo Shirt";
export const SIZE = process.env.PRELOVED_SIZE ?? "10";
export const CONDITION = "good";

/** Load apps/web/.env.local (or repo-root .env.local) into process.env once. */
export function loadLocalEnv() {
  for (const candidate of [
    resolve(process.cwd(), ".env.local"),
    resolve(process.cwd(), "../.env.local"),
    resolve(process.cwd(), "../../.env.local"),
  ]) {
    if (!existsSync(candidate)) continue;
    for (const raw of readFileSync(candidate, "utf8").split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const i = line.indexOf("=");
      if (i < 1) continue;
      const k = line.slice(0, i).replace(/^export\s+/, "");
      let v = line.slice(i + 1);
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!(k in process.env)) process.env[k] = v;
    }
    return;
  }
}

/** Seed/Connect webhooks can flip stripe_charges_enabled false. Pin it true before PI mint. */
export async function forceChargesEnabled(tenantId: string = TENANT) {
  loadLocalEnv();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing for forceChargesEnabled");
  const sql = neon(url);
  await sql`update tenants set stripe_charges_enabled = true where id = ${tenantId}`;
}

export async function confirmVisaPayment(paymentIntentId: string) {
  loadLocalEnv();
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY missing");
  const stripe = new Stripe(key);
  const pi = await stripe.paymentIntents.confirm(paymentIntentId, {
    payment_method: "pm_card_visa",
    return_url: `http://127.0.0.1:3000/${TENANT}/order/placed`,
  });
  if (pi.status !== "succeeded") {
    throw new Error(`expected succeeded PaymentIntent, got ${pi.status}`);
  }
}

export type PrelovedQtySnapshot = { id: string; qtyOnHand: number };

/**
 * Snapshot every in-stock preloved SKU for the tenant, then zero qty_on_hand so
 * the parent Preloved filter renders empty without write-off or sale. Always
 * restore via restoreShopPrelovedQty (try/finally).
 */
export async function emptyShopPrelovedQty(
  tenantId: string = TENANT,
): Promise<PrelovedQtySnapshot[]> {
  loadLocalEnv();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing for emptyShopPrelovedQty");
  const sql = neon(url);
  const rows = await sql`
    select id, qty_on_hand
    from preloved_skus
    where tenant_id = ${tenantId}
      and qty_on_hand > 0
  `;
  const snapshot = (rows as Array<{ id: string; qty_on_hand: number }>).map(
    (row) => ({ id: row.id, qtyOnHand: Number(row.qty_on_hand) }),
  );
  if (snapshot.length === 0) return snapshot;
  await sql`
    update preloved_skus
    set qty_on_hand = 0
    where tenant_id = ${tenantId}
      and qty_on_hand > 0
  `;
  return snapshot;
}

/** Restore qty_on_hand after emptyShopPrelovedQty. No-op on an empty snapshot. */
export async function restoreShopPrelovedQty(
  snapshot: PrelovedQtySnapshot[],
): Promise<void> {
  if (snapshot.length === 0) return;
  loadLocalEnv();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing for restoreShopPrelovedQty");
  const sql = neon(url);
  for (const row of snapshot) {
    if (!Number.isInteger(row.qtyOnHand) || row.qtyOnHand < 0) {
      throw new Error(
        `restoreShopPrelovedQty bad qty for ${row.id}: ${row.qtyOnHand}`,
      );
    }
    await sql`
      update preloved_skus
      set qty_on_hand = ${row.qtyOnHand}
      where id = ${row.id}
    `;
  }
}

/** Pin qty / GST on a pooled SKU. Returns null when the row does not exist. */
export async function pinPooledSkuForTest(opts: {
  qty: number;
  gstFree?: boolean;
  size?: string;
  condition?: string;
}): Promise<{ skuId: string } | null> {
  if (!Number.isInteger(opts.qty) || opts.qty < 0) {
    throw new Error(`pinPooledSkuForTest expects non-negative integer qty, got ${opts.qty}`);
  }
  loadLocalEnv();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing for pinPooledSkuForTest");
  const sql = neon(url);
  const size = opts.size ?? SIZE;
  const condition = opts.condition ?? CONDITION;
  const rows =
    opts.gstFree === undefined
      ? await sql`
          update preloved_skus
          set qty_on_hand = ${opts.qty}
          where tenant_id = ${TENANT}
            and source_item_id = ${ITEM_ID}
            and size = ${size}
            and condition = ${condition}
          returning id
        `
      : await sql`
          update preloved_skus
          set qty_on_hand = ${opts.qty},
              gst_free = ${opts.gstFree}
          where tenant_id = ${TENANT}
            and source_item_id = ${ITEM_ID}
            and size = ${size}
            and condition = ${condition}
          returning id
        `;
  if (rows.length === 0) return null;
  const row = rows[0] as { id: string };
  return { skuId: row.id };
}

/** Pin qty_on_hand for the pooled size/condition SKU (race fixtures). */
export async function pinPooledSkuQty(qty: number): Promise<{
  skuId: string;
  unitPrice: number;
  sourceItemId: string;
}> {
  if (!Number.isInteger(qty) || qty < 0) {
    throw new Error(`pinPooledSkuQty expects non-negative integer, got ${qty}`);
  }
  loadLocalEnv();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing for pinPooledSkuQty");
  const sql = neon(url);
  const rows = await sql`
    update preloved_skus
    set qty_on_hand = ${qty}
    where tenant_id = ${TENANT}
      and source_item_id = ${ITEM_ID}
      and size = ${SIZE}
      and condition = ${CONDITION}
    returning id, price, source_item_id
  `;
  if (rows.length === 0) {
    throw new Error(
      `No preloved SKU for ${TENANT}/${ITEM_ID} size ${SIZE} ${CONDITION}; intake one first.`,
    );
  }
  const row = rows[0] as {
    id: string;
    price: string | number;
    source_item_id: string;
  };
  return {
    skuId: row.id,
    unitPrice: Number(row.price),
    sourceItemId: row.source_item_id,
  };
}

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

/** Put shared demo-academy back to donation-only after consignment gates. */
export async function restoreDonationOnlyIntake(page: Page) {
  const res = await page.request.patch(`/api/tenant/${TENANT}/preloved`, {
    data: { intakeMode: "donation_only" },
  });
  if (!res.ok()) {
    throw new Error(
      `restore donation_only failed: ${res.status()} ${await res.text()}`,
    );
  }
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
