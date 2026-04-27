import { notFound } from "next/navigation";
import { TENANTS, type TenantId } from "@/lib/data";
import { MobileShell } from "@/components/mobile-shell";
import { CartScreen } from "./cart-screen";

export default async function CartPage({ params }: PageProps<"/[tenant]/cart">) {
  const { tenant: tid } = await params;
  if (!(tid in TENANTS)) notFound();
  const tenant = TENANTS[tid as TenantId];
  return (
    <MobileShell bg="var(--color-paper)">
      <CartScreen tenant={tenant} />
    </MobileShell>
  );
}
