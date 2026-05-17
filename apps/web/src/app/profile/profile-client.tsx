"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MobileShell } from "@/components/mobile-shell";
import { BottomNav } from "@/components/bottom-nav";
import { authClient } from "@/lib/auth/client";
import { clearActiveChildCookieClient } from "@/lib/active-child.client";

function getInitials(displayName: string, email: string): string {
  const source = displayName.trim() || email;
  // If we used the email, take just the first letter of the local part.
  if (!displayName.trim()) {
    return (email[0] ?? "U").toUpperCase();
  }
  return (
    source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "U"
  );
}

export type ProfileTenant = {
  id: string;
  short: string;
  shopEmail: string | null;
};

export type ProfileClientProps = {
  user: {
    name: string | null;
    email: string;
    image: string | null;
  };
  childrenCount: number;
  tenants: ProfileTenant[]; // unique tenants of the parent's children, sorted by short
};

export function ProfileClient({ user, childrenCount, tenants }: ProfileClientProps) {
  const displayName = user.name?.trim() || user.email;
  const initials = getInitials(user.name ?? "", user.email);

  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const handleSignOut = async () => {
    setSignOutError(null);
    setSigningOut(true);
    try {
      await authClient.signOut();
      clearActiveChildCookieClient();
      router.replace("/");
      router.refresh();
    } catch {
      setSignOutError("Couldn't sign out. Try again.");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <MobileShell bg="var(--color-paper)">
      <div className="px-4 pt-3 pb-3 flex items-center flex-shrink-0">
        <div className="flex-1 text-center font-serif text-[17px] font-semibold" style={{ color: "var(--color-navy)" }}>
          Profile
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        <div
          className="rounded-[14px] border bg-white p-4 mb-3 flex items-center gap-3"
          style={{
            borderColor: "var(--color-rule)",
            boxShadow: "0 1px 0 rgba(15,30,50,0.04), 0 8px 24px -16px rgba(15,30,50,0.10)",
          }}
        >
          {user.image ? (
            <img
              alt=""
              src={user.image}
              className="w-[52px] h-[52px] rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div
              className="w-[52px] h-[52px] rounded-full flex items-center justify-center text-white font-serif text-[20px] font-medium flex-shrink-0"
              style={{ background: "var(--color-navy-deep)" }}
            >
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div
              className="font-serif text-[17px] font-semibold leading-[1.15] truncate"
              style={{ color: "var(--color-ink)" }}
            >
              {displayName}
            </div>
            <div
              className="text-[12px] mt-0.5 truncate"
              style={{ color: "var(--color-ink-dim)" }}
            >
              {user.email}
            </div>
          </div>
        </div>

        <Link
          href="/"
          className="block rounded-[14px] border bg-white p-4 mb-3"
          style={{
            borderColor: "var(--color-rule)",
            boxShadow: "0 1px 0 rgba(15,30,50,0.04), 0 8px 24px -16px rgba(15,30,50,0.10)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[13.5px] font-medium" style={{ color: "var(--color-ink)" }}>
              My children
            </span>
            <span className="text-[12px] flex items-center gap-1.5" style={{ color: "var(--color-ink-dim)" }}>
              {childrenCount === 0 ? "0 saved" : `${childrenCount} saved`}
              <span style={{ color: "var(--color-rule)" }}>›</span>
            </span>
          </div>
        </Link>

        {tenants.some((t) => t.shopEmail) && (
          <div
            className="rounded-[14px] border bg-white mb-3 overflow-hidden"
            style={{
              borderColor: "var(--color-rule)",
              boxShadow: "0 1px 0 rgba(15,30,50,0.04), 0 8px 24px -16px rgba(15,30,50,0.10)",
            }}
          >
            {tenants
              .filter((t) => t.shopEmail)
              .map((t, i) => (
                <a
                  key={t.id}
                  href={`mailto:${t.shopEmail}`}
                  className="block px-4 py-3 flex items-center justify-between"
                  style={{
                    color: "var(--color-ink)",
                    borderTop: i === 0 ? undefined : "1px solid var(--color-rule)",
                  }}
                >
                  <span className="text-[13.5px] font-medium">Email {t.short}</span>
                  <span style={{ color: "var(--color-rule)" }}>›</span>
                </a>
              ))}
          </div>
        )}

        <div
          className="rounded-[14px] border bg-white mb-3 overflow-hidden"
          style={{
            borderColor: "var(--color-rule)",
            boxShadow: "0 1px 0 rgba(15,30,50,0.04), 0 8px 24px -16px rgba(15,30,50,0.10)",
          }}
        >
          {tenants.map((t, i) => (
            <Link
              key={`refund-${t.id}`}
              href={`/${t.id}/refund-policy`}
              className="block px-4 py-3 flex items-center justify-between"
              style={{
                color: "var(--color-ink)",
                borderTop: i === 0 ? undefined : "1px solid var(--color-rule)",
              }}
            >
              <span className="text-[13.5px] font-medium">Refund policy · {t.short}</span>
              <span style={{ color: "var(--color-rule)" }}>›</span>
            </Link>
          ))}
          <Link
            href="/privacy"
            className="block px-4 py-3 flex items-center justify-between"
            style={{
              color: "var(--color-ink)",
              borderTop: tenants.length === 0 ? undefined : "1px solid var(--color-rule)",
            }}
          >
            <span className="text-[13.5px] font-medium">Privacy</span>
            <span style={{ color: "var(--color-rule)" }}>›</span>
          </Link>
          <Link
            href="/terms"
            className="block px-4 py-3 flex items-center justify-between"
            style={{
              color: "var(--color-ink)",
              borderTop: "1px solid var(--color-rule)",
            }}
          >
            <span className="text-[13.5px] font-medium">Terms of service</span>
            <span style={{ color: "var(--color-rule)" }}>›</span>
          </Link>
        </div>

        <div className="mt-2">
          {signOutError && (
            <div
              className="text-[12px] font-semibold text-center mb-2 py-2 px-3 rounded-[10px]"
              style={{ color: "#B23A2A", background: "rgba(178,58,42,0.06)" }}
            >
              {signOutError}
            </div>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full py-3.5 rounded-[14px] border bg-white text-[13px] font-semibold disabled:opacity-60"
            style={{
              borderColor: "var(--color-rule)",
              color: "#B23A2A",
              boxShadow: "0 1px 0 rgba(15,30,50,0.04), 0 8px 24px -16px rgba(15,30,50,0.10)",
            }}
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>

      <BottomNav active="profile" />
    </MobileShell>
  );
}
