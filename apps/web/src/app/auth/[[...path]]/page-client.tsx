"use client";

import "@neondatabase/auth/ui/css";
import { AuthView, NeonAuthUIProvider } from "@neondatabase/auth/react/ui";
import type { AuthViewPath } from "@neondatabase/auth/react/ui";
import { useEffect } from "react";
import { authClient } from "@/lib/auth/client";
import { useSession } from "@/lib/auth/client";
import { clearActiveChildCookieClient } from "@/lib/active-child.client";

export function AuthPageClient({ path }: { path: string }) {
  const session = useSession();

  useEffect(() => {
    if (session?.data === null) {
      clearActiveChildCookieClient();
    }
  }, [session?.data]);

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--color-paper)" }}
    >
      <div className="w-full max-w-md">
        <NeonAuthUIProvider authClient={authClient}>
          <AuthView path={path as AuthViewPath} />
        </NeonAuthUIProvider>
      </div>
    </main>
  );
}
