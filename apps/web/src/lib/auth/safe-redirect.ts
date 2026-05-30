/**
 * Same-origin redirect validator shared by the auth route (server + client).
 *
 * Resolves `raw` against a sentinel origin and rejects anything that escapes it
 * — this defends against the whole open-redirect family (`//evil.com`,
 * `/\evil.com`, embedded-tab / control-char tricks) that a `startsWith("//")`
 * string check misses, since the URL parser normalises backslashes/control
 * chars to `//host`. Also rejects `/auth` and `/auth/*` to avoid sign-in loops.
 *
 * Returns the safe in-app path (pathname + search + hash), or null if `raw` is
 * absent, not a root-relative path, off-origin, or an auth route.
 */
export function safeInternalPath(raw: string | null | undefined): string | null {
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
