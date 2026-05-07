"use client";

import { MobileShell } from "@/components/mobile-shell";
import { BottomNav } from "@/components/bottom-nav";
import { Crest } from "@/components/crest";
import { Chip } from "@/components/chip";
import { DoubleRule } from "@/components/double-rule";
import { OrderStatusStepper, type StepperStatus } from "@/components/order-status-stepper";
import type { Tenant } from "@/lib/data";

type OrderRow = {
  id: string;
  tenantId: string;
  parentEmail: string;
  parentName: string;
  studentName: string;
  studentYear: string | null;
  delivery: "pickup" | "ship";
  status:
    | "pending_payment"
    | "new"
    | "packing"
    | "ready"
    | "collected"
    | "partially_refunded"
    | "refunded";
  subtotal: string;
  total: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  lines: Array<{
    id: string;
    itemName: string;
    variantLabel: string;
    qty: number;
    unitPrice: string;
    lineTotal: string;
  }>;
};

type DbTenantRow = {
  id: string;
  name: string;
  accent: string;
  shopEmail: string | null;
  shopHours: string | null;
  address: string | null;
  collectionInstructions: string | null;
};

type RefundRow = {
  id: string;
  amount: string;
  reason: string | null;
  createdAt: Date | null;
};

const STATUS_LABEL: Record<OrderRow["status"], string> = {
  pending_payment: "Payment processing",
  new: "Order placed",
  packing: "Packing",
  ready: "Ready for pickup",
  collected: "Collected",
  partially_refunded: "Partially refunded",
  refunded: "Refunded",
};

const STATUS_TONE: Record<
  OrderRow["status"],
  "neutral" | "navy" | "success" | "warn" | "info" | "danger" | "gold"
> = {
  pending_payment: "warn",
  new: "neutral",
  packing: "info",
  ready: "success",
  collected: "success",
  partially_refunded: "warn",
  refunded: "danger",
};

