"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { initPosthog, capturePageview, identifyUser, resetUser } from "@/lib/analytics/client";
import { useSession } from "@/lib/auth/client";

function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    capturePageview();
  }, [pathname, searchParams]);

  return null;
}

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const identifiedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    initPosthog();
  }, []);

  useEffect(() => {
    const userId = session?.user?.id ?? null;
    if (userId) {
      identifiedUserIdRef.current = userId;
      identifyUser(userId, {
        email: session?.user?.email ?? undefined,
        name: session?.user?.name ?? undefined,
      });
    } else if (session !== undefined && identifiedUserIdRef.current !== null) {
      // User just signed out — reset to disconnect future events from the old profile
      identifiedUserIdRef.current = null;
      resetUser();
    }
  }, [session]);

  return (
    <>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      {children}
    </>
  );
}
