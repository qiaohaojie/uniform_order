"use client";
import { useMemo, useState, useTransition } from "react";
import type { Tenant } from "@/lib/data";
import type { BoardOrder, WorkflowMode } from "@/db/queries";
import { AdminTopbar } from "@/components/admin-shell";
import { OrdersBoard } from "./orders-board";
import { OrdersMobileList } from "./orders-mobile-list";
import { ExportOrdersButton } from "@/components/export-orders-button";
import { PickSlip, type PickSlipOrder, type PickSlipLine } from "@/components/admin/pick-slip";
import { recordPickSlipPrinted } from "./actions";

export function OrdersPageClient({
  tenantId,
  tenant,
  orders,
  workflowMode,
  linesByOrder,
}: {
  tenantId: string;
  tenant: Tenant;
  orders: BoardOrder[];
  workflowMode: WorkflowMode;
  linesByOrder: Record<string, PickSlipLine[]>;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [pending, start] = useTransition();

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.id.toLowerCase().includes(q) ||
        o.parentName.toLowerCase().includes(q) ||
        o.studentName.toLowerCase().includes(q) ||
        o.studentYear.toLowerCase().includes(q) ||
        o.studentRoll.toLowerCase().includes(q),
    );
  }, [orders, searchQuery]);

  const toPrepareOrders = useMemo(
    () =>
      orders
        .filter((o) => o.fulfilmentStatus === "to_prepare")
        .sort((a, b) => {
          const at = a.createdAt?.getTime() ?? 0;
          const bt = b.createdAt?.getTime() ?? 0;
          return at - bt;
        }),
    [orders],
  );
  const newCount = toPrepareOrders.length;

  const handlePrint = () => {
    if (newCount === 0) return;
    if (newCount >= 25 && !window.confirm(`Print ${newCount} pick slips?`)) return;
    const ids = toPrepareOrders.map((o) => o.id);
    start(async () => {
      try {
        await recordPickSlipPrinted(tenantId, ids);
      } catch (err) {
        console.error("recordPickSlipPrinted failed", err);
      }
      window.print();
    });
  };

  return (
    <>
      <AdminTopbar
        kicker={`${tenant.short} · Operator`}
        title="Orders"
        right={
          <div className="flex items-center gap-2">
            <div
              className="h-9 border rounded-md px-2.5 flex items-center gap-2 bg-white w-[240px]"
              style={{ borderColor: "var(--color-rule)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink-dim)" strokeWidth="1.7" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" />
                <path d="M20 20 L16 16" />
              </svg>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by order, parent, or kid"
                className="flex-1 border-none outline-none text-[12.5px] bg-transparent"
                style={{ fontFamily: "var(--font-sans)", color: "var(--color-ink)" }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-[11px] leading-none"
                  style={{ color: "var(--color-ink-dim)" }}
                >
                  ✕
                </button>
              )}
            </div>
            <button
              onClick={handlePrint}
              disabled={newCount === 0 || pending}
              title={newCount === 0 ? "No new orders to pick" : undefined}
              className="h-9 px-3.5 text-[12.5px] font-semibold rounded-md border flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <rect x="6" y="3" width="12" height="6" />
                <rect x="3" y="9" width="18" height="9" rx="1" />
                <rect x="6" y="15" width="12" height="6" />
              </svg>
              {newCount > 0 ? `Print pick slips (${newCount})` : "Print pick slips"}
            </button>
            <ExportOrdersButton
              tenantId={tenantId}
              tenantShort={tenant.short}
              accent={tenant.accent}
            />
          </div>
        }
      />
      <OrdersBoard
        tenantId={tenantId}
        orders={filtered}
        workflowMode={workflowMode}
        accent={tenant.accent}
      />
      <OrdersMobileList
        tenantId={tenantId}
        orders={filtered}
        workflowMode={workflowMode}
        accent={tenant.accent}
      />
      <div className="print:block hidden" aria-hidden>
        {toPrepareOrders.map((o, idx) => {
          const slipOrder: PickSlipOrder = {
            id: o.id,
            status: o.fulfilmentStatus,
            parentName: o.parentName,
            parentEmail: o.parentEmail,
            parentMobile: o.parentMobile,
            parentNote: o.parentNote,
            studentName: o.studentName,
            studentYear: o.studentYear,
            studentRoll: o.studentRoll,
            delivery: o.fulfilmentMethod === "shipping" ? "ship" : "pickup",
            total: o.total,
            gst: o.gst,
            stripeRef: o.stripeRef,
            createdAt: o.createdAt ? o.createdAt.toISOString() : "",
          };
          return (
            <div
              key={o.id}
              className={idx < toPrepareOrders.length - 1 ? "break-after-page" : undefined}
            >
              <PickSlip order={slipOrder} tenant={tenant} lines={linesByOrder[o.id] ?? []} />
            </div>
          );
        })}
      </div>
    </>
  );
}
