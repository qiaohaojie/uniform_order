"use client";
import { useState } from "react";
import { deriveSlug, deriveShort, isValidSlug } from "@/lib/platform/slug";
import type { TenantRow } from "@/db/schema";
import { createTenantDraft } from "../actions";

export function Step1Identity({
  tenant,
  onContinue,
}: {
  tenant: TenantRow | null;
  onContinue: (id: string) => void;
}) {
  const [name, setName] = useState(tenant?.name ?? "");
  const [short, setShort] = useState(tenant?.short ?? "");
  const [id, setId] = useState(tenant?.id ?? "");
  const [motto, setMotto] = useState(tenant?.motto ?? "");
  const [address, setAddress] = useState(tenant?.address ?? "");
  const [shortDirty, setShortDirty] = useState(!!tenant?.short);
  const [idDirty, setIdDirty] = useState(!!tenant?.id);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function onName(v: string) {
    setName(v);
    const nextShort = shortDirty ? short : deriveShort(v);
    if (!shortDirty) setShort(nextShort);
    if (!idDirty) setId(deriveSlug(nextShort));
  }
  function onShort(v: string) {
    setShort(v);
    setShortDirty(true);
    if (!idDirty) setId(deriveSlug(v));
  }
  function onId(v: string) {
    setId(v);
    setIdDirty(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidSlug(id)) {
      setError("Slug must be 3–16 chars: lowercase letters, digits, hyphens; start with a letter.");
      return;
    }
    setPending(true);
    const result = await createTenantDraft({ name, short, id, motto: motto || undefined, address: address || undefined });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onContinue(result.id);
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <h2 className="font-serif text-xl font-semibold">Step 1 of 6 · School identity</h2>
      <Field label="Display name" value={name} onChange={onName} required />
      <Field label="Short code" value={short} onChange={onShort} hint="2–8 chars, used as initials in the crest." />
      <Field
        label="Slug"
        value={id}
        onChange={onId}
        hint={`URL: ${id || "<slug>"}.uniformorder.online`}
        disabled={!!tenant}
      />
      <Field label="Motto (optional)" value={motto} onChange={setMotto} />
      <Field label="Address (optional)" value={address} onChange={setAddress} />
      {error && <div className="text-sm text-red-700">{error}</div>}
      <button
        type="submit"
        disabled={pending}
        className="h-10 px-5 rounded-md bg-navy-deep text-white font-semibold disabled:opacity-60"
      >
        {pending ? "Saving…" : tenant ? "Continue" : "Create draft & continue"}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
  disabled,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <label className="block">
      <div className="text-[11px] font-bold uppercase tracking-[0.6px] mb-1.5">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        className="block w-full h-10 px-3 border border-rule rounded-md text-[13px] disabled:bg-parchment"
      />
      {hint && <div className="text-[11px] text-ink-dim mt-1.5">{hint}</div>}
    </label>
  );
}
