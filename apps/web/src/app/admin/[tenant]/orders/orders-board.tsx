"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { Tenant } from "@/lib/data";
import { Chip } from "@/components/chip";

type OrderStatus = "new" | "packing" | "ready" | "collected";

interface DbOrder {
  id: string;
  tenantId: string;
  parentName: string;
  parentEmail: string;
  parentMobile: string;
  studentName: string;
  studentYear: string;
  studentRoll: string;
  delivery: "pickup" | "ship";
  deliveryFee: string;
  subtotal: string;
  gst: string;
  total: string;
  stripeRef: string | null;
  status: OrderStatus;
  createdAt: string;
}

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
  order: DbOrder;
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
  const total = parseFloat(order.total);

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
        {order.studentName}
      </div>
      <div className="text-[11px]" style={{ color: "var(--color-ink-dim)" }}>
        {order.parentName} · {order.studentYear}
      </div>
      <div
        className="mt-2 pt-2 flex justify-between text-[11px]"
        style={{ borderTop: "1px dashed var(--color-rule)" }}
      >
        <span style={{ color: "var(--color-ink-dim)" }}>
          {new Date(order.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
        </span>
        <span className="font-bold tnum" style={{ color: "var(--color-ink)" }}>
          ${total.toFixed(0)}
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
              background: order.status === "ready" ? "var(--color-success)" : accent,
            }}
          >
            {nextLabel[order.status]}
          </button>
        </div>
      )}
      {order.status === "ready" && (
        <button
          onClick={() => {
            const subject = encodeURIComponent(`Your uniform order ${order.id} is ready`);
            const body = encodeURIComponent(
              `Hi ${order.parentName},\n\nYour uniform order ${order.id} for ${order.studentName} is ready for collection.\n\nPlease collect during shop hours.\n\nThank you.`
            );
            window.open(`mailto:${order.parentEmail}?subject=${subject}&body=${body}`);
          }}
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

export function OrdersBoard({
  tenantId,
  tenant,
  searchQuery,
}: {
  tenantId: string;
  tenant: Tenant;
  searchQuery: string;
}) {
  const [allOrders, setAllOrders] = useState<DbOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders?tenantId=${encodeURIComponent(tenantId)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to fetch orders.");
      }
      const data = await res.json();
      setAllOrders(data);
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleAdvance = async (id: string, status: OrderStatus) => {
    // Optimistic update
    setAllOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status } : o))
    );
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, tenantId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to update order status.");
      }
    } catch (err) {
      console.error("Failed to update order status:", err);
      fetchOrders(); // Revert on error
    }
  };

  // Filter by search query
  const q = searchQuery.toLowerCase().trim();
  const filtered = q
    ? allOrders.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          o.parentName.toLowerCase().includes(q) ||
          o.studentName.toLowerCase().includes(q) ||
          o.studentYear.toLowerCase().includes(q) ||
          o.studentRoll.toLowerCase().includes(q)
      )
    : allOrders;

  const counts = COLUMNS.reduce(
    (acc, col) => ({ ...acc, [col.id]: filtered.filter((o) => o.status === col.id).length }),
    {} as Record<OrderStatus, number>
  );

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-[13px]" style={{ color: "var(--color-ink-dim)" }}>
          Loading orders…
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 overflow-hidden">
      <div className="h-full grid gap-3.5" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {COLUMNS.map((col) => {
          const colOrders = filtered.filter((o) => o.status === col.id);
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
