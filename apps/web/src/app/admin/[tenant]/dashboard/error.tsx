"use client";

import { AdminLivePageError } from "@/components/admin-live-page-error";

export default function AdminDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <AdminLivePageError title="Dashboard could not load" error={error} reset={reset} />;
}
