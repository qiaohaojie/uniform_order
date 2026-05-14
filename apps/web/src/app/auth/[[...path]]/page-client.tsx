"use client";

import "@neondatabase/auth-ui/css";
import { AuthView, NeonAuthUIProvider } from "@neondatabase/auth-ui";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient, useSession } from "@/lib/auth/client";
import { clearActiveChildCookieClient } from "@/lib/active-child.client";

export function AuthPageClient({ path }: { path: string }) {
  const router = useRouter();
  const session = useSession();

  // Sign-out side-effect: clear active-child cookie when session goes null.
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
        <NeonAuthUIProvider
          authClient={authClient}
          navigate={(href) => router.push(href)}
          replace={(href) => router.replace(href)}
          onSessionChange={router.refresh}
          Link={Link}
          magicLink
        >
          <AuthView path={path} />
        </NeonAuthUIProvider>
      </div>
    </main>
  );
}
