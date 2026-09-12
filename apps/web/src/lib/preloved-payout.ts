/**
 * Phase 2 consignment remittance — commission split + treasurer CSV.
 * Snapshot commissionBps at sale time; do not recompute from live settings.
 * This module must not import the DB client.
 */
import {
  DEFAULT_COMMISSION_BPS,
  formatPayoutPreference,
  isValidCommissionBps,
  type ConsignmentLotPayoutStatus,
  type ConsignmentPayoutPreference,
} from "./preloved-consignment";

export const PAYOUT_CSV_HEADERS = [
  "Sold at",
  "Ticket",
  "Family",
  "Student",
  "Email",
  "Mobile",
  "Payout preference",
  "Payout status",
  "BSB",
  "Account name",
  "Account number",
  "Item",
  "Size",
  "Condition",
  "Order",
  "Sale price",
  "Commission bps",
  "Commission %",
  "Shop commission",
  "Amount owing",
] as const;

export type PayoutCsvRow = {
  soldAt: Date;
  ticketCode: string;
  familyName: string;
  studentName: string;
  email: string;
  mobile: string;
  payoutPreference: ConsignmentPayoutPreference;
  payoutStatus: ConsignmentLotPayoutStatus;
  bankBsb: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  itemName: string;
  size: string;
  condition: "good" | "fair";
  orderId: string;
  salePrice: number;
  commissionBps: number;
  commissionAmount: number;
  remittanceAmount: number;
};

export type SaleCommissionSplit = {
  saleCents: number;
  commissionCents: number;
  remittanceCents: number;
  saleAud: number;
  commissionAud: number;
  remittanceAud: number;
};

export function parseMoney2(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(n * 100) / 100;
}

/**
 * Shop keeps commissionBps / 10_000 of the sale; parent remittance is the rest.
 * Integer cents so 50% of $19.95 is $9.98 / $9.97, never a display-only cut.
 */
export function splitSaleCommission(
  saleAud: number,
  commissionBps: number = DEFAULT_COMMISSION_BPS,
): SaleCommissionSplit {
  if (!isValidCommissionBps(commissionBps)) {
    throw new RangeError("commissionBps must be an integer between 0 and 10000");
  }
  if (!Number.isFinite(saleAud) || saleAud < 0) {
    throw new RangeError("saleAud must be a finite amount of 0 or more");
  }
  const saleCents = Math.round(saleAud * 100);
  const commissionCents = Math.round((saleCents * commissionBps) / 10_000);
  const remittanceCents = saleCents - commissionCents;
  return {
    saleCents,
    commissionCents,
    remittanceCents,
    saleAud: saleCents / 100,
    commissionAud: commissionCents / 100,
    remittanceAud: remittanceCents / 100,
  };
}

export function csvCell(value: string | number | null | undefined): string {
  const raw = value == null ? "" : String(value);
  if (/[",\n\r]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

export function formatCsvMoney(value: number): string {
  return parseMoney2(value).toFixed(2);
}

export function formatCommissionBpsPercent(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`;
}

export function formatPayoutCsvIso(value: Date): string {
  return value.toISOString();
}

export function buildPayoutCsv(rows: readonly PayoutCsvRow[]): string {
  const lines = [
    PAYOUT_CSV_HEADERS.join(","),
    ...rows.map((row) =>
      [
        csvCell(formatPayoutCsvIso(row.soldAt)),
        csvCell(row.ticketCode),
        csvCell(row.familyName),
        csvCell(row.studentName),
        csvCell(row.email),
        csvCell(row.mobile),
        csvCell(formatPayoutPreference(row.payoutPreference)),
        csvCell(row.payoutStatus),
        csvCell(row.bankBsb),
        csvCell(row.bankAccountName),
        csvCell(row.bankAccountNumber),
        csvCell(row.itemName),
        csvCell(row.size),
        csvCell(row.condition),
        csvCell(row.orderId),
        csvCell(formatCsvMoney(row.salePrice)),
        csvCell(row.commissionBps),
        csvCell(formatCommissionBpsPercent(row.commissionBps)),
        csvCell(formatCsvMoney(row.commissionAmount)),
        csvCell(formatCsvMoney(row.remittanceAmount)),
      ].join(","),
    ),
  ];
  return `${lines.join("\n")}\n`;
}

export function payoutCsvFilename(tenantId: string, now = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  return `payout-${tenantId}-${day}.csv`;
}
