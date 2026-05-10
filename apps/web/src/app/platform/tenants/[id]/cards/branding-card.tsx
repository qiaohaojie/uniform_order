"use client";
import { useEffect, useState, useTransition } from "react";
import { Crest } from "@/components/crest";
import { togglePublicListing } from "../actions";
import type { tenants } from "@/db/schema";
import { BrandingEditDrawer } from "./branding-edit-drawer";

type TenantRow = typeof tenants.$inferSelect;

export function BrandingCard({ tenant }: { tenant: TenantRow }) {
  const [listed, setListed] = useState(tenant.isPubliclyListed);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  // Resync local state when the RSC re-renders with a fresh tenant prop
  // (e.g. after revalidatePath from any sibling action).
  useEffect(() => {
    setListed(tenant.isPubliclyListed);
  }, [tenant.isPubliclyListed]);

  const onToggle = (next: boolean) => {
    setError(null);
    setListed(next);
    startTransition(async () => {
      try {
        await togglePublicListing(tenant.id, next);
      } catch (e) {
        setListed(!next);
        setError(e instanceof Error ? e.message : "Failed to update");
      }
    });
  };

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

        <div className="mt-5 pt-4 border-t border-rule flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Publicly listed</div>
            <div className="text-xs text-ink-dim mt-0.5">
              When on, this tenant appears on the public school picker at uniformorder.online.
            </div>
            {error ? <div className="text-xs text-alert mt-1">{error}</div> : null}
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

      {editing ? (
        <BrandingEditDrawer tenant={tenant} onClose={() => setEditing(false)} />
      ) : null}
    </>
  );
}
