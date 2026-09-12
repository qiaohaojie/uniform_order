/**
 * Phase 2 consignment lots — parent form + operator payout marks.
 * School-fee credit is a manual operator mark (no school-finance integration).
 * This module must not import the DB client.
 */

export const CONSIGNMENT_PAYOUT_PREFERENCES = [
  "eft",
  "school_fee_credit",
  "donate_proceeds",
] as const;
export type ConsignmentPayoutPreference =
  (typeof CONSIGNMENT_PAYOUT_PREFERENCES)[number];

export const CONSIGNMENT_UNSOLD_PREFERENCES = ["donate", "collect"] as const;
export type ConsignmentUnsoldPreference =
  (typeof CONSIGNMENT_UNSOLD_PREFERENCES)[number];

export const CONSIGNMENT_LOT_PAYOUT_STATUSES = [
  "pending",
  "school_fee_credited",
  "eft_paid",
  "donated_proceeds",
] as const;
export type ConsignmentLotPayoutStatus =
  (typeof CONSIGNMENT_LOT_PAYOUT_STATUSES)[number];

export const MIN_CONSIGNMENT_ITEMS = 1;
export const MAX_CONSIGNMENT_ITEMS = 30;
export const DEFAULT_COMMISSION_BPS = 5000;
export const MIN_COMMISSION_BPS = 0;
export const MAX_COMMISSION_BPS = 10_000;

/** Common shop commission presets (basis points). */
export const COMMISSION_BPS_PRESETS = [2500, 3000, 4000, 5000] as const;

export type ConsignmentLotItemDraft = {
  garment: string;
  size: string;
};

export type InsertConsignmentLotInput = {
  tenantId: string;
  familyName: string;
  studentName: string;
  email: string;
  mobile: string;
  payoutPreference: ConsignmentPayoutPreference;
  bankBsb?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  unsoldPreference: ConsignmentUnsoldPreference;
  items: ConsignmentLotItemDraft[];
};

export type ConsignmentLotListItem = {
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
  payoutMarkedAt: Date | null;
  createdAt: Date;
};

export function isConsignmentIntakeMode(mode: string): boolean {
  return mode === "donation_and_consignment";
}

export function formatPayoutPreference(
  value: ConsignmentPayoutPreference,
): string {
  if (value === "eft") return "EFT";
  if (value === "school_fee_credit") return "School-fee credit";
  if (value === "donate_proceeds") return "Donate proceeds";
  return value;
}

export function formatUnsoldPreference(
  value: ConsignmentUnsoldPreference,
): string {
  if (value === "donate") return "Donate unsold to charity";
  if (value === "collect") return "Collect within 14 days of expiry";
  return value;
}

export function formatLotPayoutStatus(value: ConsignmentLotPayoutStatus): string {
  if (value === "pending") return "Pending";
  if (value === "school_fee_credited") return "School-fee credited";
  if (value === "eft_paid") return "EFT paid";
  if (value === "donated_proceeds") return "Proceeds donated";
  return value;
}

export function formatCommissionPercent(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`;
}

export function isValidCommissionBps(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= MIN_COMMISSION_BPS &&
    value <= MAX_COMMISSION_BPS
  );
}

/** Compact ticket for bag tags — e.g. CL-A3F9K2. */
export function generateConsignmentTicketCode(now = new Date()): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  const seed =
    now.getTime().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "") +
    Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "");
  for (let i = 0; i < seed.length && suffix.length < 6; i++) {
    const ch = seed[i]!;
    if (alphabet.includes(ch)) suffix += ch;
  }
  while (suffix.length < 6) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)]!;
  }
  return `CL-${suffix.slice(0, 6)}`;
}

export function normalizeBsb(value: string): string {
  return value.replace(/\s|-/g, "");
}

export function isValidBsb(value: string): boolean {
  return /^\d{6}$/.test(normalizeBsb(value));
}

export function payoutStatusForPreference(
  preference: ConsignmentPayoutPreference,
): ConsignmentLotPayoutStatus {
  if (preference === "school_fee_credit") return "school_fee_credited";
  if (preference === "eft") return "eft_paid";
  return "donated_proceeds";
}
