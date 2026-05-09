import { notFound, redirect } from "next/navigation";
import { getTenant, toTenantBrand } from "@/db/queries";
import { MobileShell } from "@/components/mobile-shell";
import { CheckoutScreen } from "./checkout-screen";
import { getSessionUser } from "@/lib/auth/authorization";
import { getActiveChild } from "@/lib/active-child.server";

export default async function CheckoutPage({ params }: PageProps<"/[tenant]/checkout">) {
  const { tenant: slug } = await params;
  const tenantRecord = await getTenant(slug);
  if (!tenantRecord) notFound();

  const [user, active] = await Promise.all([getSessionUser(), getActiveChild()]);
  if (!user) {
    redirect(`/auth/sign-in?callbackURL=${encodeURIComponent(`/${slug}/checkout`)}`);
  }

  const tenant = toTenantBrand(tenantRecord);

  const prefill =
    active && active.tenantId === slug
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
