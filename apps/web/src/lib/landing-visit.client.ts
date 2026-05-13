// apps/web/src/lib/landing-visit.client.ts
const COOKIE_NAME = (slug: string) => `uo:visited:${slug}`;
const TTL = 60 * 60 * 24 * 30; // 30 days

// slug is always lowercase ASCII — no URL-encoding needed for Path value
export function setVisitedCookie(slug: string): void {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_NAME(slug)}=1; Path=/${slug}; Max-Age=${TTL}; SameSite=Lax${secure}`;
}
