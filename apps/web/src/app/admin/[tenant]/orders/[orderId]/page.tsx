import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getOrderById,
  getOrderRefunds,
  getTotalRefunded,
  getTenant,
  getTenantSettings,
  listOrderEvents,
  listOrderNotificationEvents,
  toTenantBrand,
} from "@/db/queries";
import { AdminTopbar } from "@/components/admin-shell";
import { DoubleRule } from "@/components/double-rule";
import { OrderDetailActions } from "./order-detail-actions";
import { OrderHistory } from "./order-history";
import { PrintButton } from "@/components/print-button";
import { loadOrderActivity } from "@/lib/audit/load-order-activity";
import { OrderActivityStrip } from "@/components/admin/order-activity-strip";
import { PickSlip, type PickSlipOrder, type PickSlipLine } from "@/components/admin/pick-slip";

export default async function OrderDetailPage({
  params,
}: { params: Promise<{ tenant: string; orderId: string }> }) {
  const { tenant: tid, orderId } = await params;
  const tenantRecord = await getTenant(tid);
  if (!tenantRecord) notFound();
  const tenant = toTenantBrand(tenantRecord);

  const order = await getOrderById(orderId);
  if (!order || order.tenantId !== tid) notFound();

  const [refunds, refundedTotal, activityRows, settings, events, notifications] =
    await Promise.all([
      getOrderRefunds(orderId),
      getTotalRefunded(orderId),
      loadOrderActivity(orderId),
      getTenantSettings(tenantRecord.id),
      listOrderEvents(orderId),
      listOrderNotificationEvents(orderId),
    ]);

  const total = parseFloat(order.total);

  const slipOrder: PickSlipOrder = {
    id: order.id,
    status: order.fulfilmentStatus,
    parentName: order.parentName,
    parentEmail: order.parentEmail,
    parentMobile: order.parentMobile,
    parentNote: order.parentNote,
    studentName: order.studentName,
    studentYear: order.studentYear,
    studentRoll: order.studentRoll,
    delivery: order.fulfilmentMethod === "shipping" ? "ship" : "pickup",
    total: order.total,
    gst: order.gst,
    stripeRef: order.stripeRef,
    createdAt: order.createdAt ? order.createdAt.toISOString() : "",
  };

  const slipLines: PickSlipLine[] = order.lines.map((line) => ({
    itemName: line.itemName,
    variantLabel: line.variantLabel,
    qty: line.qty,
    lineTotal: line.lineTotal,
  }));

  const refundsBlock = refunds.length > 0 ? (
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
  ) : null;

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
                fulfilmentStatus={order.fulfilmentStatus}
                fulfilmentMethod={order.fulfilmentMethod}
                paymentStatus={order.paymentStatus}
                workflowMode={settings.workflowMode}
                accent={tenant.accent}
                total={total}
                refunded={refundedTotal}
              />
            </div>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto p-7">
        <div className="max-w-3xl mx-auto">
          <PickSlip order={slipOrder} tenant={tenant} lines={slipLines} refundsSlot={refundsBlock} />
          <OrderActivityStrip rows={activityRows} />
          <OrderHistory events={events} notifications={notifications} />
        </div>
      </div>
    </>
  );
}
