import { notFound } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { tenants, tenantSettingEvents } from "@/db/schema";
import { getTenantSettings } from "@/db/queries";
import { requirePlatformAdmin } from "@/lib/auth/authorization";
import { SettingsClient } from "./settings-client";

export default async function PlatformTenantSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePlatformAdmin();
  const { id } = await params;
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  if (!tenant) notFound();
  const settings = await getTenantSettings(id);
  const events = await db
    .select()
    .from(tenantSettingEvents)
    .where(eq(tenantSettingEvents.tenantId, id))
    .orderBy(desc(tenantSettingEvents.createdAt))
    .limit(5);
  return <SettingsClient tenant={tenant} settings={settings} recentEvents={events} />;
}