function formatDate(d: Date | string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function OrderDetailClient({
  order,
  crestTenant,
  dbTenant,
  refunds,
  totalRefunded,
}: {
  order: OrderRow;
  crestTenant: Tenant;
  dbTenant: DbTenantRow;
  refunds: RefundRow[];
  totalRefunded: number;
}) {
  const isStepperStatus = (
    s: OrderRow["status"]
  ): s is StepperStatus =>
    s === "new" || s === "packing" || s === "ready" || s === "collected";

  const isRefundStatus =
    order.status === "partially_refunded" || order.status === "refunded";

  const subtotal = parseFloat(order.subtotal);
  const total = parseFloat(order.total);
  const netPaid = Math.max(0, total - totalRefunded);
  const accent = dbTenant.accent;

  return (
    <MobileShell bg="var(--color-paper)">
      <div className="px-5 pt-4 pb-3 flex items-center gap-3 flex-shrink-0">
        <Crest tenant={crestTenant} size={36} />
        <div className="flex-1 min-w-0">
          <div className="font-serif text-[15px] font-semibold leading-[1.2]">
            Order {order.id}
          </div>
        </div>
        <Chip tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Chip>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        <div
          className="bg-white rounded-xl border p-4 mb-4"
          style={{ borderColor: "var(--color-rule)" }}
        >
          {order.status === "pending_payment" ? (
            <div
              className="rounded-md p-3 text-[13px] leading-[1.5]"
              style={{
                background: "var(--color-parchment)",
                color: "var(--color-ink-dim)",
              }}
            >
              <div
                className="font-semibold mb-1"
                style={{ color: "var(--color-ink)" }}
              >
                Payment processing
              </div>
              Payment is being confirmed. This usually clears within a minute —
              refresh to check again.
            </div>
          ) : isRefundStatus ? (
            <div
              className="rounded-md p-3 text-[13px] leading-[1.5]"
              style={{
                background: "var(--color-parchment)",
                color: "var(--color-ink-dim)",
              }}
            >
              <div
                className="font-semibold mb-1"
                style={{ color: "var(--color-ink)" }}
              >
                {STATUS_LABEL[order.status]} — ${totalRefunded.toFixed(2)} returned
              </div>
              See refunds below for the breakdown.
            </div>
          ) : isStepperStatus(order.status) ? (
            <>
              <div
                className="text-[10.5px] text-center mb-2.5"
                style={{ color: "var(--color-ink-dim)" }}
              >
                Placed {formatDate(order.createdAt)}
              </div>
              <OrderStatusStepper status={order.status} accent={accent} />
              <div
                className="text-[10.5px] text-center mt-3"
                style={{ color: "var(--color-ink-dim)" }}
              >
                Last updated {formatDate(order.updatedAt)}
              </div>
            </>
          ) : null}
        </div>

        <div
          className="bg-white rounded-xl border p-4 mb-4"
          style={{ borderColor: "var(--color-rule)" }}
        >
          <div
            className="text-[11px] tracking-[0.4px] uppercase font-bold mb-2"
            style={{ color: "var(--color-ink-dim)" }}
          >
            {order.delivery === "pickup" ? "Pickup" : "Shipping"}
          </div>
          <Row label="Student" value={order.studentName} />
          {order.studentYear && <Row label="Year" value={order.studentYear} />}
          <Row label="School" value={dbTenant.name} />
          {order.delivery === "pickup" && (
            <>
              {dbTenant.shopHours && (
                <Row label="Shop hours" value={dbTenant.shopHours} />
              )}
              {dbTenant.address && <Row label="Address" value={dbTenant.address} />}
              {dbTenant.collectionInstructions && (
                <Row
                  label="Instructions"
                  value={dbTenant.collectionInstructions}
                />
              )}
            </>
          )}
        </div>

        <div
          className="bg-white rounded-xl border p-4 mb-4"
          style={{ borderColor: "var(--color-rule)" }}
        >
          <div
            className="text-[11px] tracking-[0.4px] uppercase font-bold mb-2"
            style={{ color: "var(--color-ink-dim)" }}
          >
            Items
          </div>
          {order.lines.map((line) => (
            <div
              key={line.id}
              className="flex justify-between py-2 text-[13px] border-b last:border-b-0"
              style={{ borderColor: "var(--color-rule)" }}
            >
              <div className="flex-1 min-w-0 pr-3">
                <div className="font-semibold">{line.itemName}</div>
                <div
                  className="text-[11px]"
                  style={{ color: "var(--color-ink-dim)" }}
                >
                  {line.variantLabel} · qty {line.qty}
                </div>
              </div>
              <div className="font-bold tnum">
                ${parseFloat(line.lineTotal).toFixed(2)}
              </div>
            </div>
          ))}
        </div>

        <div
          className="bg-white rounded-xl border p-4 mb-4"
          style={{ borderColor: "var(--color-rule)" }}
        >
          <div
            className="text-[11px] tracking-[0.4px] uppercase font-bold mb-2"
            style={{ color: "var(--color-ink-dim)" }}
          >
            Payment
          </div>
          <Row label="Subtotal" value={`$${subtotal.toFixed(2)}`} tnum />
          <Row label="Total" value={`$${total.toFixed(2)}`} bold tnum />
          {refunds.length > 0 && (
            <>
              <DoubleRule />
              {refunds.map((r) => (
                <Row
                  key={r.id}
                  label={`Refund · ${formatDate(r.createdAt)}${
                    r.reason ? ` · ${r.reason}` : ""
                  }`}
                  value={`-$${parseFloat(r.amount).toFixed(2)}`}
                  tnum
                />
              ))}
              <DoubleRule />
              <Row label="Net paid" value={`$${netPaid.toFixed(2)}`} bold tnum />
            </>
          )}
        </div>

        <div
          className="bg-white rounded-xl border p-4"
          style={{ borderColor: "var(--color-rule)" }}
        >
          <div
            className="text-[11px] tracking-[0.4px] uppercase font-bold mb-2"
            style={{ color: "var(--color-ink-dim)" }}
          >
            Need help?
          </div>
          {dbTenant.shopEmail ? (
            <a
              href={`mailto:${dbTenant.shopEmail}?subject=${encodeURIComponent(
                `Order ${order.id}`
              )}`}
              className="inline-block text-[13px] font-semibold underline"
              style={{ color: accent }}
            >
              Email {dbTenant.name}
            </a>
          ) : (
            <div className="text-[13px]" style={{ color: "var(--color-ink-dim)" }}>
              Contact your school directly for help with this order.
            </div>
          )}
        </div>
      </div>

      <BottomNav active="orders" />
    </MobileShell>
  );
}

function Row({
  label,
  value,
  bold,
  tnum,
}: {
  label: string;
  value: string;
  bold?: boolean;
  tnum?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-[13px]">
      <span style={{ color: "var(--color-ink-dim)" }}>{label}</span>
      <span
        className={`${bold ? "font-bold" : "font-semibold"} ${
          tnum ? "tnum" : ""
        } text-right`}
      >
        {value}
      </span>
    </div>
  );
}
