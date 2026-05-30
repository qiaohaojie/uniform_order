import { notFound } from "next/navigation";
import { authViewPaths, getViewByPath } from "@neondatabase/auth-ui/server";
import { AuthPageClient } from "./page-client";

export const dynamic = "force-dynamic";

export default async function AuthPage({
  params,
  searchParams,
}: {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<{ callbackURL?: string | string[] }>;
}) {
  const { path = [] } = await params;
  const sp = await searchParams;
  const authPath = path.join("/") || "sign-in";
  const rawCallback = Array.isArray(sp.callbackURL) ? sp.callbackURL[0] : sp.callbackURL;

  // Resolve the requested path to a better-auth view exactly as the library does
  // — getViewByPath is `for (key in authViewPaths) if (authViewPaths[key] === authPath) return key`,
  // i.e. a case-sensitive, full-string match returning the view key or undefined —
  // then gate server-side before mounting the client AuthView:
  //   - unknown path  -> notFound(): a garbage segment no longer falls back to
  //     SIGN_IN with a 200 (S3). `/auth/foo`, `/auth/Sign-In`, `/auth/account` 404.
  //   - SIGN_OUT view -> notFound(): a bare GET to `/auth/sign-out` would
  //     otherwise sign the user out from a mount effect with no POST/CSRF token
  //     (S1). Logout is done explicitly via authClient.signOut(), never this route.
  // The empty path (`/auth`) maps to "sign-in" above, so it stays a valid view.
  // Imported from the package's "/server" entry — the bare package is
  // "use client", so its exports would be opaque client references in an RSC.
  const view = getViewByPath(authViewPaths, authPath);
  if (!view || view === "SIGN_OUT") {
    notFound();
  }

  return <AuthPageClient path={authPath} callbackURL={rawCallback ?? null} />;
}
