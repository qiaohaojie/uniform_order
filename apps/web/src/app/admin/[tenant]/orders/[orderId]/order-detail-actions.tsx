"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type OrderStatus = "new" | "packing" | "ready" | "collected";

const nextStatus: Record<OrderStatus, OrderStatus | null> = {
  new: "packing",
  packing: "ready",
  ready: "collected",
  collected: null,
};
const nextLabel: Record<OrderStatus, string> = {
  new: "Start packing",
  packing: "Mark ready",
  ready: "Mark collected",
  collected: "",
};

export function OrderDetailActions({
  orderId,
  currentStatus,
  accent,
  parentEmail,
  parentName,
  studentName,
}: {
  orderId: string;
  currentStatus: OrderStatus;
  accent: string;
  parentEmail: string;
  parentName: string;
  studentName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const next = nextStatus[currentStatus];

  const handleAdvance = async () => {
    if (!next) return;
    setLoading(true);
    try {
      await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      router.refresh();
    } catch (err) {
      console.error("Failed to advance status:", err);
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

  return (
    <>
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
