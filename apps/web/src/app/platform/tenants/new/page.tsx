import { db } from "@/db";
import { tenants, catalogItems } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { WizardClient } from "./wizard-client";

export default async function NewTenantPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; step?: string }>;
}) {
  const { id, step } = await searchParams;
  const tenant = id ? await db.query.tenants.findFirst({ where: eq(tenants.id, id) }) : null;

  let catalogCount = 0;
  if (id) {
    const [row] = await db
      .select({ n: count() })
      .from(catalogItems)
      .where(eq(catalogItems.tenantId, id));
    catalogCount = Number(row?.n ?? 0);
  }

  return <WizardClient tenant={tenant ?? null} initialStep={parseStep(step)} catalogCount={catalogCount} />;
}

function parseStep(s: string | undefined): 1 | 2 | 3 | 4 | 5 | 6 {
  const n = Number(s);
  if (n >= 1 && n <= 6) return n as 1 | 2 | 3 | 4 | 5 | 6;
  return 1;
}
