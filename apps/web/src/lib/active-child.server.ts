import "server-only";
import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/auth/authorization";
import { getChildById } from "@/db/queries";
import { ACTIVE_CHILD_COOKIE_NAME } from "./active-child.client";

export type ActiveChild = {
  id: string;
  tenantId: string;
  name: string;
  year: string;
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
  const childId = cookieStore.get(ACTIVE_CHILD_COOKIE_NAME)?.value;
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
