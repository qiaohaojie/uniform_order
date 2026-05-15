"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { exportOrdersCsv } from "@/app/admin/[tenant]/orders/actions";
import {
  EXPORT_STATUS_OPTIONS,
  type ExportStatusFilter,
} from "@/app/admin/[tenant]/orders/csv";

const STATUS_LABELS: Record<ExportStatusFilter, string> = {
  all: "All statuses",
  to_prepare: "To prepare",
  ready: "Ready",
  needs_attention: "Needs attention",
  completed: "Completed",
};

export function ExportOrdersButton({
  tenantId,
  tenantShort,
  accent,
}: {
  tenantId: string;
  tenantShort: string;
  accent: string;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ExportStatusFilter>("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const selectRef = useRef<HTMLSelectElement | null>(null);
  const popoverId = useId();

  // Close popover, return focus to trigger.
  const close = useCallback(() => {
    setOpen(false);
    setError(null);
    setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);

  // Click-outside + Escape handling.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      close();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    selectRef.current?.focus();

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  const handleDownload = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const { csv, filename, rowCount } = await exportOrdersCsv(tenantId, status);

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      void rowCount;
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }, [tenantId, status, close]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={popoverId}
        className="h-9 px-3.5 text-[12.5px] font-semibold rounded-md border flex items-center gap-1.5"
        style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M21 15 V19 a2 2 0 0 1 -2 2 H5 a2 2 0 0 1 -2 -2 V15" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Export CSV
      </button>

      {open && (
        <div
          ref={popoverRef}
          id={popoverId}
          role="dialog"
          aria-label="Export orders as CSV"
          className="absolute right-0 top-[calc(100%+6px)] z-30 w-[300px] rounded-md border bg-white p-3.5 shadow-lg"
          style={{ borderColor: "var(--color-rule)" }}
        >
          <label
            htmlFor={`${popoverId}-status`}
            className="block text-[11px] font-semibold uppercase tracking-[0.4px] mb-1.5"
            style={{ color: "var(--color-ink-dim)" }}
          >
            Status
          </label>
          <select
            ref={selectRef}
            id={`${popoverId}-status`}
            value={status}
            onChange={(e) => setStatus(e.target.value as ExportStatusFilter)}
            disabled={busy}
            className="w-full h-9 px-2.5 text-[13px] rounded-md border bg-white"
            style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
          >
            {EXPORT_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>

          <p
            className="mt-2.5 text-[11.5px] leading-snug"
            style={{ color: "var(--color-ink-dim)" }}
          >
            {status === "all" ? (
              <>
                Exports{" "}
                <strong style={{ color: "var(--color-ink)" }}>every</strong>{" "}
                order for {tenantShort}, regardless of your current search.
              </>
            ) : (
              <>
                Exports all{" "}
                <strong style={{ color: "var(--color-ink)" }}>
                  {STATUS_LABELS[status].toLowerCase()}
                </strong>{" "}
                orders for {tenantShort}, regardless of your current search.
              </>
            )}
          </p>

          {error && (
            <p
              role="alert"
              className="mt-2.5 text-[11.5px] leading-snug"
              style={{ color: "#B91C1C" }}
            >
              {error}
            </p>
          )}

          <div className="mt-3.5 flex justify-end gap-2">
            <button
              type="button"
              onClick={close}
              disabled={busy}
              className="h-8 px-3 text-[12px] font-semibold rounded-md border"
              style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={busy}
              className="h-8 px-3 text-[12px] font-semibold rounded-md text-white disabled:opacity-60"
              style={{ background: accent }}
            >
              {busy ? "Preparing…" : "Download"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
