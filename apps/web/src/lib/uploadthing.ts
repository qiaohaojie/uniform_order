import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { z } from "zod";
import { ensureTenantAccess, isPlatformAdminEmail, requireSessionUser } from "@/lib/auth/authorization";
import { getTenant } from "@/db/queries";

const f = createUploadthing();

export const uploadRouter = {
  catalogImage: f({ image: { maxFileSize: "2MB", maxFileCount: 1 } })
    .input(z.object({ tenantId: z.string().min(1) }))
    .middleware(async ({ input }) => {
      const tenant = await getTenant(input.tenantId);
      if (!tenant) throw new UploadThingError("tenant_not_found");

      const auth = await requireSessionUser();
      if ("response" in auth) {
        throw new UploadThingError("Authentication required");
      }
      const { user } = auth;

      const denied = ensureTenantAccess(user, tenant.shopEmail);
      if (denied) throw new UploadThingError("Forbidden");

      if (tenant.platformApprovalStatus !== "approved") {
        throw new UploadThingError("tenant_not_approved");
      }

      return { tenantId: input.tenantId, userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // The drawer captures `file.url` via onClientUploadComplete and
      // sends it in the catalog POST/PATCH body. UploadThing keeps the
      // file regardless of whether the catalog save succeeds; orphaned
      // files are GC'd by a future cleanup job.
      return { url: file.url, tenantId: metadata.tenantId };
    }),
  tenantLogo: f({ image: { maxFileSize: "2MB", maxFileCount: 1 } })
    .input(z.object({ tenantId: z.string().min(1) }))
    .middleware(async ({ input }) => {
      const auth = await requireSessionUser();
      if ("response" in auth) {
        throw new UploadThingError("Authentication required");
      }
      const { user } = auth;
      if (!isPlatformAdminEmail(user.email)) {
        throw new UploadThingError("Platform admin only");
      }
      return { tenantId: input.tenantId, userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { url: file.url, tenantId: metadata.tenantId };
    }),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
