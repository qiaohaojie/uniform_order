"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Spinner } from "@heroui/react";
import {
  formatCommissionPercent,
  formatLotPayoutStatus,
  formatPayoutPreference,
  formatUnsoldPreference,
  payoutStatusForPreference,
  type ConsignmentLotPayoutStatus,
  type ConsignmentLotItemDraft,
  type ConsignmentPayoutPreference,
  type ConsignmentUnsoldPreference,
} from "@/lib/preloved-consignment";
import { formatCsvMoney } from "@/lib/preloved-payout";

export type ConsignmentLotRow = {
  id: string;
  ticketCode: string;
  familyName: string;
  studentName: string;
  email: string;
  mobile: string;
  payoutPreference: ConsignmentPayoutPreference;
  bankBsb: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  unsoldPreference: ConsignmentUnsoldPreference;
  items: ConsignmentLotItemDraft[];
  payoutStatus: ConsignmentLotPayoutStatus;
  payoutMarkedAt: string | null;
  createdAt: string;
  acceptedUnits: {
    id: string;
    skuId: string;
    itemName: string;
    size: string;
    condition: "good" | "fair";
    qty: number;
    soldOrderLineId: string | null;
    createdAt: string;
  }[];
  acceptedQty: number;
  soldLines: {
    id: string;
    consignmentItemId: string;
    orderId: string;
    orderLineId: string;
    itemName: string;
    size: string;
    condition: "good" | "fair";
    qty: number;
    saleUnitPrice: number;
    saleLineTotal: number;
    commissionBps: number;
    commissionAmount: number;
    remittanceAmount: number;
    createdAt: string;
  }[];
  soldQty: number;
  remittanceTotal: number;
  commissionTotal: number;
};

function parseMoneySum(values: number[]): number {
  return values.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
}

function formatReceived(iso: string, timeZone: string) {
  return new Date(iso).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}

export function ConsignmentsClient({
  tenantId,
  timeZone,
}: {
  tenantId: string;
  timeZone: string;
}) {
  const [lots, setLots] = useState<ConsignmentLotRow[] | null>(null);
  const [commissionBps, setCommissionBps] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markError, setMarkError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exportNotice, setExportNotice] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);

  const loadLots = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/tenant/${tenantId}/preloved/consignment-lots`,
      );
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        lots?: ConsignmentLotRow[];
        commissionBps?: number;
      } | null;
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to load consignment lots.");
      }
      setLots(Array.isArray(data?.lots) ? data.lots : []);
      setCommissionBps(
        typeof data?.commissionBps === "number" ? data.commissionBps : null,
      );
    } catch (err) {
      console.error("Consignments load failed:", err);
      setLots(null);
      setError(
        err instanceof Error ? err.message : "Failed to load consignment lots.",
      );
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadLots();
  }, [loadLots]);

  const markPayout = async (lot: ConsignmentLotRow) => {
    setMarkingId(lot.id);
    setMarkError("");
    const payoutStatus = payoutStatusForPreference(lot.payoutPreference);
    try {
      const res = await fetch(
        `/api/tenant/${tenantId}/preloved/consignment-lots/${lot.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payoutStatus }),
        },
      );
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        lot?: ConsignmentLotRow;
      } | null;
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to mark payout.");
      }
      if (data?.lot) {
        setLots((prev) =>
          prev
            ? prev.map((row) => (row.id === data.lot!.id ? data.lot! : row))
            : prev,
        );
      }
    } catch (err) {
      console.error("Mark payout failed:", err);
      setMarkError(
        err instanceof Error ? err.message : "Failed to mark payout.",
      );
    } finally {
      setMarkingId(null);
    }
  };

  const exportPayoutCsv = async () => {
    setExporting(true);
    setExportError("");
    setExportNotice("");
    try {
      const qs = pendingOnly ? "?pending=1" : "";
      const res = await fetch(
        `/api/tenant/${tenantId}/preloved/payout.csv${qs}`,
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Failed to export payout CSV.");
      }
      const csv = await res.text();
      const count = Number(res.headers.get("X-Payout-Row-Count") ?? "0");
      const match = /filename="([^"]+)"/.exec(
        res.headers.get("Content-Disposition") ?? "",
      );
      const filename = match?.[1] ?? `payout-${tenantId}.csv`;
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      if (count === 0) {
        setExportNotice(
          "No sold consignment lines yet. Downloaded a headers-only CSV.",
        );
      }
    } catch (err) {
      console.error("Payout CSV export failed:", err);
      setExportError(
        err instanceof Error ? err.message : "Failed to export payout CSV.",
      );
    } finally {
      setExporting(false);
    }
  };

  const soldLineCount = (lots ?? []).reduce(
    (sum, lot) => sum + (lot.soldQty ?? 0),
    0,
  );
  const remittanceOwing = parseMoneySum(
    (lots ?? [])
      .filter((lot) => lot.payoutStatus === "pending")
      .map((lot) => lot.remittanceTotal ?? 0),
  );

  return (
    <div className="flex-1 overflow-y-auto p-7" data-testid="consignments-panel">
      <p
        className="text-[13px] mb-4 max-w-2xl"
        style={{ color: "var(--color-ink-dim)" }}
      >
        Parent consignment lots. Accept garments on Intake against a ticket.
        When a consigned unit sells, the shop keeps the published commission and
        the remainder is the amount owing. Export the treasurer CSV for EFT,
        school-fee credit, or donated proceeds — marks stay manual.
        {commissionBps != null
          ? ` Shop commission: ${formatCommissionPercent(commissionBps)}.`
          : null}
        {!loading && !error && lots && lots.length > 0
          ? ` ${soldLineCount} sold · $${formatCsvMoney(remittanceOwing)} pending owing.`
          : null}
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label
          className="flex items-center gap-2 text-[13px]"
          style={{ color: "var(--color-ink)" }}
        >
          <input
            type="checkbox"
            checked={pendingOnly}
            onChange={(event) => setPendingOnly(event.target.checked)}
            data-testid="consignments-export-pending"
          />
          Pending payouts only
        </label>
        <Button
          size="sm"
          onPress={() => void exportPayoutCsv()}
          isPending={exporting}
          isDisabled={exporting || loading}
          data-testid="consignments-export-csv"
        >
          Export payout CSV
        </Button>
      </div>

      {markError ? (
        <div className="mb-4 max-w-xl" data-testid="consignments-mark-error">
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Could not mark payout</Alert.Title>
              <Alert.Description>{markError}</Alert.Description>
            </Alert.Content>
          </Alert>
        </div>
      ) : null}

      {exportError ? (
        <div className="mb-4 max-w-xl" data-testid="consignments-export-error">
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Could not export payout CSV</Alert.Title>
              <Alert.Description>{exportError}</Alert.Description>
            </Alert.Content>
          </Alert>
        </div>
      ) : null}

      {exportNotice ? (
        <p
          className="mb-4 max-w-xl text-[13px]"
          style={{ color: "var(--color-ink-dim)" }}
          data-testid="consignments-export-empty"
        >
          {exportNotice}
        </p>
      ) : null}

      {loading ? <LotsLoading /> : null}

      {!loading && error ? (
        <LotsError message={error} onRetry={() => void loadLots()} />
      ) : null}

      {!loading && !error && lots && lots.length === 0 ? <LotsEmpty /> : null}

      {!loading && !error && lots && lots.length > 0 ? (
        <LotsList
          lots={lots}
          timeZone={timeZone}
          markingId={markingId}
          onMark={(lot) => void markPayout(lot)}
        />
      ) : null}
    </div>
  );
}

