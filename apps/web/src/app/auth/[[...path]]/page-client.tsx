"use client";

import "@neondatabase/auth/ui/css";
import { AuthView, NeonAuthUIProvider } from "@neondatabase/auth/react/ui";
import type { AuthViewPath } from "@neondatabase/auth/react/ui";
import { authClient } from "@/lib/auth/client";

export function AuthPageClient({ path }: { path: string }) {
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
