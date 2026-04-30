import { notFound } from "next/navigation";
import { TENANTS, type TenantId } from "@/lib/data";
import { AdminTopbar } from "@/components/admin-shell";
import { UploadClient } from "./upload-client";

export default async function AdminUploadPage({ params }: PageProps<"/admin/[tenant]/upload">) {
  const { tenant: tid } = await params;
  if (!(tid in TENANTS)) notFound();
  const tenant = TENANTS[tid as TenantId];

  return (
    <>
      <AdminTopbar
        kicker={`${tenant.short} · Operator`}
        title="Bulk upload"
        right={
          <div className="flex items-center gap-2">
            <a
              href="#"
              className="h-9 px-3.5 text-[12.5px] font-semibold rounded-md border flex items-center gap-1.5"
              style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <path d="M21 15 V19 a2 2 0 0 1 -2 2 H5 a2 2 0 0 1 -2 -2 V15" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download template
            </a>
          </div>
        }
      />
      <UploadClient tenant={tenant} />
    </>
  );
}
