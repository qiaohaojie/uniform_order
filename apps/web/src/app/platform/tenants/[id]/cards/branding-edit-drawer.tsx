"use client";

import { useEffect, useRef, useState } from "react";
import { UploadButton } from "@/components/uploadthing";
import { Crest } from "@/components/crest";
import { AccentPicker } from "@/components/platform/accent-picker";
import { BrandingPreview } from "@/components/platform/branding-preview";
import { editTenantBranding } from "../actions";
import type { TenantRow } from "@/db/schema";

export function BrandingEditDrawer({
  tenant,
  onClose,
}: {
  tenant: TenantRow;
  onClose: () => void;
}) {
  const [logoUrl, setLogoUrl] = useState<string | null>(tenant.logoUrl);
  const [accent, setAccent] = useState(tenant.accent);
  const [motto, setMotto] = useState<string>(tenant.motto ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Stable refs so the keydown listener isn't re-registered on every parent
  // render (parents typically pass an inline `() => setEditing(false)`), and
  // so async post-await setters can no-op once the drawer has unmounted.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const mountedRef = useRef(true);

  // Esc-to-close + lock body scroll while drawer is mounted.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      mountedRef.current = false;
    };
  }, []);

  async function save() {
    setError(null);
    setPending(true);
    const r = await editTenantBranding(tenant.id, {
      logoUrl,
      accent,
      motto: motto.trim() === "" ? undefined : motto.trim(),
    });
    if (!mountedRef.current) return;
    setPending(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    onClose();
  }

  const saveDisabled = pending || isUploading;

  return (
    <div className="fixed inset-0 z-40">
      {/* scrim */}
      <button
        type="button"
        aria-label="Close drawer"
        onClick={onClose}
        disabled={pending}
        className="absolute inset-0 bg-black/40 disabled:cursor-not-allowed"
      />
      {/* panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Edit branding"
        className="absolute right-0 top-0 h-full w-full max-w-[720px] bg-paper shadow-xl flex flex-col"
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-rule">
          <h2 className="font-serif text-lg font-semibold">Edit branding</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="Close"
            className="text-ink-dim hover:text-ink text-xl leading-none disabled:opacity-40"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 grid grid-cols-1 md:grid-cols-[1fr_320px] gap-5">
          {/* form */}
          <div className="space-y-5">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.6px] mb-2">School logo</div>
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-md border border-rule bg-parchment flex items-center justify-center overflow-hidden">
                  {logoUrl ? (
                    <img src={logoUrl} alt="" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <Crest tenant={{ id: tenant.id, accent, short: tenant.short }} size={48} ring={false} />
                  )}
                </div>
                <UploadButton
                  endpoint="tenantLogo"
                  input={{ tenantId: tenant.id }}
                  onUploadBegin={() => {
                    setError(null);
                    setIsUploading(true);
                  }}
                  onClientUploadComplete={(res) => {
                    setIsUploading(false);
                    const url = res?.[0]?.url ?? null;
                    if (url) setLogoUrl(url);
                  }}
                  onUploadError={(e) => {
                    setIsUploading(false);
                    setError(e.message);
                  }}
                />
                {logoUrl ? (
                  <button
                    type="button"
                    onClick={() => setLogoUrl(null)}
                    className="text-xs text-ink-dim hover:text-ink underline"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.6px] mb-2">Accent colour</div>
              <AccentPicker value={accent} onChange={setAccent} />
            </div>

            <div>
              <label
                htmlFor="motto-input"
                className="text-[11px] font-bold uppercase tracking-[0.6px] mb-2 block"
              >
                Motto <span className="font-normal opacity-60">(optional)</span>
              </label>
              <input
                id="motto-input"
                type="text"
                maxLength={200}
                value={motto}
                onChange={(e) => setMotto(e.target.value)}
                className="w-full h-9 px-2 border border-rule rounded-md text-sm"
                placeholder="e.g. Veritas et Virtus"
              />
            </div>
          </div>

          {/* preview */}
          <BrandingPreview
            tenantName={tenant.name}
            short={tenant.short}
            accent={accent}
            logoUrl={logoUrl}
            motto={motto.trim()}
          />
        </div>

        <footer className="px-5 py-4 border-t border-rule flex flex-col gap-2">
          {error ? <div className="text-sm text-alert">{error}</div> : null}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="h-10 px-4 rounded-md border border-rule text-ink disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saveDisabled}
              className="h-10 px-5 rounded-md bg-navy-deep text-white font-semibold disabled:opacity-60"
            >
              {pending ? "Saving…" : isUploading ? "Uploading…" : "Save changes"}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
