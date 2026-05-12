import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTenant, getTenantLegalVersion } from "@/db/queries";
import { MobileShell } from "@/components/mobile-shell";
import { TenantFooter } from "@/components/tenant-footer";

// Tenant-internal document, not an SEO target.
export const metadata: Metadata = {
  title: "Refund policy",
  robots: { index: false, follow: false },
};

export default async function RefundPolicyPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  // The [tenant] route param is the tenant id (slug == id in this codebase —
  // see TENANTS in lib/data.ts and getTenant's signature in db/queries.ts:712).
  const { tenant: tenantId } = await params;
  const tenant = await getTenant(tenantId);
  if (!tenant) notFound();

  const version = tenant.currentLegalVersionId
    ? await getTenantLegalVersion(tenant.currentLegalVersionId)
    : null;
  if (!version) notFound();

  if (version.policyMode === "url") {
    if (!version.policyUrl) notFound(); // belt-and-braces; check constraint guarantees this
    redirect(version.policyUrl);
  }

  return (
    <MobileShell>
      <div className="px-5 py-6">
        <h1
          className="font-serif text-2xl font-semibold pb-2 mb-4 border-b-2"
          style={{ borderColor: tenant.accent }}
        >
          Refund policy
        </h1>
        <div className="text-sm leading-6 text-ink whitespace-pre-wrap">
          {version.policyText}
        </div>
        <div className="mt-6 pt-4 border-t border-rule text-xs text-ink-dim">
          Declared by {version.declarantName}, {version.declarantRole} ·{" "}
          {new Date(version.createdAt).toLocaleDateString("en-AU", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </div>
      </div>
      <TenantFooter tenant={tenant} />
    </MobileShell>
  );
}
