"use client";

import { useEffect, useRef, useState } from "react";
import type { TenantRow, TenantLegalVersionRow } from "@/db/schema";
import { editTenantLegal } from "../actions";

type Mode = "text" | "url";

export function LegalEditDrawer({
  tenant,
  currentVersion,
  onClose,
}: {
  tenant: TenantRow;
  currentVersion: TenantLegalVersionRow | null;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>(currentVersion?.policyMode ?? "text");
  const [policyText, setPolicyText] = useState<string>(currentVersion?.policyText ?? "");
  const [policyUrl, setPolicyUrl] = useState<string>(currentVersion?.policyUrl ?? "");
  const [aclAck, setAclAck] = useState<boolean>(currentVersion?.aclAcknowledged ?? false);
  const [sorAck, setSorAck] = useState<boolean>(
    currentVersion?.sellerOfRecordAcknowledged ?? false,
  );
  const [declarantName, setDeclarantName] = useState<string>(
    currentVersion?.declarantName ?? "",
  );
  const [declarantRole, setDeclarantRole] = useState<string>(
    currentVersion?.declarantRole ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Stable refs so the keydown listener isn't re-registered on every parent
  // render (parents typically pass an inline `() => setEditing(false)`), and
  // so async post-await setters can no-op once the drawer has unmounted.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const mountedRef = useRef(true);
  // Read pending via a ref inside the keydown closure so the effect's deps can
  // stay [] — depending on [pending] would trip mountedRef.current = false on
  // every pending toggle, which is a real bug (mid-save state would silently
  // no-op the post-await setters).
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  useEffect(() => {
    // React 18+ Strict Mode runs effects setup → cleanup → setup on initial
    // mount in dev. Reset mountedRef on every setup so the previous cleanup's
    // `mountedRef.current = false` doesn't permanently disable post-await
    // setters (the bug: save() would await, hit `if (!mountedRef.current)
    // return`, and leave pending=true forever — drawer stuck on "Saving…").
    mountedRef.current = true;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pendingRef.current) onCloseRef.current();
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

    const payload =
      mode === "text"
        ? {
            mode: "text" as const,
            policyText,
            aclAcknowledged: aclAck,
            sellerOfRecordAcknowledged: sorAck,
            declarantName: declarantName.trim(),
            declarantRole: declarantRole.trim(),
          }
        : {
            mode: "url" as const,
            policyUrl: policyUrl.trim(),
            aclAcknowledged: aclAck,
            sellerOfRecordAcknowledged: sorAck,
            declarantName: declarantName.trim(),
            declarantRole: declarantRole.trim(),
          };

    const r = await editTenantLegal(tenant.id, payload);
    if (!mountedRef.current) return;
    setPending(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    onClose();
  }

  const contentValid =
    mode === "text"
      ? policyText.trim().length >= 50
      : policyUrl.trim().length > 0 && /^https:\/\//i.test(policyUrl.trim());
  const declarantValid = declarantName.trim().length > 0 && declarantRole.trim().length > 0;
  const saveDisabled = pending || !contentValid || !aclAck || !sorAck || !declarantValid;

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Close drawer"
        onClick={onClose}
        disabled={pending}
        className="absolute inset-0 bg-black/40 disabled:cursor-not-allowed"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Edit legal & refund policy"
        className="absolute right-0 top-0 h-full w-full max-w-[640px] bg-paper shadow-xl flex flex-col"
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-rule">
          <h2 className="font-serif text-lg font-semibold">Edit legal &amp; refund policy</h2>
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

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <fieldset>
            <legend className="text-[11px] font-bold uppercase tracking-[0.6px] mb-2">
              Policy source
            </legend>
            <div className="flex gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="legal-mode"
                  value="text"
                  checked={mode === "text"}
                  onChange={() => setMode("text")}
                />
                Write policy text
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="legal-mode"
                  value="url"
                  checked={mode === "url"}
                  onChange={() => setMode("url")}
                />
                Link to external URL
              </label>
            </div>
          </fieldset>

          {mode === "text" ? (
            <div>
              <label
                htmlFor="legal-text-input"
                className="text-[11px] font-bold uppercase tracking-[0.6px] mb-2 block"
              >
                Policy text <span className="font-normal opacity-60">(min 50 chars)</span>
              </label>
              <textarea
                id="legal-text-input"
                rows={14}
                value={policyText}
                onChange={(e) => setPolicyText(e.target.value)}
                className="w-full px-2 py-2 border border-rule rounded-md text-sm font-mono"
                placeholder="Paste or type your refund / exchange policy here…"
              />
            </div>
          ) : (
            <div>
              <label
                htmlFor="legal-url-input"
                className="text-[11px] font-bold uppercase tracking-[0.6px] mb-2 block"
              >
                Policy URL <span className="font-normal opacity-60">(must be HTTPS)</span>
              </label>
              <input
                id="legal-url-input"
                type="url"
                value={policyUrl}
                onChange={(e) => setPolicyUrl(e.target.value)}
                className="w-full h-9 px-2 border border-rule rounded-md text-sm"
                placeholder="https://example.school.nsw.edu.au/refund-policy"
              />
            </div>
          )}

          <div className="space-y-3 border-t border-rule pt-4">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={aclAck}
                onChange={(e) => setAclAck(e.target.checked)}
                className="mt-1"
              />
              <span>
                We confirm this refund policy complies with Australian Consumer Law and we accept
                responsibility for honoring it for purchases via uniformorder.online.
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={sorAck}
                onChange={(e) => setSorAck(e.target.checked)}
                className="mt-1"
              />
              <span>
                We acknowledge we are seller of record under Stripe Connect for purchases via
                uniformorder.online.
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-rule pt-4">
            <div>
              <label
                htmlFor="legal-declarant-name"
                className="text-[11px] font-bold uppercase tracking-[0.6px] mb-2 block"
              >
                Declarant name
              </label>
              <input
                id="legal-declarant-name"
                type="text"
                maxLength={120}
                value={declarantName}
                onChange={(e) => setDeclarantName(e.target.value)}
                className="w-full h-9 px-2 border border-rule rounded-md text-sm"
                placeholder="e.g. Jane Smith"
              />
            </div>
            <div>
              <label
                htmlFor="legal-declarant-role"
                className="text-[11px] font-bold uppercase tracking-[0.6px] mb-2 block"
              >
                Declarant role
              </label>
              <input
                id="legal-declarant-role"
                type="text"
                maxLength={120}
                value={declarantRole}
                onChange={(e) => setDeclarantRole(e.target.value)}
                className="w-full h-9 px-2 border border-rule rounded-md text-sm"
                placeholder="e.g. Bursar"
              />
            </div>
          </div>
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
              {pending ? "Saving…" : "Save policy"}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
