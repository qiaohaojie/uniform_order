"use client";
import { useState } from "react";
import { Crest } from "@/components/crest";
import type { TenantRow } from "@/db/schema";
import { BrandingEditDrawer } from "./branding-edit-drawer";

export function BrandingCard({ tenant }: { tenant: TenantRow }) {
  const [editing, setEditing] = useState(false);

  return (
    <>
      <section className="bg-paper rounded-[10px] border border-rule p-5">
        <header className="flex items-start justify-between mb-4">
          <h2 className="font-serif text-lg font-semibold">Branding</h2>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm text-ink-dim hover:text-ink underline"
          >
            Edit
          </button>
        </header>

        <div className="flex items-center gap-4">
          {tenant.logoUrl ? (
            <img src={tenant.logoUrl} alt="" className="w-14 h-14 rounded-md object-cover border border-rule" />
          ) : (
            <Crest tenant={{ id: tenant.id, accent: tenant.accent, short: tenant.short }} size={56} />
          )}
          <div>
            <div className="font-serif text-base font-semibold">{tenant.name}</div>
            <div className="text-sm text-ink-dim">{tenant.short} · {tenant.accent}</div>
            {tenant.motto ? <div className="text-xs text-ink-dim italic mt-0.5">{tenant.motto}</div> : null}
          </div>
        </div>
      </section>

      {editing ? (
        <BrandingEditDrawer tenant={tenant} onClose={() => setEditing(false)} />
      ) : null}
    </>
  );
}
