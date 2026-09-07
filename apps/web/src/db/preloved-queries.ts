/**
 * Preloved settings / SKU / intake / parent-shop helpers.
 * Kept out of queries.ts so GST/report work in queries.ts does not clash.
 */
import { cache } from "react";
import { and, asc, desc, eq, gt, gte, isNotNull, lt, sql } from "drizzle-orm";
import {
  DEFAULT_PRICE_FRACTION_OF_NEW,
  PRELOVED_INTAKE_MODE,
  PRELOVED_INTAKE_SOURCE,
  PrelovedCatalogMatchError,
  PrelovedExpiredStockError,
  PrelovedWriteOffNotEligibleError,
  defaultPrelovedPrice,
  defaultPrelovedSettings,
  roundPrelovedPrice,
  isPersistablePriceFractionOfNew,
  isPrelovedPriceAboveCap,
  parseActorId,
  parsePriceFraction,
  parseRefuseList,
  prelovedExpiresAt,
  roundPriceFractionOfNew,
  type AcceptAndPoolInput,
  type InsertPrelovedIntakeEventInput,
  type PrelovedCondition,
  type PrelovedSettings,
  type PrelovedSettingsPatch,
  type PrelovedStockListItem,
  type RejectPrelovedIntakeInput,
  type ShopPrelovedSku,
  type WriteOffPrelovedSkuInput,
} from "@/lib/preloved";
import { type InsertDonationNoteInput } from "@/lib/preloved-donate";
import { policyTextWithPrelovedRefundClause } from "@/lib/preloved-refund-policy";
import { logAuditEvent } from "@/lib/audit/log";
import type { AuditActorRole } from "@/lib/audit/types";
import { db } from "./index";
import {
  catalogItems,
  catalogVariants,
  prelovedDonationNotes,
  prelovedIntakeEvents,
  prelovedSkus,
  tenantPrelovedSettings,
  type PrelovedDonationNoteRow,
  type PrelovedIntakeEventRow,
  type PrelovedSkuRow,
} from "./schema";
import {
  getTenant,
  getTenantLegalVersion,
  insertNextTenantLegalVersion,
} from "./queries";

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

export const getPrelovedSettings = cache(async (tenantId: string): Promise<PrelovedSettings> => {
  const [row] = await db
    .select()
    .from(tenantPrelovedSettings)
    .where(eq(tenantPrelovedSettings.tenantId, tenantId))
    .limit(1);
  return mapSettingsRow(tenantId, row);
});

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

/**
 * When preloved is on, persist the ACL-safe clause on the current text-mode
 * legal version (new row + pointer flip). URL-mode rows cannot store
 * policy_text (check constraint); those tenants keep URL mode and the tenant
 * refund-policy route shows the canonical paragraph instead of redirecting.
 *
 * enteredByUserId must be a real neon_auth UUID. Dev-session ids fall back to
 * the previous version's enteredByUserId.
 */
export async function ensurePrelovedRefundClauseOnLegalVersion(opts: {
  tenantId: string;
  actorEmail: string;
  actorUserId: string;
  actorRole: AuditActorRole;
}): Promise<{ id: string; version: number } | null> {
  const tenant = await getTenant(opts.tenantId);
  if (!tenant?.currentLegalVersionId) return null;

  const current = await getTenantLegalVersion(tenant.currentLegalVersionId);
  if (!current || current.policyMode !== "text") return null;

  const nextText = policyTextWithPrelovedRefundClause(current.policyText);
  if (nextText === (current.policyText ?? "")) return null;

  const enteredByUserId = parseActorId(opts.actorUserId) ?? current.enteredByUserId;
  const inserted = await insertNextTenantLegalVersion({
    tenantId: opts.tenantId,
    policyMode: "text",
    policyText: nextText,
    policyUrl: null,
    aclAcknowledged: current.aclAcknowledged,
    sellerOfRecordAcknowledged: current.sellerOfRecordAcknowledged,
    declarantName: current.declarantName,
    declarantRole: current.declarantRole,
    enteredByUserId,
    enteredByEmail: opts.actorEmail,
  });
  if (!inserted) return null;

  await logAuditEvent({
    tenantId: opts.tenantId,
    actorEmail: opts.actorEmail,
    actorRole: opts.actorRole,
    action: "tenant.legal_updated",
    targetType: "tenant_legal_version",
    targetId: inserted.id,
    payload: {
      version: inserted.version,
      mode: "text",
      changedFields: ["preloved_refund_clause"],
    },
  });
  return inserted;
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
      actorId: parseActorId(input.actorId),
    })
    .returning();
  return row;
}

