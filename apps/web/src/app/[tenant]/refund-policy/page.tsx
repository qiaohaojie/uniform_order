import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPrelovedSettings } from "@/db/preloved-queries";
import { getTenant, getTenantLegalVersion } from "@/db/queries";
import { MobileShell } from "@/components/mobile-shell";
import { TenantFooter } from "@/components/tenant-footer";
import {
  displayRefundPolicyText,
  PRELOVED_REFUND_CLAUSE,
} from "@/lib/preloved-refund-policy";

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

  const settings = await getPrelovedSettings(tenantId);
  const prelovedEnabled = settings.prelovedEnabled;
  const externalPolicyUrl =
    version.policyMode === "url" ? version.policyUrl : null;

  // URL mode normally sends parents to the school's hosted policy. Preloved
  // still needs the ACL-safe clause on this tenant route, so skip the redirect
  // and link out instead. We cannot inspect the remote page for the clause.
  if (externalPolicyUrl) {
    if (!prelovedEnabled) {
      redirect(externalPolicyUrl);
    }
  } else if (version.policyMode === "url") {
    notFound(); // belt-and-braces; check constraint guarantees a URL
  }

  const storedText = displayRefundPolicyText(
    version.policyText,
    prelovedEnabled,
  );
  // URL-mode rows cannot store policy_text (check constraint). Show the
  // canonical paragraph locally instead of injecting onto a text-mode version.
  const policyText =
    prelovedEnabled && !storedText.trim() && externalPolicyUrl
      ? PRELOVED_REFUND_CLAUSE
      : storedText;

  return (
    <MobileShell logoUrl={tenant.logoUrl ?? undefined}>
      <div className="px-5 py-6">
        <h1
          className="font-serif text-2xl font-semibold pb-2 mb-4 border-b-2"
          style={{ borderColor: tenant.accent }}
        >
          Refund policy
        </h1>
        <div
          className="text-sm leading-6 text-ink whitespace-pre-wrap"
          data-testid="refund-policy-text"
        >
          {policyText}
        </div>
        {prelovedEnabled && externalPolicyUrl ? (
          <p className="mt-4 text-sm leading-6">
            <a
              className="underline hover:text-ink"
              href={externalPolicyUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              School refund policy
            </a>
          </p>
        ) : null}
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
