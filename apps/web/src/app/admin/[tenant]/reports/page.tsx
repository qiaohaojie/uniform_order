import { notFound } from "next/navigation";
import { TENANTS, type TenantId } from "@/lib/data";
import { SALES_DATA } from "@/lib/admin-data";
import { AdminTopbar } from "@/components/admin-shell";
import { ExportCsvButton, type CsvRow } from "@/components/export-csv-button";

// GST summary rows — in a real app these would come from the DB
const GST_ROWS: CsvRow[] = [
  { period: "Apr 2026", gross: 1480, gst: 134.55, net: 1345.45, fees: 43.05, payout: 1302.40 },
  { period: "Mar 2026", gross: 3240, gst: 294.55, net: 2945.45, fees: 94.17, payout: 2851.28 },
  { period: "Feb 2026", gross: 2780, gst: 252.73, net: 2527.27, fees: 80.82, payout: 2446.45 },
  { period: "Jan 2026", gross: 3960, gst: 360.00, net: 3600.00, fees: 115.02, payout: 3484.98 },
];

export default async function AdminReportsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: tid } = await params;
  if (!(tid in TENANTS)) notFound();
  const tenant = TENANTS[tid as TenantId];
  const sales = SALES_DATA[tid as TenantId];

  const months = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr"];
  const monthlyRevenue = [2840, 4120, 3960, 2780, 3240, 1480];
  const maxRev = Math.max(...monthlyRevenue);

  return (
    <>
      <AdminTopbar
        kicker={`${tenant.short} · Operator`}
        title="Reports"
        right={
          <div className="flex items-center gap-2">
            <select
              className="h-9 px-3 text-[12.5px] font-semibold rounded-md border bg-white"
              style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
            >
              <option>Last 6 months</option>
              <option>Last 12 months</option>
              <option>This term</option>
            </select>
            <ExportCsvButton
              rows={GST_ROWS}
              filename={`${tid}-gst-report.csv`}
            />
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto p-7">
        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-3.5 mb-6">
          {[
            { label: "Total revenue", value: `$${sales.revenue.toLocaleString()}`, sub: "6 months" },
            { label: "Total orders", value: String(sales.orders), sub: "6 months" },
            { label: "Avg order value", value: `$${sales.avgOrder.toFixed(2)}`, sub: "6 months" },
            { label: "GST collected", value: `$${(sales.revenue / 11).toFixed(0)}`, sub: "Remittable" },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-white rounded-[10px] border p-4"
              style={{ borderColor: "var(--color-rule)" }}
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.4px]" style={{ color: "var(--color-ink-dim)" }}>
                {s.label}
              </div>
              <div className="font-serif text-[26px] font-semibold mt-2 tnum" style={{ color: "var(--color-ink)" }}>
                {s.value}
              </div>
              <div className="text-[11px] mt-1" style={{ color: "var(--color-ink-dim)" }}>{s.sub}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-3.5" style={{ gridTemplateColumns: "2fr 1fr" }}>
          {/* Monthly revenue bar chart */}
          <div
            className="bg-white rounded-[10px] border p-[18px]"
            style={{ borderColor: "var(--color-rule)" }}
          >
            <div className="flex justify-between items-baseline mb-5">
              <h3 className="type-h2 m-0" style={{ color: "var(--color-ink)" }}>
                Monthly revenue
              </h3>
              <span className="text-[11px]" style={{ color: "var(--color-ink-dim)" }}>Nov 2025 – Apr 2026</span>
            </div>
            <div className="flex items-end gap-3 h-[160px]">
              {monthlyRevenue.map((v, i) => {
                const pct = (v / maxRev) * 100;
                const isLast = i === monthlyRevenue.length - 1;
                return (
                  <div key={months[i]} className="flex-1 flex flex-col items-center gap-1.5">
                    <div className="text-[11px] font-semibold tnum" style={{ color: "var(--color-ink-dim)" }}>
                      ${(v / 1000).toFixed(1)}k
                    </div>
                    <div className="w-full flex items-end" style={{ height: 120 }}>
                      <div
                        className="w-full rounded-t"
                        style={{
                          height: `${pct}%`,
                          background: isLast ? `${tenant.accent}60` : tenant.accent,
                          minHeight: 4,
                        }}
                      />
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--color-ink-dim)" }}>
                      {months[i]}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Category breakdown */}
          <div
            className="bg-white rounded-[10px] border p-[18px]"
            style={{ borderColor: "var(--color-rule)" }}
          >
            <h3 className="type-h2 m-0 mb-4" style={{ color: "var(--color-ink)" }}>
              Revenue by category
            </h3>
            {[
              { cat: "Winter", pct: 38, rev: 6999 },
              { cat: "Summer", pct: 26, rev: 4789 },
              { cat: "Sports", pct: 18, rev: 3316 },
              { cat: "Formal", pct: 11, rev: 2026 },
              { cat: "Bags", pct: 5, rev: 921 },
              { cat: "Stationery", pct: 2, rev: 369 },
            ].map((c) => (
              <div key={c.cat} className="mb-3">
                <div className="flex justify-between text-[12px] mb-1">
                  <span className="font-medium" style={{ color: "var(--color-ink)" }}>{c.cat}</span>
                  <span className="tnum" style={{ color: "var(--color-ink-dim)" }}>${c.rev.toLocaleString()}</span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: "var(--color-parchment)" }}>
                  <div
                    className="h-1.5 rounded-full"
                    style={{ width: `${c.pct}%`, background: tenant.accent }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* GST summary */}
        <div
          className="mt-3.5 bg-white rounded-[10px] border p-[18px]"
          style={{ borderColor: "var(--color-rule)" }}
        >
          <h3 className="type-h2 m-0 mb-4" style={{ color: "var(--color-ink)" }}>
            GST summary (BAS-ready)
          </h3>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-[10.5px] uppercase tracking-[0.6px]" style={{ color: "var(--color-ink-dim)" }}>
                {["Period", "Gross sales", "GST collected", "Net (ex-GST)", "Stripe fees", "Net payout"].map((h) => (
                  <th key={h} className="text-right py-2 font-bold border-b first:text-left" style={{ borderColor: "var(--color-rule)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GST_ROWS.map((r, i) => (
                <tr key={r.period} className="border-b" style={{ borderColor: i < GST_ROWS.length - 1 ? "var(--color-rule)" : "transparent" }}>
                  <td className="py-2.5 font-medium" style={{ color: "var(--color-ink)" }}>{r.period}</td>
                  <td className="py-2.5 text-right tnum" style={{ color: "var(--color-ink)" }}>${r.gross.toLocaleString()}</td>
                  <td className="py-2.5 text-right tnum" style={{ color: "var(--color-ink)" }}>${r.gst.toFixed(2)}</td>
                  <td className="py-2.5 text-right tnum" style={{ color: "var(--color-ink)" }}>${r.net.toFixed(2)}</td>
                  <td className="py-2.5 text-right tnum" style={{ color: "var(--color-ink-dim)" }}>−${r.fees.toFixed(2)}</td>
                  <td className="py-2.5 text-right tnum font-semibold" style={{ color: "var(--color-ink)" }}>${r.payout.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
