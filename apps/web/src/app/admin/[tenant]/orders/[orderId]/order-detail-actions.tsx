"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type OrderStatus = "pending_payment" | "new" | "packing" | "ready" | "collected" | "partially_refunded" | "refunded";

const nextStatus: Record<OrderStatus, OrderStatus | null> = {
  pending_payment: null,
  new: "packing",
  packing: "ready",
  ready: "collected",
  collected: null,
  partially_refunded: null,
  refunded: null,
};
const nextLabel: Record<OrderStatus, string> = {
  pending_payment: "",
  new: "Start packing",
  packing: "Mark ready",
  ready: "Mark collected",
  collected: "",
  partially_refunded: "",
  refunded: "",
};

function money(n: number) {
  return n.toFixed(2);
}

export function OrderDetailActions({
  orderId,
  tenantId,
  currentStatus,
  accent,
  parentEmail,
  parentName,
  studentName,
  total,
  refunded,
}: {
  orderId: string;
  tenantId: string;
  currentStatus: OrderStatus;
  accent: string;
  parentEmail: string;
  parentName: string;
  studentName: string;
  total: number;
  refunded: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showRefund, setShowRefund] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const next = nextStatus[currentStatus];
  const refundable = currentStatus !== "pending_payment" && currentStatus !== "refunded";
  const remaining = Math.max(0, total - refunded);

  const handleAdvance = async () => {
    if (!next) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next, tenantId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to advance status.");
      }
      router.refresh();
    } catch (err) {
      console.error("Failed to advance status:", err);
      setError(err instanceof Error ? err.message : "Failed to advance status.");
    } finally {
      setLoading(false);
    }
  };

  const handleNotify = () => {
    const subject = encodeURIComponent(`Your uniform order ${orderId} is ready`);
    const body = encodeURIComponent(
      `Hi ${parentName},\n\nYour uniform order ${orderId} for ${studentName} is ready for collection.\n\nPlease collect during shop hours.\n\nThank you.`
    );
    window.open(`mailto:${parentEmail}?subject=${subject}&body=${body}`);
  };

  const handleRefund = async () => {
    const amount = parseFloat(refundAmount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > remaining + 0.01) {
      setError("Invalid refund amount.");
      return;
    }
    setLoading(true);
    setError("");
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {error && (
        <span className="text-[12px] font-semibold" style={{ color: "#B23A2A" }}>
          {error}
        </span>
      )}
      {currentStatus === "ready" && (
        <button
          onClick={handleNotify}
          className="h-9 px-3.5 text-[12.5px] font-semibold rounded-md border flex items-center gap-1.5"
          style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <rect x="3" y="5" width="18" height="14" rx="1" /><path d="M3 7 L12 13 L21 7" />
          </svg>
          Notify parent
        </button>
      )}
      {refundable && (
        <>
          <button
            onClick={() => setShowRefund((s) => !s)}
            className="h-9 px-3.5 text-[12.5px] font-semibold rounded-md border flex items-center gap-1.5"
            style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            Refund
          </button>
          {showRefund && (
            <div
              className="absolute right-0 top-[42px] z-20 bg-white rounded-lg border shadow-lg p-4 w-[280px]"
              style={{ borderColor: "var(--color-rule)" }}
            >
              <div className="text-[12px] font-semibold mb-2" style={{ color: "var(--color-ink)" }}>
                Refund order
              </div>
              <div className="text-[11px] mb-2" style={{ color: "var(--color-ink-dim)" }}>
                Remaining: ${money(remaining)}
              </div>
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
                  disabled={loading}
                  className="flex-1 h-8 rounded text-[12px] font-semibold text-white disabled:opacity-60"
                  style={{ background: "#B23A2A" }}
                >
                  {loading ? "Processing…" : "Confirm"}
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {next && (
        <button
          onClick={handleAdvance}
          disabled={loading}
          className="h-9 px-3.5 text-[12.5px] font-semibold rounded-md text-white flex items-center gap-1.5 disabled:opacity-60"
          style={{ background: accent }}
        >
          {loading ? "Saving…" : nextLabel[currentStatus]}
        </button>
      )}
    </>
  );
}