/**
 * Persist one parent drop-off bag note. Does not insert preloved_skus
 * or preloved_intake_events.
 */
export async function insertDonationNote(
  input: InsertDonationNoteInput,
): Promise<PrelovedDonationNoteRow> {
  const [row] = await db
    .insert(prelovedDonationNotes)
    .values({
      tenantId: input.tenantId,
      parentName: input.parentName,
      studentName: input.studentName,
      bagCount: input.bagCount,
    })
    .returning();
  return row;
}

function variantHasSize(sizes: unknown, size: string): boolean {
  if (!Array.isArray(sizes)) return false;
  return sizes.some((entry) => String(entry) === size);
}

function toMoney(value: string | number | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value ?? NaN);
  return Number.isFinite(parsed) ? parsed : 0;
}

const stockListSelect = {
  id: prelovedSkus.id,
  sourceItemId: prelovedSkus.sourceItemId,
  itemName: catalogItems.name,
  size: prelovedSkus.size,
  condition: prelovedSkus.condition,
  price: prelovedSkus.price,
  qtyOnHand: prelovedSkus.qtyOnHand,
  listedAt: prelovedSkus.listedAt,
  expiresAt: prelovedSkus.expiresAt,
  defectNote: prelovedSkus.defectNote,
};

function mapStockListItem(row: {
  id: string;
  sourceItemId: string;
  itemName: string;
  size: string;
  condition: PrelovedCondition;
  price: string;
  qtyOnHand: number;
  listedAt: Date;
  expiresAt: Date | null;
  defectNote: string | null;
}): PrelovedStockListItem {
  return {
    id: row.id,
    sourceItemId: row.sourceItemId,
    itemName: row.itemName,
    size: row.size,
    condition: row.condition,
    price: toMoney(row.price),
    qtyOnHand: row.qtyOnHand,
    listedAt: row.listedAt,
    expiresAt: row.expiresAt,
    defectNote: row.defectNote,
  };
}

export type AcceptAndPoolResult = {
  sku: PrelovedSkuRow;
  event: PrelovedIntakeEventRow;
  defaultPrice: number;
  appliedPrice: number;
  priceAboveCap: boolean;
};

/** True when ON CONFLICT may increment (restock qty 0, or not yet expired). */
function canAcceptOntoSku(listedAt: Date) {
  return sql`(${prelovedSkus.qtyOnHand} = 0 OR ${prelovedSkus.expiresAt} IS NULL OR ${prelovedSkus.expiresAt} >= ${listedAt})`;
}

/**
 * Pool one donated garment onto the (tenant, item, size, condition) SKU.
 * ON CONFLICT increments qty_on_hand on the existing row (same id).
 * Restock after qty 0 restarts listedAt/expiresAt, recopies donatedGstFree,
 * and applies the new price (and defectNote when sent). Pooling onto in-stock
 * qty only increments qty_on_hand.
 * Accept onto expired in-stock qty is refused until write-off (qty 0).
 * SKU upsert and accepted event insert run in one db.batch so a failed event
 * cannot leave a qty increment that a client retry would apply again.
 * The event is INSERT … SELECT of the eligible unique-key row because batch
 * queries are composed before INSERT … RETURNING is available, and a VALUES
 * insert would still write an event when the conflict WHERE no-ops.
 */
