import { z } from "zod";

export const ITEM_CATEGORIES = [
  "Summer",
  "Winter",
  "Sports",
  "Formal",
  "Bags",
  "Stationery",
] as const;

// Restrict catalog images to UploadThing-hosted URLs only.
// Stored URLs that bypass our CSP allowlist would be unrenderable via
// next/image and undeletable by uploadthing-cleanup (which extracts the
// file key from the path). Enforce at the schema boundary.
const UPLOADTHING_HOST_RE = /^https:\/\/([^/]*\.)?(utfs\.io|ufs\.sh)\/f\/[^/?#]+/;

export const catalogImageUrlSchema = z
  .string()
  .url()
  .refine((u) => UPLOADTHING_HOST_RE.test(u), {
    message: "imageUrl must be an UploadThing-hosted URL",
  });

export const catalogVariantInputSchema = z.object({
  // Server-assigned id from a prior fetch — present means "update this row";
  // absent means "insert new". Omitted variants on PATCH are deleted.
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1).max(40),
  price: z.number().positive().max(10000),
  active: z.boolean().optional(),
  sizes: z.array(z.string().min(1).max(20)).max(40).default([]),
});

export const sizeGuideSchema = z
  .object({
    unit: z.string().trim().min(1).max(20),
    cols: z.array(z.string().trim().min(1).max(40)).min(1).max(8),
    rows: z
      .array(z.array(z.string().trim().max(40)).min(1).max(8))
      .min(1)
      .max(50),
  })
  .refine((g) => g.rows.every((r) => r.length === g.cols.length), {
    message: "Every row must have the same number of cells as columns",
  });

export type SizeGuideInput = z.infer<typeof sizeGuideSchema>;

export const catalogItemInputSchema = z.object({
  tenantId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  category: z.enum(ITEM_CATEGORIES),
  description: z.string().trim().max(500).nullable().optional(),
  imageUrl: catalogImageUrlSchema.nullable().optional(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
  sizeGuide: sizeGuideSchema.nullable().optional(),
  variants: z.array(catalogVariantInputSchema).min(1),
});

export const catalogItemPatchSchema = catalogItemInputSchema
  .omit({ tenantId: true })
  .partial()
  .extend({
    variants: z.array(catalogVariantInputSchema).min(1).optional(),
    sizeGuide: sizeGuideSchema.nullable().optional(),
  });

export type CatalogItemInput = z.infer<typeof catalogItemInputSchema>;
export type CatalogItemPatch = z.infer<typeof catalogItemPatchSchema>;
export type CatalogVariantInput = z.infer<typeof catalogVariantInputSchema>;

export const catalogReorderSchema = z.object({
  tenantSlug: z.string().min(1).max(64),
  orderedIds: z.array(z.string().min(1)).min(1).max(500, "Catalog too large to reorder in one request — contact support"),
});

export type CatalogReorderInput = z.infer<typeof catalogReorderSchema>;
