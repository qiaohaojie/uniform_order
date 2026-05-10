import { db } from "@/db";
import { catalogItems, catalogVariants } from "@/db/schema";
import { eq, count } from "drizzle-orm";

export type CloneResult =
  | { ok: true; copied: number }
  | { ok: false; error: string };

/**
 * Pure DB clone — NO auth check. Callers must enforce authorization
 * (server actions do; smoke scripts skip). Idempotent via dst-empty preflight.
 */
export async function cloneCatalogFromTenantUnsafe(
  srcTenantId: string,
  dstTenantId: string,
): Promise<CloneResult> {
  if (srcTenantId === dstTenantId) {
    return { ok: false, error: "Source and destination must differ" };
  }

  const [dstCountRow] = await db
    .select({ n: count() })
    .from(catalogItems)
    .where(eq(catalogItems.tenantId, dstTenantId));
  const dstCount = Number(dstCountRow?.n ?? 0);
  if (dstCount > 0) {
    return {
      ok: false,
      error: `Destination tenant already has ${dstCount} catalog item(s). Clear its catalog before re-cloning.`,
    };
  }

  const srcItems = await db.query.catalogItems.findMany({
    where: eq(catalogItems.tenantId, srcTenantId),
  });
  if (srcItems.length === 0) {
    return { ok: true as const, copied: 0 };
  }

  // Build oldId → newId map. New ID = `{dstSlug}-{tail-of-source-id}` after stripping the source slug prefix.
  const idMap = new Map<string, string>();
  for (const it of srcItems) {
    const tail = it.id.startsWith(`${srcTenantId}-`)
      ? it.id.slice(srcTenantId.length + 1)
      : it.id;
    const newId = `${dstTenantId}-${tail}`;
    idMap.set(it.id, newId);
  }

  const srcVariants = await db.query.catalogVariants.findMany({
    where: (v, { inArray }) => inArray(v.itemId, srcItems.map((i) => i.id)),
  });

  const itemsInsert = db.insert(catalogItems).values(
    srcItems.map((it) => ({
      id: idMap.get(it.id)!,
      tenantId: dstTenantId,
      name: it.name,
      category: it.category,
      description: it.description,
      imageUrl: it.imageUrl,
      sizeGuide: it.sizeGuide,
      active: it.active,
      sortOrder: it.sortOrder,
    })),
  );
  // Guard the variants insert: drizzle .values([]) throws on empty arrays.
  if (srcVariants.length > 0) {
    const variantsInsert = db.insert(catalogVariants).values(
      srcVariants.map((v) => ({
        itemId: idMap.get(v.itemId)!,
        label: v.label,
        price: v.price,
        active: v.active,
      })),
    );
    await db.batch([itemsInsert, variantsInsert]);
  } else {
    await db.batch([itemsInsert]);
  }

  return { ok: true, copied: srcItems.length };
}
