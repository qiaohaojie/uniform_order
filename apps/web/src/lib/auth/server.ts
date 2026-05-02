import { createNeonAuth } from "@neondatabase/auth/next/server";

let authClient: ReturnType<typeof createNeonAuth> | null = null;

export function getAuth() {
  if (authClient) return authClient;

  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!baseUrl || !cookieSecret) {
    throw new Error("Neon Auth environment variables are not configured");
  }

  authClient = createNeonAuth({
    baseUrl,
    cookies: {
      secret: cookieSecret,
    },
  });
  return authClient;
}
