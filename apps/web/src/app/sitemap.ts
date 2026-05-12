import type { MetadataRoute } from "next";
import { getPubliclyListedTenants, getActiveCatalog } from "@/db/queries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://uniformorder.online";
  const tenantList = (await getPubliclyListedTenants()).filter(
    (t) => t.platformApprovalStatus === "approved",
  );
  const perTenant = await Promise.all(
    tenantList.map(async (tenant) => {
      const items = await getActiveCatalog(tenant.id);
      return [
        { url: `${base}/${tenant.id}`, changeFrequency: "weekly" as const },
        { url: `${base}/${tenant.id}/contact`, changeFrequency: "monthly" as const },
        ...items.map((item) => ({
          url: `${base}/${tenant.id}/item/${item.id}`,
          changeFrequency: "weekly" as const,
        })),
      ];
    }),
  );
  return perTenant.flat();
}
