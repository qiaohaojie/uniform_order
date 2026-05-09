"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV = [
  { href: "/platform/tenants", label: "Tenants" },
  { href: "/platform/billing", label: "Billing" },
] as const;

export function PlatformShell({
  userName,
  userEmail,
  children,
}: {
  userName: string | null;
  userEmail: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const active: "tenants" | "billing" = pathname.startsWith("/platform/billing") ? "billing" : "tenants";
  return (
    <div className="flex min-h-screen bg-parchment text-ink font-sans">
      <aside className="w-[220px] shrink-0 bg-[#0A1726] text-[#E8E0CF] flex flex-col">
        <div className="px-[18px] py-[20px] border-b border-white/[0.08]">
          <div className="font-serif text-[22px] font-semibold text-white">UniformOrder</div>
          <div className="mt-1.5 text-[10.5px] uppercase tracking-[0.6px] font-semibold text-[#A3B0C2]">
            Platform Console
          </div>
        </div>
        <nav className="flex-1 px-2 py-3.5">
          {NAV.map((n) => {
            const on = active === n.href.split("/").pop();
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-2.5 px-3 py-2 my-0.5 rounded-md text-[13px] ${
                  on ? "bg-white/[0.07] text-white font-semibold" : "text-[#B6C0CE] font-medium"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-white/[0.08] flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gold text-navy-deep flex items-center justify-center text-xs font-bold">
            {(userName ?? "?").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-white truncate">{userName ?? "—"}</div>
            <div className="text-[10.5px] text-[#A3B0C2] truncate">Platform admin</div>
          </div>
        </div>
      </aside>
      <main className="flex-1 min-w-0 flex flex-col">{children}</main>
    </div>
  );
}