export async function acceptAndPool(
  input: AcceptAndPoolInput,
): Promise<AcceptAndPoolResult> {
  const settings = await getPrelovedSettings(input.tenantId);

  const catalogRows = await db
    .select({
      itemId: catalogItems.id,
      variantPrice: catalogVariants.price,
      sizes: catalogVariants.sizes,
    })
    .from(catalogItems)
    .innerJoin(catalogVariants, eq(catalogVariants.itemId, catalogItems.id))
    .where(
      and(
        eq(catalogItems.id, input.sourceItemId),
        eq(catalogItems.tenantId, input.tenantId),
        eq(catalogItems.active, true),
        eq(catalogVariants.active, true),
      ),
    );

  const matched = catalogRows.find((row) => variantHasSize(row.sizes, input.size));
  if (!matched) {
    throw new PrelovedCatalogMatchError();
  }

  const newVariantPrice = toMoney(matched.variantPrice);
  const defaultPrice = defaultPrelovedPrice(
    newVariantPrice,
    settings.priceFractionOfNew,
  );
  const appliedPrice =
    input.price === undefined ? defaultPrice : roundPrelovedPrice(input.price);
  const priceAboveCap = isPrelovedPriceAboveCap(
    appliedPrice,
    newVariantPrice,
    settings.priceFractionOfNew,
  );

  const listedAt = new Date();
  const expiresAt = prelovedExpiresAt(listedAt, settings.holdDays);
  const priceSql = toNumeric2(appliedPrice, 0);
  const conflictSet: {
    qtyOnHand: ReturnType<typeof sql>;
    price: ReturnType<typeof sql>;
    gstFree: ReturnType<typeof sql>;
    listedAt: ReturnType<typeof sql>;
    expiresAt: ReturnType<typeof sql>;
    defectNote?: ReturnType<typeof sql>;
  } = {
    qtyOnHand: sql`${prelovedSkus.qtyOnHand} + 1`,
    price: sql`CASE WHEN ${prelovedSkus.qtyOnHand} = 0 THEN ${priceSql}::numeric ELSE ${prelovedSkus.price} END`,
    gstFree: sql`CASE WHEN ${prelovedSkus.qtyOnHand} = 0 THEN ${settings.donatedGstFree} ELSE ${prelovedSkus.gstFree} END`,
    listedAt: sql`CASE WHEN ${prelovedSkus.qtyOnHand} = 0 THEN ${listedAt} ELSE ${prelovedSkus.listedAt} END`,
    expiresAt: sql`CASE WHEN ${prelovedSkus.qtyOnHand} = 0 THEN ${expiresAt} ELSE ${prelovedSkus.expiresAt} END`,
  };
  if (input.defectNote !== undefined) {
    conflictSet.defectNote = sql`CASE WHEN ${prelovedSkus.qtyOnHand} = 0 THEN ${input.defectNote} ELSE ${prelovedSkus.defectNote} END`;
  }

  const skuUpsert = db
    .insert(prelovedSkus)
    .values({
      tenantId: input.tenantId,
      sourceItemId: input.sourceItemId,
      size: input.size,
      condition: input.condition,
      price: priceSql,
      qtyOnHand: 1,
      gstFree: settings.donatedGstFree,
      active: true,
      defectNote: input.defectNote ?? null,
      listedAt,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: [
        prelovedSkus.tenantId,
        prelovedSkus.sourceItemId,
        prelovedSkus.size,
        prelovedSkus.condition,
      ],
      set: conflictSet,
      // Keep expired in-stock rows unchanged so a new unit is not mixed
      // onto a hold that is already past and write-off eligible.
      setWhere: canAcceptOntoSku(listedAt),
    })
    .returning();

  const eventInsert = db
    .insert(prelovedIntakeEvents)
    .select(
      db
        .select({
          id: sql`gen_random_uuid()`.as("id"),
          tenantId: prelovedSkus.tenantId,
          prelovedSkuId: prelovedSkus.id,
          sourceItemId: prelovedSkus.sourceItemId,
          size: prelovedSkus.size,
          condition: prelovedSkus.condition,
          source: sql<typeof PRELOVED_INTAKE_SOURCE>`${PRELOVED_INTAKE_SOURCE}::preloved_intake_source`.as(
            "source",
          ),
          action: sql<"accepted">`'accepted'::preloved_intake_action`.as(
            "action",
          ),
          qty: sql<number>`1::int`.as("qty"),
          rejectReason: sql`null`.as("rejectReason"),
          actorId: sql<string | null>`${parseActorId(input.actorId)}::uuid`.as(
            "actorId",
          ),
          createdAt: sql`now()`.as("createdAt"),
        })
        .from(prelovedSkus)
        .where(
          and(
            eq(prelovedSkus.tenantId, input.tenantId),
            eq(prelovedSkus.sourceItemId, input.sourceItemId),
            eq(prelovedSkus.size, input.size),
            eq(prelovedSkus.condition, input.condition),
            canAcceptOntoSku(listedAt),
          ),
        ),
    )
    .returning();

  const [skuRows, eventRows] = await db.batch([skuUpsert, eventInsert]);
  const sku = skuRows[0];
  const event = eventRows[0];

  if (!sku) {
    throw new PrelovedExpiredStockError();
  }
  if (!event) {
    throw new Error("Failed to record preloved intake event");
  }

  return { sku, event, defaultPrice, appliedPrice, priceAboveCap };
}

