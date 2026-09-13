import Link from "next/link";
import { listTenantsWithStats, getPlatformKpis } from "@/lib/platform/queries";
import { TenantsTable } from "./tenants-table";
import { ProvisionSchoolButton } from "./provision-school-button";

export default async function PlatformTenantsPage() {
  const [list, kpis] = await Promise.all([listTenantsWithStats(), getPlatformKpis()]);
  const pending = list.filter((t) => t.status === "pending");

  return (
    <div data-testid="platform-tenants-page">
      <header className="flex items-center justify-between px-7 py-5 border-b border-rule">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.6px] font-bold text-ink-dim">
            UniformOrder Platform
          </div>
          <h1 className="font-serif text-2xl font-semibold mt-1">Tenant schools</h1>
        </div>
        <ProvisionSchoolButton label="Provision new school" testId="platform-provision" />
      </header>

      <div className="flex-1 px-7 py-6 overflow-auto">
        <KpiTiles kpis={kpis} />

        {pending.length > 0 ? (
          <section className="mt-6 bg-amber-50 border border-amber-200 rounded-[10px] p-4" data-testid="platform-pending-queue">
            <h2 className="font-serif text-lg font-semibold">Pending approval</h2>
            <p className="text-sm text-ink-dim mt-1">
              These schools have a DB slug but are not approved. Approve to unlock the parent shop; turn the shop on from the tenant page.
            </p>
            <ul className="mt-3 space-y-2">
              {pending.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
                  <div>
                    <span className="font-semibold">{t.name}</span>{" "}
                    <span className="font-mono text-ink-dim">/{t.id}</span>
                  </div>
                  <Link href={`/platform/tenants/${t.id}`} className="font-semibold text-navy-deep underline">
                    Review →
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="mt-6">
          {list.length === 0 ? (
            <div
              className="bg-paper rounded-[10px] border border-rule px-6 py-16 text-center"
              data-testid="platform-tenants-empty"
            >
              <h2 className="font-serif text-xl font-semibold">No schools yet</h2>
              <p className="text-sm text-ink-dim mt-2 max-w-md mx-auto">
                Provision a school to assign its database slug, then approve it and turn the parent shop on. You do not need to edit Neon by hand.
              </p>
              <div className="mt-5">
                <ProvisionSchoolButton label="Provision the first school" testId="platform-provision-empty" />
              </div>
            </div>
          ) : (
            <TenantsTable rows={list} />
          )}
        </div>
      </div>
    </div>
  );
}

function KpiTiles({ kpis }: { kpis: Awaited<ReturnType<typeof getPlatformKpis>> }) {
  const tiles = [
    {
      label: "Tenants",
      value: kpis.tenants.total,
      sub: `${kpis.tenants.active} live · ${kpis.tenants.pending} pending`,
    },
    {
      label: "Parents",
      value: kpis.parents.toLocaleString(),
      sub: "Across all schools",
    },
    {
      label: "Orders · 30d",
      value: kpis.orders30d.count,
      sub:
        kpis.orders30d.deltaMom == null
          ? "—"
          : `${kpis.orders30d.deltaMom > 0 ? "+" : ""}${(kpis.orders30d.deltaMom * 100).toFixed(0)}% MoM`,
    },
    {
      label: "Revenue · 30d",
      value: `$${Number(kpis.revenue30d).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      sub: "Gross — net of refunds",
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-3.5">
      {tiles.map((t) => (
        <div key={t.label} className="bg-paper rounded-[10px] border border-rule p-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.4px] text-ink-dim">
            {t.label}
          </div>
          <div className="font-serif text-[26px] font-semibold mt-1.5 tnum">{t.value}</div>
          <div className="text-[11px] text-ink-dim mt-1">{t.sub}</div>
        </div>
      ))}
    </div>
  );
}
