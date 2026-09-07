/**
 * M06 fulfilment: pay one preloved unit → stock qty down → pick slip PRELOVED
 * on the preloved line only → Kanban still to_prepare with no extra column.
 * Oversell PI returns 409 insufficient_qty. New catalogue variants stay
 * untracked (fingerprint unchanged; new-only PI does not 409).
 *
 * Does not start the app. From repo root:
 *   pnpm dev:web
 *   PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 pnpm test:m06-preloved-fulfilment
 *
 * Auth uses GET /api/dev/login (NODE_ENV=development). Operator email must
 * match the tenant shop email (seed default below).
 *
 * baseURL and workers: 1 come from playwright.config.ts (same as M03–M05).
 *
 * PRELOVED_TENANT defaults to imhs (Illawarra Modern High School). Override
 * with rgsh (Riverside Academy) if needed. Demo tenants are synthetic only.
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import Stripe from "stripe";
import { expect, test, type Page } from "playwright/test";
import { computeTotals } from "../../src/lib/order-totals";
import { PRELOVED_VARIANT_LABEL } from "../../src/lib/preloved";
import {
  ITEM_ID,
  ITEM_NAME,
  OPERATOR_EMAIL,
  SIZE,
  TENANT,
  devLogin,
  ensureInStockSku,
  ensurePrelovedEnabled,
  openCatalog,
  parseMoney,
  readStockQty,
  skuCard,
} from "./helpers";

const STRIPE_TEST_CARD = "4242424242424242";
const STRIPE_TEST_EXPIRY = "1234";
const STRIPE_TEST_CVC = "123";
const STRIPE_TEST_POSTAL = "2000";

type CatalogVariant = {
  id: string;
  itemId: string;
  label: string;
  price: string | number;
  sizes: unknown;
  active: boolean;
  qty?: unknown;
  qtyOnHand?: unknown;
};

type CatalogItem = {
  id: string;
  variants: CatalogVariant[];
};

async function fetchCatalog(page: Page): Promise<CatalogItem[]> {
  const res = await page.request.get(`/api/catalog?tenantId=${encodeURIComponent(TENANT)}`);
  expect(res.ok(), `GET /api/catalog failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  const body = (await res.json()) as CatalogItem[];
  expect(Array.isArray(body)).toBeTruthy();
  return body;
}

function catalogVariantsFingerprint(items: CatalogItem[]) {
  return items
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((item) => ({
      itemId: item.id,
      variants: (item.variants ?? [])
        .slice()
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((v) => ({
          id: v.id,
          itemId: v.itemId,
          label: v.label,
          price: String(v.price),
          sizes: v.sizes,
          active: v.active,
        })),
    }));
}

function expectNoQtyOnCatalogVariants(items: CatalogItem[]) {
  for (const item of items) {
    for (const variant of item.variants ?? []) {
      expect(
        variant,
        `catalog_variants ${variant.id} must not carry qty`,
      ).not.toHaveProperty("qty");
      expect(
        variant,
        `catalog_variants ${variant.id} must not carry qtyOnHand`,
      ).not.toHaveProperty("qtyOnHand");
    }
  }
}

function pickNewPoloVariant(items: CatalogItem[]): {
  itemId: string;
  variantLabel: string;
  unitPrice: number;
  size: string;
} {
  const polo = items.find((item) => item.id === ITEM_ID);
  expect(polo, `catalog is missing ${ITEM_ID}`).toBeTruthy();
  const variant =
    polo!.variants.find(
      (v) =>
        v.active !== false &&
        Array.isArray(v.sizes) &&
        (v.sizes as string[]).includes(SIZE),
    ) ?? polo!.variants.find((v) => v.active !== false);
  expect(variant, `no active ${ITEM_ID} variant`).toBeTruthy();
  const sizes = Array.isArray(variant!.sizes) ? (variant!.sizes as string[]) : [];
  return {
    itemId: polo!.id,
    variantLabel: variant!.label,
    unitPrice: Number(variant!.price),
    size: sizes.includes(SIZE) ? SIZE : (sizes[0] ?? SIZE),
  };
}

async function postPaymentIntent(
  page: Page,
  payload: Record<string, unknown>,
) {
  return page.request.post("/api/stripe/payment-intent", { data: payload });
}

async function confirmVisaPayment(paymentIntentId: string) {
  loadLocalEnv();
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY missing");
  const stripe = new Stripe(key);
  const pi = await stripe.paymentIntents.confirm(paymentIntentId, {
    payment_method: "pm_card_visa",
    return_url: "http://127.0.0.1:3000/demo-academy/order/placed",
  });
  if (pi.status !== "succeeded") {
    throw new Error(`expected succeeded PaymentIntent, got ${pi.status}`);
  }
}

async function fillStripeTestCard(page: Page) {
  await expect(page.locator("#payment-element")).toBeVisible({ timeout: 20_000 });
  await expect(
    page
      .locator(
        'iframe[title*="Secure" i], iframe[name^="__privateStripeFrame"], iframe[src*="js.stripe.com"]',
      )
      .first(),
  ).toBeVisible({ timeout: 30_000 });

  try {
    await expect
      .poll(
        async () => {
          for (const frame of page.frames()) {
            if (!/stripe/i.test(frame.url())) continue;
            const cardTab = frame.getByRole("tab", { name: /^Card$/i }).or(
              frame.getByRole("button", { name: /^Card$/i }),
            );
            if ((await cardTab.count()) > 0) {
              await cardTab.first().click({ timeout: 2_000 }).catch(() => undefined);
            }
            const number = frame.locator(
              '#Field-numberInput, input[name="number"], input[name="cardnumber"], input[autocomplete="cc-number"], [placeholder*="1234"]',
            );
            const expiry = frame.locator(
              '#Field-expiryInput, input[name="expiry"], input[name="exp-date"], input[autocomplete="cc-exp"], [placeholder*="MM"]',
            );
            const cvc = frame.locator(
              '#Field-cvcInput, input[name="cvc"], input[autocomplete="cc-csc"], [placeholder*="CVC"]',
            );
            if ((await number.count()) === 0 || (await expiry.count()) === 0 || (await cvc.count()) === 0) {
              continue;
            }
            await number.first().fill(STRIPE_TEST_CARD);
            await expiry.first().fill(STRIPE_TEST_EXPIRY);
            await cvc.first().fill(STRIPE_TEST_CVC);
            const postal = frame.locator(
              '#Field-postalCodeInput, input[name="postalCode"], input[name="postal"], input[autocomplete="postal-code"], [placeholder*="ZIP" i], [placeholder*="Postcode" i]',
            );
            if ((await postal.count()) > 0) await postal.first().fill(STRIPE_TEST_POSTAL);
            return true;
          }

          const numberInput = page
            .frameLocator(
              'iframe[title*="card number" i], iframe[title*="Secure card number" i]',
            )
            .locator("input")
            .first();
          const expiryInput = page
            .frameLocator(
              'iframe[title*="expiration" i], iframe[title*="expiry" i], iframe[title*="Secure expiration" i]',
            )
            .locator("input")
            .first();
          const cvcInput = page
            .frameLocator('iframe[title*="CVC" i], iframe[title*="cvc" i]')
            .locator("input")
            .first();
          if (
            (await numberInput.count()) === 0 ||
            (await expiryInput.count()) === 0 ||
            (await cvcInput.count()) === 0
          ) {
            return false;
          }
          await numberInput.fill(STRIPE_TEST_CARD);
          await expiryInput.fill("12 / 34");
          await cvcInput.fill(STRIPE_TEST_CVC);
          const postalInput = page
            .frameLocator(
              'iframe[title*="postal" i], iframe[title*="ZIP" i], iframe[title*="postcode" i]',
            )
            .locator("input")
            .first();
          if ((await postalInput.count()) > 0) await postalInput.fill(STRIPE_TEST_POSTAL);
          return true;
        },
        { timeout: 30_000, intervals: [250, 500, 1_000] },
      )
      .toBe(true);
  } catch {
    throw new Error(
      "Stripe Payment Element card fields did not appear. Use pnpm dev:web with Stripe test keys and a Connect account that can charge.",
    );
  }
}

async function fillCheckoutDetails(page: Page) {
  await page.locator("#studentName").fill("M06 Test Student");
  await page.locator("#rollClass").fill("9F");
  await page.locator("#parentName").fill("M06 Test Parent");
  await page.locator("#mobile").fill("0412345678");
  await page.locator("#email").fill(OPERATOR_EMAIL);
  const terms = page.locator('input[type="checkbox"]');
  await expect(terms).toBeVisible();
  await terms.check();
}

async function addOnePrelovedUnit(page: Page): Promise<{
  skuId: string;
  unitPrice: number;
  qtyOnHand: number;
  sourceItemId: string;
}> {
  await openCatalog(page, "Preloved");
  const card = skuCard(page);
  await expect(card).toBeVisible();
  const skuId = await card.getAttribute("data-sku-id");
  const sourceItemId = await card.getAttribute("data-source-item-id");
  expect(skuId).toBeTruthy();
  expect(sourceItemId).toBeTruthy();
  const href = await card.getAttribute("href");
  expect(href).toMatch(new RegExp(`/${TENANT}/preloved/[0-9a-f-]+`, "i"));
  await page.goto(href!);
  await expect(page.getByTestId("preloved-sku-page")).toBeVisible();

  const stepper = page.getByTestId("preloved-qty-stepper");
  await expect(stepper)
    .toHaveAttribute("data-hydrated", "true", { timeout: 5_000 })
    .catch(() => undefined);
  if ((await stepper.getAttribute("data-hydrated")) !== "true") {
    throw new Error(
      "Preloved PDP did not hydrate in Playwright (same risk as M05 parent shop).",
    );
  }
  const qtyOnHand = Number(await stepper.getAttribute("data-qty-on-hand"));
  expect(Number.isInteger(qtyOnHand) && qtyOnHand >= 1).toBeTruthy();
  await expect(page.getByTestId("preloved-qty")).toHaveText("1");

  const price = parseMoney(await page.getByTestId("preloved-add-to-cart").innerText());
  await page.getByTestId("preloved-add-to-cart").click();
  await expect(page).toHaveURL(new RegExp(`/${TENANT}/cart`));
  return {
    skuId: skuId!,
    unitPrice: price,
    qtyOnHand,
    sourceItemId: sourceItemId!,
  };
}

function loadLocalEnv() {
  for (const raw of readFileSync(".env.local", "utf8").split("\n")) {
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
}

/** Seed/Connect webhooks can flip stripe_charges_enabled false. Pin it true before PI mint. */
async function forceChargesEnabled() {
  loadLocalEnv();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing for forceChargesEnabled");
  const sql = neon(url);
  await sql`update tenants set stripe_charges_enabled = true where id = ${TENANT}`;
}

