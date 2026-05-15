"use client";

import { useState, useTransition } from "react";
import type { BoardOrder } from "@/db/queries";
import { reportIssue } from "./actions";

export function ReportIssueSheet({
  order,
  tenantId,
  onClose,
}: {
  order: Pick<BoardOrder, "id" | "fulfilmentStatus">;
  tenantId: string;
  onClose: () => void;
}) {
  const wasReady = order.fulfilmentStatus === "ready";
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(wasReady);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const trimmed = reason.trim();
    if (!trimmed) return;
    setError(null);
    start(async () => {
      try {
        await reportIssue(tenantId, order.id, trimmed, { notifyParent: notify });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to report issue");
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Report issue for order ${order.id}`}
        className="bg-paper w-full sm:max-w-md sm:rounded-lg rounded-t-lg border border-rule p-4 flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-serif text-lg">Report issue — {order.id}</h2>
        <label className="text-sm flex flex-col gap-1">
          What&apos;s the issue?
          <textarea
            className="w-full border border-rule rounded p-2 text-sm"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
          />
        </label>
        <label className="text-sm flex items-center gap-2">
          <input
            type="checkbox"
            checked={notify}
            disabled={wasReady}
            onChange={(e) => setNotify(e.target.checked)}
          />
          Notify parent now
          {wasReady && (
            <span className="text-xs text-foreground/70 ml-1">
              (required — they already received the ready email)
            </span>
          )}
        </label>
        {error && <p className="text-xs text-red-700">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-3 py-1.5 rounded border border-rule"
            disabled={pending}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !reason.trim()}
            className="text-sm px-3 py-1.5 rounded bg-navy-deep text-white disabled:opacity-50"
          >
            {pending ? "Saving…" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
