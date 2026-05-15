import type { ReactNode } from "react";
import type { Tenant } from "@/lib/data";
import { Chip } from "@/components/chip";
import { DoubleRule } from "@/components/double-rule";
import { Crest } from "@/components/crest";

export interface PickSlipOrder {
  id: string;
  status: string;
  parentName: string;
  parentEmail: string;
  parentMobile: string;
  parentNote: string | null;
  studentName: string;
  studentYear: string;
  studentRoll: string;
  delivery: string;
  total: string;
  gst: string;
  stripeRef: string | null;
  createdAt: string; // ISO string — see Task 2 for the detail-page adapter
}

export interface PickSlipLine {
  itemName: string;
  variantLabel: string | null;
  qty: number;
  lineTotal: string;
}

const STATUS_MAP: Record<string, { tone: "info" | "warn" | "success" | "neutral" | "danger"; label: string }> = {
  // New fulfilment_status enum (current schema)
  to_prepare: { tone: "info", label: "To prepare" },
  ready: { tone: "success", label: "Ready for pickup" },
  needs_attention: { tone: "warn", label: "Needs attention" },
  completed: { tone: "neutral", label: "Completed" },
  // Payment derived states still flow through here
  partially_refunded: { tone: "danger", label: "Partially refunded" },
  refunded: { tone: "danger", label: "Refunded" },
  // Legacy keys kept for any cached page state during the migration window
  pending_payment: { tone: "neutral", label: "Pending payment" },
  new: { tone: "info", label: "New" },
  packing: { tone: "warn", label: "Packing" },
  collected: { tone: "neutral", label: "Collected" },
};

function PickSlipBarcode({ orderId }: { orderId: string }) {
  const widths = [3, 1, 2, 1, 1, 3, 1, 2, 3, 1, 1, 2, 3, 2, 1, 1, 3, 1, 2, 1, 1, 3, 2, 1];
  let x = 0;
  return (
    <svg width={180} height={48}>
      {widths.map((w, i) => {
        const fill = i % 2 === 0 ? "var(--color-ink)" : "transparent";
        const el = <rect key={i} x={x} y={0} width={w * 2} height={36} fill={fill} />;
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

export interface PickSlipProps {
  order: PickSlipOrder;
  tenant: Tenant;
  lines: PickSlipLine[];
  /** Rendered between the items table and the footer. Detail page uses it for the refunds block; batch print passes nothing. */
  refundsSlot?: ReactNode;
}

export function PickSlip({ order, tenant, lines, refundsSlot }: PickSlipProps) {
  const statusInfo = STATUS_MAP[order.status] ?? { tone: "neutral" as const, label: order.status };
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
              <div className="type-h2 leading-tight" style={{ color: "var(--color-ink)" }}>
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
          <div className="type-label mb-1" style={{ color: "var(--color-ink-dim)" }}>Student</div>
          <div className="font-serif text-[16px] font-medium" style={{ color: "var(--color-ink)" }}>
            {order.studentName}
          </div>
          <div className="text-[11px]" style={{ color: "var(--color-ink-dim)" }}>
            {order.studentYear} · Roll {order.studentRoll}
          </div>
        </div>
        <div>
          <div className="type-label mb-1" style={{ color: "var(--color-ink-dim)" }}>Parent</div>
          <div className="font-serif text-[16px] font-medium" style={{ color: "var(--color-ink)" }}>
            {order.parentName}
          </div>
          <div className="text-[11px]" style={{ color: "var(--color-ink-dim)" }}>
            {order.parentMobile}
          </div>
        </div>
        <div>
          <div className="type-label mb-1" style={{ color: "var(--color-ink-dim)" }}>Fulfilment</div>
          <div className="font-serif text-[16px] font-medium" style={{ color: "var(--color-ink)" }}>
            {order.delivery === "pickup" ? "Pickup at office" : "Ship to home"}
          </div>
          <div className="text-[11px]" style={{ color: "var(--color-ink-dim)" }}>
            {order.delivery === "pickup" ? "Notify when ready" : order.parentEmail}
          </div>
        </div>
      </div>

      <DoubleRule />

      {/* Parent note callout (on-screen, screen + print) */}
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
          <tr className="text-[10.5px] uppercase tracking-[0.6px]" style={{ color: "var(--color-ink-dim)" }}>
            <th className="text-left py-2 font-bold border-b w-8" style={{ borderColor: "var(--color-rule)" }}>✓</th>
            <th className="text-left py-2 font-bold border-b" style={{ borderColor: "var(--color-rule)" }}>Item</th>
            <th className="text-left py-2 font-bold border-b w-[150px]" style={{ borderColor: "var(--color-rule)" }}>Variant</th>
            <th className="text-center py-2 font-bold border-b w-[50px]" style={{ borderColor: "var(--color-rule)" }}>Qty</th>
            <th className="text-right py-2 font-bold border-b w-[90px]" style={{ borderColor: "var(--color-rule)" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
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
              <td className="py-3 font-medium" style={{ color: "var(--color-ink)" }}>{line.itemName}</td>
              <td className="py-3 text-[12px]" style={{ color: "var(--color-ink-dim)" }}>{line.variantLabel}</td>
              <td className="py-3 text-center font-bold font-mono" style={{ color: "var(--color-ink)" }}>{line.qty}</td>
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
            <td colSpan={4} className="text-right text-[11px]" style={{ color: "var(--color-ink-dim)" }}>GST included</td>
            <td className="text-right text-[11px] tnum" style={{ color: "var(--color-ink-dim)" }}>${gst.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      {refundsSlot}

      {/* Footer */}
      <div className="mt-6 flex items-center justify-between">
        <div className="text-[11px] font-mono" style={{ color: "var(--color-ink-dim)" }}>
          {order.stripeRef ? `Paid via Stripe · ${order.stripeRef}` : "Payment pending"} · {order.parentEmail}
        </div>
        <PickSlipBarcode orderId={order.id} />
      </div>
    </div>
  );
}
