"use client";

import { AdminLivePageError } from "@/components/admin-live-page-error";

export default function AdminReportsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <AdminLivePageError title="Reports could not load" error={error} reset={reset} />;
}
