"use client";
import Link from "next/link";
import { useTransition } from "react";
import type { BoardOrder, WorkflowMode } from "@/db/queries";
import { markReady, markCompleted, resolveIssue } from "./actions";

const BTN =
  "text-xs px-2 py-1 rounded border border-rule hover:bg-rule/40 disabled:opacity-50";

export function OrderCard({
  order,
  tenantId,
  mode,
  accent,
}: {
  order: BoardOrder;
  tenantId: string;
  mode: WorkflowMode;
  accent: string;
}) {
  const total = parseFloat(order.total);
  return (
    <article className="bg-parchment border border-rule rounded-md p-3 text-sm">
      <div className="flex items-baseline justify-between">
        <Link
          href={`/admin/${tenantId}/orders/${order.id}`}
          className="font-mono text-[11px] font-semibold"
          style={{ color: accent }}
        >
          {order.id}
        </Link>
        <span className="tnum font-semibold">${total.toFixed(0)}</span>
      </div>
      <div className="mt-1 font-serif text-[14px] leading-tight">
        {order.studentName}
      </div>
      <div className="text-[11px] text-foreground/60">
        {order.parentName} · {order.studentYear}
      </div>
      <BadgeRow order={order} mode={mode} />
      <Actions order={order} tenantId={tenantId} mode={mode} />
    </article>
  );
}

function BadgeRow({ order, mode }: { order: BoardOrder; mode: WorkflowMode }) {
  const emails = (order.emailsSent ?? {}) as Record<
    string,
    "queued" | "sent" | "failed" | undefined
  >;
  return (
    <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
      {order.paymentStatus !== "pending" &&
        order.paymentStatus !== "refunded" &&
        order.paymentStatus !== "partially_refunded" && (
          <Badge label="Paid" tone="green" />
        )}
      {order.pickSlipPrintedAt && <Badge label="Printed" tone="muted" />}
      {mode === "standard" && emails.ready === "sent" && (
        <Badge label="Email sent" tone="muted" />
      )}
      {mode === "standard" && emails.ready === "failed" && (
        <Badge label="Email failed" tone="red" />
      )}
      {mode === "standard" && emails.hold === "sent" && (
        <Badge label="Hold notice sent" tone="amber" />
      )}
      {order.paymentStatus === "refunded" && (
        <Badge label="Refunded" tone="red" />
      )}
      {order.paymentStatus === "partially_refunded" && (
        <Badge
          label={`Partially refunded $${(order.refundedAmountCents / 100).toFixed(2)}`}
          tone="amber"
        />
      )}
      {order.completionType === "collected" && (
        <Badge label="Collected" tone="muted" />
      )}
      {order.completionType === "manual" && (
        <Badge label="Manual" tone="muted" />
      )}
    </div>
  );
}

function Badge({
  label,
  tone,
}: {
  label: string;
  tone: "green" | "red" | "amber" | "muted";
}) {
  const cls = {
    green: "bg-green-100 text-green-900",
    red: "bg-red-100 text-red-900",
    amber: "bg-amber-100 text-amber-900",
    muted: "bg-rule/60 text-foreground/80",
  }[tone];
  return <span className={`px-1.5 py-0.5 rounded ${cls}`}>{label}</span>;
}

function Actions({
  order,
  tenantId,
  mode,
}: {
  order: BoardOrder;
  tenantId: string;
  mode: WorkflowMode;
}) {
  const [pending, start] = useTransition();
  if (order.fulfilmentStatus === "completed") return null;

  if (mode === "simple") {
    return (
      <div className="mt-2 flex flex-wrap gap-1">
        <button
          className={BTN}
          disabled={pending}
          onClick={() => start(() => markCompleted(tenantId, order.id, "manual"))}
        >
          Mark completed
        </button>
      </div>
    );
  }

  const s = order.fulfilmentStatus;
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {s === "to_prepare" && (
        <button
          className={BTN}
          disabled={pending}
          onClick={() => start(() => markReady(tenantId, order.id))}
        >
          Mark ready
        </button>
      )}
      {s === "ready" && (
        <button
          className={BTN}
          disabled={pending}
          onClick={() =>
            start(() => markCompleted(tenantId, order.id, "collected"))
          }
        >
          Mark completed
        </button>
      )}
      {s === "needs_attention" && (
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
  );
}
