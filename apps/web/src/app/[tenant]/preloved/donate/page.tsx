import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, Chip } from "@heroui/react";
import { getTenant } from "@/db/queries";
import { getPrelovedSettings } from "@/db/preloved-queries";
import { getSessionUser, isPlatformAdminEmail } from "@/lib/auth/authorization";
import { MobileShell } from "@/components/mobile-shell";
import { TenantFooter } from "@/components/tenant-footer";
import { DonateScreen } from "./donate-screen";

const WASH_RULES = [
  "Current school uniform only — not old styles or non-uniform clothing",
  "Washed before you drop the bag",
  "No stains or holes",
  "Name labels removed",
] as const;

function displayOrFallback(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function formatRefuseItem(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string }>;
}): Promise<Metadata> {
  const { tenant: slug } = await params;
  const tenant = await getTenant(slug);
  if (!tenant) return { title: "Donate preloved" };
  return { title: `Donate preloved — ${tenant.name}`, robots: { index: true } };
}

export default async function DonatePage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const tenant = await getTenant(slug);
  if (!tenant) notFound();

  const isVisibleToPublic =
    tenant.isPubliclyListed && tenant.platformApprovalStatus === "approved";
  if (!isVisibleToPublic) {
    const user = await getSessionUser();
    if (!user || !isPlatformAdminEmail(user.email)) notFound();
  }

  const settings = await getPrelovedSettings(tenant.id);
  if (!settings.prelovedEnabled) notFound();

  const shopHours = displayOrFallback(
    tenant.shopHours,
    "Ask the uniform shop for opening times.",
  );
  const address = displayOrFallback(
    tenant.address,
    "Ask the uniform shop for the drop-off address.",
  );
  const collectionInstructions = displayOrFallback(
    tenant.collectionInstructions,
    "Drop the bag at the uniform shop during opening hours.",
  );

  return (
    <MobileShell bg="var(--color-paper)" logoUrl={tenant.logoUrl ?? undefined}>
      <div className="px-5 py-6" data-testid="donate-page">
        <h1
          className="font-serif text-2xl font-semibold pb-2 mb-4 border-b-2"
          style={{ borderColor: tenant.accent, color: "var(--color-navy-deep)" }}
        >
          Donate preloved
        </h1>

        <p className="text-sm leading-6 text-ink mb-5">
          Drop a washed bag at the shop. Do not photograph items or create a listing —
          volunteers inspect, price, and put accepted garments on the rack.
        </p>

        <div className="space-y-4">
          <Card className="bg-paper border border-rule shadow-none">
            <Card.Header>
              <Card.Title className="font-serif text-base text-navy-deep">
                What to bring
              </Card.Title>
              <Card.Description className="text-ink-dim">
                Only washed current-uniform pieces that the shop can sell.
              </Card.Description>
            </Card.Header>
            <Card.Content>
              <ul className="list-disc pl-5 space-y-1.5 text-sm leading-6 text-ink">
                {WASH_RULES.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </Card.Content>
          </Card>

          <Card className="bg-paper border border-rule shadow-none">
            <Card.Header>
              <Card.Title className="font-serif text-base text-navy-deep">
                What not to bring
              </Card.Title>
              <Card.Description className="text-ink-dim">
                The shop will refuse these items.
              </Card.Description>
            </Card.Header>
            <Card.Content>
              {settings.refuseList.length > 0 ? (
                <ul className="flex flex-wrap gap-2" aria-label="Refuse list">
                  {settings.refuseList.map((item) => (
                    <li key={item}>
                      <Chip size="sm" variant="secondary" color="warning">
                        {formatRefuseItem(item)}
                      </Chip>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm leading-6 text-ink">
                  No extra refuse items are listed. Current uniform only, washed, no
                  stains or holes.
                </p>
              )}
            </Card.Content>
          </Card>

          <Card className="bg-paper border border-rule shadow-none">
            <Card.Header>
              <Card.Title className="font-serif text-base text-navy-deep">
                Where and when
              </Card.Title>
              <Card.Description className="text-ink-dim">
                Leave the bag at the shop — there is no parent listing or payment.
              </Card.Description>
            </Card.Header>
            <Card.Content>
              <div className="space-y-3 text-sm leading-6 text-ink">
                <section>
                  <div className="text-ink-dim text-xs uppercase tracking-wide">
                    Shop hours
                  </div>
                  <p className="whitespace-pre-wrap">{shopHours}</p>
                </section>
                <section>
                  <div className="text-ink-dim text-xs uppercase tracking-wide">
                    Address
                  </div>
                  <p className="whitespace-pre-wrap">{address}</p>
                </section>
                <section>
                  <div className="text-ink-dim text-xs uppercase tracking-wide">
                    Collection instructions
                  </div>
                  <p className="whitespace-pre-wrap">{collectionInstructions}</p>
                </section>
              </div>
            </Card.Content>
          </Card>

          <Card className="bg-paper border border-rule shadow-none">
            <Card.Header>
              <Card.Title className="font-serif text-base text-navy-deep">
                If we cannot accept it
              </Card.Title>
            </Card.Header>
            <Card.Content>
              <p className="text-sm leading-6 text-ink">
                Rejected items go to charity or textile recycling. They are not
                returned by default.
              </p>
            </Card.Content>
          </Card>

          <Card className="bg-paper border border-rule shadow-none">
            <Card.Header>
              <Card.Title className="font-serif text-base text-navy-deep">
                I am dropping off a donation
              </Card.Title>
              <Card.Description className="text-ink-dim">
                Optional note so the shop expects a bag. This is a message, not
                a listing or payment.
              </Card.Description>
            </Card.Header>
            <Card.Content>
              <DonateScreen tenantId={tenant.id} accent={tenant.accent} />
            </Card.Content>
          </Card>
        </div>
      </div>
      <TenantFooter tenant={tenant} />
    </MobileShell>
  );
}
