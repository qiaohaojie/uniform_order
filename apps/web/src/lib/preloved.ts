/**
 * Preloved domain types and in-code defaults.
 * Phase 2 exposes intake mode + commission; donation-only remains the default.
 * This module must not import the DB client.
 */
import { round2 } from "./order-totals";
import {
  DEFAULT_COMMISSION_BPS,
  isValidCommissionBps,
} from "./preloved-consignment";

export const PRELOVED_INTAKE_MODES = [
  "donation_only",
  "donation_and_consignment",
] as const;
export type PrelovedIntakeMode = (typeof PRELOVED_INTAKE_MODES)[number];
/** @deprecated Prefer PRELOVED_INTAKE_MODES[0]; kept for donation-default call sites. */
export const PRELOVED_INTAKE_MODE = "donation_only" as const;

export const PRELOVED_CONDITIONS = ["good", "fair"] as const;
export type PrelovedCondition = (typeof PRELOVED_CONDITIONS)[number];

export function formatPrelovedCondition(condition: PrelovedCondition): string {
  if (condition === "good") return "Good";
  if (condition === "fair") return "Fair";
  return condition;
}

export const PRELOVED_INTAKE_KINDS = ["accepted", "rejected", "written_off"] as const;
export type PrelovedIntakeKind = (typeof PRELOVED_INTAKE_KINDS)[number];

export const PRELOVED_INTAKE_SOURCES = ["donation", "consignment"] as const;
export type PrelovedIntakeSource = (typeof PRELOVED_INTAKE_SOURCES)[number];
/** @deprecated Prefer PRELOVED_INTAKE_SOURCES[0]; donation remains the default source. */
export const PRELOVED_INTAKE_SOURCE = "donation" as const;

export const DEFAULT_REFUSE_LIST = ["socks", "swimwear", "hats"] as const;

export const DEFAULT_PRICE_FRACTION_OF_NEW = 0.5;
export const MIN_PRICE_FRACTION_OF_NEW = 0.01;
export const MAX_PRICE_FRACTION_OF_NEW = 2;
export const DEFAULT_HOLD_DAYS = 365;

export type PrelovedSettings = {
  tenantId: string;
  prelovedEnabled: boolean;
  intakeMode: PrelovedIntakeMode;
  priceFractionOfNew: number;
  holdDays: number;
  donatedGstFree: boolean;
  refuseList: string[];
  commissionBps: number;
};

/** Operator-writable settings including Phase 2 intake mode + commission. */
export type PrelovedSettingsPatch = {
  prelovedEnabled?: boolean;
  intakeMode?: PrelovedIntakeMode;
  priceFractionOfNew?: number;
  holdDays?: number;
  donatedGstFree?: boolean;
  refuseList?: string[];
  commissionBps?: number;
};

export type AcceptAndPoolInput = {
  tenantId: string;
  sourceItemId: string;
  size: string;
  condition: PrelovedCondition;
  price?: number;
  defectNote?: string | null;
  actorId?: string | null;
  /** When set, accept is attributed to this tenant consignment lot. */
  consignmentLotId?: string | null;
};

export type RejectPrelovedIntakeInput = {
  tenantId: string;
  actorId?: string | null;
  sourceItemId?: string | null;
  size?: string | null;
  condition?: PrelovedCondition | null;
  rejectReason: string;
};

export type WriteOffPrelovedSkuInput = {
  tenantId: string;
  skuId: string;
  actorId?: string | null;
};

export type PrelovedStockListItem = {
  id: string;
  sourceItemId: string;
  itemName: string;
  size: string;
  condition: PrelovedCondition;
  price: number;
  qtyOnHand: number;
  listedAt: Date;
  expiresAt: Date | null;
  defectNote: string | null;
  /** Distinct consignment tickets that contributed units to this pooled SKU. */
  lotTickets: string[];
};

/** Parent-shop DTO for an in-stock preloved SKU. imageUrl is the SKU photo or null. */
export type ShopPrelovedSku = {
  id: string;
  sourceItemId: string;
  itemName: string;
  category: string;
  size: string;
  condition: PrelovedCondition;
  price: number;
  qtyOnHand: number;
  defectNote: string | null;
  imageUrl: string | null;
};

export const PRELOVED_VARIANT_LABEL = "Preloved";

export function prelovedSkuPath(tenantId: string, skuId: string): string {
  return `/${tenantId}/preloved/${skuId}`;
}

export type InsertPrelovedIntakeEventInput = {
  tenantId: string;
  actorId?: string | null;
  kind: PrelovedIntakeKind;
  qty: number;
  rejectReason?: string | null;
  prelovedSkuId?: string | null;
  sourceItemId?: string | null;
  size?: string | null;
  condition?: PrelovedCondition | null;
};

