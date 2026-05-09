"use client";
import type { TenantRow } from "@/db/schema";

export function Step1Identity({ tenant, onContinue }: { tenant: TenantRow | null; onContinue: (id: string) => void }) {
  return <div>Step 1 stub — see Task 4.5</div>;
}
