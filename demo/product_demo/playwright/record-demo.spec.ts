/**
 * Demo recording spec — six acts as test.describe blocks.
 * Each act produces one video per project (desktop, mobile).
 *
 * Selectors prefer getByRole/getByLabel. Where the existing UI lacks
 * accessible names, getByText is used with a brittleness comment.
 *
 * Credentials come from .env.demo via the --env-file flag passed to the
 * config (set DEMO_BASE_URL there or via process env).
 */
import { test, expect } from "playwright/test";

const OPERATOR_EMAIL = process.env.DEMO_OPERATOR_EMAIL ?? "operator@demo.uniformorder.online";
const OPERATOR_PASSWORD = process.env.DEMO_OPERATOR_PASSWORD ?? "DemoPass123!";

/**
 * Sign in via the Better Auth API directly. The response's Set-Cookie is
 * captured by the BrowserContext, so subsequent page.goto() calls carry the
 * session. Bypasses the @neondatabase/auth-ui form — on iPhone 13 emulation
 * the UI submit + cookie handshake races with the next navigation and the
 * session gets dropped.
 */
async function apiSignIn(page: import("playwright/test").Page, email: string, password: string) {
  const res = await page.context().request.post("http://localhost:3000/api/auth/sign-in/email", {
    data: { email, password, rememberMe: true },
    failOnStatusCode: false,
  });
  if (!res.ok()) {
    throw new Error(`apiSignIn failed: ${res.status()} ${await res.text()}`);
  }
  // Diagnostic + sanity check: confirm Better Auth set a session cookie on
  // the context. Without this, mobile contexts that silently drop the cookie
  // would proceed to the protected route and bounce back to /auth/sign-in.
  const cookies = await page.context().cookies("http://localhost:3000");
  const hasSession = cookies.some((c) =>
    c.name.startsWith("better-auth") || c.name.includes("session"),
  );
  if (!hasSession) {
    throw new Error(
      `apiSignIn: no session cookie on context after sign-in. Got: ${cookies
        .map((c) => c.name)
        .join(", ") || "(none)"}`,
    );
  }
}

/**
 * UI sign-in used by Act 1 so the demo video captures the actual sign-in form.
 * Other acts use apiSignIn to skip the UI noise.
 */
async function uiSignIn(page: import("playwright/test").Page, email: string, password: string) {
  await page.goto("/auth/sign-in");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('input[type="password"]').press("Enter");
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 15_000 });
  await page.waitForLoadState("networkidle");
}

// Backwards-compat alias: existing acts use signIn() — keep it pointing at
// the API path so the admin acts work on mobile as well as desktop.
const signIn = apiSignIn;

const PLATFORM_ADMIN_EMAIL =
  process.env.DEMO_PLATFORM_ADMIN_EMAIL ?? "platformadmin@demo.uniformorder.online";
const PLATFORM_ADMIN_PASSWORD =
  process.env.DEMO_PLATFORM_ADMIN_PASSWORD ?? "DemoPass123!";

test.describe("Act 1 — Setup & login", () => {
  test("platform admin views tenants", async ({ page }) => {
    // Establish session via API first so the post-sign-in navigation is
    // reliable on mobile, then visit the UI sign-in form purely for the
    // demo recording, then jump to /platform/tenants.
    await apiSignIn(page, PLATFORM_ADMIN_EMAIL, PLATFORM_ADMIN_PASSWORD);
    await page.goto("/auth/sign-in");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500); // dwell on sign-in form for narration
    await page.goto("/platform/tenants");
    await page.waitForLoadState("networkidle");
    // Tenants are listed by display name ("Riverside Academy") or slug ("demo-academy").
    const academy = page
      .getByRole("link", { name: /Riverside Academy|demo-academy/i })
      .or(page.getByText(/Riverside Academy|demo-academy/i))
      .first();
    await expect(academy).toBeVisible({ timeout: 15_000 });
    await academy.click();
    await page.waitForTimeout(2000); // dwell for narration
  });
});

