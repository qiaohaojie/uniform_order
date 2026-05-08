import { z } from "zod";

export const ITEM_CATEGORIES = [
  "Summer",
  "Winter",
  "Sports",
  "Formal",
  "Bags",
  "Stationery",
] as const;

export const catalogVariantInputSchema = z.object({
  label: z.string().trim().min(1).max(40),
  price: z.number().positive().max(10000),
  active: z.boolean().optional(),
});

export const catalogItemInputSchema = z.object({
  tenantId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  category: z.enum(ITEM_CATEGORIES),
  description: z.string().trim().max(500).optional(),
  imageUrl: z.string().url().optional(),
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
