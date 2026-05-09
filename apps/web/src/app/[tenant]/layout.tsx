import { notFound } from "next/navigation";
import { getTenant } from "@/db/queries";
import { getSessionUser, isPlatformAdminEmail } from "@/lib/auth/authorization";

export default async function TenantLayout({ params, children }: LayoutProps<"/[tenant]">) {
  const { tenant } = await params;
  const tenantRecord = await getTenant(tenant);
  if (!tenantRecord) notFound();

  const isVisibleToPublic =
    tenantRecord.isPubliclyListed &&
    tenantRecord.platformApprovalStatus === "approved";

  if (!isVisibleToPublic) {
    // Platform-admin escape hatch — admins always see hidden/pending tenants
    // while signed in. To preview the public 404 experience, sign out.
    const user = await getSessionUser();
    if (!user || !isPlatformAdminEmail(user.email)) notFound();
  }

  return <>{children}</>;
}
