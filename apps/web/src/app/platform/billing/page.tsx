import { db } from "@/db";
import { tenants } from "@/db/schema";
import { getTenantBilling } from "@/lib/platform/stripe-billing";
import { BillingTable } from "./billing-table";

export default async function BillingPage() {
  const list = await db
    .select({ id: tenants.id, name: tenants.name, accountId: tenants.stripeAccountId })
    .from(tenants);
  const billing = await Promise.all(list.map((t) => getTenantBilling(t.id, t.accountId)));
  const merged = list.map((t, i) => ({ ...t, ...billing[i] }));

  const enabled = merged.filter((m) => m.chargesEnabled).length;
  const totalBalance = merged.reduce((s, m) => s + (m.balance?.available ?? 0) + (m.balance?.pending ?? 0), 0);
  const totalNet30 = merged.reduce((s, m) => s + m.net30d, 0);
  const totalGross30 = merged.reduce((s, m) => s + m.gross30d, 0);

  return (
    <>
      <header className="px-7 py-5 border-b border-rule">
        <h1 className="font-serif text-2xl font-semibold">Billing & payouts</h1>
      </header>
      <div className="flex-1 px-7 py-6 overflow-auto">
        <div className="grid grid-cols-4 gap-3.5">
          <Tile label="Connected accounts" value={`${enabled} / ${list.length}`} sub="enabled" />
          <Tile label="Total balance" value={`$${totalBalance.toFixed(0)}`} sub="across tenants" />
          <Tile label="Payouts · 30d" value={`$${totalNet30.toFixed(0)}`} sub="net" />
          <Tile label="Gross · 30d" value={`$${totalGross30.toFixed(0)}`} sub="pre-fee" />
        </div>
        <div className="mt-6">
          <BillingTable rows={merged} />
        </div>
      </div>
    </>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-paper rounded-[10px] border border-rule p-4">
      <div className="text-[11px] font-bold uppercase tracking-[0.4px] text-ink-dim">{label}</div>
      <div className="font-serif text-[26px] font-semibold mt-1.5 tnum">{value}</div>
      <div className="text-[11px] text-ink-dim mt-1">{sub}</div>
    </div>
  );
}
