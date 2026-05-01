import { db, orders, orderLines, catalogItems, catalogVariants, tenants } from "./index";
import { eq, desc, ilike, or } from "drizzle-orm";

// ─── Orders ──────────────────────────────────────────────────────────────────

export async function getOrdersByTenant(tenantId: string) {
  return db
    .select()
    .from(orders)
    .where(eq(orders.tenantId, tenantId))
    .orderBy(desc(orders.createdAt));
}

export async function getOrderById(orderId: string) {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order) return null;

  const lines = await db
    .select()
    .from(orderLines)
    .where(eq(orderLines.orderId, orderId));

  return { ...order, lines };
}

export async function getOrdersByParentEmail(email: string) {
  return db
    .select()
    .from(orders)
    .where(eq(orders.parentEmail, email))
    .orderBy(desc(orders.createdAt));
}

export async function updateOrderStatus(
  orderId: string,
  status: "new" | "packing" | "ready" | "collected"
) {
  return db
    .update(orders)
    .set({ status, updatedAt: new Date() })
    .where(eq(orders.id, orderId));
}

// ─── Catalog ─────────────────────────────────────────────────────────────────

export async function getCatalogByTenant(tenantId: string) {
  const items = await db
    .select()
    .from(catalogItems)
    .where(eq(catalogItems.tenantId, tenantId))
    .orderBy(catalogItems.sortOrder);

  const variants = await db
    .select()
    .from(catalogVariants)
    .where(
      or(
        ...items.map((i) => eq(catalogVariants.itemId, i.id))
      )
    );

  return items.map((item) => ({
    ...item,
    variants: variants.filter((v) => v.itemId === item.id),
  }));
}

export async function getCatalogItemById(itemId: string) {
  const [item] = await db
    .select()
    .from(catalogItems)
    .where(eq(catalogItems.id, itemId))
    .limit(1);
  if (!item) return null;

  const variants = await db
    .select()
    .from(catalogVariants)
    .where(eq(catalogVariants.itemId, itemId));

  return { ...item, variants };
}

export async function addCatalogItem(data: {
  id: string;
  tenantId: string;
  name: string;
  category: string;
  description?: string;
  variants: { label: string; price: number }[];
}) {
  await db.insert(catalogItems).values({
    id: data.id,
    tenantId: data.tenantId,
    name: data.name,
    category: data.category,
    description: data.description,
  });

  for (const v of data.variants) {
    await db.insert(catalogVariants).values({
      itemId: data.id,
      label: v.label,
      price: String(v.price),
    });
  }
}

export async function updateCatalogItemName(itemId: string, name: string) {
  return db
    .update(catalogItems)
    .set({ name, updatedAt: new Date() })
    .where(eq(catalogItems.id, itemId));
}

export async function deleteCatalogItem(itemId: string) {
  return db.delete(catalogItems).where(eq(catalogItems.id, itemId));
}

// ─── Tenants ─────────────────────────────────────────────────────────────────

export async function getTenant(tenantId: string) {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return tenant ?? null;
}

export async function updateTenantStripe(
  tenantId: string,
  data: {
    stripeAccountId: string;
    stripePayoutsEnabled: boolean;
    stripeChargesEnabled: boolean;
  }
) {
  return db
    .update(tenants)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));
}

export async function updateTenantSettings(
  tenantId: string,
  data: {
    name?: string;
    address?: string;
    shopHours?: string;
    shopEmail?: string;
  }
) {
  return db
    .update(tenants)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));
}
