"use client";
import type { TenantRow, TenantLegalVersionRow } from "@/db/schema";

// TODO(plan-task-9): replace with the full drawer in the next commit.
// This stub exists only so LegalCard (shipped in this commit) type-checks
// against an importable LegalEditDrawer; clicking Edit on the card would
// render nothing until Task 9 lands.
export function LegalEditDrawer(_: {
  tenant: TenantRow;
  currentVersion: TenantLegalVersionRow | null;
  onClose: () => void;
}) {
  return null;
}
