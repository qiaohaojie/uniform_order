"use client";
import { useState } from "react";
import type { TenantRow } from "@/db/schema";
import { createStripeStandardForTenant } from "../actions";

export function Step3Stripe({
  tenant,
  onContinue,
}: {
  tenant: TenantRow;
  onContinue: () => void;
}) {
  const [acctId, setAcctId] = useState<string | null>(tenant.stripeAccountId);
  const [link, setLink] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setPending(true);
    setError(null);
    const r = await createStripeStandardForTenant(tenant.id);
    setPending(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setAcctId(r.accountId);
    setLink(r.onboardingUrl);
  }

  async function copy() {
    if (link) await navigator.clipboard.writeText(link);
  }

  return (
    <div className="space-y-5">
      <h2 className="font-serif text-xl font-semibold">Step 3 of 6 · Stripe Connect</h2>
      <p className="text-sm text-ink-dim">
        We'll create a Stripe <strong>Standard</strong> account for {tenant.name}. Forward the onboarding link to the school's bursar.
      </p>
      {!acctId && (
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          className="h-10 px-5 rounded-md bg-navy-deep text-white font-semibold disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create Stripe Standard account"}
        </button>
      )}
      {acctId && (
        <div className="space-y-3">
          <div className="text-sm">
            Account: <code className="font-mono text-xs">{acctId}</code>
          </div>
          {link && (
            <div className="flex gap-2 items-center">
              <input value={link} readOnly className="flex-1 h-9 px-2 border border-rule rounded-md text-xs font-mono" />
              <button type="button" onClick={copy} className="h-9 px-3 rounded-md border border-rule text-xs">Copy</button>
            </div>
          )}
          <p className="text-xs text-ink-dim">
            Charges-enabled flag flips automatically when the school finishes onboarding (via the existing
            <code> account.updated</code> webhook). You can continue now and revisit this step later.
          </p>
        </div>
      )}
      {error && <div className="text-sm text-red-700">{error}</div>}
      <button
        type="button"
        onClick={onContinue}
        className="h-10 px-5 rounded-md bg-navy-deep text-white font-semibold"
      >
        Continue
      </button>
    </div>
  );
}
