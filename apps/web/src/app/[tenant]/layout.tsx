import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTenant } from "@/db/queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string }>;
}): Promise<Metadata> {
  const { tenant: slug } = await params;
  const tenant = await getTenant(slug);
  if (!tenant) return { title: "Uniform shop" };
  return {
    title: `${tenant.name} Uniform Shop`,
    description: tenant.motto ?? `${tenant.name} parent uniform shop`,
    openGraph: {
      title: `${tenant.name} Uniform Shop`,
      description: tenant.motto ?? `${tenant.name} parent uniform shop`,
      images: tenant.logoUrl ? [{ url: tenant.logoUrl }] : [],
    },
  };
}

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
