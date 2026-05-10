"use client";
import { useState } from "react";
import type { TenantRow } from "@/db/schema";
import { updateTenantOperator } from "../actions";

export function Step3Operator({
  tenant,
  onContinue,
}: {
  tenant: TenantRow;
  onContinue: () => void;
}) {
  const [shopEmail, setShopEmail] = useState(tenant.shopEmail ?? "");
  const [shopHours, setShopHours] = useState(tenant.shopHours ?? "");
  const [collectionInstructions, setCollectionInstructions] = useState(tenant.collectionInstructions ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const r = await updateTenantOperator(tenant.id, { shopEmail, shopHours, collectionInstructions });
    setPending(false);
    if (!r.ok) {
      setError("Save failed.");
      return;
    }
    onContinue();
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <h2 className="font-serif text-xl font-semibold">Step 3 of 6 · Operator & shop contact</h2>
      <div>
        <label className="block">
          <div className="text-[11px] font-bold uppercase tracking-[0.6px] mb-1.5">Shop email</div>
          <input
            type="email"
            value={shopEmail}
            onChange={(e) => setShopEmail(e.target.value)}
            required
            className="block w-full h-10 px-3 border border-rule rounded-md text-[13px]"
          />
          <div className="text-[11px] text-amber-800 mt-1.5 bg-amber-50 px-2 py-1 rounded">
            <strong>This email is also the school's login.</strong> The operator will sign in with this address — make sure it's an inbox they can access.
          </div>
        </label>
      </div>
      <label className="block">
        <div className="text-[11px] font-bold uppercase tracking-[0.6px] mb-1.5">Shop hours (optional)</div>
        <input
          value={shopHours}
          onChange={(e) => setShopHours(e.target.value)}
          className="block w-full h-10 px-3 border border-rule rounded-md text-[13px]"
        />
      </label>
      <label className="block">
        <div className="text-[11px] font-bold uppercase tracking-[0.6px] mb-1.5">Collection instructions (optional)</div>
        <textarea
          value={collectionInstructions}
          onChange={(e) => setCollectionInstructions(e.target.value)}
          rows={4}
          className="block w-full px-3 py-2 border border-rule rounded-md text-[13px]"
        />
      </label>
      {error && <div className="text-sm text-red-700">{error}</div>}
      <button
        type="submit"
        disabled={pending}
        className="h-10 px-5 rounded-md bg-navy-deep text-white font-semibold disabled:opacity-60"
      >
        {pending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