function LotsLoading() {
  return (
    <div
      className="flex flex-col items-center justify-center text-center py-16 px-6"
      data-testid="consignments-loading"
      role="status"
      aria-live="polite"
    >
      <Spinner size="lg" color="current" className="mb-4 text-[var(--color-gold)]" />
      <p className="text-[13.5px]" style={{ color: "var(--color-ink-dim)" }}>
        Loading consignment lots…
      </p>
    </div>
  );
}

function LotsError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="max-w-xl" data-testid="consignments-error">
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Could not load consignments</Alert.Title>
          <Alert.Description>{message}</Alert.Description>
        </Alert.Content>
        <Button
          size="sm"
          variant="danger"
          onPress={onRetry}
          data-testid="consignments-retry"
        >
          Try again
        </Button>
      </Alert>
    </div>
  );
}

function LotsEmpty() {
  return (
    <div
      className="flex flex-col items-center justify-center text-center py-16 px-6"
      data-testid="consignments-empty"
    >
      <h2
        className="font-serif text-[22px] font-medium leading-[1.2] mb-2"
        style={{ color: "var(--color-ink)" }}
      >
        No consignment lots yet
      </h2>
      <p
        className="text-[13.5px] leading-[1.5] max-w-md"
        style={{ color: "var(--color-ink-dim)" }}
      >
        When a parent submits the consign form, the lot and ticket code appear
        here. Accept garments on Intake against that ticket after inspection.
      </p>
    </div>
  );
}

