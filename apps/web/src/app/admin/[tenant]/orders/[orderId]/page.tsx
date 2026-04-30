import { notFound } from "next/navigation";
import Link from "next/link";
import { TENANTS, type TenantId } from "@/lib/data";
import { getOrderById } from "@/lib/admin-data";
import { AdminTopbar } from "@/components/admin-shell";
import { Chip } from "@/components/chip";
import { DoubleRule } from "@/components/double-rule";
import { Crest } from "@/components/crest";

function Barcode({ orderId }: { orderId: string }) {
  const widths = [3, 1, 2, 1, 1, 3, 1, 2, 3, 1, 1, 2, 3, 2, 1, 1, 3, 1, 2, 1, 1, 3, 2, 1];
  let x = 0;
  return (
    <svg width={180} height={48}>
      {widths.map((w, i) => {
        const fill = i % 2 === 0 ? "var(--color-ink)" : "transparent";
        const el = (
          <rect key={i} x={x} y={0} width={w * 2} height={36} fill={fill} />
        );
        x += w * 2 + 1;
        return el;
      })}
      <text
        x={0}
        y={46}
        fontFamily="var(--font-mono)"
        fontSize="10"
        fill="var(--color-ink-dim)"
        letterSpacing="2"
      >
        {orderId}
      </text>
    </svg>
  );
}

