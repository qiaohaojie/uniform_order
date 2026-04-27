import Link from "next/link";
import { PAST_ORDERS, TENANTS } from "@/lib/data";
import { Crest } from "@/components/crest";
import { Chip } from "@/components/chip";
import { MobileShell } from "@/components/mobile-shell";
import { BottomNav } from "@/components/bottom-nav";

export default function OrdersPage() {
  return (
    <MobileShell bg="var(--color-paper)">
      <div className="px-4 pt-3 pb-3 flex items-center flex-shrink-0">
        <div className="flex-1 text-center font-serif text-[17px] font-semibold" style={{ color: "var(--color-navy)" }}>
          My Orders
        </div>
      </div>

      <div className="px-[18px] pb-1.5 flex-shrink-0">
        <div className="flex gap-1.5">
          <FilterChip active>All</FilterChip>
          <FilterChip>Riley</FilterChip>
          <FilterChip>Mia</FilterChip>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-[18px] pt-3.5">
        {/* Active order */}
        <div
          className="bg-white border rounded-xl p-4 mb-3.5"
          style={{ borderColor: "var(--color-rule)" }}
        >
          <div className="flex items-center gap-2.5 mb-2.5">
            <Crest tenant={TENANTS.nsbh} size={32} />
            <div className="flex-1 min-w-0">
              <div className="font-serif text-[13.5px] font-semibold leading-[1.2]">
                NSBH · Riley
              </div>
              <div className="text-[10.5px]" style={{ color: "var(--color-ink-dim)" }}>
                Placed 27 Apr · 9:42am
              </div>
            </div>
            <Chip tone="warn">Packing</Chip>
          </div>
          <StatusTrack accent={TENANTS.nsbh.accent} />
          <div
            className="mt-2.5 p-2.5 rounded-md text-[11.5px] leading-[1.5]"
            style={{ background: "var(--color-parchment)", color: "var(--color-ink-dim)" }}
          >
            6 items · $363.00 · We&apos;ll email you when it&apos;s ready for pickup at the {TENANTS.nsbh.short} office.
          </div>
        </div>

        {/* Past orders */}
        <div
          className="font-sans text-[11px] font-bold tracking-[1px] uppercase mb-2"
          style={{ color: "var(--color-ink-dim)" }}
        >
          Past orders
        </div>

        {PAST_ORDERS.map((o, i) => {
          const tenant = TENANTS[o.school];
          return (
            <div
              key={o.id}
              className={`flex items-center gap-3 py-3 ${i < PAST_ORDERS.length - 1 ? "border-b" : ""}`}
              style={{ borderColor: "var(--color-rule)" }}
            >
              <Crest tenant={tenant} size={32} />
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-semibold">
                  {o.kid} · {o.items} items
                </div>
                <div className="text-[10.5px]" style={{ color: "var(--color-ink-dim)" }}>
                  {o.date} · {o.id}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="text-[13px] font-bold tnum">${o.total}</div>
                <Link
                  href={`/${tenant.id}`}
                  className="text-[10.5px] font-semibold underline"
                  style={{ color: tenant.accent }}
                >
                  Re-order
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <BottomNav active="orders" />
    </MobileShell>
  );
}

function FilterChip({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <button
      type="button"
      className="h-[30px] px-3 rounded-full text-[12px] font-semibold flex items-center border"
      style={{
        background: active ? "var(--color-navy)" : "#fff",
        color: active ? "#fff" : "var(--color-ink)",
        borderColor: active ? "var(--color-navy)" : "var(--color-rule)",
      }}
    >
      {children}
    </button>
  );
}

function StatusTrack({ accent }: { accent: string }) {
  const steps = ["Placed", "Packed", "Ready", "Collected"] as const;
  const cur = 1; // Packed in progress
  return (
    <div className="relative px-1 pt-1.5 pb-1">
      <div
        className="absolute left-3 right-3 top-3.5 h-0.5"
        style={{ background: "var(--color-rule)" }}
      />
      <div
        className="absolute left-3 top-3.5 h-0.5"
        style={{ width: "38%", background: accent }}
      />
      <div className="flex justify-between relative">
        {steps.map((s, i) => {
          const done = i <= cur;
          const isCur = i === cur;
          return (
            <div key={s} className="flex-1 flex flex-col items-center gap-1.5">
              <span
                className="w-4 h-4 rounded-full"
                style={{
                  background: done ? accent : "#fff",
                  border: `2px solid ${done ? accent : "var(--color-rule)"}`,
                  boxShadow: isCur ? `0 0 0 4px rgba(122,31,43,0.12)` : "none",
                }}
              />
              <span
                className="text-[9.5px] font-semibold tracking-[0.3px]"
                style={{ color: done ? "var(--color-ink)" : "var(--color-ink-dim)" }}
              >
                {s}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