function LotsList({
  lots,
  timeZone,
  markingId,
  onMark,
}: {
  lots: ConsignmentLotRow[];
  timeZone: string;
  markingId: string | null;
  onMark: (lot: ConsignmentLotRow) => void;
}) {
  return (
    <div className="space-y-4" data-testid="consignments-list">
      {lots.map((lot) => {
        const markLabel =
          lot.payoutPreference === "school_fee_credit"
            ? "Mark school-fee credited"
            : lot.payoutPreference === "eft"
              ? "Mark EFT paid"
              : "Mark proceeds donated";
        return (
          <article
            key={lot.id}
            className="bg-white rounded-[10px] border p-4"
            style={{ borderColor: "var(--color-rule)" }}
            data-testid="consignments-row"
            data-lot-id={lot.id}
            data-ticket={lot.ticketCode}
            data-payout-status={lot.payoutStatus}
            data-accepted-qty={String(lot.acceptedQty ?? 0)}
            data-sold-qty={String(lot.soldQty ?? 0)}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div
                  className="font-semibold text-[14px] tnum"
                  style={{ color: "var(--color-ink)" }}
                  data-testid="consignments-ticket"
                >
                  {lot.ticketCode}
                </div>
                <div className="text-[12.5px]" style={{ color: "var(--color-ink-dim)" }}>
                  {formatReceived(lot.createdAt, timeZone)}
                </div>
              </div>
              <div
                className="text-[12px] font-semibold uppercase tracking-wide"
                style={{ color: "var(--color-ink-dim)" }}
                data-testid="consignments-status"
              >
                {formatLotPayoutStatus(lot.payoutStatus)}
              </div>
            </div>

            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
              <dt style={{ color: "var(--color-ink-dim)" }}>Family</dt>
              <dd style={{ color: "var(--color-ink)" }}>
                {lot.familyName} / {lot.studentName}
              </dd>
              <dt style={{ color: "var(--color-ink-dim)" }}>Contact</dt>
              <dd style={{ color: "var(--color-ink)" }}>
                {lot.email} · {lot.mobile}
              </dd>
              <dt style={{ color: "var(--color-ink-dim)" }}>Payout</dt>
              <dd style={{ color: "var(--color-ink)" }}>
                {formatPayoutPreference(lot.payoutPreference)}
              </dd>
              <dt style={{ color: "var(--color-ink-dim)" }}>Unsold</dt>
              <dd style={{ color: "var(--color-ink)" }}>
                {formatUnsoldPreference(lot.unsoldPreference)}
              </dd>
              {lot.payoutPreference === "eft" ? (
                <>
                  <dt style={{ color: "var(--color-ink-dim)" }}>Bank</dt>
                  <dd className="tnum" style={{ color: "var(--color-ink)" }}>
                    {lot.bankAccountName} · BSB {lot.bankBsb} · {lot.bankAccountNumber}
                  </dd>
                </>
              ) : null}
              <dt style={{ color: "var(--color-ink-dim)" }}>Declared</dt>
              <dd style={{ color: "var(--color-ink)" }}>
                {lot.items
                  .map((item) => `${item.garment} (${item.size})`)
                  .join(", ")}
              </dd>
              <dt style={{ color: "var(--color-ink-dim)" }}>On rack</dt>
              <dd
                style={{ color: "var(--color-ink)" }}
                data-testid="consignments-accepted"
              >
                {(lot.acceptedUnits ?? []).length === 0 ? (
                  <span data-testid="consignments-accepted-empty">
                    None accepted yet. Link this ticket on Intake.
                  </span>
                ) : (
                  <ul className="space-y-0.5">
                    {(lot.acceptedUnits ?? []).map((unit) => (
                      <li
                        key={unit.id}
                        data-testid="consignments-accepted-row"
                        data-sku-id={unit.skuId}
                      >
                        {unit.itemName} · {unit.size} · {unit.condition} · qty{" "}
                        {unit.qty}
                        {unit.soldOrderLineId ? " · sold" : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </dd>
              <dt style={{ color: "var(--color-ink-dim)" }}>Sold</dt>
              <dd
                style={{ color: "var(--color-ink)" }}
                data-testid="consignments-sold"
              >
                {(lot.soldLines ?? []).length === 0 ? (
                  <span data-testid="consignments-sold-empty">
                    No sold units yet. Amount owing appears after a paid sale.
                  </span>
                ) : (
                  <ul className="space-y-0.5">
                    {(lot.soldLines ?? []).map((line) => (
                      <li
                        key={line.id}
                        data-testid="consignments-sold-row"
                        data-order-id={line.orderId}
                      >
                        {line.itemName} · {line.size} · {line.condition} · sale $
                        {formatCsvMoney(line.saleLineTotal)} · shop $
                        {formatCsvMoney(line.commissionAmount)} (
                        {formatCommissionPercent(line.commissionBps)}) · owing $
                        {formatCsvMoney(line.remittanceAmount)} · {line.orderId}
                      </li>
                    ))}
                  </ul>
                )}
              </dd>
              <dt style={{ color: "var(--color-ink-dim)" }}>Owing</dt>
              <dd
                className="tnum"
                style={{ color: "var(--color-ink)" }}
                data-testid="consignments-owing"
              >
                ${formatCsvMoney(lot.remittanceTotal ?? 0)}
                {(lot.commissionTotal ?? 0) > 0
                  ? ` after $${formatCsvMoney(lot.commissionTotal)} shop cut`
                  : ""}
              </dd>
            </dl>

            {lot.payoutStatus === "pending" ? (
              <div className="mt-3">
                <Button
                  size="sm"
                  onPress={() => onMark(lot)}
                  isPending={markingId === lot.id}
                  isDisabled={markingId === lot.id}
                  data-testid="consignments-mark-payout"
                >
                  {markLabel}
                </Button>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
