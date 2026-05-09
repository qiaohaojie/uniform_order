"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TenantRow } from "@/db/schema";
import { finalizeTenantGoLive } from "../actions";

export function Step6GoLive({
  tenant,
  catalogCount,
}: {
  tenant: TenantRow;
  catalogCount: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiredChecks = [
    { ok: !!tenant.name && !!tenant.short, label: "Identity set" },
    { ok: !!tenant.accent, label: "Branding set" },
    { ok: !!tenant.stripeAccountId, label: "Stripe account created" },
    { ok: !!tenant.stripeChargesEnabled, label: "Stripe charges enabled" },
    { ok: !!tenant.shopEmail, label: "Shop email set" },
  ];

  const informational = [
    {
      ok: catalogCount > 0,
      label: catalogCount > 0
        ? `Catalog has ${catalogCount} item${catalogCount === 1 ? "" : "s"}`
        : "Catalog is empty — tenant will go live as Hidden until items are added",
      blocking: false,
    },
  ];

  const allOk = requiredChecks.every((c) => c.ok);

  async function go() {
    setPending(true);
    setError(null);
    const r = await finalizeTenantGoLive(tenant.id);
    setPending(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    router.push(`/platform/tenants/${tenant.id}`);
  }

  return (
    <div className="space-y-5">
      <h2 className="font-serif text-xl font-semibold">Step 6 of 6 · Go live</h2>
      <ul className="space-y-2">
        {requiredChecks.map((c) => (
          <li key={c.label} className="flex items-center gap-2 text-sm">
            <span className={c.ok ? "text-green-600" : "text-red-600"}>
              {c.ok ? "✓" : "✗"}
            </span>
            <span className={c.ok ? "" : "text-ink-dim"}>{c.label}</span>
          </li>
        ))}
        {informational.map((c) => (
          <li key={c.label} className="flex items-center gap-2 text-sm">
            <span className={c.ok ? "text-green-600" : "text-amber-600"}>
              {c.ok ? "✓" : "ⓘ"}
            </span>
            <span className="text-ink-dim">{c.label}</span>
          </li>
        ))}
      </ul>
      {error && <div className="text-sm text-red-700">{error}</div>}
      <button
        type="button"
        onClick={go}
        disabled={!allOk || pending}
        className="h-10 px-5 rounded-md bg-navy-deep text-white font-semibold disabled:opacity-50"
      >
        {pending ? "Going live…" : "Go live"}
      </button>
      <p className="text-xs text-ink-dim">
        Setting <code>platformApprovalStatus=approved</code>. Public listing is enabled only if catalog has items; otherwise the tenant goes live as Hidden and you toggle public listing from the tenant detail page after adding items. Reversible.
      </p>
    </div>
  );
}
