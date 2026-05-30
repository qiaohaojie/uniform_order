"use client";

import "@neondatabase/auth-ui/css";
import { AuthView, NeonAuthUIProvider } from "@neondatabase/auth-ui";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient, useSession } from "@/lib/auth/client";
import { clearActiveChildCookieClient } from "@/lib/active-child.client";

// Only allow same-origin, non-auth paths. We resolve `raw` against a sentinel
// origin and reject anything that escapes it — this defends against the whole
// open-redirect family (`//evil.com`, `/\evil.com`, embedded-tab tricks) that a
// `startsWith("//")` string check misses, since the URL parser normalises
// backslashes/control chars to `//host`. Also blocks /auth → sign-in loops.
function safeCallbackPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/")) return null;
  let url: URL;
  try {
    url = new URL(raw, "https://uo.invalid");
  } catch {
    return null;
  }
  if (url.origin !== "https://uo.invalid") return null;
  if (url.pathname === "/auth" || url.pathname.startsWith("/auth/")) return null;
  return url.pathname + url.search + url.hash;
}

export function AuthPageClient({
  path,
  callbackURL,
}: {
  path: string;
  callbackURL: string | null;
}) {
  const router = useRouter();
  const session = useSession();
  const target = safeCallbackPath(callbackURL);
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
          // Pass the validated target as the library's own post-auth redirect.
          // An explicit prop takes precedence over the unguarded `?redirectTo=`
          // query param the library would otherwise read, closing that
          // open-redirect path; falls back to "/" when there is no callbackURL.
          redirectTo={target ?? "/"}
          onSessionChange={router.refresh}
          Link={Link}
        >
          <AuthView path={path} />
        </NeonAuthUIProvider>
      </div>
    </main>
  );
}
