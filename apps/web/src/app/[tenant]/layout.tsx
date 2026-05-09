import { notFound } from "next/navigation";
import { getTenant } from "@/db/queries";

export default async function TenantLayout({ params, children }: LayoutProps<"/[tenant]">) {
  // Layout validates the slug exists. Visibility gating (isPubliclyListed +
  // approval) is enforced per-route on browsing pages (catalog, item) so that
  // historical/transactional routes (cart, checkout, order/placed) stay
  // accessible for parents whose tenant later goes hidden.
  const { tenant } = await params;
  const tenantRecord = await getTenant(tenant);
  if (!tenantRecord) notFound();

  return <>{children}</>;
}
