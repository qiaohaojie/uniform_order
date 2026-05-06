"use client";

import Link from "next/link";
import type { Tenant } from "@/lib/data";
import { PARENT, cartTotal } from "@/lib/data";
import { useCart } from "@/lib/cart-store";
import { Crest } from "@/components/crest";
import { GarmentVector } from "@/components/garment";
import { Btn } from "@/components/btn";
import { BackIcon } from "@/components/icons";
import { posthog } from "@/lib/analytics/client";

export function CartScreen({ tenant }: { tenant: Tenant }) {
  const { lines, hydrated, setQty } = useCart();
  const total = cartTotal(lines);
  const totalQty = lines.reduce((s, l) => s + l.qty, 0);
  const kid = PARENT.kids.find((k) => k.tenantId === tenant.id);

  return (
    <>
      <div className="px-4 pt-1.5 pb-3 flex items-center gap-2.5 flex-shrink-0">
        <Link
          href={`/${tenant.id}`}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: "var(--color-parchment)" }}
          aria-label="Back"
        >
          <BackIcon size={18} />
        </Link>
        <div
          className="flex-1 text-center font-serif text-[17px] font-semibold"
          style={{ color: tenant.accent }}
        >
          Your Cart
        </div>
        <div className="w-9" />
      </div>

      <div className="px-4 pb-2">
        <div
          className="rounded-[10px] px-3.5 py-2.5 flex items-center gap-2.5"
          style={{ background: "var(--color-parchment)" }}
        >
          <Crest tenant={tenant} size={32} />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] leading-[1.2]" style={{ color: "var(--color-ink-dim)" }}>Order for</div>
            <div className="font-serif text-[14px] font-semibold" style={{ color: "var(--color-ink)" }}>
              {kid ? `${kid.name} · ${kid.year} · ${tenant.short}` : tenant.short}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-2">
        {!hydrated ? null : lines.length === 0 ? (
          <div className="text-center py-12 text-[13px]" style={{ color: "var(--color-ink-dim)" }}>
            Your cart is empty.
            <br />
            <Link href={`/${tenant.id}`} className="underline mt-2 inline-block" style={{ color: tenant.accent }}>
              Browse {tenant.short} uniforms
            </Link>
          </div>
        ) : (
          lines.map((line, i) => (
            <div
              key={`${line.itemId}-${line.variantLabel}-${line.size}-${i}`}
              className={`flex gap-3 py-3 ${i < lines.length - 1 ? "border-b" : ""}`}
              style={{ borderColor: "var(--color-rule)" }}
            >
              <div
                className="w-14 h-14 rounded-md flex-shrink-0 overflow-hidden"
                style={{ background: "var(--color-parchment)" }}
              >
                <GarmentVector itemId={line.itemId} accent={tenant.accent} size={56} />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="font-serif text-[13.5px] font-medium leading-[1.25] mb-0.5"
                  style={{ color: "var(--color-ink)" }}
                >
                  {line.name}
                </div>
                <div className="text-[11px]" style={{ color: "var(--color-ink-dim)" }}>
                  {line.variantLabel} · Size {line.size}
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <div
                    className="flex items-center border rounded-md h-[26px]"
                    style={{ borderColor: "var(--color-rule)" }}
                  >
                    <button
                      type="button"
                      onClick={() => setQty(i, line.qty - 1)}
                      className="w-6 text-center text-[13px]"
                      style={{ color: "var(--color-ink-dim)" }}
                      aria-label="Decrease"
                    >
                      −
                    </button>
                    <div className="w-[22px] text-center text-[12px] font-bold">{line.qty}</div>
                    <button
                      type="button"
                      onClick={() => setQty(i, line.qty + 1)}
                      className="w-6 text-center text-[13px]"
                      style={{ color: "var(--color-ink-dim)" }}
                      aria-label="Increase"
                    >
                      +
                    </button>
                  </div>
                  <div className="text-[13px] font-bold tnum" style={{ color: "var(--color-ink)" }}>
                    ${line.price * line.qty}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {hydrated && lines.length > 0 && (
        <div className="px-4 pt-3.5 pb-6 border-t bg-white flex-shrink-0" style={{ borderColor: "var(--color-rule)" }}>
          <div className="flex justify-between text-[12px] mb-1" style={{ color: "var(--color-ink-dim)" }}>
            <span>Subtotal · {totalQty} items</span>
            <span className="tnum">${total}</span>
          </div>
          <div className="flex justify-between text-[12px] mb-2" style={{ color: "var(--color-ink-dim)" }}>
            <span>GST included</span>
            <span className="tnum">${(total / 11).toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-baseline mb-3">
            <span className="font-serif text-[18px] font-semibold">Total</span>
            <span className="font-serif text-[22px] font-semibold tnum">${total}</span>
          </div>
          <Link
            href={`/${tenant.id}/checkout`}
            onClick={() => posthog.capture("checkout_started", {
              tenant_id: tenant.id,
              item_count: totalQty,
              cart_total: total,
            })}
          >
            <Btn variant="primary" size="lg" fullWidth accent={tenant.accent}>
              Checkout
            </Btn>
          </Link>
        </div>
      )}
    </>
  );
}
