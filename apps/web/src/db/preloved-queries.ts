/**
 * Preloved settings / SKU / intake helpers.
 * Kept out of queries.ts so M02 can own GST/report changes without merge conflict.
 */
import { eq } from "drizzle-orm";
import { isUniqueConstraintError } from "@/lib/db/unique-constraint";
import {
  DEFAULT_PRICE_FRACTION_OF_NEW,
  PRELOVED_INTAKE_MODE,
  PRELOVED_INTAKE_SOURCE,
  PRELOVED_SKU_UNIQUE_CONSTRAINT,
  PrelovedSkuConflictError,
  defaultPrelovedSettings,
  isPersistablePriceFractionOfNew,
  parsePriceFraction,
  parseRefuseList,
  roundPriceFractionOfNew,
  type InsertPrelovedIntakeEventInput,
  type InsertPrelovedSkuInput,
  type PrelovedSettings,
  type PrelovedSettingsPatch,
} from "@/lib/preloved";
import { db } from "./index";
import {
  prelovedIntakeEvents,
  prelovedSkus,
  tenantPrelovedSettings,
  type PrelovedIntakeEventRow,
  type PrelovedSkuRow,
} from "./schema";

function mapSettingsRow(
  tenantId: string,
  row: typeof tenantPrelovedSettings.$inferSelect | undefined,
): PrelovedSettings {
  if (!row) return defaultPrelovedSettings(tenantId);
  return {
    tenantId: row.tenantId,
    prelovedEnabled: row.prelovedEnabled,
    intakeMode: PRELOVED_INTAKE_MODE,
    priceFractionOfNew: parsePriceFraction(row.priceFractionOfNew),
    holdDays: row.holdDays,
    donatedGstFree: row.donatedGstFree,
    refuseList: parseRefuseList(row.refuseList),
  };
}

function toNumeric2(value: number, fallback = DEFAULT_PRICE_FRACTION_OF_NEW): string {
  return Number.isFinite(value) ? value.toFixed(2) : fallback.toFixed(2);
}

export async function getPrelovedSettings(tenantId: string): Promise<PrelovedSettings> {
  const [row] = await db
    .select()
    .from(tenantPrelovedSettings)
    .where(eq(tenantPrelovedSettings.tenantId, tenantId))
    .limit(1);
  return mapSettingsRow(tenantId, row);
}

/**
 * Insert or update tenant preloved settings.
 * Only provided patch columns are written; omitted columns use DB defaults
 * on insert and stay unchanged on conflict. Commission is never written.
 */
export async function upsertPrelovedSettings(
  tenantId: string,
  patch: PrelovedSettingsPatch,
): Promise<PrelovedSettings> {
  const columns: {
    prelovedEnabled?: boolean;
    priceFractionOfNew?: string;
    holdDays?: number;
    donatedGstFree?: boolean;
    refuseList?: string[];
  } = {};
  if (patch.prelovedEnabled !== undefined) columns.prelovedEnabled = patch.prelovedEnabled;
  if (patch.priceFractionOfNew !== undefined) {
    if (!isPersistablePriceFractionOfNew(patch.priceFractionOfNew)) {
      throw new RangeError(
        "priceFractionOfNew must round to a value between 0.01 and 2",
      );
    }
    columns.priceFractionOfNew = roundPriceFractionOfNew(
      patch.priceFractionOfNew,
    ).toFixed(2);
  }
  if (patch.holdDays !== undefined) columns.holdDays = patch.holdDays;
  if (patch.donatedGstFree !== undefined) columns.donatedGstFree = patch.donatedGstFree;
  if (patch.refuseList !== undefined) columns.refuseList = [...patch.refuseList];

  const [row] = await db
    .insert(tenantPrelovedSettings)
    .values({ tenantId, ...columns })
    .onConflictDoUpdate({
      target: tenantPrelovedSettings.tenantId,
      set: {
        ...columns,
        updatedAt: new Date(),
      },
    })
    .returning();
  return mapSettingsRow(tenantId, row);
}

export async function insertPrelovedSku(
  input: InsertPrelovedSkuInput,
): Promise<PrelovedSkuRow> {
  try {
    const [row] = await db
      .insert(prelovedSkus)
      .values({
        tenantId: input.tenantId,
        sourceItemId: input.sourceItemId,
        size: input.size,
        condition: input.condition,
        price: toNumeric2(input.price, 0),
        qtyOnHand: input.qtyOnHand,
        gstFree: input.gstFree ?? false,
        active: input.active ?? true,
        imageUrl: input.imageUrl ?? null,
        expiresAt: input.expiresAt ?? null,
      })
      .returning();
    return row;
  } catch (err) {
    if (isUniqueConstraintError(err, PRELOVED_SKU_UNIQUE_CONSTRAINT)) {
      throw new PrelovedSkuConflictError(err);
    }
    throw err;
  }
}

export async function insertPrelovedIntakeEvent(
  input: InsertPrelovedIntakeEventInput,
): Promise<PrelovedIntakeEventRow> {
  const [row] = await db
    .insert(prelovedIntakeEvents)
    .values({
      tenantId: input.tenantId,
      prelovedSkuId: input.prelovedSkuId ?? null,
      sourceItemId: input.sourceItemId ?? null,
      size: input.size ?? null,
      condition: input.condition ?? null,
      source: PRELOVED_INTAKE_SOURCE,
      action: input.kind,
      qty: input.qty,
      rejectReason: input.rejectReason ?? null,
      actorId: input.actorId ?? null,
    })
    .returning();
  return row;
}
