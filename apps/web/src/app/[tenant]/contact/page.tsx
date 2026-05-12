import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTenant } from "@/db/queries";
import { getSessionUser, isPlatformAdminEmail } from "@/lib/auth/authorization";
import { MobileShell } from "@/components/mobile-shell";
import { TenantFooter } from "@/components/tenant-footer";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string }>;
}): Promise<Metadata> {
  const { tenant: slug } = await params;
  const tenant = await getTenant(slug);
  if (!tenant) return { title: "Contact" };
  return { title: `Contact ${tenant.name}`, robots: { index: true } };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const tenant = await getTenant(slug);
  if (!tenant) notFound();

  const isVisibleToPublic =
    tenant.isPubliclyListed && tenant.platformApprovalStatus === "approved";
  if (!isVisibleToPublic) {
    const user = await getSessionUser();
    if (!user || !isPlatformAdminEmail(user.email)) notFound();
  }

  return (
    <MobileShell bg="var(--color-paper)">
      <div className="px-5 py-6">
        <h1
          className="font-serif text-2xl font-semibold pb-2 mb-4 border-b-2"
          style={{ borderColor: tenant.accent }}
        >
          Contact {tenant.name}
        </h1>
        <div className="space-y-4 text-sm leading-6 text-ink">
          {tenant.shopEmail && (
            <section>
              <div className="text-ink-dim text-xs uppercase tracking-wide">Email</div>
              <a
                className="underline hover:text-ink-dim"
                href={`mailto:${tenant.shopEmail}`}
              >
                {tenant.shopEmail}
              </a>
            </section>
          )}
          {tenant.shopHours && (
            <section>
              <div className="text-ink-dim text-xs uppercase tracking-wide">Shop hours</div>
              <p className="whitespace-pre-wrap">{tenant.shopHours}</p>
            </section>
          )}
          {tenant.address && (
            <section>
              <div className="text-ink-dim text-xs uppercase tracking-wide">Address</div>
              <p className="whitespace-pre-wrap">{tenant.address}</p>
            </section>
          )}
          {tenant.collectionInstructions && (
            <section>
              <div className="text-ink-dim text-xs uppercase tracking-wide">
                Collection instructions
              </div>
              <p className="whitespace-pre-wrap">{tenant.collectionInstructions}</p>
            </section>
          )}
        </div>
      </div>
      <TenantFooter tenant={tenant} hideContact />
    </MobileShell>
  );
}
