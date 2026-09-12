import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  jsonb,
  uuid,
  pgEnum,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { neonAuthUsers } from "./external-schema";

// ─── Enums ───────────────────────────────────────────────────────────────────
export const orderFulfilmentStatusEnum = pgEnum("order_fulfilment_status", [
  "to_prepare",
  "ready",
  "needs_attention",
  "completed",
]);

export const orderPaymentStatusEnum = pgEnum("order_payment_status", [
  "pending",
  "paid",
  "partially_refunded",
  "refunded",
]);

export const orderCompletionTypeEnum = pgEnum("order_completion_type", [
  "collected",
  "shipped",
  "manual",
]);

export const orderFulfilmentMethodEnum = pgEnum("order_fulfilment_method", [
  "pickup",
  "shipping",
]);

export const workflowModeEnum = pgEnum("workflow_mode", [
  "standard",
  "simple",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "ready",
  "hold",
  "refund",
]);

export const notificationStatusEnum = pgEnum("notification_status", [
  "queued",
  "sent",
  "failed",
  "skipped",
]);

export const orderEventTypeEnum = pgEnum("order_event_type", [
  "order_paid",
  "pick_slip_printed",
  "status_changed",
  "ready_email_sent",
  "hold_email_sent",
  "refund_email_sent",
  "refund_created",
  "refund_failed",
  "order_reopened",
]);

export const policyModeEnum = pgEnum("policy_mode", ["text", "url"]);

export const prelovedIntakeModeEnum = pgEnum("preloved_intake_mode", [
  "donation_only",
  "donation_and_consignment",
]);

export const prelovedConditionEnum = pgEnum("preloved_condition", [
  "good",
  "fair",
]);

export const prelovedIntakeSourceEnum = pgEnum("preloved_intake_source", [
  "donation",
]);

export const prelovedIntakeActionEnum = pgEnum("preloved_intake_action", [
  "accepted",
  "rejected",
  "written_off",
]);

export const consignmentPayoutPreferenceEnum = pgEnum(
  "consignment_payout_preference",
  ["eft", "school_fee_credit", "donate_proceeds"],
);

export const consignmentUnsoldPreferenceEnum = pgEnum(
  "consignment_unsold_preference",
  ["donate", "collect"],
);

export const consignmentLotPayoutStatusEnum = pgEnum(
  "consignment_lot_payout_status",
  ["pending", "school_fee_credited", "eft_paid", "donated_proceeds"],
);

// ─── Tenant legal versions ───────────────────────────────────────────────────
// IMPORTANT: defined before `tenants` because `tenants.current_legal_version_id`
// needs the FK target in scope. The opposite-direction FK (tenantId → tenants.id)
// is enforced via the SQL ALTER TABLE in the migration only — the Drizzle column
// stays as plain `text("tenant_id")` with no .references() callback to avoid the
// hoisting cycle. FK integrity is preserved at the DB layer.
export const tenantLegalVersions = pgTable(
  "tenant_legal_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: text("tenant_id").notNull(), // FK enforced via SQL only — see note above
    version: integer("version").notNull(),
    policyMode: policyModeEnum("policy_mode").notNull(),
    policyText: text("policy_text"),
    policyUrl: text("policy_url"),
    aclAcknowledged: boolean("acl_acknowledged").notNull(),
    sellerOfRecordAcknowledged: boolean("seller_of_record_acknowledged").notNull(),
    declarantName: text("declarant_name").notNull(),
    declarantRole: text("declarant_role").notNull(),
    enteredByUserId: uuid("entered_by_user_id").notNull(), // FK enforced via SQL only
    enteredByEmail: text("entered_by_email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantVersionUnique: uniqueIndex("tenant_legal_versions_tenant_version_unique").on(
      t.tenantId,
      t.version,
    ),
  }),
);

