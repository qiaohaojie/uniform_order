import { notFound, redirect } from "next/navigation";
import { TENANTS, type TenantId } from "@/lib/data";
import { MobileShell } from "@/components/mobile-shell";
import { CheckoutScreen } from "./checkout-screen";
import { getSessionUser } from "@/lib/auth/authorization";
import { getActiveChild } from "@/lib/active-child.server";

export default async function CheckoutPage({ params }: PageProps<"/[tenant]/checkout">) {
  const { tenant: tid } = await params;
  if (!(tid in TENANTS)) notFound();

  const [user, active] = await Promise.all([getSessionUser(), getActiveChild()]);
  if (!user) {
    redirect(`/auth/sign-in?callbackURL=${encodeURIComponent(`/${tid}/checkout`)}`);
  }

  const tenant = TENANTS[tid as TenantId];

  const prefill =
    active && active.tenantId === tid
      ? {
          studentName: active.name,
          year: `Year ${active.year}`,
          rollClass: active.rollClass ?? "",
        }
      : null;

  return (
    <MobileShell bg="var(--color-paper)">
      <CheckoutScreen tenant={tenant} prefill={prefill} />
    </MobileShell>
  );
}