export default async function OrderDetailPage({
  params,
}: PageProps<"/admin/[tenant]/orders/[orderId]">) {
  const { tenant: tid, orderId } = await params;
  if (!(tid in TENANTS)) notFound();
  const tenant = TENANTS[tid as TenantId];
  const order = getOrderById(orderId);
  if (!order) notFound();

  const statusMap: Record<string, { tone: "info" | "warn" | "success" | "neutral"; label: string }> = {
    new: { tone: "info", label: "New" },
    packing: { tone: "warn", label: "Packing" },
    ready: { tone: "success", label: "Ready for pickup" },
    collected: { tone: "neutral", label: "Collected" },
  };
  const statusInfo = statusMap[order.status];

  return (
    <>
      <AdminTopbar
        kicker={`${tenant.short} · Orders`}
        title={order.id}
        right={
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/${tid}/orders`}
              className="h-9 px-3.5 text-[12.5px] font-semibold rounded-md border flex items-center gap-1.5"
              style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
            >
              ← Back to orders
            </Link>
            <button
              className="h-9 px-3.5 text-[12.5px] font-semibold rounded-md border flex items-center gap-1.5"
              style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <rect x="6" y="3" width="12" height="6" /><rect x="3" y="9" width="18" height="9" rx="1" /><rect x="6" y="15" width="12" height="6" />
              </svg>
              Print pick slip
            </button>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto p-7">
        <div className="max-w-3xl mx-auto">
          {/* Pick slip card */}
          <div
            className="bg-white rounded-xl border p-7"
            style={{ borderColor: "var(--color-rule)" }}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <Crest tenant={tenant} size={44} />
                  <div>
                    <div
                      className="font-serif text-[22px] font-medium leading-tight"
                      style={{ color: "var(--color-ink)" }}
                    >
                      Pick Slip
                    </div>
                    <div
                      className="font-mono text-[13px] font-semibold"
                      style={{ color: tenant.accent }}
                    >
                      {order.id}
                    </div>
                  </div>
                </div>
                <div className="text-[11.5px] mt-1" style={{ color: "var(--color-ink-dim)" }}>
                  Placed {order.placedAt}
                </div>
              </div>
              <Chip tone={statusInfo.tone}>{statusInfo.label}</Chip>
            </div>

            <DoubleRule />

            {/* Details grid */}
            <div className="grid grid-cols-3 gap-6 mt-4 mb-5">
              <div>
                <div
                  className="text-[10px] font-bold tracking-[0.6px] uppercase mb-1"
                  style={{ color: "var(--color-ink-dim)" }}
                >
                  Student
                </div>
                <div className="font-serif text-[16px] font-medium" style={{ color: "var(--color-ink)" }}>
                  {order.kid}
                </div>
                <div className="text-[11px]" style={{ color: "var(--color-ink-dim)" }}>
                  {order.year} · Roll {order.rollClass}
                </div>
              </div>
              <div>
                <div
                  className="text-[10px] font-bold tracking-[0.6px] uppercase mb-1"
                  style={{ color: "var(--color-ink-dim)" }}
                >
                  Parent
                </div>
                <div className="font-serif text-[16px] font-medium" style={{ color: "var(--color-ink)" }}>
                  {order.parent}
                </div>
                <div className="text-[11px]" style={{ color: "var(--color-ink-dim)" }}>
                  {order.mobile}
                </div>
              </div>
              <div>
                <div
                  className="text-[10px] font-bold tracking-[0.6px] uppercase mb-1"
                  style={{ color: "var(--color-ink-dim)" }}
                >
                  Fulfilment
                </div>
                <div className="font-serif text-[16px] font-medium" style={{ color: "var(--color-ink)" }}>
                  {order.delivery === "pickup" ? "Pickup at office" : "Ship to home"}
                </div>
                <div className="text-[11px]" style={{ color: "var(--color-ink-dim)" }}>
                  {order.delivery === "pickup" ? "Notify when ready" : order.email}
                </div>
              </div>
            </div>

            <DoubleRule />

            {/* Items table */}
            <table className="w-full border-collapse text-[13px] mt-3.5" style={{ fontFamily: "var(--font-sans)" }}>
              <thead>
                <tr
                  className="text-[10.5px] uppercase tracking-[0.6px]"
                  style={{ color: "var(--color-ink-dim)" }}
                >
                  <th className="text-left py-2 font-bold border-b w-8" style={{ borderColor: "var(--color-rule)" }}>✓</th>
                  <th className="text-left py-2 font-bold border-b" style={{ borderColor: "var(--color-rule)" }}>Item</th>
                  <th className="text-left py-2 font-bold border-b w-[130px]" style={{ borderColor: "var(--color-rule)" }}>Variant</th>
                  <th className="text-center py-2 font-bold border-b w-[60px]" style={{ borderColor: "var(--color-rule)" }}>Size</th>
                  <th className="text-center py-2 font-bold border-b w-[50px]" style={{ borderColor: "var(--color-rule)" }}>Qty</th>
                  <th className="text-right py-2 font-bold border-b w-[80px]" style={{ borderColor: "var(--color-rule)" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((line, i) => (
                  <tr
                    key={i}
                    className="border-b"
                    style={{ borderColor: "var(--color-rule)", borderStyle: "dashed" }}
                  >
                    <td className="py-3">
                      <div
                        className="w-[18px] h-[18px] border rounded"
                        style={{ borderColor: "var(--color-ink)", borderWidth: 1.5 }}
                      />
                    </td>
                    <td className="py-3 font-medium" style={{ color: "var(--color-ink)" }}>
                      {line.name}
                    </td>
                    <td className="py-3 text-[12px]" style={{ color: "var(--color-ink-dim)" }}>
                      {line.variantLabel}
                    </td>
                    <td className="py-3 text-center font-bold font-mono" style={{ color: "var(--color-ink)" }}>
                      {line.size}
                    </td>
                    <td className="py-3 text-center font-bold font-mono" style={{ color: "var(--color-ink)" }}>
                      {line.qty}
                    </td>
                    <td className="py-3 text-right font-semibold tnum" style={{ color: "var(--color-ink)" }}>
                      ${(line.price * line.qty).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} className="pt-3.5 text-right font-serif text-[16px] font-semibold" style={{ color: "var(--color-ink)" }}>
                    Total (incl. GST)
                  </td>
                  <td className="pt-3.5 text-right font-serif text-[22px] font-semibold tnum" style={{ color: "var(--color-ink)" }}>
                    ${order.total.toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={5} className="text-right text-[11px]" style={{ color: "var(--color-ink-dim)" }}>
                    GST included
                  </td>
                  <td className="text-right text-[11px] tnum" style={{ color: "var(--color-ink-dim)" }}>
                    ${(order.total / 11).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Notes */}
            {order.notes && (
              <div
                className="mt-6 p-3.5 rounded text-[11px] leading-[1.6]"
                style={{
                  background: "var(--color-parchment)",
                  color: "var(--color-ink-dim)",
                  fontFamily: "var(--font-sans)",
                }}
              >
                <b style={{ color: "var(--color-ink)" }}>Packer notes</b> · {order.notes}
              </div>
            )}

            {/* Footer */}
            <div className="mt-6 flex items-center justify-between">
              <div className="text-[11px] font-mono" style={{ color: "var(--color-ink-dim)" }}>
                Paid via Stripe · {order.stripeRef} · {order.email}
              </div>
              <Barcode orderId={order.id} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
