"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { disableTenant, reEnableTenant, deleteUnusedTenant } from "../actions";
import type { TenantRow } from "@/db/schema";
import type { TenantStatus } from "@/lib/platform/queries";

export function DangerCard({
  tenant,
  status,
  canDelete,
}: {
  tenant: TenantRow;
  status: TenantStatus;
  canDelete: boolean;
}) {
  const router = useRouter();
  const isDisabled = status === "disabled";
  const [confirming, setConfirming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
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

  const onDelete = () => {
    setError(null);
    startTransition(async () => {
      try {
        const r = await deleteUnusedTenant(tenant.id);
        if (!r.ok) {
          setConfirmDelete(false);
          setError(r.error);
          return;
        }
        router.push("/platform/tenants");
        router.refresh();
      } catch (e) {
        setConfirmDelete(false);
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
          <Button
            size="sm"
            isPending={pending}
            onPress={() => run(() => reEnableTenant(tenant.id))}
          >
            Re-enable tenant
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-ink-dim">
            Disable hides the parent shop, blocks new orders, and removes this tenant from the public listing. Existing orders are preserved.
          </p>
          {confirming ? (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" isDisabled={pending} onPress={() => setConfirming(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="danger"
                isPending={pending}
                onPress={() => run(() => disableTenant(tenant.id))}
              >
                Confirm disable
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="danger" onPress={() => setConfirming(true)}>
              Disable tenant
            </Button>
          )}
        </div>
      )}

      {canDelete ? (
        <div className="mt-4 pt-4 border-t border-rule flex items-center justify-between gap-4">
          <p className="text-sm text-ink-dim">
            Delete this unused school (no orders). Catalog rows are removed. Cannot be undone.
          </p>
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" isDisabled={pending} onPress={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="danger"
                isPending={pending}
                onPress={onDelete}
                data-testid="platform-delete-tenant"
              >
                Confirm delete
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="danger"
              onPress={() => setConfirmDelete(true)}
              data-testid="platform-delete-tenant-start"
            >
              Delete unused school
            </Button>
          )}
        </div>
      ) : null}

      {error ? <div className="mt-3 text-xs text-alert">{error}</div> : null}
    </section>
  );
}
