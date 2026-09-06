"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Tenant } from "@/lib/data";
import { formatPrelovedCondition, type PrelovedCondition } from "@/lib/preloved";

export type WriteOffListItem = {
  id: string;
  sourceItemId: string;
  itemName: string;
  size: string;
  condition: PrelovedCondition;
  price: number;
  qtyOnHand: number;
  listedAt: string;
  expiresAt: string | null;
  defectNote: string | null;
};

const COLUMNS = ["Item", "Size", "Condition", "Qty", "Listed", "Expired", "Action"] as const;

function formatDate(iso: string, timeZone: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  });
}

export function WriteOffsClient({
  tenantId,
  tenant,
  holdDays,
  initialSkus,
}: {
  tenantId: string;
  tenant: Tenant;
  holdDays: number;
  initialSkus: WriteOffListItem[];
}) {
  const router = useRouter();
  const [skus, setSkus] = useState(initialSkus);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const handleWriteOff = async (sku: WriteOffListItem) => {
    const confirmed = window.confirm(
      `Write off ${sku.itemName} size ${sku.size} (${sku.qtyOnHand} on hand) to charity?\n\nQuantity will be set to 0. Donations have no parent payout.`,
    );
    if (!confirmed) return;

    setPendingId(sku.id);
    setError("");
    setNotice("");
    try {
      const res = await fetch(
        `/api/tenant/${tenantId}/preloved/skus/${sku.id}/write-off`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        qtyWrittenOff?: number;
      } | null;
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to write off SKU.");
      }
      const qty = data?.qtyWrittenOff ?? sku.qtyOnHand;
      setSkus((prev) => prev.filter((row) => row.id !== sku.id));
      setNotice(`Wrote off ${qty} to charity. No parent payout.`);
      router.refresh();
    } catch (err) {
      console.error("Write-off failed:", err);
      setError(err instanceof Error ? err.message : "Failed to write off SKU.");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-7">
      <p className="text-[13px] mb-4 max-w-2xl" style={{ color: "var(--color-ink-dim)" }}>
        Pooled donations past {holdDays} days from listing. Write off to charity
        sets quantity to 0. There is no parent payout, EFT, or commission on
        donations.
      </p>

      {error && (
        <div
          className="mb-3 text-[12.5px] px-3 py-2 rounded"
          style={{ background: "#FEF2F2", color: "#B91C1C" }}
        >
          {error}
        </div>
      )}
      {notice && (
        <div
          className="mb-3 text-[12.5px] px-3 py-2 rounded"
          style={{ background: "#E5F0E7", color: "var(--color-success)" }}
        >
          {notice}
        </div>
      )}

      {skus.length === 0 ? (
        <EmptyWriteOffState holdDays={holdDays} />
      ) : (
        <div
          className="bg-white rounded-[10px] border overflow-hidden"
          style={{ borderColor: "var(--color-rule)" }}
        >
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr
                className="text-[10.5px] uppercase tracking-[0.6px]"
                style={{ color: "var(--color-ink-dim)" }}
              >
                {COLUMNS.map((label) => (
                  <th
                    key={label}
                    className={`py-2.5 px-4 font-bold border-b ${
                      label === "Qty" || label === "Action" ? "text-right" : "text-left"
                    }`}
                    style={{ borderColor: "var(--color-rule)" }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {skus.map((sku, i) => (
                <tr
                  key={sku.id}
                  className="border-b"
                  style={{ borderColor: i === skus.length - 1 ? "transparent" : "var(--color-rule)" }}
                >
                  <td className="py-3 px-4 font-medium" style={{ color: "var(--color-ink)" }}>
                    <div>{sku.itemName}</div>
                    {sku.defectNote ? (
                      <div className="text-[11.5px] font-normal mt-0.5" style={{ color: "var(--color-ink-dim)" }}>
                        {sku.defectNote}
                      </div>
                    ) : null}
                  </td>
                  <td className="py-3 px-4" style={{ color: "var(--color-ink)" }}>
                    {sku.size}
                  </td>
                  <td className="py-3 px-4" style={{ color: "var(--color-ink)" }}>
                    {formatPrelovedCondition(sku.condition)}
                  </td>
                  <td className="py-3 px-4 text-right tnum" style={{ color: "var(--color-ink)" }}>
                    {sku.qtyOnHand}
                  </td>
                  <td className="py-3 px-4 tnum" style={{ color: "var(--color-ink-dim)" }}>
                    {formatDate(sku.listedAt, tenant.timezone)}
                  </td>
                  <td className="py-3 px-4 tnum" style={{ color: "var(--color-alert)" }}>
                    {sku.expiresAt ? formatDate(sku.expiresAt, tenant.timezone) : "—"}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleWriteOff(sku)}
                      disabled={pendingId === sku.id}
                      className="h-9 px-3.5 text-[12.5px] font-semibold rounded-md text-white disabled:opacity-60"
                      style={{ background: tenant.accent }}
                    >
                      {pendingId === sku.id ? "Writing off…" : "Write off to charity"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EmptyWriteOffState({ holdDays }: { holdDays: number }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
        style={{ background: "var(--color-parchment)", color: "var(--color-gold)" }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M8 9 H16" />
          <path d="M8 13 H14" />
        </svg>
      </div>
      <h2 className="font-serif text-[22px] font-medium leading-[1.2] mb-2" style={{ color: "var(--color-ink)" }}>
        No preloved stock is past the hold period
      </h2>
      <p className="text-[13.5px] leading-[1.5] max-w-md" style={{ color: "var(--color-ink-dim)" }}>
        SKUs with quantity on hand appear here {holdDays} days after listing.
        Write off to charity sets quantity to 0. Donations have no parent payout.
      </p>
    </div>
  );
}
