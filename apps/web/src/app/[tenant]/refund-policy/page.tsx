import Link from "next/link";
import { notFound } from "next/navigation";
import { MobileShell } from "@/components/mobile-shell";
import { TENANTS, type TenantId } from "@/lib/data";

export default async function RefundPolicyPage({
  params,
}: { params: Promise<{ tenant: string }> }) {
  const { tenant: tenantId } = await params;
  if (!(tenantId in TENANTS)) notFound();
  const tenant = TENANTS[tenantId as TenantId];

  return (
    <MobileShell>
      <main className="flex-1 px-5 py-6">
        <h1 className="font-serif text-2xl font-semibold mb-4" style={{ color: tenant.accent }}>
          {tenant.short} refund policy
        </h1>
        <div className="space-y-3 text-[14px]" style={{ color: "var(--color-ink)" }}>
          <p>We accept exchanges for incorrect sizes or faulty items within 14 days of collection or delivery.</p>
          <p>Items must be in original condition, with tags attached and original packaging where provided.</p>
          <p>Opened or worn items may be declined for refund unless required under Australian Consumer Law.</p>
          <p>To request a refund or exchange, contact the school uniform shop with your order number and item details.</p>
        </div>
        <div className="mt-6">
          <Link href={`/${tenantId}/checkout`} className="underline text-[13px]" style={{ color: tenant.accent }}>
            Back to checkout
          </Link>
        </div>
      </main>
    </MobileShell>
  );
}
