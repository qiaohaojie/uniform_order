"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const YEAR_VALUES = ["7", "8", "9", "10", "11", "12"];

export type TenantOption = { id: string; name: string };

export type ChildFormInitial = {
  id?: string;
  tenantId?: string;
  name?: string;
  year?: string;        // canonical short form
  rollClass?: string | null;
};

export function ChildFormModal({
  mode,
  open,
  initial,
  tenants,
  onClose,
  onSaved,
}: {
  mode: "add" | "edit";
  open: boolean;
  initial: ChildFormInitial;
  tenants: TenantOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tenantId, setTenantId] = useState<string>(initial.tenantId ?? tenants[0]?.id ?? "");
  const [name, setName] = useState<string>(initial.name ?? "");
  const [year, setYear] = useState<string>(initial.year ?? "9");
  const [rollClass, setRollClass] = useState<string>(initial.rollClass ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTenantId(initial.tenantId ?? tenants[0]?.id ?? "");
    setName(initial.name ?? "");
    setYear(initial.year ?? "9");
    setRollClass(initial.rollClass ?? "");
    setError(null);
  }, [open, initial.id]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const url =
        mode === "add"
          ? "/api/parent/children"
          : `/api/parent/children/${initial.id}`;
      const method = mode === "add" ? "POST" : "PATCH";
      const body =
        mode === "add"
          ? { tenantId, name: name.trim(), year, rollClass: rollClass.trim() || null }
          : { name: name.trim(), year, rollClass: rollClass.trim() || null };

      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Save failed");
        return;
      }
      onSaved();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.4)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="child-form-title"
    >
      <div
        className="bg-white rounded-xl border shadow-xl w-full max-w-md mx-4 overflow-hidden"
        style={{ borderColor: "var(--color-rule)" }}
      >
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--color-rule)" }}
        >
          <h2 id="child-form-title" className="font-serif text-[18px] font-semibold" style={{ color: "var(--color-ink)" }}>
            {mode === "add" ? "Add a child" : "Edit child"}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-[16px]"
            style={{ color: "var(--color-ink-dim)", background: "var(--color-parchment)" }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          {error && (
            <div className="text-[12.5px] px-3 py-2 rounded" style={{ background: "#FEF2F2", color: "#B91C1C" }}>
              {error}
            </div>
          )}

          <div>
            <label className="type-label block mb-1" style={{ color: "var(--color-ink-dim)" }}>School *</label>
            <select
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              disabled={mode === "edit"}
              className="w-full h-9 border rounded-md px-3 text-[13px] outline-none bg-white disabled:opacity-60"
              style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {mode === "edit" && (
              <div className="text-[11px] mt-1" style={{ color: "var(--color-ink-dim)" }}>
                Remove and re-add to change school.
              </div>
            )}
          </div>

          <div>
            <label className="type-label block mb-1" style={{ color: "var(--color-ink-dim)" }}>Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="e.g. Tim"
              className="w-full h-9 border rounded-md px-3 text-[13px] outline-none"
              style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="type-label block mb-1" style={{ color: "var(--color-ink-dim)" }}>Year *</label>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full h-9 border rounded-md px-3 text-[13px] outline-none bg-white"
                style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
              >
                {YEAR_VALUES.map((y) => (
                  <option key={y} value={y}>Year {y}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="type-label block mb-1" style={{ color: "var(--color-ink-dim)" }}>Roll class</label>
              <input
                value={rollClass}
                onChange={(e) => setRollClass(e.target.value)}
                maxLength={20}
                placeholder="optional"
                className="w-full h-9 border rounded-md px-3 text-[13px] outline-none"
                style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
              />
            </div>
          </div>

          <div className="text-[11.5px] leading-[1.5]" style={{ color: "var(--color-ink-dim)" }}>
            We save this so you can re-order quickly. Edit or remove anytime.{" "}
            <Link href="/privacy" className="underline">Privacy notice</Link>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 h-9 rounded-md text-[13px]"
              style={{ background: "var(--color-parchment)", color: "var(--color-ink)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || name.trim().length === 0}
              className="px-4 h-9 rounded-md text-[13px] text-white disabled:opacity-50"
              style={{ background: "var(--color-navy)" }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
