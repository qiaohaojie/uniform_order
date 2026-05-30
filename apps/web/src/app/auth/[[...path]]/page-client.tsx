"use client";

import "@neondatabase/auth-ui/css";
import { AuthView, NeonAuthUIProvider } from "@neondatabase/auth-ui";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient, useSession } from "@/lib/auth/client";
import { clearActiveChildCookieClient } from "@/lib/active-child.client";
import { safeInternalPath } from "@/lib/auth/safe-redirect";

export function AuthPageClient({
  path,
  callbackURL,
}: {
  path: string;
  callbackURL: string | null;
}) {
  const router = useRouter();
  const session = useSession();
  const target = safeInternalPath(callbackURL);
  const sessionData = session?.data;
  const isPending = session?.isPending ?? false;
  const redirected = useRef<boolean>(false);

  useEffect(() => {
    // Clear the active-child cookie only once the session has resolved to
    // signed-out. `data` is null while `isPending`, so an authenticated parent
    // landing here mid-load must not lose their selected child.
    if (!isPending && sessionData === null) {
      clearActiveChildCookieClient();
    }
    // Bounce a visitor who is already signed in on mount to the validated
    // deep-link. The fresh-sign-in / OAuth-callback cases are handled natively
    // by the library via the `redirectTo` prop below.
    if (sessionData && target && !redirected.current) {
      redirected.current = true;
      router.replace(target);
    }
  }, [sessionData, isPending, target, router]);

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--color-paper)" }}
    >
      <div className="w-full max-w-md">
        <NeonAuthUIProvider
          authClient={authClient}
          navigate={router.push}
          replace={router.replace}
          // Post-auth redirect target = the validated callbackURL (`/` default).
          // The open redirect is closed primarily server-side (page.tsx strips an
          // unsafe `?redirectTo=` before this mounts), so `getSearchParam(
          // "redirectTo")` can never return an attacker value. We still pass the
          // sanitized target on both the provider (context fallback) and <AuthView>
          // (form-level `redirectToProp`, first in the library's
          // `redirectToProp || getSearchParam("redirectTo") || contextRedirectTo`
          // chain) as defense in depth.
          redirectTo={target ?? "/"}
          onSessionChange={router.refresh}
          Link={Link}
        >
          <AuthView path={path} redirectTo={target ?? "/"} />
        </NeonAuthUIProvider>
      </div>
    </main>
  );
}
