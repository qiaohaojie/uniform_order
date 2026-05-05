import { notFound } from "next/navigation";
import { TENANTS, type TenantId } from "@/lib/data";
import { getLiveReportsData } from "@/db/queries";
import { AdminTopbar } from "@/components/admin-shell";
import { ExportCsvButton } from "@/components/export-csv-button";

export default async function AdminReportsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: tid } = await params;
  if (!(tid in TENANTS)) notFound();
  const tenant = TENANTS[tid as TenantId];
  const reports = await getLiveReportsData(tid);

  const maxRev = Math.max(1, ...reports.monthlyRevenue.map((row) => row.revenue));
  const rangeLabel =
    reports.monthlyRevenue.length > 0
      ? `${reports.monthlyRevenue[0]?.label ?? ""} – ${reports.monthlyRevenue[reports.monthlyRevenue.length - 1]?.label ?? ""}`
      : "Last 6 months";

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
              rows={reports.gstRows}
              filename={`${tid}-gst-report.csv`}
            />
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto p-7">
        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-3.5 mb-6">
          {[
            { label: "Total revenue", value: `$${reports.revenue.toLocaleString()}`, sub: "6 months" },
            { label: "Total orders", value: String(reports.orders), sub: "6 months" },
            { label: "Avg order value", value: `$${reports.avgOrder.toFixed(2)}`, sub: "6 months" },
            { label: "GST collected", value: `$${reports.gst.toFixed(2)}`, sub: "Remittable" },
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
              <span className="text-[11px]" style={{ color: "var(--color-ink-dim)" }}>{rangeLabel}</span>
            </div>
            <div className="flex items-end gap-3 h-[160px]">
              {reports.monthlyRevenue.map((row, i) => {
                const pct = (row.revenue / maxRev) * 100;
                const isLast = i === reports.monthlyRevenue.length - 1;
                const revenueLabel = row.revenue < 1000 ? `$${row.revenue.toFixed(0)}` : `$${(row.revenue / 1000).toFixed(1)}k`;
                return (
                  <div key={row.month} className="flex-1 flex flex-col items-center gap-1.5">
                    <div className="text-[11px] font-semibold tnum" style={{ color: "var(--color-ink-dim)" }}>
                      {revenueLabel}
                    </div>
                    <div className="w-full flex items-end" style={{ height: 120 }}>
                      <div
                        className="w-full rounded-t"
                        style={{
                          height: `${pct}%`,
                          background: isLast ? `${tenant.accent}60` : tenant.accent,
                          minHeight: row.revenue > 0 ? 4 : 0,
                        }}
                      />
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--color-ink-dim)" }}>
                      {row.label}
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
            {reports.categoryRevenue.length === 0 ? (
              <p className="text-[12px]" style={{ color: "var(--color-ink-dim)" }}>
                No live category sales yet.
              </p>
            ) : (
              reports.categoryRevenue.map((c) => (
                <div key={c.cat} className="mb-3">
                  <div className="flex justify-between text-[12px] mb-1">
                    <span className="font-medium" style={{ color: "var(--color-ink)" }}>{c.cat}</span>
                    <span className="tnum" style={{ color: "var(--color-ink-dim)" }}>${c.revenue.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: "var(--color-parchment)" }}>
                    <div
                      className="h-1.5 rounded-full"
                      style={{ width: `${c.pct}%`, background: tenant.accent }}
                    />
                  </div>
                </div>
              ))
            )}
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
              {reports.gstRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-4 text-center text-[12px]"
                    style={{ color: "var(--color-ink-dim)" }}
                  >
                    No live GST rows yet.
                  </td>
                </tr>
              ) : (
                reports.gstRows.map((r, i) => (
                  <tr key={r.period} className="border-b" style={{ borderColor: i < reports.gstRows.length - 1 ? "var(--color-rule)" : "transparent" }}>
                    <td className="py-2.5 font-medium" style={{ color: "var(--color-ink)" }}>{r.period}</td>
                    <td className="py-2.5 text-right tnum" style={{ color: "var(--color-ink)" }}>${r.gross.toLocaleString()}</td>
                    <td className="py-2.5 text-right tnum" style={{ color: "var(--color-ink)" }}>${r.gst.toFixed(2)}</td>
                    <td className="py-2.5 text-right tnum" style={{ color: "var(--color-ink)" }}>${r.net.toFixed(2)}</td>
                    <td className="py-2.5 text-right tnum" style={{ color: "var(--color-ink-dim)" }}>−${r.fees.toFixed(2)}</td>
                    <td className="py-2.5 text-right tnum font-semibold" style={{ color: "var(--color-ink)" }}>${r.payout.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
