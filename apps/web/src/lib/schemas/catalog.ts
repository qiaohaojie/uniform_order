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

export const catalogItemInputSchema = z.object({
  tenantId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  category: z.enum(ITEM_CATEGORIES),
  description: z.string().trim().max(500).nullable().optional(),
  imageUrl: catalogImageUrlSchema.nullable().optional(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
  variants: z.array(catalogVariantInputSchema).min(1),
});

export const catalogItemPatchSchema = catalogItemInputSchema
  .omit({ tenantId: true })
  .partial()
  .extend({
    variants: z.array(catalogVariantInputSchema).min(1).optional(),
  });

export type CatalogItemInput = z.infer<typeof catalogItemInputSchema>;
export type CatalogItemPatch = z.infer<typeof catalogItemPatchSchema>;
export type CatalogVariantInput = z.infer<typeof catalogVariantInputSchema>;
