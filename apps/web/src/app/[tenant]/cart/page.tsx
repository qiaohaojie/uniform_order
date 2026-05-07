import { notFound } from "next/navigation";
import { TENANTS, type TenantId } from "@/lib/data";
import { MobileShell } from "@/components/mobile-shell";
import { CartScreen } from "./cart-screen";
import { getActiveChild } from "@/lib/active-child.server";

export default async function CartPage({ params }: PageProps<"/[tenant]/cart">) {
  const { tenant: tid } = await params;
  if (!(tid in TENANTS)) notFound();
  const tenant = TENANTS[tid as TenantId];
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
