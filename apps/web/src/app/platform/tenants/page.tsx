import Link from "next/link";
import { listTenantsWithStats, getPlatformKpis } from "@/lib/platform/queries";
import { TenantsTable } from "./tenants-table";

export default async function PlatformTenantsPage() {
  const [list, kpis] = await Promise.all([listTenantsWithStats(), getPlatformKpis()]);

  return (
    <>
      <header className="flex items-center justify-between px-7 py-5 border-b border-rule">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.6px] font-bold text-ink-dim">
            UniformOrder Platform
          </div>
          <h1 className="font-serif text-2xl font-semibold mt-1">Tenant schools</h1>
        </div>
        <Link
          href="/platform/tenants/new"
          className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-navy-deep text-white text-sm font-semibold"
        >
          + Provision new tenant
        </Link>
      </header>

      <div className="flex-1 px-7 py-6 overflow-auto">
        <KpiTiles kpis={kpis} />
        <div className="mt-6">
          <TenantsTable rows={list} />
        </div>
      </div>
    </>
  );
}

function KpiTiles({ kpis }: { kpis: Awaited<ReturnType<typeof getPlatformKpis>> }) {
  const tiles = [
    {
      label: "Tenants",
      value: kpis.tenants.total,
      sub: `${kpis.tenants.active} active · ${kpis.tenants.setup} setup`,
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
