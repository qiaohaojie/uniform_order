/**
 * M05 leftover: parent Preloved filter empty state (donate copy + link).
 *
 * Non-destructive: snapshots in-stock qty, zeros the rack for the assertion,
 * then restores. Does not write-off or sell units.
 *
 * Does not start the app. From repo root:
 *   pnpm dev:web
 *   PLAYWRIGHT_BASE_URL=http://127.0.0.1:<port> pnpm test:m05-empty-preloved-filter
 *
 * Bound to demo-academy by the package script (live Neon has no imhs).
 */
import { expect, test } from "playwright/test";
import {
  TENANT,
  devLogin,
  emptyShopPrelovedQty,
  ensurePrelovedEnabled,
  openCatalog,
  restoreShopPrelovedQty,
} from "./helpers";

const MOBILE_VIEWPORT = { width: 430, height: 800 };
const EMPTY_COPY = /No preloved in this size right now/i;
const DONATE_HREF = `/${TENANT}/preloved/donate`;

test.describe("M05 empty Preloved filter", () => {
  test("empty Preloved filter shows donate copy and links to donate", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(MOBILE_VIEWPORT);
    await devLogin(page, `/admin/${TENANT}/settings`);
    await ensurePrelovedEnabled(page);

    const snapshot = await emptyShopPrelovedQty();
    try {
      await openCatalog(page, "Preloved");
      await expect(page.getByTestId("preloved-filter-chip")).toBeVisible();

      const empty = page.getByTestId("preloved-empty");
      await expect(empty).toBeVisible();
      await expect(empty).toContainText(EMPTY_COPY);
      await expect(
        empty.getByRole("link", { name: "Donate outgrown items" }),
      ).toHaveAttribute("href", DONATE_HREF);
      await expect(page.getByTestId("preloved-card")).toHaveCount(0);
    } finally {
      await restoreShopPrelovedQty(snapshot);
    }
  });
});
