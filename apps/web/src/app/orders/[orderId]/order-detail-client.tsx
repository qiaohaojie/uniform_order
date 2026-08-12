"use client";

import { MobileShell } from "@/components/mobile-shell";
import { BottomNav } from "@/components/bottom-nav";
import { Crest, type CrestTenant } from "@/components/crest";
import { Chip } from "@/components/chip";
import { DoubleRule } from "@/components/double-rule";
import { OrderStatusStepper, type StepperStatus } from "@/components/order-status-stepper";

type FulfilmentStatus = "to_prepare" | "ready" | "needs_attention" | "completed";
type PaymentStatus = "pending" | "paid" | "partially_refunded" | "refunded";
type FulfilmentMethod = "pickup" | "shipping";

type OrderRow = {
  id: string;
  tenantId: string;
  parentEmail: string;
  parentName: string;
  studentName: string;
  studentYear: string | null;
  fulfilmentMethod: FulfilmentMethod;
  fulfilmentStatus: FulfilmentStatus;
  paymentStatus: PaymentStatus;
  subtotal: string;
  total: string;
  parentNote: string | null;
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

type DisplayStatus =
  | "pending_payment"
  | "to_prepare"
  | "ready"
  | "needs_attention"
  | "completed"
  | "partially_refunded"
  | "refunded";

function displayStatus(
  fulfilmentStatus: FulfilmentStatus,
  paymentStatus: PaymentStatus,
): DisplayStatus {
  if (paymentStatus === "pending") return "pending_payment";
  if (paymentStatus === "refunded") return "refunded";
  if (paymentStatus === "partially_refunded") return "partially_refunded";
  return fulfilmentStatus;
}

const STATUS_LABEL: Record<DisplayStatus, string> = {
  pending_payment: "Payment processing",
  to_prepare: "Order placed",
  ready: "Ready for pickup",
  needs_attention: "On hold",
  completed: "Completed",
  partially_refunded: "Partially refunded",
  refunded: "Refunded",
};

const STATUS_TONE: Record<
  DisplayStatus,
  "neutral" | "navy" | "success" | "warn" | "info" | "danger" | "gold"
> = {
  pending_payment: "warn",
  to_prepare: "info",
  ready: "success",
  needs_attention: "warn",
  completed: "success",
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
  crestTenant: CrestTenant;
  dbTenant: DbTenantRow;
  refunds: RefundRow[];
  totalRefunded: number;
}) {
  const ds = displayStatus(order.fulfilmentStatus, order.paymentStatus);
  const isStepperStatus = (s: DisplayStatus): s is StepperStatus =>
    s === "to_prepare" || s === "ready" || s === "completed";

  const isRefundStatus =
    ds === "partially_refunded" || ds === "refunded";

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
        <Chip tone={STATUS_TONE[ds]}>{STATUS_LABEL[ds]}</Chip>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        <div
          className="bg-white rounded-xl border p-4 mb-4"
          style={{ borderColor: "var(--color-rule)" }}
        >
          {ds === "pending_payment" ? (
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
                {STATUS_LABEL[ds]} — ${totalRefunded.toFixed(2)} returned
              </div>
              See refunds below for the breakdown.
            </div>
          ) : isStepperStatus(ds) ? (
            <>
              <div
                className="text-[10.5px] text-center mb-2.5"
                style={{ color: "var(--color-ink-dim)" }}
              >
                Placed {formatDate(order.createdAt)}
              </div>
              <OrderStatusStepper status={ds} accent={accent} />
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
            {order.fulfilmentMethod === "pickup" ? "Pickup" : "Shipping"}
          </div>
          <Row label="Student" value={order.studentName} />
          {order.studentYear && <Row label="Year" value={order.studentYear} />}
          <Row label="School" value={dbTenant.name} />
          {order.fulfilmentMethod === "pickup" && (
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

        {order.parentNote && (
          <div
            className="rounded-lg border p-3 mb-4"
            style={{ borderColor: "var(--color-rule)", background: "var(--color-parchment)" }}
          >
            <div className="text-[11px] font-bold tracking-[1.2px] uppercase mb-1" style={{ color: "var(--color-gold-text)" }}>
              Your note to the school
            </div>
            <div className="text-[13px] leading-[1.5]" style={{ color: "var(--color-ink)" }}>
              {order.parentNote}
            </div>
          </div>
        )}

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