export function defaultPrelovedSettings(tenantId: string): PrelovedSettings {
  return {
    tenantId,
    prelovedEnabled: false,
    intakeMode: PRELOVED_INTAKE_MODE,
    priceFractionOfNew: DEFAULT_PRICE_FRACTION_OF_NEW,
    holdDays: DEFAULT_HOLD_DAYS,
    donatedGstFree: false,
    refuseList: [...DEFAULT_REFUSE_LIST],
    commissionBps: DEFAULT_COMMISSION_BPS,
  };
}

export function parseIntakeMode(value: unknown): PrelovedIntakeMode {
  if (value === "donation_and_consignment" || value === "donation_only") {
    return value;
  }
  return PRELOVED_INTAKE_MODE;
}

export function parseCommissionBps(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value ?? NaN);
  if (!isValidCommissionBps(parsed)) return DEFAULT_COMMISSION_BPS;
  return parsed;
}

export function parsePriceFraction(value: string | number | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value ?? NaN);
  if (!Number.isFinite(parsed)) return DEFAULT_PRICE_FRACTION_OF_NEW;
  return parsed;
}

/** Round to numeric(4,2) using the same toFixed(2) path as persistence. */
export function roundPriceFractionOfNew(value: number): number {
  return Number(value.toFixed(2));
}

/**
 * True when the value, rounded to 2 decimal places, is persistable as
 * numeric(4,2) without collapsing to 0.00 (or overflowing the max).
 */
export function isPersistablePriceFractionOfNew(value: number): boolean {
  if (!Number.isFinite(value)) return false;
  const rounded = roundPriceFractionOfNew(value);
  return rounded >= MIN_PRICE_FRACTION_OF_NEW && rounded <= MAX_PRICE_FRACTION_OF_NEW;
}

export function parseRefuseList(value: unknown): string[] {
  if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) {
    return [...value];
  }
  return [...DEFAULT_REFUSE_LIST];
}

export class PrelovedCatalogMatchError extends Error {
  readonly code = "catalog_mismatch";

  constructor(message = "No active catalog item with that size for this tenant.") {
    super(message);
    this.name = "PrelovedCatalogMatchError";
  }
}

export class PrelovedConsignmentNotEnabledError extends Error {
  readonly code = "consignment_not_enabled";

  constructor(
    message = "Turn on donation + consignment in Settings before linking a lot.",
  ) {
    super(message);
    this.name = "PrelovedConsignmentNotEnabledError";
  }
}

export class PrelovedConsignmentLotNotFoundError extends Error {
  readonly code = "consignment_lot_not_found";

  constructor(message = "That consignment lot was not found for this school.") {
    super(message);
    this.name = "PrelovedConsignmentLotNotFoundError";
  }
}

export class PrelovedWriteOffNotEligibleError extends Error {
  readonly code = "write_off_not_eligible";

  constructor(message = "SKU is not eligible for write-off.") {
    super(message);
    this.name = "PrelovedWriteOffNotEligibleError";
  }
}

export class PrelovedExpiredStockError extends Error {
  readonly code = "expired_stock";

  constructor(
    message = "Write off expired stock for this item, size, and condition before accepting another garment.",
  ) {
    super(message);
    this.name = "PrelovedExpiredStockError";
  }
}

export class PrelovedInsufficientQtyError extends Error {
  readonly code = "insufficient_qty";

  constructor(message = "Preloved quantity is insufficient.") {
    super(message);
    this.name = "PrelovedInsufficientQtyError";
  }
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Same 2dp rounding as checkout `round2`. */
export function roundPrelovedPrice(value: number): number {
  return round2(value);
}

/** Default preloved price: round2(new variant × tenant fraction). */
export function defaultPrelovedPrice(
  newVariantPrice: number,
  priceFractionOfNew: number = DEFAULT_PRICE_FRACTION_OF_NEW,
): number {
  return roundPrelovedPrice(newVariantPrice * priceFractionOfNew);
}

/** Soft cap: operator price above default is allowed, but flagged. */
export function isPrelovedPriceAboveCap(
  operatorPrice: number,
  newVariantPrice: number,
  priceFractionOfNew: number = DEFAULT_PRICE_FRACTION_OF_NEW,
): boolean {
  return (
    roundPrelovedPrice(operatorPrice) >
    defaultPrelovedPrice(newVariantPrice, priceFractionOfNew)
  );
}

export function prelovedExpiresAt(listedAt: Date, holdDays: number): Date {
  const days = Number.isFinite(holdDays) ? holdDays : DEFAULT_HOLD_DAYS;
  return new Date(listedAt.getTime() + days * MS_PER_DAY);
}

/** Persist actor_id only when the session id is a UUID; dev- fallback ids become null. */
export function parseActorId(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return UUID_RE.test(trimmed) ? trimmed : null;
}