async function readKanbanColumnLabels(page: Page): Promise<string[]> {
  const board = page
    .locator("[data-no-print]")
    .filter({ has: page.locator("header", { hasText: /To prepare/i }) })
    .first();
  await expect(board).toBeVisible();
  return board.locator("section > header").evaluateAll((headers) =>
    headers.map((header) => {
      const label = header.querySelector("span.font-bold, span:nth-child(2)");
      return (label?.textContent ?? header.textContent ?? "").trim();
    }),
  );
}

test.describe("M06 preloved fulfilment", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("pay one preloved unit: stock down, PRELOVED pick slip, kanban unchanged", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await devLogin(page, `/admin/${TENANT}/settings`);
    const { donatedGstFree } = await ensurePrelovedEnabled(page);

    const catalogBefore = await fetchCatalog(page);
    expectNoQtyOnCatalogVariants(catalogBefore);
    const fingerprintBefore = catalogVariantsFingerprint(catalogBefore);
    const newPolo = pickNewPoloVariant(catalogBefore);

    const qtyBefore = await ensureInStockSku(page);

    await page.evaluate(() => localStorage.removeItem("uo:cart:v1"));
    const { skuId, unitPrice, sourceItemId } = await addOnePrelovedUnit(page);
    expect(skuId).toMatch(/^[0-9a-f-]{36}$/i);

    const oversellQty = qtyBefore + 1;
    const oversellTotals = computeTotals({
      lines: [{ unitPrice, qty: oversellQty, gstFree: donatedGstFree }],
      delivery: "pickup",
    });
    await forceChargesEnabled();
    const oversellRes = await postPaymentIntent(page, {
      tenantId: TENANT,
      amount: oversellTotals.total,
      lines: [
        {
          itemId: sourceItemId,
          variantLabel: PRELOVED_VARIANT_LABEL,
          size: SIZE,
          unitPrice,
          qty: oversellQty,
          prelovedSkuId: skuId,
        },
      ],
      delivery: "pickup",
      subtotal: oversellTotals.subtotal,
      gst: oversellTotals.gst,
    });
    expect(oversellRes.status(), await oversellRes.text()).toBe(409);
    expect((await oversellRes.json()) as { error?: string }).toMatchObject({
      error: "insufficient_qty",
    });

    const catalogAfterOversell = await fetchCatalog(page);
    expectNoQtyOnCatalogVariants(catalogAfterOversell);
    expect(catalogVariantsFingerprint(catalogAfterOversell)).toEqual(fingerprintBefore);

    await forceChargesEnabled();
    const payTotals = computeTotals({
      lines: [
        { unitPrice, qty: 1, gstFree: donatedGstFree },
        { unitPrice: newPolo.unitPrice, qty: 1, gstFree: false },
      ],
      delivery: "pickup",
    });
    const payRes = await postPaymentIntent(page, {
      tenantId: TENANT,
      amount: payTotals.total,
      lines: [
        {
          itemId: sourceItemId,
          variantLabel: PRELOVED_VARIANT_LABEL,
          size: SIZE,
          unitPrice,
          qty: 1,
          prelovedSkuId: skuId,
        },
        {
          itemId: newPolo.itemId,
          variantLabel: newPolo.variantLabel,
          size: newPolo.size,
          unitPrice: newPolo.unitPrice,
          qty: 1,
        },
      ],
      delivery: "pickup",
      subtotal: payTotals.subtotal,
      gst: payTotals.gst,
      metadata: {
        parentEmail: OPERATOR_EMAIL,
        studentName: "M06 Test Student",
        studentYear: "Year 9",
        delivery: "pickup",
      },
    });
    expect(
      payRes.ok(),
      `paid mixed-cart PI failed: ${payRes.status()} ${await payRes.text()}`,
    ).toBeTruthy();
    const payBody = (await payRes.json()) as { paymentIntentId?: string };
    expect(payBody.paymentIntentId).toBeTruthy();
    await confirmVisaPayment(payBody.paymentIntentId!);

    const orderRes = await page.request.post("/api/orders", {
      data: {
        tenantId: TENANT,
        parentName: "M06 Test Parent",
        parentEmail: OPERATOR_EMAIL,
        parentMobile: "0412345678",
        studentName: "M06 Test Student",
        studentYear: "Year 9",
        studentRoll: "9F",
        fulfilmentMethod: "pickup",
        deliveryFee: 0,
        subtotal: payTotals.subtotal,
        gst: payTotals.gst,
        total: payTotals.total,
        stripePaymentIntentId: payBody.paymentIntentId,
        refundPolicyAccepted: true,
        lines: [
          {
            itemId: sourceItemId,
            itemName: ITEM_NAME,
            variantLabel: PRELOVED_VARIANT_LABEL,
            size: SIZE,
            qty: 1,
            unitPrice,
            lineTotal: unitPrice,
          },
          {
            itemId: newPolo.itemId,
            itemName: ITEM_NAME,
            variantLabel: newPolo.variantLabel,
            size: newPolo.size,
            qty: 1,
            unitPrice: newPolo.unitPrice,
            lineTotal: newPolo.unitPrice,
          },
        ],
      },
    });
    expect(
      orderRes.ok(),
      `POST /api/orders failed: ${orderRes.status()} ${await orderRes.text()}`,
    ).toBeTruthy();
    const orderBody = (await orderRes.json()) as { orderId?: string };
    const orderId = orderBody.orderId;
    expect(orderId).toBeTruthy();

    const qtyAfter = await readStockQty(page);
    expect(qtyAfter).toBe(qtyBefore - 1);

    await page.goto(`/admin/${TENANT}/orders/${orderId}`);
    await expect(page.getByText("Pick Slip").first()).toBeVisible();
    const prelovedMark = page.getByTestId("pick-slip-preloved");
    await expect(prelovedMark).toHaveCount(1);
    await expect(prelovedMark).toHaveText("PRELOVED");
    const slipTable = page.locator("table").filter({ has: prelovedMark });
    const prelovedRow = slipTable.locator("tbody tr").filter({ has: prelovedMark });
    await expect(prelovedRow).toHaveCount(1);
    await expect(prelovedRow).toContainText(ITEM_NAME);
    await expect(prelovedRow).toContainText(PRELOVED_VARIANT_LABEL);
    const unmarkedRows = slipTable.locator("tbody tr").filter({ hasNot: prelovedMark });
    await expect(unmarkedRows).toHaveCount(1);
    await expect(unmarkedRows.getByTestId("pick-slip-preloved")).toHaveCount(0);

    await page.goto(`/admin/${TENANT}/orders`);
    const columnLabels = await readKanbanColumnLabels(page);
    const normalized = columnLabels.map((label) => label.replace(/\s+\d+\s*$/, "").trim());
    expect(
      normalized.length === 2 || normalized.length === 4,
      `unexpected Kanban columns: ${JSON.stringify(normalized)}`,
    ).toBeTruthy();
    expect(normalized[0]).toMatch(/To prepare/i);
    expect(normalized.some((label) => /preloved/i.test(label))).toBeFalsy();
    if (normalized.length === 4) {
      expect(normalized).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/To prepare/i),
          expect.stringMatching(/^Ready$/i),
          expect.stringMatching(/Needs attention/i),
          expect.stringMatching(/Completed/i),
        ]),
      );
    } else {
      expect(normalized).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/To prepare/i),
          expect.stringMatching(/Completed/i),
        ]),
      );
    }

    const toPrepare = page
      .locator("[data-no-print] section")
      .filter({ has: page.locator("header", { hasText: /To prepare/i }) })
      .first();
    await expect(toPrepare.getByRole("link", { name: orderId! })).toBeVisible();

    const catalogAfterPay = await fetchCatalog(page);
    expectNoQtyOnCatalogVariants(catalogAfterPay);
    expect(catalogVariantsFingerprint(catalogAfterPay)).toEqual(fingerprintBefore);

    const newOnlyQty = 99;
    const newOnlyTotals = computeTotals({
      lines: [{ unitPrice: newPolo.unitPrice, qty: newOnlyQty, gstFree: false }],
      delivery: "pickup",
    });
    await forceChargesEnabled();
    const newOnlyRes = await postPaymentIntent(page, {
      tenantId: TENANT,
      amount: newOnlyTotals.total,
      lines: [
        {
          itemId: newPolo.itemId,
          variantLabel: newPolo.variantLabel,
          size: newPolo.size,
          unitPrice: newPolo.unitPrice,
          qty: newOnlyQty,
        },
      ],
      delivery: "pickup",
      subtotal: newOnlyTotals.subtotal,
      gst: newOnlyTotals.gst,
    });
    const newOnlyBody = (await newOnlyRes.json().catch(() => ({}))) as {
      error?: string;
    };
    expect(
      newOnlyBody.error,
      `new-only PI must not fail as insufficient_qty (${newOnlyRes.status()} ${JSON.stringify(newOnlyBody)})`,
    ).not.toBe("insufficient_qty");
  });
});
