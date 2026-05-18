"use client";

import "@neondatabase/auth-ui/css";
import { AuthView, NeonAuthUIProvider } from "@neondatabase/auth-ui";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient, useSession } from "@/lib/auth/client";
import { clearActiveChildCookieClient } from "@/lib/active-child.client";

// Only allow same-origin, non-auth, relative paths — avoids open-redirect
// (//evil.com) and sign-in → sign-in loops.
function safeCallbackPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  if (raw.startsWith("/auth/") || raw === "/auth") return null;
  return raw;
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
  const previousSignedIn = useRef<boolean>(false);
  const redirected = useRef<boolean>(false);

  useEffect(() => {
    const data = session?.data;
    if (data === null) {
      clearActiveChildCookieClient();
    }
    const isSignedIn = !!data;
    if (!previousSignedIn.current && isSignedIn && target && !redirected.current) {
      redirected.current = true;
      router.replace(target);
    }
    previousSignedIn.current = isSignedIn;
  }, [session?.data, target, router]);

  // The library navigates to "/" after sign-in. If a callbackURL was passed,
  // divert to it instead so deep-links into gated pages survive the auth round-trip.
  const handleNavigate = (href: string) => {
    if (target && href === "/") {
      router.push(target);
    } else {
      router.push(href);
    }
  };
  const handleReplace = (href: string) => {
    if (target && href === "/") {
      router.replace(target);
    } else {
      router.replace(href);
    }
  };

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--color-paper)" }}
    >
      <div className="w-full max-w-md">
        <NeonAuthUIProvider
          authClient={authClient}
          navigate={handleNavigate}
          replace={handleReplace}
          onSessionChange={router.refresh}
          Link={Link}
        >
          <AuthView path={path} />
        </NeonAuthUIProvider>
      </div>
    </main>
  );
}
