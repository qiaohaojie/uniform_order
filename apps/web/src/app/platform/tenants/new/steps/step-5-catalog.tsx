"use client";
import { useEffect, useState } from "react";
import type { TenantRow } from "@/db/schema";
import { cloneCatalogFromTenant, listCloneSources } from "../actions";

export function Step5Catalog({
  tenant,
  onContinue,
}: {
  tenant: TenantRow;
  onContinue: () => void;
}) {
  const [sources, setSources] = useState<Array<{ id: string; name: string }>>([]);
  const [src, setSrc] = useState<string | "">("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCloneSources(tenant.id).then(setSources);
  }, [tenant.id]);

  async function clone() {
    if (!src) return;
    setPending(true);
    setError(null);
    const r = await cloneCatalogFromTenant(src, tenant.id);
    setPending(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setResult(`Copied ${r.copied} item(s).`);
  }

  return (
    <div className="space-y-5">
      <h2 className="font-serif text-xl font-semibold">Step 5 of 6 · Catalog</h2>
      <p className="text-sm text-ink-dim">
        Clone an existing school's catalog as a starting point, or skip and add items manually after go-live.
      </p>
      <div className="flex gap-2 items-center">
        <select
          value={src}
          onChange={(e) => setSrc(e.target.value)}
          className="h-10 px-3 border border-rule rounded-md text-[13px] flex-1"
        >
          <option value="">Choose a source tenant…</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={clone}
          disabled={!src || pending}
          className="h-10 px-4 rounded-md border border-navy-deep text-navy-deep text-sm font-semibold disabled:opacity-50"
        >
          Clone
        </button>
      </div>
      {result && <div className="text-sm text-green-700">{result}</div>}
      {error && <div className="text-sm text-red-700">{error}</div>}
      <p className="text-xs text-ink-dim">
        Catalog editing in <code>/admin/{tenant.id}/catalog</code> is gated until the tenant is approved (Step 6).
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onContinue}
          className="h-10 px-5 rounded-md bg-navy-deep text-white font-semibold"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