export async function rejectPrelovedIntake(
  input: RejectPrelovedIntakeInput,
): Promise<PrelovedIntakeEventRow> {
  return insertPrelovedIntakeEvent({
    tenantId: input.tenantId,
    actorId: input.actorId,
    kind: "rejected",
    qty: 1,
    rejectReason: input.rejectReason,
    sourceItemId: input.sourceItemId ?? null,
    size: input.size ?? null,
    condition: input.condition ?? null,
  });
}

export type WriteOffPrelovedSkuResult = {
  sku: PrelovedSkuRow;
  event: PrelovedIntakeEventRow;
  qtyWrittenOff: number;
};

function isExpiredForWriteOff(sku: PrelovedSkuRow, now: Date): boolean {
  return sku.expiresAt != null && sku.expiresAt < now;
}

async function findWrittenOffEventForListing(
  tenantId: string,
  skuId: string,
  listedAt: Date,
): Promise<PrelovedIntakeEventRow | undefined> {
  const [row] = await db
    .select()
    .from(prelovedIntakeEvents)
    .where(
      and(
        eq(prelovedIntakeEvents.tenantId, tenantId),
        eq(prelovedIntakeEvents.prelovedSkuId, skuId),
        eq(prelovedIntakeEvents.action, "written_off"),
        gte(prelovedIntakeEvents.createdAt, listedAt),
      ),
    )
    .orderBy(desc(prelovedIntakeEvents.createdAt))
    .limit(1);
  return row;
}

