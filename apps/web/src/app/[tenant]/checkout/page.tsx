import { notFound } from "next/navigation";
import { TENANTS, type TenantId } from "@/lib/data";
import { MobileShell } from "@/components/mobile-shell";
import { CheckoutScreen } from "./checkout-screen";

export default async function CheckoutPage({ params }: PageProps<"/[tenant]/checkout">) {
  const { tenant: tid } = await params;
  if (!(tid in TENANTS)) notFound();
  const tenant = TENANTS[tid as TenantId];
  return (
    <MobileShell bg="var(--color-paper)">
      <CheckoutScreen tenant={tenant} />
    </MobileShell>
  );
}
