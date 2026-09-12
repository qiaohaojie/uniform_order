/**
 * Preloved settings / SKU / intake / donation-note / parent-shop / paid-decrement helpers.
 * Kept out of queries.ts so GST/report work in queries.ts does not clash.
 */
import { cache } from "react";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, isNotNull, lt, sql } from "drizzle-orm";
import {
  DEFAULT_PRICE_FRACTION_OF_NEW,
  PRELOVED_INTAKE_SOURCE,
  PrelovedCatalogMatchError,
  PrelovedConsignmentLotNotFoundError,
  PrelovedConsignmentNotEnabledError,
  PrelovedExpiredStockError,
  PrelovedInsufficientQtyError,
  PrelovedWriteOffNotEligibleError,
  defaultPrelovedPrice,
  defaultPrelovedSettings,
  roundPrelovedPrice,
  isPersistablePriceFractionOfNew,
  isPrelovedPriceAboveCap,
  parseActorId,
  parseCommissionBps,
  parseIntakeMode,
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
import {
  type DonationNoteListItem,
  type InsertDonationNoteInput,
} from "@/lib/preloved-donate";
import {
  generateConsignmentTicketCode,
  isConsignmentIntakeMode,
  isValidCommissionBps,
  payoutStatusForPreference,
  type ConsignmentAcceptedUnit,
  type ConsignmentLotItemDraft,
  type ConsignmentLotListItem,
  type InsertConsignmentLotInput,
} from "@/lib/preloved-consignment";
import { policyTextWithPrelovedRefundClause } from "@/lib/preloved-refund-policy";
import { logAuditEvent } from "@/lib/audit/log";
import type { AuditActorRole } from "@/lib/audit/types";
import { isUniqueConstraintError } from "@/lib/db/unique-constraint";
import { db } from "./index";
import {
  catalogItems,
  catalogVariants,
  consignmentItems,
  consignmentLots,
  prelovedDonationNotes,
  prelovedIntakeEvents,
  prelovedSkus,
  tenantPrelovedSettings,
  type ConsignmentLotRow,
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
    intakeMode: parseIntakeMode(row.intakeMode),
    priceFractionOfNew: parsePriceFraction(row.priceFractionOfNew),
    holdDays: row.holdDays,
    donatedGstFree: row.donatedGstFree,
    refuseList: parseRefuseList(row.refuseList),
    commissionBps: parseCommissionBps(row.commissionBps),
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
 * on insert and stay unchanged on conflict.
 */
export async function upsertPrelovedSettings(
  tenantId: string,
  patch: PrelovedSettingsPatch,
): Promise<PrelovedSettings> {
  const columns: {
    prelovedEnabled?: boolean;
    intakeMode?: PrelovedSettings["intakeMode"];
    priceFractionOfNew?: string;
    holdDays?: number;
    donatedGstFree?: boolean;
    refuseList?: string[];
    commissionBps?: number;
  } = {};
  if (patch.prelovedEnabled !== undefined) columns.prelovedEnabled = patch.prelovedEnabled;
  if (patch.intakeMode !== undefined) columns.intakeMode = patch.intakeMode;
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
  if (patch.commissionBps !== undefined) {
    if (!isValidCommissionBps(patch.commissionBps)) {
      throw new RangeError("commissionBps must be an integer between 0 and 10000");
    }
    columns.commissionBps = patch.commissionBps;
  }

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

const DONATION_NOTE_INBOX_LIMIT = 200;

/** Newest parent drop-off notes for the operator inbox. */
export async function listDonationNotes(
  tenantId: string,
): Promise<DonationNoteListItem[]> {
  const rows = await db
    .select({
      id: prelovedDonationNotes.id,
      parentName: prelovedDonationNotes.parentName,
      studentName: prelovedDonationNotes.studentName,
      bagCount: prelovedDonationNotes.bagCount,
      createdAt: prelovedDonationNotes.createdAt,
    })
    .from(prelovedDonationNotes)
    .where(eq(prelovedDonationNotes.tenantId, tenantId))
    .orderBy(desc(prelovedDonationNotes.createdAt))
    .limit(DONATION_NOTE_INBOX_LIMIT);
  return rows;
}

const CONSIGNMENT_LOT_LIST_LIMIT = 200;

function parseLotItems(value: unknown): ConsignmentLotItemDraft[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is ConsignmentLotItemDraft =>
        !!entry &&
        typeof entry === "object" &&
        typeof (entry as ConsignmentLotItemDraft).garment === "string" &&
        typeof (entry as ConsignmentLotItemDraft).size === "string",
    )
    .map((entry) => ({
      garment: entry.garment.trim(),
      size: entry.size.trim(),
    }));
}

function mapConsignmentLotRow(row: ConsignmentLotRow): ConsignmentLotListItem {
  return {
    id: row.id,
    ticketCode: row.ticketCode,
    familyName: row.familyName,
    studentName: row.studentName,
    email: row.email,
    mobile: row.mobile,
    payoutPreference: row.payoutPreference,
    bankBsb: row.bankBsb,
    bankAccountName: row.bankAccountName,
    bankAccountNumber: row.bankAccountNumber,
    unsoldPreference: row.unsoldPreference,
    items: parseLotItems(row.items),
    payoutStatus: row.payoutStatus,
    payoutMarkedAt: row.payoutMarkedAt,
    createdAt: row.createdAt,
    acceptedUnits: [],
    acceptedQty: 0,
  };
}

export async function getConsignmentLot(
  tenantId: string,
  lotId: string,
): Promise<ConsignmentLotRow | null> {
  const [row] = await db
    .select()
    .from(consignmentLots)
    .where(
      and(eq(consignmentLots.id, lotId), eq(consignmentLots.tenantId, tenantId)),
    )
    .limit(1);
  return row ?? null;
}

async function attachAcceptedUnits(
  tenantId: string,
  lots: ConsignmentLotListItem[],
): Promise<ConsignmentLotListItem[]> {
  if (lots.length === 0) return lots;
  const lotIds = lots.map((lot) => lot.id);
  const rows = await db
    .select({
      id: consignmentItems.id,
      lotId: consignmentItems.lotId,
      skuId: consignmentItems.prelovedSkuId,
      itemName: catalogItems.name,
      size: consignmentItems.size,
      condition: consignmentItems.condition,
      qty: consignmentItems.qty,
      createdAt: consignmentItems.createdAt,
    })
    .from(consignmentItems)
    .innerJoin(catalogItems, eq(catalogItems.id, consignmentItems.sourceItemId))
    .where(
      and(
        eq(consignmentItems.tenantId, tenantId),
        inArray(consignmentItems.lotId, lotIds),
      ),
    )
    .orderBy(desc(consignmentItems.createdAt));

  const byLot = new Map<string, ConsignmentAcceptedUnit[]>();
  for (const row of rows) {
    const unit: ConsignmentAcceptedUnit = {
      id: row.id,
      skuId: row.skuId,
      itemName: row.itemName,
      size: row.size,
      condition: row.condition,
      qty: row.qty,
      createdAt: row.createdAt,
    };
    const list = byLot.get(row.lotId) ?? [];
    list.push(unit);
    byLot.set(row.lotId, list);
  }

  return lots.map((lot) => {
    const acceptedUnits = byLot.get(lot.id) ?? [];
    return {
      ...lot,
      acceptedUnits,
      acceptedQty: acceptedUnits.reduce((sum, unit) => sum + unit.qty, 0),
    };
  });
}

async function attachLotTickets(
  tenantId: string,
  items: PrelovedStockListItem[],
): Promise<PrelovedStockListItem[]> {
  if (items.length === 0) return items;
  const skuIds = items.map((item) => item.id);
  const rows = await db
    .select({
      skuId: consignmentItems.prelovedSkuId,
      ticketCode: consignmentLots.ticketCode,
    })
    .from(consignmentItems)
    .innerJoin(consignmentLots, eq(consignmentLots.id, consignmentItems.lotId))
    .where(
      and(
        eq(consignmentItems.tenantId, tenantId),
        inArray(consignmentItems.prelovedSkuId, skuIds),
      ),
    )
    .orderBy(asc(consignmentLots.ticketCode));

  const bySku = new Map<string, string[]>();
  for (const row of rows) {
    const list = bySku.get(row.skuId) ?? [];
    if (!list.includes(row.ticketCode)) list.push(row.ticketCode);
    bySku.set(row.skuId, list);
  }

  return items.map((item) => ({
    ...item,
    lotTickets: bySku.get(item.id) ?? [],
  }));
}

/** Create a consignment lot with a unique ticket code (retry on collision). */
export async function insertConsignmentLot(
  input: InsertConsignmentLotInput,
): Promise<ConsignmentLotRow> {
  const items = input.items.map((item) => ({
    garment: item.garment.trim(),
    size: item.size.trim(),
  }));
  const termsAcceptedAt = new Date();
  for (let attempt = 0; attempt < 5; attempt++) {
    const ticketCode = generateConsignmentTicketCode();
    try {
      const [row] = await db
        .insert(consignmentLots)
        .values({
          tenantId: input.tenantId,
          ticketCode,
          familyName: input.familyName,
          studentName: input.studentName,
          email: input.email,
          mobile: input.mobile,
          payoutPreference: input.payoutPreference,
          bankBsb: input.bankBsb ?? null,
          bankAccountName: input.bankAccountName ?? null,
          bankAccountNumber: input.bankAccountNumber ?? null,
          unsoldPreference: input.unsoldPreference,
          items,
          termsAcceptedAt,
        })
        .returning();
      return row;
    } catch (err) {
      if (isUniqueConstraintError(err) && attempt < 4) continue;
      throw err;
    }
  }
  throw new Error("Failed to allocate a consignment ticket code");
}

/** Newest consignment lots for the operator consignments tab. */
export async function listConsignmentLots(
  tenantId: string,
): Promise<ConsignmentLotListItem[]> {
  const rows = await db
    .select()
    .from(consignmentLots)
    .where(eq(consignmentLots.tenantId, tenantId))
    .orderBy(desc(consignmentLots.createdAt))
    .limit(CONSIGNMENT_LOT_LIST_LIMIT);
  return attachAcceptedUnits(tenantId, rows.map(mapConsignmentLotRow));
}

export type MarkConsignmentLotPayoutResult =
  | { ok: true; lot: ConsignmentLotListItem }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "already_marked"; lot: ConsignmentLotListItem };

/**
 * Mark a pending lot. Status is derived from payoutPreference.
 * Completed marks are not overwritten (409 already_marked).
 */
export async function markConsignmentLotPayout(opts: {
  tenantId: string;
  lotId: string;
  actorId?: string | null;
}): Promise<MarkConsignmentLotPayoutResult> {
  const actorId = parseActorId(opts.actorId);
  const lotWhere = and(
    eq(consignmentLots.id, opts.lotId),
    eq(consignmentLots.tenantId, opts.tenantId),
  );

  const [existing] = await db
    .select()
    .from(consignmentLots)
    .where(lotWhere)
    .limit(1);

  if (!existing) {
    return { ok: false, reason: "not_found" };
  }
  if (existing.payoutStatus !== "pending") {
    const [lot] = await attachAcceptedUnits(opts.tenantId, [
      mapConsignmentLotRow(existing),
    ]);
    return {
      ok: false,
      reason: "already_marked",
      lot,
    };
  }

  const [row] = await db
    .update(consignmentLots)
    .set({
      payoutStatus: payoutStatusForPreference(existing.payoutPreference),
      payoutMarkedAt: new Date(),
      payoutMarkedBy: actorId,
    })
    .where(and(lotWhere, eq(consignmentLots.payoutStatus, "pending")))
    .returning();

  if (!row) {
    const [current] = await db
      .select()
      .from(consignmentLots)
      .where(lotWhere)
      .limit(1);
    if (!current) {
      return { ok: false, reason: "not_found" };
    }
    const [lot] = await attachAcceptedUnits(opts.tenantId, [
      mapConsignmentLotRow(current),
    ]);
    return {
      ok: false,
      reason: "already_marked",
      lot,
    };
  }

  const [lot] = await attachAcceptedUnits(opts.tenantId, [
    mapConsignmentLotRow(row),
  ]);
  return { ok: true, lot };
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
    lotTickets: [],
  };
}

