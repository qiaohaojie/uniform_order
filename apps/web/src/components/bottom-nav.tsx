"use client";

import Link from "next/link";
import { ShopIcon, OrdersIcon, KidsIcon, ProfileIcon } from "./icons";

type NavTab = "shop" | "orders" | "kids" | "profile";

export function BottomNav({
  active,
  shopHref = "/",
  accent = "var(--color-navy)",
}: {
  active: NavTab;
  shopHref?: string;
  accent?: string;
}) {
  const tabs: { id: NavTab; label: string; href: string; icon: React.ComponentType<{ size?: number }> }[] = [
    { id: "shop", label: "Shop", href: shopHref, icon: ShopIcon },
    { id: "orders", label: "Orders", href: "/orders", icon: OrdersIcon },
    { id: "kids", label: "Kids", href: "/?action=add-child", icon: KidsIcon },
    { id: "profile", label: "Profile", href: "#", icon: ProfileIcon },
  ];

  return (
    <nav className="border-t border-rule bg-white flex flex-shrink-0 px-0 pt-2 pb-[18px]" style={{ borderTopColor: "var(--color-rule)" }}>
      {tabs.map((t) => {
        const on = t.id === active;
        const Icon = t.icon;
        return (
          <Link
            key={t.id}
            href={t.href}
            className="flex-1 flex flex-col items-center gap-1 py-1.5"
            style={{ color: on ? accent : "var(--color-ink-dim)" }}
          >
            <span style={{ opacity: on ? 1 : 0.7 }}>
              <Icon size={22} />
            </span>
            <span className="text-[10px] font-semibold tracking-[0.3px]">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
