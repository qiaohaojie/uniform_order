import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/auth/authorization";
import { getChildById } from "@/db/queries";

const COOKIE_NAME = "uo:active-child";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type ActiveChild = {
  id: string;
  tenantId: string;
  name: string;
  year: string;            // canonical short form, e.g. "9"
  rollClass: string | null;
};

/**
 * Server-side reader. Resolves the cookie's child UUID, ownership-checks
 * against the current session, and returns the child or null.
 *
 * Returns null when:
 * - No cookie present
 * - No session (not signed in)
 * - Cookie value does not match a child row
 * - Child's parentId does not match session user (stale cookie after sign-out / account switch)
 */
export async function getActiveChild(): Promise<ActiveChild | null> {
  const cookieStore = await cookies();
  const childId = cookieStore.get(COOKIE_NAME)?.value;
  if (!childId) return null;

  const user = await getSessionUser();
  if (!user) return null;

  const child = await getChildById(childId);
  if (!child) return null;
  if (child.parentId !== user.id) return null;

  return {
    id: child.id,
    tenantId: child.tenantId,
    name: child.name,
    year: child.year,
    rollClass: child.rollClass,
  };
}

/**
 * Server-side mutator. Writes the cookie. Used by API routes and server actions.
 * Client code should use the response cookie pattern via a small fetch endpoint.
 */
export async function setActiveChildCookieServer(childId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, childId, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export async function clearActiveChildCookieServer(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Client-side cookie name + helpers. Used by the picker tap handler.
 * httpOnly is false on this cookie because we set it from the client.
 */
export const ACTIVE_CHILD_COOKIE_NAME = COOKIE_NAME;

export function setActiveChildCookieClient(childId: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(
    childId
  )}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function readActiveChildCookieClient(): string | null {
  if (typeof document === "undefined") return null;
  const escaped = COOKIE_NAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function clearActiveChildCookieClient(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}