// ─── Tenants ─────────────────────────────────────────────────────────────────
export const tenants = pgTable("tenants", {
  id: text("id").primaryKey(), // e.g. "imhs"
  name: text("name").notNull(),
  short: text("short").notNull(),
  accent: text("accent").notNull().default("#7A1F2B"),
  logoUrl: text("logo_url"),  // nullable; Crest renders from initials when null
  motto: text("motto"),
  address: text("address"),
  shopHours: text("shop_hours"),
  shopEmail: text("shop_email"),
  timezone: text("timezone").notNull().default("Australia/Sydney"),
  collectionInstructions: text("collection_instructions"),
  // Marketplace visibility
  isPubliclyListed: boolean("is_publicly_listed").notNull().default(false),
  // Stripe Connect
  stripeAccountId: text("stripe_account_id"),
  stripePayoutsEnabled: boolean("stripe_payouts_enabled").default(false),
  stripeChargesEnabled: boolean("stripe_charges_enabled").default(false),
  // Platform approval gate (Stripe Connect compliance)
  platformApprovalStatus: text("platform_approval_status").notNull().default("pending"),
  platformApprovedAt: timestamp("platform_approved_at"),
  platformApprovedBy: text("platform_approved_by"),
  platformRejectionReason: text("platform_rejection_reason"),
  // Current legal/refund-policy version (FK enforced via SQL ALTER, not Drizzle)
  currentLegalVersionId: uuid("current_legal_version_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Catalog items ───────────────────────────────────────────────────────────
export const catalogItems = pgTable("catalog_items", {
  id: text("id").primaryKey(), // e.g. "blazer-m"
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull(), // "Winter" | "Summer" | "Sports" | "Formal" | "Bags" | "Stationery"
  description: text("description"),
  imageUrl: text("image_url"),
  sizeGuide: jsonb("size_guide"), // { unit: string; cols: string[]; rows: string[][] } | null
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Catalog variants (size/colour options with price) ───────────────────────
export const catalogVariants = pgTable(
  "catalog_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: text("item_id")
      .notNull()
      .references(() => catalogItems.id, { onDelete: "cascade" }),
    label: text("label").notNull(), // e.g. "Size 8", "Small"
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    sizes: jsonb("sizes").$type<string[]>().notNull().default([]),
    active: boolean("active").notNull().default(true),
  },
  (t) => ({
    // getCatalogPriceLookup keys order-line pricing on (itemId,label); two ACTIVE
    // variants sharing a label would let an order line bind to an arbitrary price.
    // Enforce uniqueness among active variants only (inactive/archived may repeat).
    itemLabelActiveUnique: uniqueIndex("catalog_variants_item_label_active_unique")
      .on(t.itemId, t.label)
      .where(sql`${t.active} = true`),
  }),
);

// ─── Preloved (donation rack) ────────────────────────────────────────────────
// Qty lives only on preloved SKUs. Do not add inventory to catalog_variants.
export const tenantPrelovedSettings = pgTable("tenant_preloved_settings", {
  tenantId: text("tenant_id")
    .primaryKey()
    .references(() => tenants.id, { onDelete: "cascade" }),
  prelovedEnabled: boolean("preloved_enabled").notNull().default(false),
  intakeMode: prelovedIntakeModeEnum("intake_mode")
    .notNull()
    .default("donation_only"),
  priceFractionOfNew: numeric("price_fraction_of_new", {
    precision: 4,
    scale: 2,
  })
    .notNull()
    .default("0.50"),
  holdDays: integer("hold_days").notNull().default(365),
  donatedGstFree: boolean("donated_gst_free").notNull().default(false),
  refuseList: jsonb("refuse_list")
    .$type<string[]>()
    .notNull()
    .default(sql`'["socks","swimwear","hats"]'::jsonb`),
  commissionBps: integer("commission_bps").notNull().default(5000),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const prelovedSkus = pgTable(
  "preloved_skus",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    sourceItemId: text("source_item_id")
      .notNull()
      .references(() => catalogItems.id, { onDelete: "restrict" }),
    size: text("size").notNull(),
    condition: prelovedConditionEnum("condition").notNull(),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    qtyOnHand: integer("qty_on_hand").notNull().default(0),
    gstFree: boolean("gst_free").notNull().default(false),
    active: boolean("active").notNull().default(true),
    imageUrl: text("image_url"),
    defectNote: text("defect_note"),
    listedAt: timestamp("listed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => ({
    tenantItemSizeConditionUnique: uniqueIndex(
      "preloved_skus_tenant_item_size_condition_unique",
    ).on(t.tenantId, t.sourceItemId, t.size, t.condition),
    tenantExpiresAtIdx: index("idx_preloved_skus_tenant_expires_at").on(
      t.tenantId,
      t.expiresAt,
    ),
    qtyOnHandNonNegative: check(
      "preloved_skus_qty_on_hand_non_negative",
      sql`${t.qtyOnHand} >= 0`,
    ),
  }),
);

export const prelovedIntakeEvents = pgTable(
  "preloved_intake_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    prelovedSkuId: uuid("preloved_sku_id").references(() => prelovedSkus.id, {
      onDelete: "set null",
    }),
    sourceItemId: text("source_item_id").references(() => catalogItems.id, {
      onDelete: "set null",
    }),
    size: text("size"),
    condition: prelovedConditionEnum("condition"),
    source: prelovedIntakeSourceEnum("source").notNull().default("donation"),
    action: prelovedIntakeActionEnum("action").notNull(),
    qty: integer("qty").notNull(),
    rejectReason: text("reject_reason"),
    actorId: uuid("actor_id").references(() => neonAuthUsers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tenantTimeIdx: index("idx_preloved_intake_events_tenant_time").on(
      t.tenantId,
      t.createdAt,
    ),
    skuTimeIdx: index("idx_preloved_intake_events_sku_time").on(
      t.prelovedSkuId,
      t.createdAt,
    ),
  }),
);

// Parent drop-off bag note. A message to operators — not a listing.
// No preloved_sku_id; intake_action is unchanged.
export const prelovedDonationNotes = pgTable(
  "preloved_donation_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    parentName: text("parent_name").notNull(),
    studentName: text("student_name").notNull(),
    bagCount: integer("bag_count").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    bagCountRange: check(
      "preloved_donation_notes_bag_count_range",
      sql`${t.bagCount} >= 1 AND ${t.bagCount} <= 20`,
    ),
  }),
);

