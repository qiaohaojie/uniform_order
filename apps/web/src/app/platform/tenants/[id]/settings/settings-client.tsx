"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { InferSelectModel } from "drizzle-orm";
import type { tenants, tenantSettingEvents } from "@/db/schema";
import type { getTenantSettings, WorkflowMode } from "@/db/queries";
import { updateTenantSettingsAction } from "./actions";

type Tenant = InferSelectModel<typeof tenants>;
type TenantSettings = Awaited<ReturnType<typeof getTenantSettings>>;
type SettingEvent = InferSelectModel<typeof tenantSettingEvents>;

export function SettingsClient({
  tenant,
  settings,
  recentEvents,
}: {
  tenant: Tenant;
  settings: TenantSettings;
  recentEvents: SettingEvent[];
}) {
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>(settings.workflowMode);
  const [shippingEnabled, setShippingEnabled] = useState(settings.shippingEnabled);
  const [pickupEnabled, setPickupEnabled] = useState(settings.pickupEnabled);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const submit = () => {
    const trimmed = reason.trim();
    if (!trimmed) return;
    setError(null);
    setSaved(false);
    start(async () => {
      try {
        await updateTenantSettingsAction(
          tenant.id,
          { workflowMode, shippingEnabled, pickupEnabled },
          trimmed,
        );
        setReason("");
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  };

  return (
    <main className="max-w-2xl p-7 flex flex-col gap-5">
      <div>
        <Link
          href={`/platform/tenants/${tenant.id}`}
          className="text-sm font-semibold text-navy-deep underline"
        >
          ← Back to tenant
        </Link>
        <h1 className="font-serif text-2xl mt-2">{tenant.name} — workflow settings</h1>
      </div>

      <fieldset className="flex flex-col gap-2 border border-rule rounded p-3">
        <legend className="px-1 text-sm font-semibold">Workflow mode</legend>
        <label className="text-sm flex items-center gap-2">
          <input
            type="radio"
            checked={workflowMode === "standard"}
            onChange={() => setWorkflowMode("standard")}
          />
          Standard (4 columns: To prepare → Ready → Needs attention → Completed)
        </label>
        <label className="text-sm flex items-center gap-2">
          <input
            type="radio"
            checked={workflowMode === "simple"}
            onChange={() => setWorkflowMode("simple")}
          />
          Simple (2 columns: To prepare → Completed)
        </label>
        <p className="text-xs text-foreground/70 mt-1">
          Switching collapses display only — historical statuses are preserved.
        </p>
      </fieldset>

      <fieldset className="flex flex-col gap-2 border border-rule rounded p-3">
        <legend className="px-1 text-sm font-semibold">Fulfilment options</legend>
        <label className="text-sm flex items-center gap-2">
          <input
            type="checkbox"
            checked={shippingEnabled}
            onChange={(e) => setShippingEnabled(e.target.checked)}
          />
          Shipping enabled (offers Ship in checkout)
        </label>
        <label className="text-sm flex items-center gap-2">
          <input
            type="checkbox"
            checked={pickupEnabled}
            onChange={(e) => setPickupEnabled(e.target.checked)}
          />
          Pickup enabled
        </label>
      </fieldset>

      <label className="text-sm flex flex-col gap-1">
        Reason for change (required)
        <textarea
          className="border border-rule rounded p-2"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {saved && !error && <p className="text-sm text-green-700">Saved.</p>}

      <button
        className="bg-navy-deep text-white px-4 py-2 rounded self-start disabled:opacity-50"
        disabled={!reason.trim() || pending}
        onClick={submit}
      >
        {pending ? "Saving…" : "Save"}
      </button>

      <section className="mt-2">
        <h2 className="font-serif text-lg">Recent changes</h2>
        {recentEvents.length === 0 ? (
          <p className="text-sm text-foreground/60 mt-2">No changes yet.</p>
        ) : (
          <ul className="text-sm mt-2 flex flex-col gap-2">
            {recentEvents.map((e) => (
              <li key={e.id} className="border-b border-rule pb-2">
                <div className="text-xs text-foreground/60">
                  {new Date(e.createdAt).toLocaleString()}
                </div>
                <div>
                  <code className="text-xs">{e.settingKey}</code>: {e.oldValue ?? "—"}{" "}
                  → <strong>{e.newValue}</strong>
                </div>
                {e.reason && <div className="text-xs italic">&ldquo;{e.reason}&rdquo;</div>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
