"use client";

import type { ReactNode } from "react";
import type { BoardOrder, FulfilmentStatus, WorkflowMode } from "@/db/queries";
import { OrderCard } from "./order-card";

const STANDARD_COLUMNS: Array<{ key: FulfilmentStatus; label: string; tone: string }> = [
  { key: "to_prepare", label: "To prepare", tone: "#3B82F6" },
  { key: "ready", label: "Ready", tone: "#10B981" },
  { key: "needs_attention", label: "Needs attention", tone: "#F59E0B" },
  { key: "completed", label: "Completed", tone: "#6B7280" },
];

const SIMPLE_COLUMNS: Array<{ key: "to_prepare" | "completed"; label: string; tone: string }> = [
  { key: "to_prepare", label: "To prepare", tone: "#3B82F6" },
  { key: "completed", label: "Completed", tone: "#6B7280" },
];

export function OrdersBoard({
  tenantId,
  orders,
  workflowMode,
  accent,
}: {
  tenantId: string;
  orders: BoardOrder[];
  workflowMode: WorkflowMode;
  accent: string;
}) {
  if (workflowMode === "simple") {
    const groups = {
      to_prepare: orders.filter((o) => o.fulfilmentStatus !== "completed"),
      completed: orders.filter((o) => o.fulfilmentStatus === "completed"),
    };
    return (
      <BoardGrid columns={2}>
        {SIMPLE_COLUMNS.map((col) => (
          <Column key={col.key} label={col.label} tone={col.tone} count={groups[col.key].length}>
            {groups[col.key].map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                tenantId={tenantId}
                mode="simple"
                accent={accent}
              />
            ))}
          </Column>
        ))}
      </BoardGrid>
    );
  }

  const groups: Record<FulfilmentStatus, BoardOrder[]> = {
    to_prepare: [],
    ready: [],
    needs_attention: [],
    completed: [],
  };
  for (const o of orders) groups[o.fulfilmentStatus].push(o);

  return (
    <BoardGrid columns={4}>
      {STANDARD_COLUMNS.map((col) => (
        <Column key={col.key} label={col.label} tone={col.tone} count={groups[col.key].length}>
          {groups[col.key].map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              tenantId={tenantId}
              mode="standard"
              accent={accent}
            />
          ))}
        </Column>
      ))}
    </BoardGrid>
  );
}

function BoardGrid({ columns, children }: { columns: 2 | 4; children: ReactNode }) {
  return (
    <div
      data-no-print
      className="hidden lg:grid gap-3.5 p-6"
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {children}
    </div>
  );
}

function Column({
  label,
  tone,
  count,
  children,
}: {
  label: string;
  tone: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section
      className="bg-white rounded-[10px] border flex flex-col min-h-0"
      style={{ borderColor: "var(--color-rule)" }}
    >
      <header
        className="px-3.5 py-3 flex items-center gap-2 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--color-rule)" }}
      >
        <div className="w-2 h-2 rounded-full" style={{ background: tone }} />
        <span className="text-[12.5px] font-bold" style={{ color: "var(--color-ink)" }}>
          {label}
        </span>
        <span className="text-[11px] font-semibold" style={{ color: "var(--color-ink-dim)" }}>
          {count}
        </span>
      </header>
      <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2">
        {count === 0 && (
          <div className="text-[12px] text-center py-8" style={{ color: "var(--color-ink-dim)" }}>
            No orders
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
