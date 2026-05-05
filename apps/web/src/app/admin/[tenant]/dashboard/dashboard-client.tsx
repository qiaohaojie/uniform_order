"use client";
import Link from "next/link";
import type { Tenant } from "@/lib/data";
import type { LiveDashboardData, LiveOrderStatus } from "@/db/queries";
import { Chip } from "@/components/chip";
import { Spark } from "@/components/spark";

function StatusBadge({ status }: { status: LiveOrderStatus }) {
  const map: Record<LiveOrderStatus, { tone: "warn" | "info" | "success" | "neutral"; label: string }> = {
    pending_payment: { tone: "neutral", label: "Pending Payment" },
    new: { tone: "info", label: "New" },
    packing: { tone: "warn", label: "Packing" },
    ready: { tone: "success", label: "Ready" },
    collected: { tone: "neutral", label: "Collected" },
  };
  const { tone, label } = map[status];
  return <Chip tone={tone}>{label}</Chip>;
}

export function AdminDashboardClient({
  tenant,
  dashboard,
}: {
  tenant: Tenant;
  dashboard: LiveDashboardData;
}) {
  const stats = [
    {
      label: "Revenue · 30d",
      value: `$${dashboard.revenue.toLocaleString()}`,
      delta: "Live orders",
      tone: "pos" as const,
      spark: dashboard.spark,
    },
    { label: "Orders · 30d", value: String(dashboard.orders), delta: "Live orders", tone: "pos" as const },
    { label: "Avg order", value: `$${dashboard.avgOrder.toFixed(2)}`, delta: "Last 30 days", tone: "pos" as const },
    {
      label: "Awaiting pickup",
      value: String(dashboard.awaitingPickup),
      delta: `${dashboard.readyOverSevenDays} over 7d`,
      tone: "warn" as const,
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-7">
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3.5 mb-6">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-[10px] border p-4"
            style={{ borderColor: "var(--color-rule)" }}
          >
            <div
              className="text-[11px] font-semibold tracking-[0.4px] uppercase"
              style={{ color: "var(--color-ink-dim)" }}
            >
              {s.label}
            </div>
            <div className="flex justify-between items-end mt-2">
              <div
                className="font-serif text-[26px] font-semibold leading-none tracking-[-0.4px] tnum"
                style={{ color: "var(--color-ink)" }}
              >
                {s.value}
              </div>
              {s.spark && <Spark data={s.spark} w={80} h={28} color={tenant.accent} />}
            </div>
            <div
              className="text-[11px] font-semibold mt-1.5"
              style={{
                color:
                  s.tone === "pos"
                    ? "var(--color-success)"
                    : s.tone === "warn"
                    ? "#7A5418"
                    : "var(--color-ink-dim)",
              }}
            >
              {s.delta}
            </div>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid gap-3.5" style={{ gridTemplateColumns: "2fr 1fr" }}>
        {/* Top selling items */}
        <div
          className="bg-white rounded-[10px] border p-[18px]"
          style={{ borderColor: "var(--color-rule)" }}
        >
          <div className="flex justify-between items-baseline mb-3.5">
            <h3 className="font-serif text-[17px] font-medium m-0" style={{ color: "var(--color-ink)" }}>
              Top selling items
            </h3>
            <span className="text-[11px]" style={{ color: "var(--color-ink-dim)" }}>
              Last 30 days
            </span>
          </div>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr
                className="text-[10.5px] uppercase tracking-[0.6px]"
                style={{ color: "var(--color-ink-dim)" }}
              >
                <th className="text-left py-2 font-bold border-b" style={{ borderColor: "var(--color-rule)" }}>
                  Item
                </th>
                <th className="text-right py-2 font-bold border-b" style={{ borderColor: "var(--color-rule)" }}>
                  Qty
                </th>
                <th className="text-right py-2 font-bold border-b" style={{ borderColor: "var(--color-rule)" }}>
                  Revenue
                </th>
                <th className="text-right py-2 font-bold border-b w-[120px]" style={{ borderColor: "var(--color-rule)" }}>
                  Share
                </th>
              </tr>
            </thead>
            <tbody>
              {dashboard.topItems.map((r, i) => {
                const pct = dashboard.revenue > 0 ? (r.revenue / dashboard.revenue) * 100 : 0;
                const widthPct = Math.min(100, Math.max(0, pct));
                return (
                  <tr
                    key={r.name}
                    className="border-b"
                    style={{ borderColor: i < dashboard.topItems.length - 1 ? "var(--color-rule)" : "transparent" }}
                  >
                    <td className="py-3 font-medium" style={{ color: "var(--color-ink)" }}>
                      {r.name}
                    </td>
                    <td className="py-3 text-right tnum" style={{ color: "var(--color-ink)" }}>
                      {r.qty}
                    </td>
                    <td className="py-3 text-right font-semibold tnum" style={{ color: "var(--color-ink)" }}>
                      ${r.revenue.toLocaleString()}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <div
                          className="w-[60px] h-1.5 rounded-full"
                          style={{ background: "var(--color-parchment)" }}
                        >
                          <div
                            className="h-1.5 rounded-full"
                            style={{ width: `${widthPct}%`, background: tenant.accent }}
                          />
                        </div>
                        <span
                          className="text-[11px] w-8 text-right"
                          style={{ color: "var(--color-ink-dim)" }}
                        >
                          {widthPct.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {dashboard.topItems.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-[12px]" style={{ color: "var(--color-ink-dim)" }}>
                    No live order lines yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Needs attention + activity */}
        <div className="flex flex-col gap-3.5">
          <div
            className="bg-white rounded-[10px] border p-[18px]"
            style={{ borderColor: "var(--color-rule)" }}
          >
            <h3 className="font-serif text-[17px] font-medium m-0 mb-3" style={{ color: "var(--color-ink)" }}>
              Needs attention
            </h3>
            <div className="flex flex-col gap-3">
              <div
                className="flex gap-2.5 p-2.5 rounded-md text-[12px] leading-[1.5]"
                style={{ background: "#FBF1E5", border: "1px solid #E5D5AE" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7A5418" strokeWidth="1.7" strokeLinecap="round" className="flex-shrink-0 mt-0.5">
                  <path d="M12 3 L22 20 H2 Z" />
                  <path d="M12 10 V14" />
                  <circle cx="12" cy="17" r="0.6" fill="#7A5418" stroke="none" />
                </svg>
                <div style={{ color: "var(--color-ink)" }}>
                  <b>{dashboard.readyOverSevenDays} orders</b> ready for pickup over 7 days.{" "}
                  <Link href={`/admin/${tenant.id}/orders`} className="font-semibold underline" style={{ color: tenant.accent }}>
                    View orders →
                  </Link>
                </div>
              </div>
              <div
                className="flex gap-2.5 p-2.5 rounded-md text-[12px] leading-[1.5]"
                style={{ background: "#E2EAF3", border: "1px solid #C7D4E3" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-navy-soft)" strokeWidth="1.7" strokeLinecap="round" className="flex-shrink-0 mt-0.5">
                  <rect x="3" y="5" width="18" height="14" rx="1" />
                  <path d="M3 7 L12 13 L21 7" />
                </svg>
                <div style={{ color: "var(--color-ink)" }}>
                  <b>Term 2 catalog</b> ready for review.{" "}
                  <Link href={`/admin/${tenant.id}/catalog`} className="font-semibold underline" style={{ color: tenant.accent }}>
                    Review →
                  </Link>
                </div>
              </div>
              <div
                className="flex gap-2.5 p-2.5 rounded-md text-[12px] leading-[1.5]"
                style={{ background: "#E5F0E7", border: "1px solid #C6DECB" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="1.7" strokeLinecap="round" className="flex-shrink-0 mt-0.5">
                  <path d="M5 13 L10 18 L20 6" />
                </svg>
                <div style={{ color: "var(--color-ink)" }}>
                  Stripe payout estimate from live orders: <b>${(dashboard.revenue * 0.26).toLocaleString()}</b>.
                </div>
              </div>
            </div>
          </div>

          {/* Recent orders */}
          <div
            className="bg-white rounded-[10px] border p-[18px]"
            style={{ borderColor: "var(--color-rule)" }}
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-serif text-[17px] font-medium m-0" style={{ color: "var(--color-ink)" }}>
                Recent orders
              </h3>
              <Link
                href={`/admin/${tenant.id}/orders`}
                className="text-[11.5px] font-semibold underline"
                style={{ color: tenant.accent }}
              >
                View all
              </Link>
            </div>
            <div className="flex flex-col">
              {dashboard.recentOrders.map((o, i) => (
                <div
                  key={o.id}
                  className="flex items-center gap-3 py-2.5"
                  style={{
                    borderBottom: i < dashboard.recentOrders.length - 1 ? "1px solid var(--color-rule)" : "none",
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-semibold truncate" style={{ color: "var(--color-ink)" }}>
                      {o.kid}
                    </div>
                    <div className="text-[10.5px] font-mono" style={{ color: "var(--color-ink-dim)" }}>
                      {o.id}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={o.status} />
                    <div className="text-[11px] tnum font-semibold" style={{ color: "var(--color-ink)" }}>
                      ${o.total.toFixed(0)}
                    </div>
                  </div>
                </div>
              ))}
              {dashboard.recentOrders.length === 0 && (
                <div className="py-4 text-[12px] text-center" style={{ color: "var(--color-ink-dim)" }}>
                  No live orders yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
