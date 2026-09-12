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
};

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

  return (
    <div className="flex-1 overflow-y-auto p-7" data-testid="consignments-panel">
      <p
        className="text-[13px] mb-4 max-w-2xl"
        style={{ color: "var(--color-ink-dim)" }}
      >
        Parent consignment lots. Bank details are operator-only. Mark school-fee
        credit, EFT, or donated proceeds by hand — there is no school-finance
        integration.
        {commissionBps != null
          ? ` Shop commission: ${formatCommissionPercent(commissionBps)}.`
          : null}
      </p>

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
        here. Accept garments on Intake after inspection.
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
              <dt style={{ color: "var(--color-ink-dim)" }}>Items</dt>
              <dd style={{ color: "var(--color-ink)" }}>
                {lot.items
                  .map((item) => `${item.garment} (${item.size})`)
                  .join(", ")}
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
