"use client";
import Link from "next/link";
import type { Tenant } from "@/lib/data";
import type { AdminOrder, OrderStatus } from "@/lib/admin-data";
import { useOrders } from "@/lib/order-store";
import { Chip } from "@/components/chip";

const COLUMNS: { id: OrderStatus; label: string; tone: string }[] = [
  { id: "new", label: "New", tone: "#3B82F6" },
  { id: "packing", label: "Packing", tone: "#F59E0B" },
  { id: "ready", label: "Ready", tone: "#10B981" },
  { id: "collected", label: "Collected", tone: "#6B7280" },
];

function OrderCard({
  order,
  accent,
  onAdvance,
}: {
  order: AdminOrder;
  accent: string;
  onAdvance: (id: string, status: OrderStatus) => void;
}) {
  const nextStatus: Record<OrderStatus, OrderStatus | null> = {
    new: "packing",
    packing: "ready",
    ready: "collected",
    collected: null,
  };
  const nextLabel: Record<OrderStatus, string> = {
    new: "Start packing",
    packing: "Mark ready",
    ready: "Collect",
    collected: "",
  };
  const next = nextStatus[order.status];

  return (
    <div
      className="rounded-lg border p-3"
      style={{ background: "var(--color-parchment)", borderColor: "var(--color-rule)" }}
    >
      <div className="flex justify-between items-center mb-1.5">
        <span className="font-mono text-[11px] font-semibold" style={{ color: accent }}>
          {order.id}
        </span>
        <Chip tone={order.delivery === "ship" ? "info" : "neutral"} size="sm">
          {order.delivery === "ship" ? "Ship" : "Pickup"}
        </Chip>
      </div>
      <div className="font-serif text-[14px] font-medium leading-[1.2] mb-0.5" style={{ color: "var(--color-ink)" }}>
        {order.kid}
      </div>
      <div className="text-[11px]" style={{ color: "var(--color-ink-dim)" }}>
        {order.parent} · {order.year}
      </div>
      <div
        className="mt-2 pt-2 flex justify-between text-[11px]"
        style={{ borderTop: "1px dashed var(--color-rule)" }}
      >
        <span style={{ color: "var(--color-ink-dim)" }}>{order.items.length} items</span>
        <span className="font-bold tnum" style={{ color: "var(--color-ink)" }}>
          ${order.total.toFixed(0)}
        </span>
      </div>
      {next && (
        <div className="mt-2 flex gap-1.5">
          <Link
            href={`/admin/${order.tenantId}/orders/${order.id}`}
            className="flex-1 h-7 text-[11.5px] font-semibold rounded border flex items-center justify-center"
            style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)", background: "#fff" }}
          >
            View
          </Link>
          <button
            onClick={() => onAdvance(order.id, next)}
            className="flex-1 h-7 text-[11.5px] font-semibold rounded text-white flex items-center justify-center"
            style={{
              background:
                order.status === "ready"
                  ? "var(--color-success)"
                  : accent,
            }}
          >
            {nextLabel[order.status]}
          </button>
        </div>
      )}
      {order.status === "ready" && (
        <button
          className="mt-1.5 w-full h-7 text-[11.5px] font-semibold rounded border flex items-center justify-center"
          style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)", background: "#fff" }}
        >
          Notify parent
        </button>
      )}
      {order.status === "collected" && (
        <Link
          href={`/admin/${order.tenantId}/orders/${order.id}`}
          className="mt-2 w-full h-7 text-[11.5px] font-semibold rounded border flex items-center justify-center"
          style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)", background: "#fff" }}
        >
          View details
        </Link>
      )}
    </div>
  );
}

export function OrdersBoard({ tenantId, tenant }: { tenantId: string; tenant: Tenant }) {
  const { orders: allOrders, updateStatus } = useOrders();
  const orders = allOrders.filter((o) => o.tenantId === tenantId);

  const handleAdvance = (id: string, status: OrderStatus) => {
    updateStatus(id, status);
  };

  const counts = COLUMNS.reduce(
    (acc, col) => ({ ...acc, [col.id]: orders.filter((o) => o.status === col.id).length }),
    {} as Record<OrderStatus, number>
  );

  return (
    <div className="flex-1 p-6 overflow-hidden">
      <div className="h-full grid gap-3.5" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {COLUMNS.map((col) => {
          const colOrders = orders.filter((o) => o.status === col.id);
          return (
            <div
              key={col.id}
              className="bg-white rounded-[10px] border flex flex-col min-h-0"
              style={{ borderColor: "var(--color-rule)" }}
            >
              {/* Column header */}
              <div
                className="px-3.5 py-3 flex items-center justify-between flex-shrink-0"
                style={{ borderBottom: "1px solid var(--color-rule)" }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: col.tone }} />
                  <span className="text-[12.5px] font-bold" style={{ color: "var(--color-ink)" }}>
                    {col.label}
                  </span>
                  <span className="text-[11px] font-semibold" style={{ color: "var(--color-ink-dim)" }}>
                    {counts[col.id]}
                  </span>
                </div>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2">
                {colOrders.length === 0 && (
                  <div
                    className="text-[12px] text-center py-8"
                    style={{ color: "var(--color-ink-dim)" }}
                  >
                    No orders
                  </div>
                )}
                {colOrders.map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    accent={tenant.accent}
                    onAdvance={handleAdvance}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
