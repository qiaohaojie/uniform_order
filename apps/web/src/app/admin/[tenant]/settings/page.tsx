import { notFound } from "next/navigation";
import { TENANTS, type TenantId } from "@/lib/data";
import { AdminTopbar } from "@/components/admin-shell";

export default async function AdminSettingsPage({ params }: PageProps<"/admin/[tenant]/settings">) {
  const { tenant: tid } = await params;
  if (!(tid in TENANTS)) notFound();
  const tenant = TENANTS[tid as TenantId];

  return (
    <>
      <AdminTopbar
        kicker={`${tenant.short} · Operator`}
        title="Settings"
        right={
          <button
            className="h-9 px-3.5 text-[12.5px] font-semibold rounded-md text-white"
            style={{ background: tenant.accent }}
          >
            Save changes
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto p-7">
        <div className="max-w-2xl mx-auto flex flex-col gap-5">
          {/* Shop details */}
          <section
            className="bg-white rounded-xl border p-6"
            style={{ borderColor: "var(--color-rule)" }}
          >
            <h2 className="type-h2 mb-4" style={{ color: "var(--color-ink)" }}>
              Shop details
            </h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.6px] mb-1.5" style={{ color: "var(--color-ink-dim)" }}>
                  School name
                </label>
                <input
                  defaultValue={tenant.name}
                  className="w-full h-10 border rounded-md px-3 text-[13px]"
                  style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.6px] mb-1.5" style={{ color: "var(--color-ink-dim)" }}>
                    Short code
                  </label>
                  <input
                    defaultValue={tenant.short}
                    className="w-full h-10 border rounded-md px-3 text-[13px]"
                    style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.6px] mb-1.5" style={{ color: "var(--color-ink-dim)" }}>
                    Shop email
                  </label>
                  <input
                    defaultValue={tenant.shopEmail}
                    className="w-full h-10 border rounded-md px-3 text-[13px]"
                    style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.6px] mb-1.5" style={{ color: "var(--color-ink-dim)" }}>
                  Address
                </label>
                <input
                  defaultValue={tenant.address}
                  className="w-full h-10 border rounded-md px-3 text-[13px]"
                  style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.6px] mb-1.5" style={{ color: "var(--color-ink-dim)" }}>
                  Shop hours
                </label>
                <input
                  defaultValue={tenant.shopHours}
                  className="w-full h-10 border rounded-md px-3 text-[13px]"
                  style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
                />
              </div>
            </div>
          </section>

          {/* Fulfilment */}
          <section
            className="bg-white rounded-xl border p-6"
            style={{ borderColor: "var(--color-rule)" }}
          >
            <h2 className="type-h2 mb-4" style={{ color: "var(--color-ink)" }}>
              Fulfilment
            </h2>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-semibold" style={{ color: "var(--color-ink)" }}>
                    Pickup at school office
                  </div>
                  <div className="text-[12px]" style={{ color: "var(--color-ink-dim)" }}>
                    Free · Ready in 1–2 school days
                  </div>
                </div>
                <div
                  className="w-10 h-6 rounded-full relative cursor-pointer"
                  style={{ background: tenant.accent }}
                >
                  <div className="absolute right-1 top-1 w-4 h-4 rounded-full bg-white" />
                </div>
              </div>
              <div
                className="h-px"
                style={{ background: "var(--color-rule)" }}
              />
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-semibold" style={{ color: "var(--color-ink)" }}>
                    Ship to home
                  </div>
                  <div className="text-[12px]" style={{ color: "var(--color-ink-dim)" }}>
                    $9.50 flat rate · 3–5 business days
                  </div>
                </div>
                <div
                  className="w-10 h-6 rounded-full relative cursor-pointer"
                  style={{ background: tenant.accent }}
                >
                  <div className="absolute right-1 top-1 w-4 h-4 rounded-full bg-white" />
                </div>
              </div>
            </div>
          </section>

          {/* Stripe */}
          <section
            className="bg-white rounded-xl border p-6"
            style={{ borderColor: "var(--color-rule)" }}
          >
            <h2 className="type-h2 mb-1" style={{ color: "var(--color-ink)" }}>
              Stripe Connect
            </h2>
            <p className="text-[12.5px] mb-4" style={{ color: "var(--color-ink-dim)" }}>
              Payments are processed via Stripe Connect. The platform collects a 2.9% + $0.30 fee per transaction.
            </p>
            <div
              className="flex items-center gap-3 p-3.5 rounded-lg border"
              style={{ borderColor: "var(--color-rule)", background: "var(--color-parchment)" }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: "var(--color-success)", color: "#fff" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                  <path d="M5 13 L10 18 L20 6" />
                </svg>
              </div>
              <div>
                <div className="text-[13px] font-semibold" style={{ color: "var(--color-ink)" }}>
                  Connected · acct_1NxKj2{tenant.short}
                </div>
                <div className="text-[11.5px]" style={{ color: "var(--color-ink-dim)" }}>
                  Payouts enabled · Next payout Wed 29 Apr
                </div>
              </div>
              <div className="flex-1" />
              <button
                className="h-8 px-3 text-[12px] font-semibold rounded border"
                style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
              >
                Manage in Stripe →
              </button>
            </div>
          </section>

          {/* Notifications */}
          <section
            className="bg-white rounded-xl border p-6"
            style={{ borderColor: "var(--color-rule)" }}
          >
            <h2 className="type-h2 mb-4" style={{ color: "var(--color-ink)" }}>
              Email notifications
            </h2>
            {[
              { label: "New order received", sub: "Sent to shop email when a new order is placed", on: true },
              { label: "Order ready for pickup", sub: "Notify parent when order is marked ready", on: true },
              { label: "Order collected", sub: "Confirmation email to parent after collection", on: false },
              { label: "Weekly sales digest", sub: "Summary of orders and revenue every Monday", on: true },
            ].map((n) => (
              <div
                key={n.label}
                className="flex items-center justify-between py-3 border-b last:border-0"
                style={{ borderColor: "var(--color-rule)" }}
              >
                <div>
                  <div className="text-[13px] font-semibold" style={{ color: "var(--color-ink)" }}>
                    {n.label}
                  </div>
                  <div className="text-[11.5px]" style={{ color: "var(--color-ink-dim)" }}>
                    {n.sub}
                  </div>
                </div>
                <div
                  className="w-10 h-6 rounded-full relative cursor-pointer flex-shrink-0"
                  style={{ background: n.on ? tenant.accent : "var(--color-rule)" }}
                >
                  <div
                    className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
                    style={{ left: n.on ? "calc(100% - 20px)" : 4 }}
                  />
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}
