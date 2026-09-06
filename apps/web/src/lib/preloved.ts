/**
 * Phase 1 preloved domain types and in-code defaults.
 * Donation-only: no consignment or commission fields on the public settings type.
 */

export const PRELOVED_INTAKE_MODE = "donation_only" as const;
export type PrelovedIntakeMode = typeof PRELOVED_INTAKE_MODE;

export const PRELOVED_CONDITIONS = ["good", "fair"] as const;
export type PrelovedCondition = (typeof PRELOVED_CONDITIONS)[number];

export const PRELOVED_INTAKE_KINDS = ["accepted", "rejected", "written_off"] as const;
export type PrelovedIntakeKind = (typeof PRELOVED_INTAKE_KINDS)[number];

export const PRELOVED_INTAKE_SOURCE = "donation" as const;
export type PrelovedIntakeSource = typeof PRELOVED_INTAKE_SOURCE;

export const DEFAULT_REFUSE_LIST = ["socks", "swimwear", "hats"] as const;

export const DEFAULT_PRICE_FRACTION_OF_NEW = 0.5;
export const MIN_PRICE_FRACTION_OF_NEW = 0.01;
export const MAX_PRICE_FRACTION_OF_NEW = 2;
export const DEFAULT_HOLD_DAYS = 365;

export const PRELOVED_SKU_UNIQUE_CONSTRAINT =
  "preloved_skus_tenant_item_size_condition_unique";

export type PrelovedSettings = {
  tenantId: string;
  prelovedEnabled: boolean;
  intakeMode: PrelovedIntakeMode;
  priceFractionOfNew: number;
  holdDays: number;
  donatedGstFree: boolean;
  refuseList: string[];
};

/** Operator-writable settings. Intake mode and commission are not accepted. */
export type PrelovedSettingsPatch = {
  prelovedEnabled?: boolean;
  priceFractionOfNew?: number;
  holdDays?: number;
  donatedGstFree?: boolean;
  refuseList?: string[];
};

export type InsertPrelovedSkuInput = {
  tenantId: string;
  sourceItemId: string;
  size: string;
  condition: PrelovedCondition;
  price: number;
  qtyOnHand: number;
  gstFree?: boolean;
  active?: boolean;
  imageUrl?: string | null;
  expiresAt?: Date | null;
};

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
  };
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

export class PrelovedSkuConflictError extends Error {
  readonly code = "23505";
  readonly constraint = PRELOVED_SKU_UNIQUE_CONSTRAINT;

  constructor(cause?: unknown) {
    super(
      "A preloved SKU already exists for this tenant, item, size, and condition.",
    );
    this.name = "PrelovedSkuConflictError";
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}
