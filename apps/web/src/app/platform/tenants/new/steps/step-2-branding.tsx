"use client";
import { useState } from "react";
import { UploadButton } from "@/components/uploadthing";
import type { TenantRow } from "@/db/schema";
import { updateTenantBranding } from "../actions";

const PRESETS = ["#7A1F2B", "#0F4C5C", "#2F5D50", "#1F3A6E", "#4A2238", "#7A5418", "#0E2A47"];

export function Step2Branding({
  tenant,
  accent,
  logoUrl,
  onAccentChange,
  onLogoChange,
  onContinue,
}: {
  tenant: TenantRow;
  accent: string;
  logoUrl: string | null;
  onAccentChange: (v: string) => void;
  onLogoChange: (v: string | null) => void;
  onContinue: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    setError(null);
    const r = await updateTenantBranding(tenant.id, { logoUrl, accent });
    setPending(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    onContinue();
  }

  return (
    <div className="space-y-5">
      <h2 className="font-serif text-xl font-semibold">Step 2 of 6 · Branding</h2>

      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.6px] mb-2">School logo</div>
        <div className="flex gap-3.5 items-center">
          <div className="w-24 h-24 bg-parchment rounded-md flex items-center justify-center">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="max-w-full max-h-full" />
            ) : (
              <span className="text-xs text-ink-dim">No logo</span>
            )}
          </div>
          <UploadButton
            endpoint="tenantLogo"
            input={{ tenantId: tenant.id }}
            onClientUploadComplete={(res) => {
              const url = res?.[0]?.url ?? null;
              if (url) onLogoChange(url);
            }}
            onUploadError={(e) => setError(e.message)}
          />
        </div>
      </div>

      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.6px] mb-2">Accent colour</div>
        <div className="flex gap-2.5 items-center">
          {PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onAccentChange(c)}
              className={`w-11 h-11 rounded-full border ${accent === c ? "border-ink ring-2 ring-white" : "border-rule"}`}
              style={{ background: c }}
            />
          ))}
          <input
            type="text"
            value={accent}
            onChange={(e) => onAccentChange(e.target.value)}
            className="ml-2 h-9 w-28 px-2 border border-rule rounded-md text-xs font-mono"
          />
        </div>
      </div>

      {error && <div className="text-sm text-red-700">{error}</div>}
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="h-10 px-5 rounded-md bg-navy-deep text-white font-semibold disabled:opacity-60"
      >
        {pending ? "Saving…" : "Continue"}
      </button>
    </div>
  );
}
