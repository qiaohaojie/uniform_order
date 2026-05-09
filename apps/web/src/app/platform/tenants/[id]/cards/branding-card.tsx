"use client";
import { useState, useTransition } from "react";
import { Crest } from "@/components/crest";
import { togglePublicListing } from "../actions";
import type { tenants } from "@/db/schema";

type TenantRow = typeof tenants.$inferSelect;

export function BrandingCard({ tenant }: { tenant: TenantRow }) {
  const [listed, setListed] = useState(tenant.isPubliclyListed);
  const [pending, startTransition] = useTransition();

  const onToggle = (next: boolean) => {
    setListed(next);
    startTransition(async () => {
      try {
        await togglePublicListing(tenant.id, next);
      } catch {
        setListed(!next);
      }
    });
  };

  return (
    <section className="bg-paper rounded-[10px] border border-rule p-5">
      <header className="flex items-start justify-between mb-4">
        <h2 className="font-serif text-lg font-semibold">Branding</h2>
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

      <div className="mt-5 pt-4 border-t border-rule flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Publicly listed</div>
          <div className="text-xs text-ink-dim mt-0.5">
            When on, this tenant appears on the public school picker at uniformorder.online.
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={listed}
          disabled={pending}
          onClick={() => onToggle(!listed)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
            listed ? "bg-navy-deep" : "bg-rule"
          } ${pending ? "opacity-60" : ""}`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
              listed ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
    </section>
  );
}
