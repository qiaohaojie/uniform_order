"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { Tenant } from "@/lib/data";

interface StripeStatus {
  connected: boolean;
  accountId?: string;
  payoutsEnabled?: boolean;
  chargesEnabled?: boolean;
  detailsSubmitted?: boolean;
}

interface NotifToggle {
  label: string;
  sub: string;
  on: boolean;
}

export function SettingsClient({
  tenantId,
  tenant,
}: {
  tenantId: string;
  tenant: Tenant;
}) {
  const searchParams = useSearchParams();
  const stripeResult = searchParams.get("stripe"); // "success" | "refresh" | null

  const [name, setName] = useState(tenant.name);
  const [shopEmail, setShopEmail] = useState(tenant.shopEmail ?? "");
  const [address, setAddress] = useState(tenant.address ?? "");
  const [shopHours, setShopHours] = useState(tenant.shopHours ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [stripeLoading, setStripeLoading] = useState(true);
  const [stripeConnecting, setStripeConnecting] = useState(false);

  const [notifs, setNotifs] = useState<NotifToggle[]>([
    { label: "New order received", sub: "Sent to shop email when a new order is placed", on: true },
    { label: "Order ready for pickup", sub: "Notify parent when order is marked ready", on: true },
    { label: "Order collected", sub: "Confirmation email to parent after collection", on: false },
    { label: "Weekly sales digest", sub: "Summary of orders and revenue every Monday", on: true },
  ]);

  // Check Stripe Connect status on mount
  useEffect(() => {
    const checkStripe = async () => {
      try {
        const res = await fetch(`/api/stripe/connect?tenantId=${tenantId}`);
        if (res.ok) {
          const data = await res.json();
          setStripeStatus(data);
        }
      } catch (err) {
        console.error("Failed to check Stripe status:", err);
      } finally {
        setStripeLoading(false);
      }
    };
    checkStripe();
  }, [tenantId, stripeResult]);

  // Show banner if returning from Stripe
  const showSuccessBanner = stripeResult === "success";
  const showRefreshBanner = stripeResult === "refresh";

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/tenant/${tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, shopEmail, address, shopHours }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleStripeConnect = async () => {
    setStripeConnecting(true);
    try {
      const res = await fetch("/api/stripe/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      if (res.ok) {
        const { url } = await res.json();
        window.location.href = url;
      } else {
        const data = await res.json();
        alert(data.error ?? "Failed to start Stripe Connect onboarding.");
      }
    } catch (err) {
      console.error("Stripe Connect error:", err);
      alert("Network error. Please try again.");
    } finally {
      setStripeConnecting(false);
    }
  };

  const toggleNotif = (i: number) => {
    setNotifs((prev) => prev.map((n, idx) => (idx === i ? { ...n, on: !n.on } : n)));
  };

  return (
    <div className="flex-1 overflow-y-auto p-7">
      <div className="max-w-2xl mx-auto flex flex-col gap-5">

        {/* Return banners */}
        {showSuccessBanner && (
          <div className="px-4 py-3 rounded-lg text-[13px] font-semibold" style={{ background: "#ECFDF5", color: "#065F46" }}>
            ✓ Stripe Connect setup complete. Your account is now connected.
          </div>
        )}
        {showRefreshBanner && (
          <div className="px-4 py-3 rounded-lg text-[13px] font-semibold" style={{ background: "#FFFBEB", color: "#92400E" }}>
            Stripe onboarding was not completed. Please try again.
          </div>
        )}

        {/* Shop details */}
        <section className="bg-white rounded-xl border p-6" style={{ borderColor: "var(--color-rule)" }}>
          <h2 className="type-h2 mb-4" style={{ color: "var(--color-ink)" }}>Shop details</h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.6px] mb-1.5" style={{ color: "var(--color-ink-dim)" }}>
                School name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-10 border rounded-md px-3 text-[13px] outline-none"
                style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)", fontFamily: "var(--font-sans)" }}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.6px] mb-1.5" style={{ color: "var(--color-ink-dim)" }}>
                  Shop email
                </label>
                <input
                  value={shopEmail}
                  onChange={(e) => setShopEmail(e.target.value)}
                  className="w-full h-10 border rounded-md px-3 text-[13px] outline-none"
                  style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)", fontFamily: "var(--font-sans)" }}
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.6px] mb-1.5" style={{ color: "var(--color-ink-dim)" }}>
                  Shop hours
                </label>
                <input
                  value={shopHours}
                  onChange={(e) => setShopHours(e.target.value)}
                  className="w-full h-10 border rounded-md px-3 text-[13px] outline-none"
                  style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)", fontFamily: "var(--font-sans)" }}
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.6px] mb-1.5" style={{ color: "var(--color-ink-dim)" }}>
                Address
              </label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full h-10 border rounded-md px-3 text-[13px] outline-none"
                style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)", fontFamily: "var(--font-sans)" }}
              />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="h-9 px-4 text-[12.5px] font-semibold rounded-md text-white disabled:opacity-60"
                style={{ background: tenant.accent }}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
              {saved && (
                <span className="text-[12.5px] font-semibold" style={{ color: "var(--color-success)" }}>
                  ✓ Saved
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Fulfilment */}
        <section className="bg-white rounded-xl border p-6" style={{ borderColor: "var(--color-rule)" }}>
          <h2 className="type-h2 mb-4" style={{ color: "var(--color-ink)" }}>Fulfilment</h2>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-semibold" style={{ color: "var(--color-ink)" }}>Pickup at school office</div>
                <div className="text-[12px]" style={{ color: "var(--color-ink-dim)" }}>Free · Ready in 1–2 school days</div>
              </div>
              <div className="w-10 h-6 rounded-full relative cursor-pointer" style={{ background: tenant.accent }}>
                <div className="absolute right-1 top-1 w-4 h-4 rounded-full bg-white" />
              </div>
            </div>
            <div className="h-px" style={{ background: "var(--color-rule)" }} />
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-semibold" style={{ color: "var(--color-ink)" }}>Ship to home</div>
                <div className="text-[12px]" style={{ color: "var(--color-ink-dim)" }}>$9.50 flat rate · 3–5 business days</div>
              </div>
              <div className="w-10 h-6 rounded-full relative cursor-pointer" style={{ background: tenant.accent }}>
                <div className="absolute right-1 top-1 w-4 h-4 rounded-full bg-white" />
              </div>
            </div>
          </div>
        </section>

        {/* Stripe Connect */}
        <section className="bg-white rounded-xl border p-6" style={{ borderColor: "var(--color-rule)" }}>
          <h2 className="type-h2 mb-1" style={{ color: "var(--color-ink)" }}>Stripe Connect</h2>
          <p className="text-[12.5px] mb-4" style={{ color: "var(--color-ink-dim)" }}>
            Connect a bank account to receive payouts. The platform collects a 2.9% + $0.30 fee per transaction.
          </p>

          {stripeLoading ? (
            <div className="text-[12.5px]" style={{ color: "var(--color-ink-dim)" }}>Checking connection…</div>
          ) : stripeStatus?.connected && stripeStatus.detailsSubmitted ? (
            <div
              className="flex items-center gap-3 p-3.5 rounded-lg border"
              style={{ borderColor: "var(--color-rule)", background: "var(--color-parchment)" }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "var(--color-success)" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M5 13 L10 18 L20 6" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold" style={{ color: "var(--color-ink)" }}>
                  Connected · {stripeStatus.accountId}
                </div>
                <div className="text-[11.5px]" style={{ color: "var(--color-ink-dim)" }}>
                  {stripeStatus.payoutsEnabled ? "Payouts enabled" : "Payouts pending"} ·{" "}
                  {stripeStatus.chargesEnabled ? "Charges enabled" : "Charges pending"}
                </div>
              </div>
              <a
                href={`https://dashboard.stripe.com/test/connect/accounts/${stripeStatus.accountId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="h-8 px-3 text-[12px] font-semibold rounded border flex items-center gap-1"
                style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
              >
                Manage in Stripe →
              </a>
            </div>
          ) : stripeStatus?.connected && !stripeStatus.detailsSubmitted ? (
            <div
              className="flex items-center gap-3 p-3.5 rounded-lg border"
              style={{ borderColor: "#FDE68A", background: "#FFFBEB" }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "#F59E0B" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 9v4M12 17h.01" />
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-semibold" style={{ color: "#92400E" }}>
                  Onboarding incomplete
                </div>
                <div className="text-[11.5px]" style={{ color: "#B45309" }}>
                  Please complete your Stripe account setup to receive payouts.
                </div>
              </div>
              <button
                onClick={handleStripeConnect}
                disabled={stripeConnecting}
                className="h-8 px-3 text-[12px] font-semibold rounded text-white disabled:opacity-60"
                style={{ background: "#F59E0B" }}
              >
                {stripeConnecting ? "Redirecting…" : "Continue setup"}
              </button>
            </div>
          ) : (
            <div
              className="flex items-center gap-3 p-3.5 rounded-lg border"
              style={{ borderColor: "var(--color-rule)", background: "var(--color-parchment)" }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "var(--color-rule)" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink-dim)" strokeWidth="2" strokeLinecap="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" />
                  <path d="M1 10h22" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-semibold" style={{ color: "var(--color-ink)" }}>
                  No bank account connected
                </div>
                <div className="text-[11.5px]" style={{ color: "var(--color-ink-dim)" }}>
                  Connect via Stripe to start receiving payouts from orders.
                </div>
              </div>
              <button
                onClick={handleStripeConnect}
                disabled={stripeConnecting}
                className="h-8 px-3 text-[12px] font-semibold rounded text-white disabled:opacity-60"
                style={{ background: tenant.accent }}
              >
                {stripeConnecting ? "Redirecting…" : "Connect bank account"}
              </button>
            </div>
          )}
        </section>

        {/* Email notifications */}
        <section className="bg-white rounded-xl border p-6" style={{ borderColor: "var(--color-rule)" }}>
          <h2 className="type-h2 mb-4" style={{ color: "var(--color-ink)" }}>Email notifications</h2>
          {notifs.map((n, i) => (
            <div
              key={n.label}
              className="flex items-center justify-between py-3 border-b last:border-0"
              style={{ borderColor: "var(--color-rule)" }}
            >
              <div>
                <div className="text-[13px] font-semibold" style={{ color: "var(--color-ink)" }}>{n.label}</div>
                <div className="text-[11.5px]" style={{ color: "var(--color-ink-dim)" }}>{n.sub}</div>
              </div>
              <button
                onClick={() => toggleNotif(i)}
                className="w-10 h-6 rounded-full relative flex-shrink-0 transition-colors"
                style={{ background: n.on ? tenant.accent : "var(--color-rule)" }}
              >
                <div
                  className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
                  style={{ left: n.on ? "calc(100% - 20px)" : 4 }}
                />
              </button>
            </div>
          ))}
        </section>

      </div>
    </div>
  );
}