// Idempotency key for paid preloved CAS decrements. One row per PaymentIntent;
// qty lives only on preloved_skus — catalog_variants still has no qty column.
export const prelovedPaidDecrements = pgTable("preloved_paid_decrements", {
  paymentIntentId: text("payment_intent_id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Phase 2 consignment lot (paper-form digital twin). Operator still inspects
// each garment; items JSON is the parent's declared list, not stock.
export const consignmentLots = pgTable(
  "consignment_lots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    ticketCode: text("ticket_code").notNull(),
    familyName: text("family_name").notNull(),
    studentName: text("student_name").notNull(),
    email: text("email").notNull(),
    mobile: text("mobile").notNull(),
    payoutPreference: consignmentPayoutPreferenceEnum("payout_preference").notNull(),
    bankBsb: text("bank_bsb"),
    bankAccountName: text("bank_account_name"),
    bankAccountNumber: text("bank_account_number"),
    unsoldPreference: consignmentUnsoldPreferenceEnum("unsold_preference").notNull(),
    items: jsonb("items")
      .$type<{ garment: string; size: string }[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }).notNull(),
    payoutStatus: consignmentLotPayoutStatusEnum("payout_status")
      .notNull()
      .default("pending"),
    payoutMarkedAt: timestamp("payout_marked_at", { withTimezone: true }),
    payoutMarkedBy: uuid("payout_marked_by").references(() => neonAuthUsers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tenantTicketUnique: uniqueIndex("consignment_lots_tenant_ticket_unique").on(
      t.tenantId,
      t.ticketCode,
    ),
    tenantTimeIdx: index("idx_consignment_lots_tenant_time").on(
      t.tenantId,
      t.createdAt,
    ),
  }),
);

// ─── Pending order snapshots ─────────────────────────────────────────────────
/**
 * Server-authoritative per-line price snapshot, written at PaymentIntent
 * creation and consumed by POST /api/orders when the order is finalised.
 *
 * The order TOTAL is Stripe-locked (verified against the PaymentIntent), but
 * without this table the per-line breakdown could only come from the client
 * body — letting a caller reshuffle prices across lines (sum unchanged) and
 * shape the amounts that drive receipts and partial-refund math. The prices
 * here are the catalog / preloved SKU prices `assertTotalsMatch` validated at
 * PI creation, so they are exactly what backed the charge — and, unlike a live
 * catalog re-read at order-POST time, they cannot drift if an operator edits a
 * price in between. `gstFree` is required on new writes; legacy JSON without it
 * is treated as taxable. No new SQL — this is jsonb shape only.
 */
export type PendingOrderLineSnapshot = {
  itemId: string;
  itemName: string;
  variantLabel: string;
  size: string | null;
  qty: number;
  /** Catalog or preloved SKU price in AUD dollars at PI creation. */
  unitPrice: number;
  /** Server-authored. Required on new writes; missing on legacy snapshots means taxable. */
  gstFree: boolean;
  prelovedSkuId?: string | null;
  condition?: "good" | "fair" | null;
};

export const pendingOrderSnapshots = pgTable(
  "pending_order_snapshots",
  {
    paymentIntentId: text("payment_intent_id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => neonAuthUsers.id, {
      onDelete: "cascade",
    }),
    fulfilmentMethod: orderFulfilmentMethodEnum("fulfilment_method").notNull(),
    subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
    gst: numeric("gst", { precision: 10, scale: 2 }).notNull(),
    total: numeric("total", { precision: 10, scale: 2 }).notNull(),
    linesJson: jsonb("lines_json")
      .$type<PendingOrderLineSnapshot[]>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // Abandoned checkouts leave rows behind; index the age so they can be swept.
    createdAtIdx: index("idx_pending_order_snapshots_created_at").on(t.createdAt),
  }),
);

