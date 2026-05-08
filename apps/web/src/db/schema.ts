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
} from "drizzle-orm/pg-core";
import { neonAuthUsers } from "./external-schema";

// ─── Enums ───────────────────────────────────────────────────────────────────
export const orderStatusEnum = pgEnum("order_status", [
  "pending_payment",
  "new",
  "packing",
  "ready",
  "collected",
  "partially_refunded",
  "refunded",
]);

export const deliveryMethodEnum = pgEnum("delivery_method", [
  "pickup",
  "ship",
]);

// ─── Tenants ─────────────────────────────────────────────────────────────────
export const tenants = pgTable("tenants", {
  id: text("id").primaryKey(), // e.g. "nsbh"
  name: text("name").notNull(),
  short: text("short").notNull(),
  accent: text("accent").notNull().default("#7A1F2B"),
  motto: text("motto"),
  address: text("address"),
  shopHours: text("shop_hours"),
  shopEmail: text("shop_email"),
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
  sizeGuide: jsonb("size_guide"), // array of {label, chest, waist, hip}
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Catalog variants (size/colour options with price) ───────────────────────
export const catalogVariants = pgTable("catalog_variants", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: text("item_id")
    .notNull()
    .references(() => catalogItems.id, { onDelete: "cascade" }),
  label: text("label").notNull(), // e.g. "Size 8", "Small"
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  active: boolean("active").notNull().default(true),
});

// ─── Orders ──────────────────────────────────────────────────────────────────
export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey(), // e.g. "NSBH-04298"
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    // Parent details
    parentName: text("parent_name").notNull(),
    parentEmail: text("parent_email").notNull(),
    parentMobile: text("parent_mobile").notNull(),
    // Student details
    studentName: text("student_name").notNull(),
    studentYear: text("student_year").notNull(),
    studentRoll: text("student_roll").notNull(),
    // Delivery
    delivery: deliveryMethodEnum("delivery").notNull().default("pickup"),
    deliveryFee: numeric("delivery_fee", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    // Financials
    subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
    gst: numeric("gst", { precision: 10, scale: 2 }).notNull(),
    total: numeric("total", { precision: 10, scale: 2 }).notNull(),
    // Stripe
    // NOTE: unique index on a nullable column — multiple NULLs are allowed in PostgreSQL
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripeRef: text("stripe_ref"),
    // Legal
    refundPolicyAcceptedAt: timestamp("refund_policy_accepted_at"),
    // Optional note from parent to school
    parentNote: text("parent_note"),
    // Status
    emailsSent: jsonb("emails_sent").notNull().default(sql`'{}'::jsonb`),
    status: orderStatusEnum("status").notNull().default("pending_payment"),
    // Auth link (optional — if parent was signed in)
    userId: uuid("user_id").references(() => neonAuthUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    stripePaymentIntentIdUnique: uniqueIndex("orders_stripe_payment_intent_id_unique").on(
      table.stripePaymentIntentId
    ),
    tenantParentEmailIdx: index("idx_orders_tenant_parent_email").on(table.tenantId, table.parentEmail),
  })
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
