import { notFound } from "next/navigation";
import { getTenant, toTenantBrand } from "@/db/queries";
import { MobileShell } from "@/components/mobile-shell";
import { CartScreen } from "./cart-screen";
import { getActiveChild } from "@/lib/active-child.server";

export default async function CartPage({ params }: PageProps<"/[tenant]/cart">) {
  const { tenant: slug } = await params;
  const tenantRecord = await getTenant(slug);
  if (!tenantRecord) notFound();
  const tenant = toTenantBrand(tenantRecord);
  const active = await getActiveChild();
  const activeChild =
    active && active.tenantId === tenant.id
      ? { name: active.name, year: `Year ${active.year}` }
      : null;
  return (
    <MobileShell bg="var(--color-paper)">
      <CartScreen tenant={tenant} activeChild={activeChild} />
    </MobileShell>
  );
}