// ─── Orders ──────────────────────────────────────────────────────────────────
export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey(), // e.g. "IMHS-04298"
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    // Parent
    parentName: text("parent_name").notNull(),
    parentEmail: text("parent_email").notNull(),
    parentMobile: text("parent_mobile").notNull(),
    // Student
    studentName: text("student_name").notNull(),
    studentYear: text("student_year").notNull(),
    studentRoll: text("student_roll").notNull(),
    // Fulfilment
    fulfilmentMethod: orderFulfilmentMethodEnum("fulfilment_method")
      .notNull()
      .default("pickup"),
    fulfilmentStatus: orderFulfilmentStatusEnum("fulfilment_status")
      .notNull()
      .default("to_prepare"),
    completionType: orderCompletionTypeEnum("completion_type"),
    deliveryFee: numeric("delivery_fee", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    // Financials
    subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
    gst: numeric("gst", { precision: 10, scale: 2 }).notNull(),
    total: numeric("total", { precision: 10, scale: 2 }).notNull(),
    refundedAmountCents: integer("refunded_amount_cents").notNull().default(0),
    // Stripe + payment
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripeRef: text("stripe_ref"),
    paymentStatus: orderPaymentStatusEnum("payment_status")
      .notNull()
      .default("pending"),
    // Legal
    refundPolicyAcceptedAt: timestamp("refund_policy_accepted_at"),
    parentNote: text("parent_note"),
    // Notification cache (source of truth lives in order_notification_events)
    emailsSent: jsonb("emails_sent").notNull().default(sql`'{}'::jsonb`),
    // Timestamps
    readyAt: timestamp("ready_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    pickSlipPrintedAt: timestamp("pick_slip_printed_at", { withTimezone: true }),
    pickSlipPrintedBy: uuid("pick_slip_printed_by").references(
      () => neonAuthUsers.id,
      { onDelete: "set null" },
    ),
    // Auth + audit
    userId: uuid("user_id").references(() => neonAuthUsers.id, { onDelete: "set null" }),
    legalVersionId: uuid("legal_version_id"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    stripePaymentIntentIdUnique: uniqueIndex("orders_stripe_payment_intent_id_unique").on(
      table.stripePaymentIntentId,
    ),
    tenantParentEmailIdx: index("idx_orders_tenant_parent_email").on(
      table.tenantId,
      table.parentEmail,
    ),
    tenantFulfilmentStatusIdx: index("idx_orders_tenant_fulfilment_status").on(
      table.tenantId,
      table.fulfilmentStatus,
    ),
  }),
);

// ─── Order line items ─────────────────────────────────────────────────────────
export const orderLines = pgTable(
  "order_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    itemId: text("item_id").notNull(),
    itemName: text("item_name").notNull(),
    variantLabel: text("variant_label").notNull(),
    size: text("size"),
    qty: integer("qty").notNull().default(1),
    unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
    lineTotal: numeric("line_total", { precision: 10, scale: 2 }).notNull(),
    prelovedSkuId: uuid("preloved_sku_id").references(() => prelovedSkus.id, {
      onDelete: "restrict",
    }),
    gstFree: boolean("gst_free").notNull().default(false),
    condition: prelovedConditionEnum("condition"),
  },
  (t) => ({
    orderItemIdx: index("idx_order_lines_order_id_item_id").on(t.orderId, t.itemId),
  })
);

// ─── Order refunds ───────────────────────────────────────────────────────────
export const orderRefunds = pgTable(
  "order_refunds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    lineId: uuid("line_id").references(() => orderLines.id, { onDelete: "set null" }),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    reason: text("reason"),
    operatorUserId: uuid("operator_user_id").references(() => neonAuthUsers.id, { onDelete: "set null" }),
    stripeRefundId: text("stripe_refund_id"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    stripeRefundIdUnique: uniqueIndex("order_refunds_stripe_refund_id_unique").on(
      table.stripeRefundId
    ),
  })
);

