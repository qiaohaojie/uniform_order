import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrderById, getOrderRefunds, getTotalRefunded, getTenant, toTenantBrand } from "@/db/queries";
import { AdminTopbar } from "@/components/admin-shell";
import { Chip } from "@/components/chip";
import { DoubleRule } from "@/components/double-rule";
import { Crest } from "@/components/crest";
import { OrderDetailActions } from "./order-detail-actions";
import { PrintButton } from "@/components/print-button";
import { loadOrderActivity } from "@/lib/audit/load-order-activity";
import { OrderActivityStrip } from "@/components/admin/order-activity-strip";

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
}: { params: Promise<{ tenant: string; orderId: string }> }) {
  const { tenant: tid, orderId } = await params;
  const tenantRecord = await getTenant(tid);
  if (!tenantRecord) notFound();
  const tenant = toTenantBrand(tenantRecord);

  // Fetch from live DB
  const order = await getOrderById(orderId);
  if (!order || order.tenantId !== tid) notFound();

  const refunds = await getOrderRefunds(orderId);
  const refundedTotal = await getTotalRefunded(orderId);
  const activityRows = await loadOrderActivity(orderId);

  const statusMap: Record<string, { tone: "info" | "warn" | "success" | "neutral" | "danger"; label: string }> = {
    pending_payment: { tone: "neutral", label: "Pending payment" },
    new: { tone: "info", label: "New" },
    packing: { tone: "warn", label: "Packing" },
    ready: { tone: "success", label: "Ready for pickup" },
    collected: { tone: "neutral", label: "Collected" },
    partially_refunded: { tone: "danger", label: "Partially refunded" },
    refunded: { tone: "danger", label: "Refunded" },
  };
  const statusInfo = statusMap[order.status] ?? { tone: "neutral", label: order.status };
  const total = parseFloat(order.total);
  const gst = parseFloat(order.gst);
  const placedAt = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString("en-AU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";

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
            <PrintButton label="Print pick slip" />
            <div className="relative">
              <OrderDetailActions
                orderId={order.id}
                tenantId={tid}
                currentStatus={order.status}
                accent={tenant.accent}
                parentEmail={order.parentEmail}
                parentName={order.parentName}
                studentName={order.studentName}
                total={total}
                refunded={refundedTotal}
              />
            </div>
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
            {/* Print-only: parent note at top of pick slip */}
            {order.parentNote && (
              <div className="print:block hidden mb-4 p-3 border-2 border-black">
                <div className="text-[11px] font-bold uppercase tracking-wide mb-1">Note from parent</div>
                <div className="text-[13px] leading-snug">{order.parentNote}</div>
              </div>
            )}

            {/* Header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <Crest tenant={tenant} size={44} />
                  <div>
                    <div
                      className="type-h2 leading-tight"
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
                  Placed {placedAt}
                </div>
              </div>
              <Chip tone={statusInfo.tone}>{statusInfo.label}</Chip>
            </div>

            <DoubleRule />

            {/* Details grid */}
            <div className="grid grid-cols-3 gap-6 mt-4 mb-5">
              <div>
                <div className="type-label mb-1" style={{ color: "var(--color-ink-dim)" }}>
                  Student
                </div>
                <div className="font-serif text-[16px] font-medium" style={{ color: "var(--color-ink)" }}>
                  {order.studentName}
                </div>
                <div className="text-[11px]" style={{ color: "var(--color-ink-dim)" }}>
                  {order.studentYear} · Roll {order.studentRoll}
                </div>
              </div>
              <div>
                <div className="type-label mb-1" style={{ color: "var(--color-ink-dim)" }}>
                  Parent
                </div>
                <div className="font-serif text-[16px] font-medium" style={{ color: "var(--color-ink)" }}>
                  {order.parentName}
                </div>
                <div className="text-[11px]" style={{ color: "var(--color-ink-dim)" }}>
                  {order.parentMobile}
                </div>
              </div>
              <div>
                <div className="type-label mb-1" style={{ color: "var(--color-ink-dim)" }}>
                  Fulfilment
                </div>
                <div className="font-serif text-[16px] font-medium" style={{ color: "var(--color-ink)" }}>
                  {order.delivery === "pickup" ? "Pickup at office" : "Ship to home"}
                </div>
                <div className="text-[11px]" style={{ color: "var(--color-ink-dim)" }}>
                  {order.delivery === "pickup" ? "Notify when ready" : order.parentEmail}
                </div>
              </div>
            </div>

            <DoubleRule />

            {/* Parent note callout */}
            {order.parentNote && (
              <div
                className="rounded-lg border p-3 mb-4 mt-4"
                style={{ borderColor: "var(--color-rule)", background: "var(--color-parchment)" }}
              >
                <div className="text-[11px] font-bold tracking-[1.2px] uppercase mb-1" style={{ color: "var(--color-gold)" }}>
                  Note from parent
                </div>
                <div className="text-[13px] leading-[1.5]" style={{ color: "var(--color-ink)" }}>
                  {order.parentNote}
                </div>
              </div>
            )}

            {/* Items table */}
            <table className="w-full border-collapse text-[13px] mt-3.5" style={{ fontFamily: "var(--font-sans)" }}>
              <thead>
                <tr
                  className="text-[10.5px] uppercase tracking-[0.6px]"
                  style={{ color: "var(--color-ink-dim)" }}
                >
                  <th className="text-left py-2 font-bold border-b w-8" style={{ borderColor: "var(--color-rule)" }}>✓</th>
                  <th className="text-left py-2 font-bold border-b" style={{ borderColor: "var(--color-rule)" }}>Item</th>
                  <th className="text-left py-2 font-bold border-b w-[150px]" style={{ borderColor: "var(--color-rule)" }}>Variant</th>
                  <th className="text-center py-2 font-bold border-b w-[50px]" style={{ borderColor: "var(--color-rule)" }}>Qty</th>
                  <th className="text-right py-2 font-bold border-b w-[90px]" style={{ borderColor: "var(--color-rule)" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {order.lines.map((line, i) => (
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
                      {line.itemName}
                    </td>
                    <td className="py-3 text-[12px]" style={{ color: "var(--color-ink-dim)" }}>
                      {line.variantLabel}
                    </td>
                    <td className="py-3 text-center font-bold font-mono" style={{ color: "var(--color-ink)" }}>
                      {line.qty}
                    </td>
                    <td className="py-3 text-right font-semibold tnum" style={{ color: "var(--color-ink)" }}>
                      ${parseFloat(line.lineTotal).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="pt-3.5 text-right font-serif text-[16px] font-semibold" style={{ color: "var(--color-ink)" }}>
                    Total (incl. GST)
                  </td>
                  <td className="pt-3.5 text-right font-serif text-[22px] font-semibold tnum" style={{ color: "var(--color-ink)" }}>
                    ${total.toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} className="text-right text-[11px]" style={{ color: "var(--color-ink-dim)" }}>
                    GST included
                  </td>
                  <td className="text-right text-[11px] tnum" style={{ color: "var(--color-ink-dim)" }}>
                    ${gst.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Refund history */}
            {refunds.length > 0 && (
              <>
                <DoubleRule />
                <div className="mt-4">
                  <div className="text-[10.5px] uppercase tracking-[0.6px] font-bold mb-2" style={{ color: "var(--color-ink-dim)" }}>
                    Refunds
                  </div>
                  {refunds.map((refund) => (
                    <div key={refund.id} className="flex items-center justify-between py-2 border-b text-[12.5px]" style={{ borderColor: "var(--color-rule)", borderStyle: "dashed" }}>
                      <div style={{ color: "var(--color-ink)" }}>
                        {refund.reason ? refund.reason : "Refund"}
                        {refund.stripeRefundId && (
                          <span className="ml-1 text-[10px] font-mono" style={{ color: "var(--color-ink-dim)" }}>
                            · {refund.stripeRefundId}
                          </span>
                        )}
                      </div>
                      <div className="font-semibold tnum" style={{ color: "#B23A2A" }}>
                        −${parseFloat(String(refund.amount)).toFixed(2)}
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 text-[12.5px] font-semibold">
                    <div style={{ color: "var(--color-ink)" }}>Net total</div>
                    <div className="tnum" style={{ color: "var(--color-ink)" }}>
                      ${Math.max(0, total - refundedTotal).toFixed(2)}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Footer */}
            <div className="mt-6 flex items-center justify-between">
              <div className="text-[11px] font-mono" style={{ color: "var(--color-ink-dim)" }}>
                {order.stripeRef ? `Paid via Stripe · ${order.stripeRef}` : "Payment pending"} · {order.parentEmail}
              </div>
              <Barcode orderId={order.id} />
            </div>
          </div>
          <OrderActivityStrip rows={activityRows} />
        </div>
      </div>
    </>
  );
}
