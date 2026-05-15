"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { BoardOrder, FulfilmentStatus, WorkflowMode } from "@/db/queries";
import { markReady, markCompleted, resolveIssue } from "./actions";
import { ReportIssueSheet } from "./report-issue-sheet";

const BTN =
  "text-sm px-3 py-1.5 rounded border border-rule hover:bg-rule/40 disabled:opacity-50";

const STANDARD_FILTERS: Array<{ key: "all" | FulfilmentStatus; label: string }> = [
  { key: "all", label: "All" },
  { key: "to_prepare", label: "To prepare" },
  { key: "ready", label: "Ready" },
  { key: "needs_attention", label: "Needs attention" },
  { key: "completed", label: "Completed" },
];

const SIMPLE_FILTERS: Array<{ key: "all" | "to_prepare" | "completed"; label: string }> = [
  { key: "all", label: "All" },
  { key: "to_prepare", label: "To prepare" },
  { key: "completed", label: "Completed" },
];

export function OrdersMobileList({
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
  const [filter, setFilter] = useState<"all" | FulfilmentStatus>("all");
  const [issueTarget, setIssueTarget] = useState<BoardOrder | null>(null);
  const filters = workflowMode === "simple" ? SIMPLE_FILTERS : STANDARD_FILTERS;

  const filtered = orders.filter((o) => {
    if (filter === "all") return true;
    if (workflowMode === "simple") {
      return filter === "completed"
        ? o.fulfilmentStatus === "completed"
        : o.fulfilmentStatus !== "completed";
    }
    return o.fulfilmentStatus === filter;
  });

  return (
    <div data-no-print className="lg:hidden flex flex-col gap-3 p-3">
      <nav className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1 rounded-full border text-xs whitespace-nowrap ${
              filter === f.key
                ? "bg-navy-deep text-white border-transparent"
                : "border-rule"
            }`}
          >
            {f.label}
          </button>
        ))}
      </nav>
      <ul className="flex flex-col gap-2">
        {filtered.length === 0 && (
          <li className="text-center py-8 text-sm text-foreground/60">No orders</li>
        )}
        {filtered.map((o) => (
          <MobileRow
            key={o.id}
            order={o}
            tenantId={tenantId}
            mode={workflowMode}
            accent={accent}
            onReportIssue={() => setIssueTarget(o)}
          />
        ))}
      </ul>
      {issueTarget && (
        <ReportIssueSheet
          order={issueTarget}
          tenantId={tenantId}
          onClose={() => setIssueTarget(null)}
        />
      )}
    </div>
  );
}

function MobileRow({
  order,
  tenantId,
  mode,
  accent,
  onReportIssue,
}: {
  order: BoardOrder;
  tenantId: string;
  mode: WorkflowMode;
  accent: string;
  onReportIssue: () => void;
}) {
  const [pending, start] = useTransition();
  const s = order.fulfilmentStatus;
  const total = parseFloat(order.total);
  return (
    <li className="bg-paper border border-rule rounded-md p-3 text-sm">
      <div className="flex items-baseline justify-between">
        <Link
          href={`/admin/${tenantId}/orders/${order.id}`}
          className="font-mono text-xs font-semibold"
          style={{ color: accent }}
        >
          {order.id}
        </Link>
        <span className="tnum font-semibold">${total.toFixed(0)}</span>
      </div>
      <div className="mt-1">
        {order.studentName} · Yr {order.studentYear}
      </div>
      <div className="text-foreground/60 text-xs">{order.parentName}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {mode === "simple" && s !== "completed" && (
          <button
            className={BTN}
            disabled={pending}
            onClick={() => start(() => markCompleted(tenantId, order.id, "manual"))}
          >
            Mark completed
          </button>
        )}
        {mode === "standard" && s === "to_prepare" && (
          <>
            <button
              className={BTN}
              disabled={pending}
              onClick={() => start(() => markReady(tenantId, order.id))}
            >
              Mark ready
            </button>
            <button className={BTN} disabled={pending} onClick={onReportIssue}>
              Report issue
            </button>
          </>
        )}
        {mode === "standard" && s === "ready" && (
          <>
            <button
              className={BTN}
              disabled={pending}
              onClick={() =>
                start(() =>
                  markCompleted(
                    tenantId,
                    order.id,
                    order.fulfilmentMethod === "shipping" ? "shipped" : "collected",
                  ),
                )
              }
            >
              Mark completed
            </button>
            <button className={BTN} disabled={pending} onClick={onReportIssue}>
              Report issue
            </button>
          </>
        )}
        {mode === "standard" && s === "needs_attention" && (
          <>
            <button
              className={BTN}
              disabled={pending}
              onClick={() => start(() => resolveIssue(tenantId, order.id))}
            >
              Resolve to ready
            </button>
            <button
              className={BTN}
              disabled={pending}
              onClick={() =>
                start(() => markCompleted(tenantId, order.id, "manual"))
              }
            >
              Mark completed
            </button>
          </>
        )}
      </div>
    </li>
  );
}
