"use client";

import Link from "next/link";
import type { Tenant } from "@/lib/data";
import { BackIcon, CartIcon } from "@/components/icons";

export function ShopPhoneNav({
  tenant,
  cartCount,
  title,
}: {
  tenant: Tenant;
  cartCount: number;
  title: string;
}) {
  return (
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
        className="flex-1 text-center font-serif text-[17px] font-semibold tracking-[0.1px]"
        style={{ color: tenant.accent }}
      >
        {title}
      </div>
      <Link
        href={`/${tenant.id}/cart`}
        className="w-9 h-9 flex items-center justify-center"
        style={{ color: "var(--color-ink)" }}
        aria-label="Cart"
      >
        <span className="relative">
          <CartIcon size={22} />
          {cartCount > 0 && (
            <span
              className="absolute -top-1 -right-1 rounded-[10px] text-[10px] font-bold h-4 min-w-4 px-1 flex items-center justify-center text-white"
              style={{ background: tenant.accent }}
            >
              {cartCount}
            </span>
          )}
        </span>
      </Link>
    </div>
  );
}
