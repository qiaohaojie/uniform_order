import { z } from "zod";

export const slugSchema = z
  .string()
  .min(3)
  .max(16)
  .regex(
    /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/,
    "Use lowercase letters, digits, single hyphens (no leading/trailing/consecutive); start with a letter",
  );

export const step1Schema = z.object({
  name: z.string().min(2).max(120),
  short: z.string().min(2).max(8),
  id: slugSchema,
  motto: z.string().max(200).optional(),
  address: z.string().max(300).optional(),
});

export const step2Schema = z.object({
  logoUrl: z.string().url().nullable(),
  accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

export const brandingEditSchema = z.object({
  logoUrl: z.string().url().nullable(),
  accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  motto: z.string().max(200).optional(),
});

export const step4Schema = z.object({
  shopEmail: z.string().email(),
  shopHours: z.string().max(200).optional(),
  collectionInstructions: z.string().max(800).optional(),
});

export type Step1 = z.infer<typeof step1Schema>;
export type Step2 = z.infer<typeof step2Schema>;
export type BrandingEdit = z.infer<typeof brandingEditSchema>;
export type Step4 = z.infer<typeof step4Schema>;

const baseLegalFields = {
  aclAcknowledged: z.literal(true, { error: "Required" }),
  sellerOfRecordAcknowledged: z.literal(true, { error: "Required" }),
  declarantName: z.string().min(1).max(120),
  declarantRole: z.string().min(1).max(120),
};

export const tenantLegalSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("text"),
    policyText: z.string().min(50, "Policy text must be at least 50 characters").max(20000),
    policyUrl: z.undefined().optional(),
    ...baseLegalFields,
  }),
  z.object({
    mode: z.literal("url"),
    policyUrl: z
      .string()
      .url()
      .refine((u) => {
        try {
          return new URL(u).protocol === "https:";
        } catch {
          return false;
        }
      }, "Must be HTTPS"),
    policyText: z.undefined().optional(),
    ...baseLegalFields,
  }),
]);

export type TenantLegal = z.infer<typeof tenantLegalSchema>;
