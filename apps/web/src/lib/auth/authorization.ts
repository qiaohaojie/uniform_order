import { NextResponse } from "next/server";
import { notFound, redirect } from "next/navigation";
import { getAuth } from "./server";

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
};

const platformAdminEmails = new Set(
  (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isPlatformAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  return platformAdminEmails.has(normalizeEmail(email));
}

export function isTenantOperatorEmail(
  userEmail: string | null | undefined,
  tenantOperatorEmail: string | null | undefined
) {
  if (!userEmail || !tenantOperatorEmail) return false;
  return normalizeEmail(userEmail) === normalizeEmail(tenantOperatorEmail);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const result = (await getAuth().getSession()) as {
      data?: {
        user?: {
          id?: string;
          email?: string | null;
          name?: string | null;
        };
      };
    };
    const user = result?.data?.user;
    if (!user?.id || !user.email) return null;
    return {
      id: user.id,
      email: normalizeEmail(user.email),
      name: user.name ?? null,
    };
  } catch (error) {
    console.error("Failed to resolve auth session:", error);
    return null;
  }
}

export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) {
    return {
      response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    };
  }
  return { user };
}

export function ensureTenantAccess(user: SessionUser, tenantOperatorEmail: string | null | undefined) {
  if (isPlatformAdminEmail(user.email) || isTenantOperatorEmail(user.email, tenantOperatorEmail)) {
    return null;
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// For RSC pages and server actions: redirect unauthenticated users to sign-in,
// and 404 unauthorised users (matches the rest of the app's pattern — throwing
// from an RSC produces a generic 500, which we want to avoid).
export async function requirePlatformAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/handler/sign-in");
  if (!isPlatformAdminEmail(user.email)) notFound();
  return user;
}

export function ensureParentEmailAccess(user: SessionUser, parentEmail: string) {
  if (isPlatformAdminEmail(user.email)) return null;
  if (normalizeEmail(user.email) === normalizeEmail(parentEmail)) return null;
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
