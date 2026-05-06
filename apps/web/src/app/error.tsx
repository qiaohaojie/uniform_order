"use client";

import { useEffect } from "react";
import Link from "next/link";
import { captureException } from "@/lib/analytics/client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
    captureException(error, { digest: error.digest, page: window.location.pathname });
  }, [error]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: "var(--color-parchment)" }}>
      <h1 className="font-serif text-3xl font-semibold mb-2" style={{ color: "var(--color-ink)" }}>
        Something went wrong
      </h1>
      <p className="text-[14px] mb-6 max-w-md text-center" style={{ color: "var(--color-ink-dim)" }}>
        We encountered an unexpected error. Please try again or return to the home page.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 rounded-md text-[13px] font-semibold text-white"
          style={{ background: "var(--color-navy-deep)" }}
        >
          Try again
        </button>
        <Link
          href="/"
          className="px-4 py-2 rounded-md text-[13px] font-semibold border"
          style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
