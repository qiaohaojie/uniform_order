import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/authorization";
import { getChildrenForParent, getPubliclyListedTenants } from "@/db/queries";
import { HomeClient } from "./home-client";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const sp = await searchParams;
  const user = await getSessionUser();
  const tenants = await getPubliclyListedTenants();

  const tenantBrandRows = tenants.map((t) => ({
    id: t.id,
    name: t.name,
    short: t.short,
    accent: t.accent,
    motto: t.motto ?? null,
  }));

  if (!user) {
    return <HomeClient mode="logged-out" tenants={tenantBrandRows} />;
  }

  const children = await getChildrenForParent(user.id);

  if (children.length === 1 && sp.action !== "add-child") {
    redirect(`/${children[0].tenantId}`);
  }

  const currentYearStart = new Date(new Date().getFullYear(), 0, 1);
  const now = new Date();
  const decorated = children.map((c) => ({
    ...c,
    needsYearConfirm: c.lastConfirmedAt < currentYearStart && now >= currentYearStart,
  }));

  const tenantById = Object.fromEntries(tenantBrandRows.map((t) => [t.id, t]));

  const firstName = (user.name ?? user.email).split(" ")[0].split("@")[0];

  return (
    <HomeClient
      mode="logged-in"
      userFirstName={firstName}
      children={decorated}
      tenants={tenantBrandRows}
      tenantById={tenantById}
    />
  );
}
