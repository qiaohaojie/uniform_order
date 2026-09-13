"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Alert, Button, Switch } from "@heroui/react";
import type { TenantRow } from "@/db/schema";
import type { TenantStatus } from "@/lib/platform/queries";
import { approveTenant, togglePublicListing } from "../actions";

const STATUS_LABEL: Record<TenantStatus, string> = {
  pending: "Pending approval",
  active: "Live",
  hidden: "Approved · shop off",
  disabled: "Disabled",
};

export function ShopStatusCard({
  tenant,
  status,
}: {
  tenant: TenantRow;
  status: TenantStatus;
}) {
  const approved = tenant.platformApprovalStatus === "approved";
  const [listed, setListed] = useState(tenant.isPubliclyListed);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setListed(tenant.isPubliclyListed);
  }, [tenant.isPubliclyListed]);

  const onApprove = () => {
    setError(null);
    setNote(null);
    startTransition(async () => {
      try {
        const r = await approveTenant(tenant.id);
        if (!r.ok) {
          setError(r.error);
          return;
        }
        setNote("Approved. Turn the shop on when the catalog is ready.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Approve failed");
      }
    });
  };

  const onToggleShop = (next: boolean) => {
    setError(null);
    setNote(null);
    setListed(next);
    startTransition(async () => {
      try {
        const r = await togglePublicListing(tenant.id, next);
        if (!r.ok) {
          setListed(!next);
          setError(r.error);
        }
      } catch (e) {
        setListed(!next);
        setError(e instanceof Error ? e.message : "Failed to update listing");
      }
    });
  };

  const stripeReady = !!tenant.stripeChargesEnabled;

  return (
    <section
      className="bg-paper rounded-[10px] border border-rule p-5"
      data-testid="platform-shop-status"
    >
      <header className="mb-4">
        <h2 className="font-serif text-lg font-semibold">Onboarding</h2>
        <p className="text-sm text-ink-dim mt-1">
          Assign the slug at create time, approve the school, then turn the parent shop on.
          Stripe can wait — checkout stays blocked until charges are enabled.
        </p>
      </header>

      <dl className="grid grid-cols-[140px_1fr] gap-y-2.5 text-sm">
        <dt className="text-ink-dim">DB slug</dt>
        <dd className="font-mono" data-testid="platform-slug">
          {tenant.id}
        </dd>
        <dt className="text-ink-dim">Shop URL</dt>
        <dd className="font-mono text-xs">/{tenant.id}</dd>
        <dt className="text-ink-dim">Status</dt>
        <dd data-testid="platform-approval-status">{STATUS_LABEL[status]}</dd>
        <dt className="text-ink-dim">Stripe charges</dt>
        <dd>{stripeReady ? "Enabled" : "Not ready"}</dd>
      </dl>

      {!stripeReady ? (
        <div className="mt-4">
          <Alert status="warning">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Stripe is not connected yet</Alert.Title>
              <Alert.Description>
                Parents can browse a live shop, but they cannot pay until Connect charges are
                enabled. Resume the onboarding wizard to create the Standard account.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm text-alert" data-testid="platform-shop-status-error">
          {error}
        </p>
      ) : null}
      {note ? (
        <p className="mt-3 text-sm text-green-800" data-testid="platform-shop-status-note">
          {note}
        </p>
      ) : null}

      <div className="mt-5 pt-4 border-t border-rule flex flex-wrap items-center gap-3">
        {status === "pending" || status === "disabled" ? (
          <Button
            size="sm"
            isPending={pending}
            onPress={onApprove}
            data-testid="platform-approve"
          >
            {status === "disabled" ? "Re-approve school" : "Approve school"}
          </Button>
        ) : (
          <Button size="sm" variant="secondary" isDisabled data-testid="platform-approve">
            Approved
          </Button>
        )}

        <div data-testid="platform-shop-live">
          <Switch
            isSelected={listed}
            isDisabled={!approved || pending}
            onChange={onToggleShop}
            aria-label="Turn parent shop on"
          >
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              Shop on
            </Switch.Content>
          </Switch>
        </div>

        {status === "pending" ? (
          <Link
            href={`/platform/tenants/new?id=${tenant.id}&step=2`}
            className="text-sm font-semibold text-navy-deep underline"
          >
            Resume wizard →
          </Link>
        ) : null}
      </div>
    </section>
  );
}
