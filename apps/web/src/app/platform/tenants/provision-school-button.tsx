"use client";

import Link from "next/link";
import { Plus } from "@gravity-ui/icons";

export function ProvisionSchoolButton({
  label,
  testId,
}: {
  label: string;
  testId: string;
}) {
  return (
    <Link
      href="/platform/tenants/new"
      data-testid={testId}
      className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-navy-deep text-white text-sm font-semibold"
    >
      <Plus />
      {label}
    </Link>
  );
}