export type AcceptAndPoolResult = {
  sku: PrelovedSkuRow;
  event: PrelovedIntakeEventRow;
  defaultPrice: number;
  appliedPrice: number;
  priceAboveCap: boolean;
  lot: { id: string; ticketCode: string } | null;
};

/** True when ON CONFLICT may increment (restock qty 0, or not yet expired). */
function canAcceptOntoSku(listedAt: Date) {
  return sql`(${prelovedSkus.qtyOnHand} = 0 OR ${prelovedSkus.expiresAt} IS NULL OR ${prelovedSkus.expiresAt} >= ${listedAt})`;
}

/**
 * Pool one garment onto the (tenant, item, size, condition) SKU.
 * ON CONFLICT increments qty_on_hand on the existing row (same id).
 * Restock after qty 0 restarts listedAt/expiresAt, recopies donatedGstFree
 * (or taxable when the unit is consigned), and applies the new price (and
 * defectNote when sent). Pooling onto in-stock qty only increments qty_on_hand.
 * Accept onto expired in-stock qty is refused until write-off (qty 0).
 * A consignment lot writes source=consignment plus a consignment_items row so
 * later sold-line remittance can attribute the unit. SKU upsert, accepted
 * event, and optional item insert run in one db.batch.
 * The event is INSERT … SELECT of the eligible unique-key row because batch
 * queries are composed before INSERT … RETURNING is available, and a VALUES
 * insert would still write an event when the conflict WHERE no-ops.
 */
