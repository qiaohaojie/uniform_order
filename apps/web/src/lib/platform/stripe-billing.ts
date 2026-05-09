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
  error: string | null;
};

async function fetchTenantBilling(tenantId: string, accountId: string | null): Promise<TenantBilling> {
  if (!accountId) {
    return {
      tenantId, accountId: null, chargesEnabled: null, payoutsEnabled: null,
      balance: null, lastPayout: null, gross30d: 0, net30d: 0, error: null,
    };
  }
  try {
    const stripe = getStripe();
    const stripeOpts = { stripeAccount: accountId };
    const [acct, balance, payouts, txs] = await Promise.all([
      stripe.accounts.retrieve(accountId),
      stripe.balance.retrieve(undefined, stripeOpts),
      stripe.payouts.list({ limit: 1 }, stripeOpts),
      stripe.balanceTransactions.list(
        {
          created: { gte: Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000) },
          limit: 100,
        },
        stripeOpts,
      ),
    ]);

    const available = (balance.available[0]?.amount ?? 0) / 100;
    const pending = (balance.pending[0]?.amount ?? 0) / 100;
    const currency = balance.available[0]?.currency ?? "aud";
    const last = payouts.data[0];

    let gross = 0;
    let net = 0;
    for (const t of txs.data) {
      if (t.type === "charge") gross += t.amount / 100;
      net += t.net / 100;
    }

    return {
      tenantId,
      accountId,
      chargesEnabled: acct.charges_enabled,
      payoutsEnabled: acct.payouts_enabled,
      balance: { available, pending, currency },
      lastPayout: last ? { date: new Date(last.arrival_date * 1000), amount: last.amount / 100, currency: last.currency } : null,
      gross30d: gross,
      net30d: net,
      error: null,
    };
  } catch (err) {
    return {
      tenantId, accountId, chargesEnabled: null, payoutsEnabled: null,
      balance: null, lastPayout: null, gross30d: 0, net30d: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export const getTenantBilling = cache((tenantId: string, accountId: string | null) =>
  unstable_cache(
    () => fetchTenantBilling(tenantId, accountId),
    [`tenant-billing:${tenantId}`],
    { revalidate: 300, tags: ["platform-billing"] },
  )()
);
