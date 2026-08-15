"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { BoardOrder, WorkflowMode } from "@/db/queries";
import { markReady, markCompleted, resolveIssue } from "./actions";
import { ReportIssueSheet } from "./report-issue-sheet";

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
  // `ready`/`hold` slots hold a plain status string; `confirmation` holds an
  // object ({sentAt,messageId} when sent, {status:"failed",…} when terminally
  // failed — see lib/email/index.ts).
  const emails = (order.emailsSent ?? {}) as Record<string, unknown>;
  const status = (key: string): string | undefined => {
    const slot = emails[key];
    if (typeof slot === "string") return slot;
    if (slot && typeof slot === "object" && "status" in slot) {
      const s = (slot as { status?: unknown }).status;
      return typeof s === "string" ? s : undefined;
    }
    return undefined;
  };
  return (
    <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
      {order.paymentStatus !== "pending" &&
        order.paymentStatus !== "refunded" &&
        order.paymentStatus !== "partially_refunded" && (
          <Badge label="Paid" tone="green" />
        )}
      {order.pickSlipPrintedAt && <Badge label="Printed" tone="muted" />}
      {status("confirmation") === "failed" && (
        <Badge label="Confirmation failed" tone="red" />
      )}
      {mode === "standard" && status("ready") === "sent" && (
        <Badge label="Email sent" tone="muted" />
      )}
      {mode === "standard" && status("ready") === "failed" && (
        <Badge label="Email failed" tone="red" />
      )}
      {mode === "standard" && status("hold") === "sent" && (
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
  const [showIssue, setShowIssue] = useState(false);
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
  // Shipping orders complete as `shipped` (parent has it sent to them);
  // pickup orders complete as `collected` (parent walked in). Manual override
  // is reserved for "Mark completed" on non-ready states (lost/forced close).
  const readyCompletion: "collected" | "shipped" =
    order.fulfilmentMethod === "shipping" ? "shipped" : "collected";
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {s === "to_prepare" && (
        <>
          <button
            className={BTN}
            disabled={pending}
            onClick={() => start(() => markReady(tenantId, order.id))}
          >
            Mark ready
          </button>
          <button
            className={BTN}
            disabled={pending}
            onClick={() => setShowIssue(true)}
          >
            Report issue
          </button>
        </>
      )}
      {s === "ready" && (
        <>
          <button
            className={BTN}
            disabled={pending}
            onClick={() =>
              start(() => markCompleted(tenantId, order.id, readyCompletion))
            }
          >
            Mark completed
          </button>
          <button
            className={BTN}
            disabled={pending}
            onClick={() => setShowIssue(true)}
          >
            Report issue
          </button>
        </>
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
      {showIssue && (
        <ReportIssueSheet
          order={order}
          tenantId={tenantId}
          onClose={() => setShowIssue(false)}
        />
      )}
    </div>
  );
}
