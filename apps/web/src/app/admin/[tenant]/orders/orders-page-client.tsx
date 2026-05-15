"use client";
import { useState } from "react";
import type { Tenant } from "@/lib/data";
import { AdminTopbar } from "@/components/admin-shell";
import { OrdersBoard } from "./orders-board";
import { ExportOrdersButton } from "@/components/export-orders-button";

export function OrdersPageClient({
  tenantId,
  tenant,
}: {
  tenantId: string;
  tenant: Tenant;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [newCount, setNewCount] = useState(0);

  const handlePrint = () => {
    if (newCount === 0) return;
    // 25 is roughly a full-day picking run at one school. Above that we want a
    // moment of pause before committing operator-side paper + ink.
    if (newCount >= 25 && !window.confirm(`Print ${newCount} pick slips?`)) {
      return;
    }
    window.print();
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
                <circle cx="11" cy="11" r="8" /><path d="M20 20 L16 16" />
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
              disabled={newCount === 0}
              title={newCount === 0 ? "No new orders to pick" : undefined}
              className="h-9 px-3.5 text-[12.5px] font-semibold rounded-md border flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <rect x="6" y="3" width="12" height="6" /><rect x="3" y="9" width="18" height="9" rx="1" /><rect x="6" y="15" width="12" height="6" />
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
        tenant={tenant}
        searchQuery={searchQuery}
        onNewCountChange={setNewCount}
      />
    </>
  );
}
