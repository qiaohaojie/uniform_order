/**
 * Client-safe active-child cookie helpers.
 * No server-only imports — safe to use in "use client" components.
 */

export const ACTIVE_CHILD_COOKIE_NAME = "uo:active-child";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export function setActiveChildCookieClient(childId: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${ACTIVE_CHILD_COOKIE_NAME}=${encodeURIComponent(
    childId
  )}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function readActiveChildCookieClient(): string | null {
  if (typeof document === "undefined") return null;
  const escaped = ACTIVE_CHILD_COOKIE_NAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function clearActiveChildCookieClient(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${ACTIVE_CHILD_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}