// ─── Tenant settings ─────────────────────────────────────────────────────────
export const tenantSettings = pgTable("tenant_settings", {
  tenantId: text("tenant_id")
    .primaryKey()
    .references(() => tenants.id, { onDelete: "cascade" }),
  workflowMode: workflowModeEnum("workflow_mode").notNull().default("standard"),
  pickupEnabled: boolean("pickup_enabled").notNull().default(true),
  shippingEnabled: boolean("shipping_enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => neonAuthUsers.id, { onDelete: "set null" }),
});

export const tenantSettingEvents = pgTable(
  "tenant_setting_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    settingKey: text("setting_key").notNull(),
    oldValue: text("old_value"),
    newValue: text("new_value").notNull(),
    changedBy: uuid("changed_by").references(() => neonAuthUsers.id, { onDelete: "set null" }),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantTimeIdx: index("idx_tenant_setting_events_tenant_time").on(t.tenantId, t.createdAt),
  }),
);

export const orderEvents = pgTable(
  "order_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    eventType: orderEventTypeEnum("event_type").notNull(),
    fromStatus: orderFulfilmentStatusEnum("from_status"),
    toStatus: orderFulfilmentStatusEnum("to_status"),
    actorId: uuid("actor_id").references(() => neonAuthUsers.id, { onDelete: "set null" }),
    reason: text("reason"),
    metadataJson: jsonb("metadata_json").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orderTimeIdx: index("idx_order_events_order_time").on(t.orderId, t.createdAt),
    tenantTimeIdx: index("idx_order_events_tenant_time").on(t.tenantId, t.createdAt),
    // At most one order_paid event per order — lets the webhook insert the audit
    // event unconditionally + idempotently (onConflictDoNothing) so it survives
    // Stripe redelivery without leaving a gap in the audit timeline (#11).
    paidUnique: uniqueIndex("order_events_paid_unique")
      .on(t.orderId)
      .where(sql`${t.eventType} = 'order_paid'`),
  }),
);

export const orderNotificationEvents = pgTable(
  "order_notification_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    status: notificationStatusEnum("status").notNull().default("queued"),
    recipientEmail: text("recipient_email").notNull(),
    providerMessageId: text("provider_message_id"),
    failureReason: text("failure_reason"),
    metadataJson: jsonb("metadata_json").notNull().default(sql`'{}'::jsonb`),
    idempotencyKey: text("idempotency_key"),
    triggeredBy: text("triggered_by"),
    triggeredByUserId: uuid("triggered_by_user_id").references(
      () => neonAuthUsers.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
  },
  (t) => ({
    idempotencyUnique: uniqueIndex("uniq_order_notification_idempotency")
      .on(t.idempotencyKey)
      .where(sql`idempotency_key is not null`),
    orderTypeTimeIdx: index("idx_order_notification_order_type_time").on(
      t.orderId,
      t.type,
      t.createdAt,
    ),
  }),
);

// ─── Parent's saved children ─────────────────────────────────────────────────
export const parentChildren = pgTable(
  "parent_children",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentId: uuid("parent_id")
      .notNull()
      .references(() => neonAuthUsers.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    year: text("year").notNull(),                  // canonical short form: "7".."12"
    rollClass: text("roll_class"),
    lastConfirmedAt: timestamp("last_confirmed_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    parentIdx: index("parent_children_parent_idx").on(t.parentId),
  })
);

// ─── Audit events ────────────────────────────────────────────────────────────
export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    tenantId: text("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
    actorEmail: text("actor_email").notNull(),
    actorRole: text("actor_role").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    payload: jsonb("payload").default({}).notNull(),
  },
  (t) => ({
    tenantTimeIdx: index("idx_audit_events_tenant_time").on(t.tenantId, t.createdAt.desc()),
    targetIdx: index("idx_audit_events_target").on(t.targetType, t.targetId, t.createdAt.desc()),
    actorTimeIdx: index("idx_audit_events_actor_time").on(t.actorEmail, t.createdAt.desc()),
  }),
);

export type TenantRow = typeof tenants.$inferSelect;
export type TenantLegalVersionRow = typeof tenantLegalVersions.$inferSelect;
export type TenantPrelovedSettingsRow = typeof tenantPrelovedSettings.$inferSelect;
export type PrelovedSkuRow = typeof prelovedSkus.$inferSelect;
export type PrelovedIntakeEventRow = typeof prelovedIntakeEvents.$inferSelect;
export type PrelovedDonationNoteRow = typeof prelovedDonationNotes.$inferSelect;
export type ConsignmentLotRow = typeof consignmentLots.$inferSelect;
