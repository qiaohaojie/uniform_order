"use client";
import Link from "next/link";
import type { ParentOrderRow } from "@/db/queries";
import type { Tenant } from "@/lib/data";
import { Crest } from "@/components/crest";
import { Chip } from "@/components/chip";

const STATUS_TONE: Record<string, "info" | "warn" | "success" | "neutral"> = {
  new: "info",
  packing: "warn",
  ready: "success",
  collected: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  packing: "Packing",
  ready: "Ready for pickup",
  collected: "Collected",
};

function StatusTrack({ accent, status }: { accent: string; status: string }) {
  const steps = ["Placed", "Packed", "Ready", "Collected"] as const;
  const statusToStep: Record<string, number> = {
    new: 0,
    packing: 1,
    ready: 2,
    collected: 3,
  };
  const cur = statusToStep[status] ?? 0;
  const pct = ["5%", "38%", "68%", "100%"][cur];

  return (
    <div className="relative px-1 pt-1.5 pb-1">
      <div className="absolute left-3 right-3 top-3.5 h-0.5" style={{ background: "var(--color-rule)" }} />
      <div className="absolute left-3 top-3.5 h-0.5" style={{ width: pct, background: accent }} />
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
                  boxShadow: isCur ? `0 0 0 4px ${accent}20` : "none",
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

/** Minimal shape that Crest actually reads: id, accent, short */
function rowToCrestTenant(o: ParentOrderRow): Tenant {
  return {
    id: o.tenantId,
    accent: o.tenantAccent,
    short: o.tenantShort,
    name: o.tenantName,
    accentInk: "#FFFFFF",
    motto: "",
    address: "",
    shopHours: "",
    shopEmail: "",
  };
}

export function OrdersListClient({ orders }: { orders: ParentOrderRow[] }) {
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="text-[32px] mb-3">🛍️</div>
        <div
          className="font-serif text-[17px] font-semibold mb-1"
          style={{ color: "var(--color-ink)" }}
        >
          No orders yet
        </div>
        <div className="text-[13px]" style={{ color: "var(--color-ink-dim)" }}>
          Your orders will appear here after you place them.
        </div>
      </div>
    );
  }

  // Separate active (non-collected) from past (collected)
  // DB already orders newest-first; preserve that within each group
  const active = orders.filter((o) => o.status !== "collected");
  const past = orders.filter((o) => o.status === "collected");

  return (
    <div className="px-[18px] pt-3.5 pb-6">
      {/* Active orders */}
      {active.map((o) => {
        const tenant = rowToCrestTenant(o);
        return (
          <Link
            key={o.id}
            href={`/orders/${o.id}`}
            className="block bg-white border rounded-xl p-4 mb-3.5 hover:shadow-sm transition-shadow"
            style={{ borderColor: "var(--color-rule)" }}
          >
            <div className="flex items-center gap-2.5 mb-2.5">
              <Crest tenant={tenant} size={32} />
              <div className="flex-1 min-w-0">
                <div className="font-serif text-[13.5px] font-semibold leading-[1.2]">
                  {o.tenantShort} · {o.studentName}
                </div>
                <div className="text-[10.5px]" style={{ color: "var(--color-ink-dim)" }}>
                  Placed {o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" }) : "—"} · {o.id}
                </div>
              </div>
              <Chip tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Chip>
            </div>
            <StatusTrack accent={o.tenantAccent} status={o.status} />
            <div
              className="mt-2.5 p-2.5 rounded-md text-[11.5px] leading-[1.5]"
              style={{ background: "var(--color-parchment)", color: "var(--color-ink-dim)" }}
            >
              ${parseFloat(o.total).toFixed(2)} ·{" "}
              {o.delivery === "pickup"
                ? `We'll email you when it's ready for pickup at the ${o.tenantShort} office.`
                : "Shipping to your address."}
            </div>
          </Link>
        );
      })}

      {/* Past orders */}
      {past.length > 0 && (
        <>
          <div
            className="font-sans text-[11px] font-bold tracking-[1px] uppercase mb-2 mt-1"
            style={{ color: "var(--color-ink-dim)" }}
          >
            Past orders
          </div>
          <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: "var(--color-rule)" }}>
            {past.map((o, i) => {
              const tenant = rowToCrestTenant(o);
              return (
                <div
                  key={o.id}
                  className={`flex items-center gap-3 px-4 py-3 ${i < past.length - 1 ? "border-b" : ""}`}
                  style={{ borderColor: "var(--color-rule)" }}
                >
                  <Link
                    href={`/orders/${o.id}`}
                    className="flex items-center gap-3 flex-1 min-w-0"
                  >
                    <Crest tenant={tenant} size={32} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-semibold">
                        {o.studentName}
                      </div>
                      <div className="text-[10.5px]" style={{ color: "var(--color-ink-dim)" }}>
                        {o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—"} · {o.id}
                      </div>
                    </div>
                  </Link>
                  <div className="flex flex-col items-end gap-1">
                    <div className="text-[13px] font-bold tnum">${parseFloat(o.total).toFixed(2)}</div>
                    <Link
                      href={`/${o.tenantId}`}
                      className="text-[10.5px] font-semibold underline"
                      style={{ color: o.tenantAccent }}
                    >
                      Re-order
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
