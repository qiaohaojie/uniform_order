"use server";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/authorization";
import { updateTenantWorkflowSettings, type WorkflowMode } from "@/db/queries";

export async function updateTenantSettingsAction(
  tenantId: string,
  patch: {
    workflowMode: WorkflowMode;
    shippingEnabled: boolean;
    pickupEnabled: boolean;
  },
  reason: string,
) {
  const user = await requirePlatformAdmin();
  if (!reason.trim()) throw new Error("Reason is required");
  await updateTenantWorkflowSettings(tenantId, patch, user.id, reason.trim());
  revalidatePath(`/platform/tenants/${tenantId}/settings`);
  revalidatePath(`/admin/${tenantId}/orders`);
}
