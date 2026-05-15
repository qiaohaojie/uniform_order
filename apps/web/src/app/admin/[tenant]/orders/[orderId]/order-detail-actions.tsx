"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { posthog } from "@/lib/analytics/client";
import type {
  FulfilmentStatus,
  FulfilmentMethod,
  WorkflowMode,
} from "@/db/queries";
import {
  markReady,
  resolveIssue,
  markCompleted,
  reopenOrder,
} from "../actions";
import { ReportIssueSheet } from "../report-issue-sheet";

function money(n: number) {
  return n.toFixed(2);
}

const BTN_OUTLINE =
  "h-9 px-3.5 text-[12.5px] font-semibold rounded-md border flex items-center gap-1.5";

export function OrderDetailActions({
  orderId,
  tenantId,
  fulfilmentStatus,
  fulfilmentMethod,
  paymentStatus,
  workflowMode,
  accent,
  total,
  refunded,
}: {
  orderId: string;
  tenantId: string;
  fulfilmentStatus: FulfilmentStatus;
  fulfilmentMethod: FulfilmentMethod;
  paymentStatus: "pending" | "paid" | "partially_refunded" | "refunded";
  workflowMode: WorkflowMode;
  accent: string;
  total: number;
  refunded: number;
}) {
  const readyCompletion: "collected" | "shipped" =
    fulfilmentMethod === "shipping" ? "shipped" : "collected";
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [showRefund, setShowRefund] = useState(false);
  const [showReopen, setShowReopen] = useState(false);
  const [showIssue, setShowIssue] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");

  const refundable =
    paymentStatus === "paid" || paymentStatus === "partially_refunded";
  const remaining = Math.max(0, total - refunded);
  const isCompleted = fulfilmentStatus === "completed";

  const runAction = (fn: () => Promise<unknown>) => {
    setError("");
    start(async () => {
      try {
        await fn();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed.");
      }
    });
  };

  const handleRefund = async () => {
    const amount = parseFloat(refundAmount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > remaining + 0.01) {
      setError("Invalid refund amount.");
      return;
    }
    setError("");
    start(async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/refund`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount, reason: refundReason }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? "Refund failed.");
        }
        setShowRefund(false);
        setRefundAmount("");
        setRefundReason("");
        router.refresh();
      } catch (err) {
        console.error("Refund failed:", err);
        setError(err instanceof Error ? err.message : "Refund failed.");
      }
    });
  };

  return (
    <>
      {error && (
        <span className="text-[12px] font-semibold" style={{ color: "#B23A2A" }}>
          {error}
        </span>
      )}

      {!isCompleted && workflowMode === "standard" && (
        <>
          {fulfilmentStatus === "to_prepare" && (
            <button
              onClick={() => {
                posthog.capture("order_mark_ready_clicked", { order_id: orderId });
                runAction(() => markReady(tenantId, orderId));
              }}
              disabled={pending}
              className="h-9 px-3.5 text-[12.5px] font-semibold rounded-md text-white disabled:opacity-60"
              style={{ background: accent }}
            >
              {pending ? "Saving…" : "Mark ready"}
            </button>
          )}
          {fulfilmentStatus === "needs_attention" && (
            <button
              onClick={() => runAction(() => resolveIssue(tenantId, orderId))}
              disabled={pending}
              className="h-9 px-3.5 text-[12.5px] font-semibold rounded-md text-white disabled:opacity-60"
              style={{ background: accent }}
            >
              Resolve to ready
            </button>
          )}
          {fulfilmentStatus !== "needs_attention" && (
            <button
              onClick={() => setShowIssue(true)}
              className={BTN_OUTLINE}
              style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
            >
              Report issue
            </button>
          )}
          <button
            onClick={() =>
              runAction(() => markCompleted(tenantId, orderId, readyCompletion))
            }
            disabled={pending}
            className="h-9 px-3.5 text-[12.5px] font-semibold rounded-md text-white disabled:opacity-60"
            style={{ background: "var(--color-success, #10B981)" }}
          >
            Mark completed
          </button>
        </>
      )}

      {!isCompleted && workflowMode === "simple" && (
        <button
          onClick={() =>
            runAction(() => markCompleted(tenantId, orderId, "manual"))
          }
          disabled={pending}
          className="h-9 px-3.5 text-[12.5px] font-semibold rounded-md text-white disabled:opacity-60"
          style={{ background: accent }}
        >
          Mark completed
        </button>
      )}

      {isCompleted && (
        <button
          onClick={() => setShowReopen(true)}
          className={BTN_OUTLINE}
          style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
        >
          Reopen order
        </button>
      )}

      {refundable && (
        <>
          <button
            onClick={() => setShowRefund((s) => !s)}
            className={BTN_OUTLINE}
            style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
          >
            Refund
          </button>
          {showRefund && (
            <div
              className="absolute right-0 top-[42px] z-20 bg-white rounded-lg border shadow-lg p-4 w-[320px]"
              style={{ borderColor: "var(--color-rule)" }}
            >
              <div className="text-[12px] font-semibold mb-1" style={{ color: "var(--color-ink)" }}>
                Refund order
              </div>
              <p className="text-[11px] mb-2" style={{ color: "var(--color-ink-dim)" }}>
                Refund ${money(remaining)} to parent? This will return money to the
                parent&apos;s card and cannot be undone from this order. To charge again,
                the parent will need to place a new order.
              </p>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={remaining}
                placeholder="Amount (AUD)"
                className="w-full h-8 px-2 text-[12.5px] rounded border mb-2"
                style={{ borderColor: "var(--color-rule)" }}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
              />
              <input
                type="text"
                placeholder="Reason (optional)"
                className="w-full h-8 px-2 text-[12.5px] rounded border mb-2"
                style={{ borderColor: "var(--color-rule)" }}
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowRefund(false)}
                  className="flex-1 h-8 rounded border text-[12px] font-semibold"
                  style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRefund}
                  disabled={pending}
                  className="flex-1 h-8 rounded text-[12px] font-semibold text-white disabled:opacity-60"
                  style={{ background: "#B23A2A" }}
                >
                  {pending ? "Processing…" : "Confirm"}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {showIssue && (
        <ReportIssueSheet
          order={{ id: orderId, fulfilmentStatus }}
          tenantId={tenantId}
          onClose={() => setShowIssue(false)}
        />
      )}
      {showReopen && (
        <ReopenDialog
          orderId={orderId}
          tenantId={tenantId}
          onClose={() => setShowReopen(false)}
          onDone={() => router.refresh()}
        />
      )}
    </>
  );
}

function ReopenDialog({
  orderId,
  tenantId,
  onClose,
  onDone,
}: {
  orderId: string;
  tenantId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-paper rounded-lg border border-rule p-4 max-w-md w-full flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-serif text-lg">Reopen order {orderId}?</h2>
        <p className="text-sm text-foreground/80">
          This will move the order back to &quot;To prepare&quot;. The parent will{" "}
          <strong>not</strong> be automatically notified.
        </p>
        <textarea
          className="w-full border border-rule rounded p-2 text-sm"
          rows={3}
          placeholder="Reason (required)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        {error && <p className="text-xs text-red-700">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="text-sm px-3 py-1.5 rounded border border-rule"
            disabled={pending}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              const trimmed = reason.trim();
              if (!trimmed) return;
              setError(null);
              start(async () => {
                try {
                  await reopenOrder(tenantId, orderId, trimmed);
                  onDone();
                  onClose();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Failed to reopen");
                }
              });
            }}
            disabled={!reason.trim() || pending}
            className="text-sm px-3 py-1.5 rounded bg-navy-deep text-white disabled:opacity-50"
          >
            {pending ? "Reopening…" : "Reopen"}
          </button>
        </div>
      </div>
    </div>
  );
}
