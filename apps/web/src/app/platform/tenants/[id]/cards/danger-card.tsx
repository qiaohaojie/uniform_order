"use client";
import { useState, useTransition } from "react";
import { disableTenant, reEnableTenant } from "../actions";
import type { tenants } from "@/db/schema";
import type { TenantStatus } from "@/lib/platform/queries";

type TenantRow = typeof tenants.$inferSelect;

export function DangerCard({ tenant, status }: { tenant: TenantRow; status: TenantStatus }) {
  const isDisabled = status === "disabled";
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<unknown>) => {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        setConfirming(false);
      } catch (e) {
        setConfirming(false);
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  };

  return (
    <section className="bg-paper rounded-[10px] border border-rule p-5">
      <header className="mb-2">
        <h2 className="font-serif text-lg font-semibold text-alert">Danger zone</h2>
      </header>

      {isDisabled ? (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-ink-dim">
            This tenant is disabled. Parents see a 404 at <span className="font-mono">/{tenant.id}</span>.
            Re-enabling restores approval but keeps the public listing off until you flip it.
          </p>
          <button
            type="button"
            onClick={() => run(() => reEnableTenant(tenant.id))}
            disabled={pending}
            className="h-9 px-4 rounded-md bg-navy-deep text-white text-sm font-semibold whitespace-nowrap disabled:opacity-50"
          >
            {pending ? "Working…" : "Re-enable tenant"}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-ink-dim">
            Disable hides the parent shop, blocks new orders, and removes this tenant from the public listing. Existing orders are preserved.
          </p>
          {confirming ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={pending}
                className="h-9 px-3 rounded-md border border-rule text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => run(() => disableTenant(tenant.id))}
                disabled={pending}
                className="h-9 px-4 rounded-md bg-alert text-white text-sm font-semibold disabled:opacity-50"
              >
                {pending ? "Disabling…" : "Confirm disable"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="h-9 px-4 rounded-md border border-alert text-alert text-sm font-semibold whitespace-nowrap"
            >
              Disable tenant
            </button>
          )}
        </div>
      )}

      {error ? <div className="mt-3 text-xs text-alert">{error}</div> : null}
    </section>
  );
}
