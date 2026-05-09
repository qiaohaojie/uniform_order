"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Crest } from "./crest";
import { PlatformMark } from "./platform-mark";
import { authClient } from "@/lib/auth/client";
import { clearActiveChildCookieClient } from "@/lib/active-child.client";

function AdminIcon({ kind, size = 16, color = "currentColor" }: { kind: string; size?: number; color?: string }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "home") return <svg {...p}><path d="M3 9.5 L12 3 L21 9.5 V20 H15 V15 H9 V20 H3 Z" /></svg>;
  if (kind === "orders") return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M8 8 H16 M8 12 H16 M8 16 H12" /></svg>;
  if (kind === "catalog") return <svg {...p}><rect x="2" y="3" width="9" height="9" rx="1" /><rect x="13" y="3" width="9" height="9" rx="1" /><rect x="2" y="14" width="9" height="7" rx="1" /><rect x="13" y="14" width="9" height="7" rx="1" /></svg>;
  if (kind === "upload") return <svg {...p}><path d="M21 15 V19 a2 2 0 0 1 -2 2 H5 a2 2 0 0 1 -2 -2 V15" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>;
  if (kind === "chart") return <svg {...p}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>;
  if (kind === "settings") return <svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>;
  if (kind === "logout") return <svg {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>;
  return null;
}

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "home" },
  { id: "orders", label: "Orders", icon: "orders", badge: "7 new" },
  { id: "catalog", label: "Catalog", icon: "catalog" },
  { id: "upload", label: "Bulk upload", icon: "upload" },
  { id: "reports", label: "Reports", icon: "chart" },
  { id: "settings", label: "Settings", icon: "settings" },
] as const;

type TenantBrand = { id: string; name: string; short: string; accent: string };

export function AdminShell({
  tenantId,
  tenant,
  userName,
  userEmail,
  children,
}: {
  tenantId: string;
  tenant: TenantBrand;
  userName?: string | null;
  userEmail: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const activeId = NAV_ITEMS.find((n) => pathname.includes(`/admin/${tenantId}/${n.id}`))?.id ?? "dashboard";
  const displayName = userName?.trim() || userEmail;
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "U";

  const handleSignOut = async () => {
    setSignOutError(null);
    setSigningOut(true);
    try {
      await authClient.signOut();
      clearActiveChildCookieClient();
      router.replace("/");
      router.refresh();
    } catch {
      setSignOutError("Sign-out failed. Please try again.");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: "var(--color-parchment)", fontFamily: "var(--font-sans)" }}>
      {/* Sidebar */}
      <div
        data-no-print
        className="w-[240px] flex-shrink-0 flex flex-col"
        style={{ background: "var(--color-navy-deep)", color: "#E8E0CF" }}
      >
        {/* Logo */}
        <div
          className="px-[18px] py-5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          <PlatformMark size={22} color="#fff" />
        </div>

        {/* Tenant switcher */}
        <div
          className="px-3 py-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div
            className="flex items-center gap-2.5 p-2 rounded-lg"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            <Crest tenant={tenant} size={36} />
            <div className="flex-1 min-w-0">
              <div
                className="text-[12px] font-semibold text-white leading-[1.2] truncate"
              >
                {tenant.short}
              </div>
              <div className="text-[10.5px]" style={{ color: "#A3B0C2" }}>
                Uniform Shop
              </div>
            </div>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#A3B0C2" strokeWidth="1.6">
              <path d="M3 5 L7 9 L11 5" />
            </svg>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3.5">
          {NAV_ITEMS.map((n) => {
            const on = n.id === activeId;
            const href = `/admin/${tenantId}/${n.id}`;
            return (
              <Link
                key={n.id}
                href={href}
                className="flex items-center gap-2.5 px-3 py-2 mx-0 my-0.5 rounded-md text-[13px] transition-colors"
                style={{
                  background: on ? "rgba(255,255,255,0.07)" : "transparent",
                  color: on ? "#fff" : "#B6C0CE",
                  fontWeight: on ? 600 : 500,
                }}
              >
                <AdminIcon kind={n.icon} size={16} color={on ? "#fff" : "#8997A8"} />
                <span className="flex-1">{n.label}</span>
                {"badge" in n && n.badge && (
                  <span
                    className="text-[10px] font-bold rounded-full px-1.5 py-0.5"
                    style={{ color: "var(--color-gold)", background: "rgba(176,138,62,0.15)" }}
                  >
                    {n.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="px-3 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0"
              style={{ background: "var(--color-gold)", color: "var(--color-navy-deep)" }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold text-white truncate">{displayName}</div>
              <div className="text-[10.5px] truncate" style={{ color: "#A3B0C2" }}>{userEmail}</div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              title="Sign out"
              disabled={signingOut}
              className={signingOut ? "opacity-60 cursor-not-allowed" : undefined}
            >
              <AdminIcon kind="logout" size={15} color="#8997A8" />
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[10.5px]" style={{ color: "#A3B0C2" }}>
            <Link href="/terms" className="underline">Terms</Link>
            <span>·</span>
            <Link href="/privacy" className="underline">Privacy</Link>
          </div>
          {signOutError && (
            <p className="mt-1 text-[10.5px]" style={{ color: "#FCA5A5" }}>
              {signOutError}
            </p>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}

export function AdminTopbar({
  title,
  kicker,
  right,
}: {
  title: string;
  kicker?: string;
  right?: ReactNode;
}) {
  return (
    <div
      data-no-print
      className="h-[68px] px-7 flex items-center gap-4 flex-shrink-0 bg-white"
      style={{ borderBottom: "1px solid var(--color-rule)" }}
    >
      <div className="flex-1 min-w-0">
        {kicker && (
          <div
            className="text-[10.5px] font-bold tracking-[1.2px] uppercase"
            style={{ color: "var(--color-ink-dim)" }}
          >
            {kicker}
          </div>
        )}
        <h1
          className="font-serif text-[22px] font-medium m-0 leading-tight tracking-[-0.2px]"
          style={{ color: "var(--color-ink)" }}
        >
          {title}
        </h1>
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}
