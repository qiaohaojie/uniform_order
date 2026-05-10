import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getStripe } from "@/lib/stripe";

export type TenantBilling = {
  tenantId: string;
  accountId: string | null;
  chargesEnabled: boolean | null;
  payoutsEnabled: boolean | null;
  balance: { available: number; pending: number; currency: string } | null;
  lastPayout: { date: Date; amount: number; currency: string } | null;
  gross30d: number;
  net30d: number;
  currency: string;
  error: string | null;
};

export const PLATFORM_BILLING_TAG = "platform-billing";
export const tenantBillingTag = (tenantId: string) => `platform-billing:${tenantId}`;

// AUD is the platform-wide currency. Stripe Connect accounts are AU-only; KPI
// aggregation assumes a single currency. Revisit if non-AU tenants are added.
export const PLATFORM_CURRENCY = "AUD";

// Cap parallel Stripe fan-out so a cold-cache load of N tenants doesn't burst
// past Stripe's 100 req/s limit (each tenant fires 4 calls + paginated tx list).
export async function mapTenantBilling<T>(
  items: T[],
  fn: (item: T) => Promise<TenantBilling>,
  concurrency = 5,
): Promise<TenantBilling[]> {
  const out = new Array<TenantBilling>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

const FALLBACK_CURRENCY = PLATFORM_CURRENCY.toLowerCase();

async function fetchTenantBilling(tenantId: string, accountId: string | null): Promise<TenantBilling> {
  if (!accountId) {
    return {
      tenantId, accountId: null, chargesEnabled: null, payoutsEnabled: null,
      balance: null, lastPayout: null, gross30d: 0, net30d: 0, currency: FALLBACK_CURRENCY, error: null,
    };
  }
  try {
    const stripe = getStripe();
    const stripeOpts = { stripeAccount: accountId };
    const since = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);

    const [acct, balance, payouts] = await Promise.all([
      stripe.accounts.retrieve(accountId),
      stripe.balance.retrieve(undefined, stripeOpts),
      stripe.payouts.list({ limit: 1 }, stripeOpts),
    ]);

    // Sum cents as integers to avoid float drift over many transactions.
    let grossCents = 0;
    let netCents = 0;
    // Auto-paginate so totals don't silently cap at one page when tenants exceed ~100 tx/30d.
    for await (const t of stripe.balanceTransactions
      .list({ created: { gte: since }, limit: 100 }, stripeOpts)) {
      if (t.type === "charge") grossCents += t.amount;
      netCents += t.net;
    }

    const available = (balance.available[0]?.amount ?? 0) / 100;
    const pending = (balance.pending[0]?.amount ?? 0) / 100;
    const currency = balance.available[0]?.currency ?? FALLBACK_CURRENCY;
    const last = payouts.data[0];

    return {
      tenantId,
      accountId,
      chargesEnabled: acct.charges_enabled,
      payoutsEnabled: acct.payouts_enabled,
      balance: { available, pending, currency },
      lastPayout: last ? { date: new Date(last.arrival_date * 1000), amount: last.amount / 100, currency: last.currency } : null,
      gross30d: grossCents / 100,
      net30d: netCents / 100,
      currency,
      error: null,
    };
  } catch (err) {
    return {
      tenantId, accountId, chargesEnabled: null, payoutsEnabled: null,
      balance: null, lastPayout: null, gross30d: 0, net30d: 0, currency: FALLBACK_CURRENCY,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// `accountId` is part of the cache key so onboarding (null → real ID) doesn't
// keep returning the stale "no account" stub until the next webhook flush.
export const getTenantBilling = cache((tenantId: string, accountId: string | null) =>
  unstable_cache(
    () => fetchTenantBilling(tenantId, accountId),
    [`tenant-billing:${tenantId}`, accountId ?? "none"],
    { revalidate: 300, tags: [PLATFORM_BILLING_TAG, tenantBillingTag(tenantId)] },
  )()
);
