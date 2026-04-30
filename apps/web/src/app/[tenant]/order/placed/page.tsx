import Link from "next/link";
import { notFound } from "next/navigation";
import { PARENT, TENANTS, type TenantId } from "@/lib/data";
import { Crest } from "@/components/crest";
import { Chip } from "@/components/chip";
import { DoubleRule } from "@/components/double-rule";
import { Btn } from "@/components/btn";
import { CheckIcon } from "@/components/icons";
import { MobileShell } from "@/components/mobile-shell";

export default async function OrderPlacedPage({ params, searchParams }: PageProps<"/[tenant]/order/placed">) {
  const { tenant: tid } = await params;
  if (!(tid in TENANTS)) notFound();
  const tenant = TENANTS[tid as TenantId];
  const sp = await searchParams;
  const total = typeof sp.total === "string" ? sp.total : "363.00";
  const delivery: "pickup" | "ship" = sp.delivery === "ship" ? "ship" : "pickup";
  const orderId = typeof sp.orderId === "string" ? sp.orderId : `${tid.toUpperCase()}-XXXXX`;

  return (
    <MobileShell bg="var(--color-parchment)">
      <div className="px-7 pt-16 pb-4 text-center flex-shrink-0">
        <div
          className="w-[76px] h-[76px] mx-auto rounded-[38px] bg-white flex items-center justify-center mb-3"
          style={{ border: `2px solid var(--color-success)`, color: "var(--color-success)" }}
        >
          <CheckIcon size={36} />
        </div>
        <Chip tone="success" size="md">Payment received</Chip>
        <h1 className="font-serif text-[28px] font-medium mt-3.5 mb-2 leading-[1.15] tracking-[-0.3px]">
          Order placed.
          <br />
          We&apos;ll have it ready soon.
        </h1>
        <p className="text-[13px] leading-[1.5] m-0 mb-5" style={{ color: "var(--color-ink-dim)" }}>
          A receipt has been sent to <b style={{ color: "var(--color-ink)" }}>{PARENT.email}</b>.
          You&apos;ll get another email when the order is ready{delivery === "pickup" ? " for pickup" : " to ship"}.
        </p>
      </div>

      <div className="px-5 flex-1">
        <div
          className="bg-white rounded-xl border p-4"
          style={{ borderColor: "var(--color-rule)" }}
        >
          <div className="flex justify-between items-center mb-2.5">
            <div>
              <div className="text-[11px] tracking-[0.4px] uppercase font-bold" style={{ color: "var(--color-ink-dim)" }}>
                Order
              </div>
              <div className="font-mono text-[15px] font-semibold mt-0.5">{orderId}</div>
            </div>
            <Crest tenant={tenant} size={40} />
          </div>
          <DoubleRule />
          <Row label={delivery === "pickup" ? "Pickup from" : "Ship to"} value={delivery === "pickup" ? `${tenant.short} School Office` : "Home address"} bold />
          {delivery === "pickup" && <Row label="Open" value={tenant.shopHours} bold />}
          <Row label="Total paid" value={`$${total}`} bold tnum />
        </div>
      </div>

      <div className="px-5 pt-5 pb-7 flex-shrink-0">
        <Link href="/orders">
          <Btn variant="primary" size="lg" fullWidth accent={tenant.accent}>
            View order details
          </Btn>
        </Link>
        <Link href="/" className="block mt-1.5">
          <Btn variant="ghost" size="md" fullWidth>
            Back to home
          </Btn>
        </Link>
      </div>
    </MobileShell>
  );
}

function Row({ label, value, bold, tnum }: { label: string; value: string; bold?: boolean; tnum?: boolean }) {
  return (
    <div className="flex justify-between py-2.5 text-[13px]">
      <span style={{ color: "var(--color-ink-dim)" }}>{label}</span>
      <span className={`${bold ? "font-bold" : "font-semibold"} ${tnum ? "tnum" : ""}`}>{value}</span>
    </div>
  );
}
