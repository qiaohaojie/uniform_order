import Link from "next/link";
import type { TenantRow } from "@/db/schema";

export function TenantFooter({
  tenant,
  hideContact,
}: {
  tenant: TenantRow;
  hideContact?: boolean;
}) {
  const showRefund = tenant.currentLegalVersionId !== null;
  return (
    <footer className="border-t border-rule bg-parchment px-5 py-4 text-[12px] leading-relaxed text-ink-dim">
      <nav aria-label="Tenant policies" className="flex flex-wrap gap-x-4 gap-y-1.5">
        {showRefund && (
          <Link className="underline hover:text-ink" href={`/${tenant.id}/refund-policy`}>
            Refund policy
          </Link>
        )}
        <Link className="underline hover:text-ink" href={`/${tenant.id}/contact`}>
          Contact
        </Link>
        <Link className="underline hover:text-ink" href="/privacy">
          Privacy
        </Link>
        <Link className="underline hover:text-ink" href="/terms">
          Terms
        </Link>
      </nav>
      {!hideContact && (tenant.shopEmail || tenant.shopHours) && (
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {tenant.shopEmail && (
            <>
              <dt className="font-semibold">Email</dt>
              <dd>
                <a className="underline hover:text-ink" href={`mailto:${tenant.shopEmail}`}>
                  {tenant.shopEmail}
                </a>
              </dd>
            </>
          )}
          {tenant.shopHours && (
            <>
              <dt className="font-semibold">Hours</dt>
              <dd className="whitespace-pre-wrap">{tenant.shopHours}</dd>
            </>
          )}
        </dl>
      )}
    </footer>
  );
}
