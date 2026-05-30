import { notFound, redirect } from "next/navigation";
import { authViewPaths, getViewByPath } from "@neondatabase/auth-ui/server";
import { safeInternalPath } from "@/lib/auth/safe-redirect";
import { AuthPageClient } from "./page-client";

export const dynamic = "force-dynamic";

export default async function AuthPage({
  params,
  searchParams,
}: {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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

  // Neutralise an unsafe `?redirectTo=` BEFORE the client AuthView mounts. The
  // library resolves its post-auth target from `getSearchParam("redirectTo")`
  // (raw, unvalidated) and that wins over our sanitized prop in some flows — most
  // notably the already-signed-in redirect, which is literally
  // `getSearchParam("redirectTo") || redirectTo` — so passing a clean prop alone
  // does NOT close the open redirect. Stripping it here, before any client code
  // reads `window.location.search`, guarantees no `getSearchParam("redirectTo")`
  // ever returns an attacker value (`?redirectTo=https://evil.example`). A
  // legitimate same-origin value — e.g. the OAuth callback's own internal
  // redirectTo — passes `safeInternalPath` and is preserved untouched.
  const rawRedirect = Array.isArray(sp.redirectTo) ? sp.redirectTo[0] : sp.redirectTo;
  if (rawRedirect !== undefined && safeInternalPath(rawRedirect) === null) {
    const kept = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) {
      if (key === "redirectTo") continue;
      if (Array.isArray(value)) value.forEach((v) => kept.append(key, v));
      else if (value !== undefined) kept.append(key, value);
    }
    const basePath = path.length ? `/auth/${path.join("/")}` : "/auth";
    const qs = kept.toString();
    redirect(qs ? `${basePath}?${qs}` : basePath);
  }

  return <AuthPageClient path={authPath} callbackURL={rawCallback ?? null} />;
}
