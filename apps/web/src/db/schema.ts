import {
  pgTable,
  pgSchema,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  jsonb,
  uuid,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ─── Neon Auth schema reference ─────────────────────────────────────────────
export const neonAuthSchema = pgSchema("neon_auth");

export const neonAuthUsers = neonAuthSchema.table("user", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email"),
  emailVerified: boolean("email_verified"),
  image: text("image"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

// ─── Enums ───────────────────────────────────────────────────────────────────
export const orderStatusEnum = pgEnum("order_status", [
  "new",
  "packing",
  "ready",
  "collected",
]);

export const deliveryMethodEnum = pgEnum("delivery_method", [
  "pickup",
  "ship",
]);

// ─── Tenants ─────────────────────────────────────────────────────────────────
export const tenants = pgTable("tenants", {
  id: text("id").primaryKey(), // e.g. "imhs"
  name: text("name").notNull(),
  short: text("short").notNull(),
  accent: text("accent").notNull().default("#7A1F2B"),
  motto: text("motto"),
  address: text("address"),
  shopHours: text("shop_hours"),
  shopEmail: text("shop_email"),
  // Stripe Connect
  stripeAccountId: text("stripe_account_id"),
  stripePayoutsEnabled: boolean("stripe_payouts_enabled").default(false),
  stripeChargesEnabled: boolean("stripe_charges_enabled").default(false),
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
    id: text("id").primaryKey(), // e.g. "IMHS-04298"
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
    // Status
    status: orderStatusEnum("status").notNull().default("new"),
    // Auth link (optional — if parent was signed in)
    userId: text("user_id").references(() => neonAuthUsers.id),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    stripePaymentIntentIdUnique: uniqueIndex("orders_stripe_payment_intent_id_unique").on(
      table.stripePaymentIntentId
    ),
  })
);

// ─── Order line items ─────────────────────────────────────────────────────────
export const orderLines = pgTable("order_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  itemId: text("item_id").notNull(),
  itemName: text("item_name").notNull(),
  variantLabel: text("variant_label").notNull(),
  qty: integer("qty").notNull().default(1),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  lineTotal: numeric("line_total", { precision: 10, scale: 2 }).notNull(),
});