test.describe("Act 2 — Operator dashboard", () => {
  test("operator scans Kanban", async ({ page }) => {
    await signIn(page, OPERATOR_EMAIL, OPERATOR_PASSWORD);
    await page.goto("/admin/demo-academy");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await page.goto("/admin/demo-academy/orders");
    await page.waitForLoadState("networkidle");
    // Any order link confirms the Kanban rendered with data.
    const anyOrderLink = page.getByRole("link", { name: /^RVRA-\d{5}$/ }).first();
    await expect(anyOrderLink).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(3000);
    // Open RVRA-00015 (needs_attention) — link role disambiguates from sidebar copies.
    await page.getByRole("link", { name: "RVRA-00015" }).first().click();
    await page.waitForTimeout(2000);
  });
});

test.describe("Act 3 — Live parent order", () => {
  test("parent builds cart and reaches checkout", async ({ page }) => {
    // Pre-set the "visited" cookie so /demo-academy renders the catalog directly
    // instead of the 30-day landing splash that hides items behind a CTA.
    await page.context().addCookies([
      {
        name: "uo:visited:demo-academy",
        value: "1",
        url: "http://localhost:3000",
      },
    ]);
    // Open catalog (Summer tab shows the polo), then navigate to the PDP directly
    // — the catalog tile click route changes between renders so a direct URL is
    // more reliable for a demo recording.
    await page.goto("/demo-academy?cat=Summer");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500); // dwell on catalog
    await page.goto("/demo-academy/item/rvra-polo-ss");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
    // PDP has two variant buttons ("Size 6–14", "Size 16–20") then size buttons.
    // Pick the 6–14 variant so "10" appears in the size grid.
    await page.getByRole("button", { name: /Size 6.?14/ }).click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /^10$/ }).click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /add to cart/i }).click();
    await page.waitForTimeout(1500);
    await page.goto("/demo-academy/cart");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await page
      .getByRole("link", { name: /checkout/i })
      .or(page.getByRole("button", { name: /checkout/i }))
      .first()
      .click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000); // dwell on checkout
  });
});

test.describe("Act 4 — Order management", () => {
  // Each project transitions a different order so desktop's "Mark ready" click
  // doesn't strand mobile (which runs second) with no to_prepare button to find.
  // Both orders are seeded as to_prepare; a fresh `demo:seed --reset` resets them.
  test("operator transitions order and views refund", async ({ page }, testInfo) => {
    const orderId = testInfo.project.name === "mobile" ? "RVRA-00004" : "RVRA-00003";
    await signIn(page, OPERATOR_EMAIL, OPERATOR_PASSWORD);
    await page.goto(`/admin/demo-academy/orders/${orderId}`);
    await page.waitForLoadState("networkidle");
    const markReady = page.getByRole("button", { name: /mark ready/i });
    await markReady.waitFor({ state: "visible", timeout: 15_000 });
    // Topbar action area sits inside an overflow-hidden flex row, so Playwright
    // reports "element is outside of the viewport" even after scrollIntoView.
    // Dispatch the click via JS to bypass the coordinate-based actionability check.
    await markReady.evaluate((el: HTMLElement) => el.click());
    await page.waitForTimeout(2000);
    // Refund act:
    await page.goto("/admin/demo-academy/orders/RVRA-00038");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
  });
});

test.describe("Act 5 — Reports & exports", () => {
  test("operator exports CSV", async ({ page }) => {
    await signIn(page, OPERATOR_EMAIL, OPERATOR_PASSWORD);
    await page.goto("/admin/demo-academy/reports");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    // Trigger download (Playwright auto-resolves the path). Bumped timeout for
    // mobile contexts where the click → download handshake is slower.
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 30_000 }),
      page.getByRole("button", { name: /export csv/i }).click(),
    ]);
    const path = await download.path();
    console.log(`[Act 5] CSV downloaded to ${path}`);
    await page.waitForTimeout(2000);
  });
});

test.describe("Act 6 — Admin configuration", () => {
  test("operator tours settings and catalog", async ({ page }) => {
    await signIn(page, OPERATOR_EMAIL, OPERATOR_PASSWORD);
    await page.goto("/admin/demo-academy/settings");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    await page.goto("/admin/demo-academy/catalog");
    await page.waitForTimeout(3000);
    // Click a catalog item to show variant editor (brittle: card click target)
    await page.getByText(/Polo Shirt — Short Sleeve/i).first().click();
    await page.waitForTimeout(3000);
  });
});
