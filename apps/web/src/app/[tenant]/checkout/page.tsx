import { notFound, redirect } from "next/navigation";
import { TENANTS, type TenantId } from "@/lib/data";
import { MobileShell } from "@/components/mobile-shell";
import { CheckoutScreen } from "./checkout-screen";
import { getSessionUser } from "@/lib/auth/authorization";

export default async function CheckoutPage({ params }: PageProps<"/[tenant]/checkout">) {
  const { tenant: tid } = await params;
  if (!(tid in TENANTS)) notFound();

  const user = await getSessionUser();
  if (!user) {
    redirect(`/auth/sign-in?callbackURL=${encodeURIComponent(`/${tid}/checkout`)}`);
  }

  const tenant = TENANTS[tid as TenantId];
  return (
    <MobileShell bg="var(--color-paper)">
      <CheckoutScreen tenant={tenant} />
    </MobileShell>
  );
}
