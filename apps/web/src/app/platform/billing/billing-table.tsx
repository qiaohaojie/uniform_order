"use client";
import type { TenantBilling } from "@/lib/platform/stripe-billing";

type Row = TenantBilling & { id: string; name: string };

export function BillingTable({ rows }: { rows: Row[] }) {
  return (
    <div className="bg-paper rounded-[10px] border border-rule overflow-hidden">
      <table className="w-full text-[13px] border-collapse">
        <thead>
          <tr className="bg-parchment">
            {["School", "Acct", "Charges", "Payouts", "Balance", "30d gross", "Last payout", ""].map((h) => (
              <th key={h} className="px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.6px] text-ink-dim border-b border-rule text-left">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-rule last:border-0">
              <td className="px-4 py-3 font-semibold">{r.name}</td>
              <td className="px-4 py-3 font-mono text-xs">{r.accountId ?? "—"}</td>
              <td className="px-4 py-3">{r.chargesEnabled === null ? "—" : r.chargesEnabled ? "✓" : "—"}</td>
              <td className="px-4 py-3">{r.payoutsEnabled === null ? "—" : r.payoutsEnabled ? "✓" : "—"}</td>
              <td className="px-4 py-3 tnum">{r.balance ? `$${(r.balance.available + r.balance.pending).toFixed(0)}` : "—"}</td>
              <td className="px-4 py-3 tnum">{r.gross30d ? `$${r.gross30d.toFixed(0)}` : "—"}</td>
              <td className="px-4 py-3 tnum">
                {r.lastPayout ? `$${r.lastPayout.amount.toFixed(0)} · ${r.lastPayout.date.toLocaleDateString("en-AU", { month: "short", day: "numeric" })}` : "—"}
              </td>
              <td className="px-4 py-3 text-right">
                {r.accountId && (
                  <a
                    href={`https://dashboard.stripe.com/connect/accounts/${r.accountId}`}
                    target="_blank"
                    rel="noopener"
                    className="text-xs font-semibold text-navy-deep underline"
                  >
                    Open ↗
                  </a>
                )}
                {r.error && <span className="text-xs text-red-700 ml-2">{r.error}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
