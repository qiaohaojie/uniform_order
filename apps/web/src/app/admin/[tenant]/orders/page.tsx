import { notFound } from "next/navigation";
import { TENANTS, type TenantId } from "@/lib/data";
import { AdminTopbar } from "@/components/admin-shell";
import { OrdersBoard } from "./orders-board";

export default async function AdminOrdersPage({ params }: PageProps<"/admin/[tenant]/orders">) {
  const { tenant: tid } = await params;
  if (!(tid in TENANTS)) notFound();
  const tenant = TENANTS[tid as TenantId];

  return (
    <>
      <AdminTopbar
        kicker={`${tenant.short} · Operator`}
        title="Orders"
        right={
          <div className="flex items-center gap-2">
            <div
              className="h-9 border rounded-md px-2.5 flex items-center gap-2 bg-white w-[240px]"
              style={{ borderColor: "var(--color-rule)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink-dim)" strokeWidth="1.7" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" /><path d="M20 20 L16 16" />
              </svg>
              <input
                placeholder="Search by order, parent, or kid"
                className="flex-1 border-none outline-none text-[12.5px] bg-transparent"
                style={{ fontFamily: "var(--font-sans)", color: "var(--color-ink)" }}
                readOnly
              />
            </div>
            <button
              className="h-9 px-3.5 text-[12.5px] font-semibold rounded-md border flex items-center gap-1.5"
              style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <rect x="6" y="3" width="12" height="6" /><rect x="3" y="9" width="18" height="9" rx="1" /><rect x="6" y="15" width="12" height="6" />
              </svg>
              Print pick slips
            </button>
            <button
              className="h-9 px-3.5 text-[12.5px] font-semibold rounded-md text-white flex items-center gap-1.5"
              style={{ background: tenant.accent }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.7" strokeLinecap="round">
                <rect x="3" y="5" width="18" height="14" rx="1" /><path d="M3 7 L12 13 L21 7" />
              </svg>
              Email parents
            </button>
          </div>
        }
      />
      <OrdersBoard tenantId={tid} tenant={tenant} />
    </>
  );
}
