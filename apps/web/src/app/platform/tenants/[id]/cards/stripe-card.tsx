"use client";
import { useState, useTransition } from "react";
import { resyncStripeStatus } from "../actions";
import type { tenants } from "@/db/schema";

type TenantRow = typeof tenants.$inferSelect;

export function StripeCard({ tenant }: { tenant: TenantRow }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onResync = () => {
    setMsg(null);
    startTransition(async () => {
      try {
        const r = await resyncStripeStatus(tenant.id);
        setMsg(r.ok ? "Synced." : (r.error ?? "Failed"));
      } catch {
        setMsg("Failed");
      }
    });
  };

  const stripeDashUrl = tenant.stripeAccountId
    ? `https://dashboard.stripe.com/connect/accounts/${tenant.stripeAccountId}`
    : null;

  return (
    <section className="bg-paper rounded-[10px] border border-rule p-5">
      <header className="flex items-start justify-between mb-4">
        <h2 className="font-serif text-lg font-semibold">Stripe Connect</h2>
        {stripeDashUrl ? (
          <a
            href={stripeDashUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-navy-deep underline"
          >
            Open Stripe ↗
          </a>
        ) : null}
      </header>

      <dl className="grid grid-cols-[140px_1fr] gap-y-2.5 text-sm">
        <dt className="text-ink-dim">Account ID</dt>
        <dd className="font-mono text-xs">{tenant.stripeAccountId ?? "—"}</dd>

        <dt className="text-ink-dim">Charges</dt>
        <dd>
          <Badge ok={!!tenant.stripeChargesEnabled} />
        </dd>

        <dt className="text-ink-dim">Payouts</dt>
        <dd>
          <Badge ok={!!tenant.stripePayoutsEnabled} />
        </dd>
      </dl>

      <div className="mt-5 pt-4 border-t border-rule flex items-center gap-3">
        <button
          type="button"
          onClick={onResync}
          disabled={pending || !tenant.stripeAccountId}
          className="h-8 px-3 rounded-md border border-rule text-xs font-semibold disabled:opacity-50"
        >
          {pending ? "Syncing…" : "Resync from Stripe"}
        </button>
        {msg ? <span className="text-xs text-ink-dim">{msg}</span> : null}
      </div>
    </section>
  );
}

function Badge({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full ${
        ok ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
      }`}
    >
      {ok ? "Enabled" : "Pending"}
    </span>
  );
}