export async function acceptAndPool(
  input: AcceptAndPoolInput,
): Promise<AcceptAndPoolResult> {
  const settings = await getPrelovedSettings(input.tenantId);
  const lotId = input.consignmentLotId?.trim() || null;
  let lot: ConsignmentLotRow | null = null;
  if (lotId) {
    if (!isConsignmentIntakeMode(settings.intakeMode)) {
      throw new PrelovedConsignmentNotEnabledError();
    }
    lot = await getConsignmentLot(input.tenantId, lotId);
    if (!lot) {
      throw new PrelovedConsignmentLotNotFoundError();
    }
  }

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
    gstFree: sql`CASE WHEN ${prelovedSkus.qtyOnHand} = 0 THEN ${lot ? false : settings.donatedGstFree} ELSE ${prelovedSkus.gstFree} END`,
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
      gstFree: lot ? false : settings.donatedGstFree,
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

  const eventId = randomUUID();
  const sourceSql = lot
    ? sql`'consignment'::preloved_intake_source`
    : sql`${PRELOVED_INTAKE_SOURCE}::preloved_intake_source`;
  const lotIdSql = lot ? sql`${lot.id}::uuid` : sql`null::uuid`;
  const eligibleSku = and(
    eq(prelovedSkus.tenantId, input.tenantId),
    eq(prelovedSkus.sourceItemId, input.sourceItemId),
    eq(prelovedSkus.size, input.size),
    eq(prelovedSkus.condition, input.condition),
    canAcceptOntoSku(listedAt),
  );

  const eventInsert = db
    .insert(prelovedIntakeEvents)
    .select(
      db
        .select({
          id: sql`${eventId}::uuid`.as("id"),
          tenantId: prelovedSkus.tenantId,
          prelovedSkuId: prelovedSkus.id,
          sourceItemId: prelovedSkus.sourceItemId,
          size: prelovedSkus.size,
          condition: prelovedSkus.condition,
          source: sourceSql.as("source"),
          consignmentLotId: lotIdSql.as("consignmentLotId"),
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
        .where(eligibleSku),
    )
    .returning();

  const itemInsert = lot
    ? db
        .insert(consignmentItems)
        .select(
          db
            .select({
              id: sql`${randomUUID()}::uuid`.as("id"),
              tenantId: prelovedSkus.tenantId,
              lotId: sql`${lot.id}::uuid`.as("lotId"),
              prelovedSkuId: prelovedSkus.id,
              intakeEventId: sql`${eventId}::uuid`.as("intakeEventId"),
              sourceItemId: prelovedSkus.sourceItemId,
              size: prelovedSkus.size,
              condition: prelovedSkus.condition,
              qty: sql<number>`1::int`.as("qty"),
              soldOrderLineId: sql`null::uuid`.as("soldOrderLineId"),
              createdAt: sql`now()`.as("createdAt"),
            })
            .from(prelovedSkus)
            .where(eligibleSku),
        )
        .returning()
    : null;

  const [skuRows, eventRows, itemRows] = itemInsert
    ? await db.batch([skuUpsert, eventInsert, itemInsert])
    : [...(await db.batch([skuUpsert, eventInsert])), undefined];
  const sku = skuRows[0];
  const event = eventRows[0];

  if (!sku) {
    throw new PrelovedExpiredStockError();
  }
  if (!event) {
    throw new Error("Failed to record preloved intake event");
  }
  if (lot && (!itemRows || !itemRows[0])) {
    throw new Error("Failed to attribute consignment intake to the lot");
  }

  return {
    sku,
    event,
    defaultPrice,
    appliedPrice,
    priceAboveCap,
    lot: lot ? { id: lot.id, ticketCode: lot.ticketCode } : null,
  };
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
 * Zero leftover expired stock and record that leftover as written_off.
 * neon-http cannot wrap the qty update + event insert in an interactive
 * transaction. Qty already 0 is treated as cleared (sold or previously
 * written off). Do not reconstruct written_off from accepted-this-listing —
 * paid CAS zeros qty without an intake sold event, so that sum would count
 * sold units as written off.
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

  if (
    !existing ||
    existing.qtyOnHand <= 0 ||
    !isExpiredForWriteOff(existing, now)
  ) {
    throw new PrelovedWriteOffNotEligibleError();
  }

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
  return attachLotTickets(tenantId, rows.map(mapStockListItem));
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
  return attachLotTickets(tenantId, rows.map(mapStockListItem));
}

export type DecrementPrelovedLine = {
  prelovedSkuId?: string | null;
  qty: number;
};

export type DecrementPrelovedForPaymentIntentResult =
  | "applied"
  | "already-applied"
  | "noop";

function collectPrelovedDecrementLines(
  lines: ReadonlyArray<DecrementPrelovedLine>,
): { skuId: string; qty: number }[] {
  const qtyBySku = new Map<string, number>();
  for (const line of lines) {
    if (typeof line.prelovedSkuId !== "string") continue;
    const skuId = line.prelovedSkuId.trim();
    if (!skuId || !SHOP_SKU_ID_RE.test(skuId)) continue;
    if (!Number.isInteger(line.qty) || line.qty <= 0) continue;
    qtyBySku.set(skuId, (qtyBySku.get(skuId) ?? 0) + line.qty);
  }
  return [...qtyBySku.entries()].map(([skuId, qty]) => ({ skuId, qty }));
}

/**
 * CAS-decrement preloved qty for a succeeded PaymentIntent.
 * One SQL statement (neon-http: never db.transaction). Empty / new-only
 * lines no-op and do not insert a claim row. Same-PI retries take
 * pg_advisory_xact_lock(hashtext(pi)) so they serialize without an unclaim
 * DELETE of a sibling INSERT (WITH writes are invisible except via
 * RETURNING). Claim INSERT runs only after UPDATE RETURNING shows every
 * requested SKU decremented. already-applied means that claim row exists
 * from a prior successful decrement, never from a failed CAS. Competing
 * PIs for the last unit: one applied, the other throws
 * PrelovedInsufficientQtyError.
 */
export async function decrementPrelovedForPaymentIntent(input: {
  paymentIntentId: string;
  tenantId: string;
  lines: ReadonlyArray<DecrementPrelovedLine>;
}): Promise<DecrementPrelovedForPaymentIntentResult> {
  const paymentIntentId = input.paymentIntentId.trim();
  const tenantId = input.tenantId.trim();
  if (!paymentIntentId || !tenantId) {
    throw new Error("paymentIntentId and tenantId are required");
  }

  const requestedLines = collectPrelovedDecrementLines(input.lines);
  if (requestedLines.length === 0) return "noop";

  const valueRows = requestedLines.map(
    (line) => sql`(${line.skuId}::uuid, ${line.qty}::int)`,
  );

  type DecrementRow = { status: string };
  let result: { rows: DecrementRow[] };
  try {
    result = (await db.execute(sql`
      WITH lock AS (
        SELECT pg_advisory_xact_lock(hashtext(${paymentIntentId})::bigint) AS held
      ),
      requested AS (
        SELECT sku_id, SUM(qty)::int AS qty
        FROM (VALUES ${sql.join(valueRows, sql`, `)}) AS t(sku_id, qty)
        GROUP BY sku_id
      ),
      already AS (
        SELECT d.payment_intent_id
        FROM preloved_paid_decrements d
        WHERE d.payment_intent_id = ${paymentIntentId}
          AND EXISTS (SELECT 1 FROM lock)
      ),
      locked AS (
        SELECT s.id, r.qty, s.qty_on_hand
        FROM requested r
        INNER JOIN preloved_skus s
          ON s.id = r.sku_id AND s.tenant_id = ${tenantId}
        WHERE NOT EXISTS (SELECT 1 FROM already)
          AND EXISTS (SELECT 1 FROM lock)
        ORDER BY s.id
        FOR UPDATE OF s
      ),
      ok AS (
        SELECT
          COUNT(*) = (SELECT COUNT(*) FROM requested)
          AND COALESCE(BOOL_AND(locked.qty_on_hand >= locked.qty), false)
          AS all_ok
        FROM locked
      ),
      decremented AS (
        UPDATE preloved_skus s
        SET qty_on_hand = s.qty_on_hand - l.qty
        FROM locked l, ok
        WHERE s.id = l.id
          AND ok.all_ok
          AND s.qty_on_hand >= l.qty
        RETURNING s.id
      ),
      claimed AS (
        INSERT INTO preloved_paid_decrements (payment_intent_id, tenant_id)
        SELECT ${paymentIntentId}, ${tenantId}
        WHERE COALESCE((SELECT all_ok FROM ok), false)
          AND (SELECT COUNT(*) FROM decremented) = (SELECT COUNT(*) FROM requested)
          AND NOT EXISTS (SELECT 1 FROM already)
        RETURNING payment_intent_id
      )
      SELECT
        CASE
          WHEN EXISTS (SELECT 1 FROM already) THEN 'already-applied'
          WHEN EXISTS (SELECT 1 FROM claimed)
            AND (SELECT COUNT(*) FROM decremented) = (SELECT COUNT(*) FROM requested)
            THEN 'applied'
          ELSE 'insufficient'
        END AS status
    `)) as { rows: DecrementRow[] };
  } catch (error) {
    // Concurrent same-PI: this statement's UPDATE rolled back on PK
    // conflict; the winner already claimed after a successful decrement.
    if (isUniqueConstraintError(error, "preloved_paid_decrements_pkey")) {
      return "already-applied";
    }
    throw error;
  }

  const status = result.rows[0]?.status;
  if (status === "applied" || status === "already-applied") return status;
  if (status === "insufficient") throw new PrelovedInsufficientQtyError();
  throw new Error(`Unexpected preloved decrement status: ${String(status)}`);
}