/** Accepted qty this listing. M03 has no sale decrements, so this is the write-off qty on retry. */
async function acceptedQtyForListing(
  tenantId: string,
  skuId: string,
  listedAt: Date,
): Promise<number> {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${prelovedIntakeEvents.qty}), 0)`,
    })
    .from(prelovedIntakeEvents)
    .where(
      and(
        eq(prelovedIntakeEvents.tenantId, tenantId),
        eq(prelovedIntakeEvents.prelovedSkuId, skuId),
        eq(prelovedIntakeEvents.action, "accepted"),
        gte(prelovedIntakeEvents.createdAt, listedAt),
      ),
    );
  const total = Number(row?.total ?? 0);
  return Number.isFinite(total) ? total : 0;
}

function writtenOffEventInput(
  input: WriteOffPrelovedSkuInput,
  sku: PrelovedSkuRow,
  qty: number,
): InsertPrelovedIntakeEventInput {
  return {
    tenantId: input.tenantId,
    actorId: input.actorId,
    kind: "written_off",
    qty,
    prelovedSkuId: sku.id,
    sourceItemId: sku.sourceItemId,
    size: sku.size,
    condition: sku.condition,
  };
}

/**
 * Zero expired stock and record written_off.
 * neon-http cannot wrap the qty update + event insert in an interactive
 * transaction. If qty is already 0 and this listing has no written_off
 * event, retry inserts the missing event instead of 409.
 */
export async function writeOffPrelovedSku(
  input: WriteOffPrelovedSkuInput,
): Promise<WriteOffPrelovedSkuResult> {
  const now = new Date();
  const [existing] = await db
    .select()
    .from(prelovedSkus)
    .where(
      and(
        eq(prelovedSkus.id, input.skuId),
        eq(prelovedSkus.tenantId, input.tenantId),
      ),
    )
    .limit(1);

  if (!existing || !isExpiredForWriteOff(existing, now)) {
    throw new PrelovedWriteOffNotEligibleError();
  }

  if (existing.qtyOnHand > 0) {
    const qtyWrittenOff = existing.qtyOnHand;
    const [sku] = await db
      .update(prelovedSkus)
      .set({ qtyOnHand: 0 })
      .where(
        and(
          eq(prelovedSkus.id, existing.id),
          eq(prelovedSkus.tenantId, input.tenantId),
          eq(prelovedSkus.qtyOnHand, qtyWrittenOff),
          isNotNull(prelovedSkus.expiresAt),
          lt(prelovedSkus.expiresAt, now),
        ),
      )
      .returning();

    if (!sku) {
      throw new PrelovedWriteOffNotEligibleError();
    }

    const event = await insertPrelovedIntakeEvent(
      writtenOffEventInput(input, sku, qtyWrittenOff),
    );
    return { sku, event, qtyWrittenOff };
  }

  const existingEvent = await findWrittenOffEventForListing(
    input.tenantId,
    existing.id,
    existing.listedAt,
  );
  if (existingEvent) {
    throw new PrelovedWriteOffNotEligibleError();
  }

  const qtyWrittenOff = await acceptedQtyForListing(
    input.tenantId,
    existing.id,
    existing.listedAt,
  );
  const event = await insertPrelovedIntakeEvent(
    writtenOffEventInput(input, existing, qtyWrittenOff),
  );
  return { sku: existing, event, qtyWrittenOff };
}

export async function listInStockPrelovedSkus(
  tenantId: string,
): Promise<PrelovedStockListItem[]> {
  const rows = await db
    .select(stockListSelect)
    .from(prelovedSkus)
    .innerJoin(catalogItems, eq(catalogItems.id, prelovedSkus.sourceItemId))
    .where(
      and(eq(prelovedSkus.tenantId, tenantId), gt(prelovedSkus.qtyOnHand, 0)),
    )
    .orderBy(desc(prelovedSkus.listedAt));
  return rows.map(mapStockListItem);
}

const shopSkuSelect = {
  id: prelovedSkus.id,
  sourceItemId: prelovedSkus.sourceItemId,
  itemName: catalogItems.name,
  category: catalogItems.category,
  size: prelovedSkus.size,
  condition: prelovedSkus.condition,
  price: prelovedSkus.price,
  qtyOnHand: prelovedSkus.qtyOnHand,
  defectNote: prelovedSkus.defectNote,
  imageUrl: prelovedSkus.imageUrl,
};

function mapShopPrelovedSku(row: {
  id: string;
  sourceItemId: string;
  itemName: string;
  category: string;
  size: string;
  condition: PrelovedCondition;
  price: string;
  qtyOnHand: number;
  defectNote: string | null;
  imageUrl: string | null;
}): ShopPrelovedSku {
  return {
    id: row.id,
    sourceItemId: row.sourceItemId,
    itemName: row.itemName,
    category: row.category,
    size: row.size,
    condition: row.condition,
    price: toMoney(row.price),
    qtyOnHand: row.qtyOnHand,
    defectNote: row.defectNote,
    imageUrl: row.imageUrl && row.imageUrl.length > 0 ? row.imageUrl : null,
  };
}

const SHOP_SKU_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const shopInStockWhere = (tenantId: string) =>
  and(
    eq(prelovedSkus.tenantId, tenantId),
    eq(prelovedSkus.active, true),
    gt(prelovedSkus.qtyOnHand, 0),
    eq(catalogItems.tenantId, tenantId),
    eq(catalogItems.active, true),
  );

/** Active in-stock SKUs whose source catalog item is live. Admin stock listing is unchanged. */
export const listShopPrelovedSkus = cache(
  async (tenantId: string): Promise<ShopPrelovedSku[]> => {
    const rows = await db
      .select(shopSkuSelect)
      .from(prelovedSkus)
      .innerJoin(catalogItems, eq(catalogItems.id, prelovedSkus.sourceItemId))
      .where(shopInStockWhere(tenantId))
      .orderBy(
        asc(catalogItems.sortOrder),
        asc(catalogItems.name),
        asc(prelovedSkus.size),
        asc(prelovedSkus.condition),
      );
    return rows.map(mapShopPrelovedSku);
  },
);

/** One shop DTO, or null when missing, inactive, qty 0, unpublished catalog, or wrong tenant. */
export const getShopPrelovedSku = cache(
  async (tenantId: string, skuId: string): Promise<ShopPrelovedSku | null> => {
    if (!SHOP_SKU_ID_RE.test(skuId)) return null;
    const [row] = await db
      .select(shopSkuSelect)
      .from(prelovedSkus)
      .innerJoin(catalogItems, eq(catalogItems.id, prelovedSkus.sourceItemId))
      .where(and(eq(prelovedSkus.id, skuId), shopInStockWhere(tenantId)))
      .limit(1);
    return row ? mapShopPrelovedSku(row) : null;
  },
);

export async function listExpiredPrelovedSkus(
  tenantId: string,
): Promise<PrelovedStockListItem[]> {
  const now = new Date();
  const rows = await db
    .select(stockListSelect)
    .from(prelovedSkus)
    .innerJoin(catalogItems, eq(catalogItems.id, prelovedSkus.sourceItemId))
    .where(
      and(
        eq(prelovedSkus.tenantId, tenantId),
        gt(prelovedSkus.qtyOnHand, 0),
        isNotNull(prelovedSkus.expiresAt),
        lt(prelovedSkus.expiresAt, now),
      ),
    )
    .orderBy(asc(prelovedSkus.expiresAt));
  return rows.map(mapStockListItem);
}
