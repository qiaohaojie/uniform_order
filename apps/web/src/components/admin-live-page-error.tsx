"use client";

import { useEffect } from "react";
import { captureException } from "@/lib/analytics/client";

export function AdminLivePageError({
  title,
  error,
  reset,
}: {
  title: string;
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(title, error);
    captureException(error, { digest: error.digest, page: window.location.pathname });
  }, [error, title]);

  return (
    <div
      data-testid="admin-live-page-error"
      className="flex-1 overflow-y-auto p-7"
      role="alert"
    >
      <div
        className="max-w-lg bg-white rounded-[10px] border p-[18px]"
        style={{ borderColor: "var(--color-rule)" }}
      >
        <h2 className="font-serif text-[20px] font-medium m-0" style={{ color: "var(--color-ink)" }}>
          {title}
        </h2>
        <p className="text-[13px] mt-2 mb-4" style={{ color: "var(--color-ink-dim)" }}>
          Live shop data could not be loaded. Check the database connection and try again.
        </p>
        <button
          type="button"
          onClick={reset}
          className="h-9 px-3.5 text-[12.5px] font-semibold rounded-md text-white"
          style={{ background: "var(--color-navy-deep)" }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
