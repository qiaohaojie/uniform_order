import type { ZodSchema } from "zod";
import { getSessionUser, isPlatformAdminEmail } from "@/lib/auth/authorization";

export async function requirePlatformAdmin() {
  const user = await getSessionUser();
  if (!user || !isPlatformAdminEmail(user.email)) {
    throw new Error("Forbidden");
  }
  return user;
}

export function parseInput<T>(
  schema: ZodSchema<T>,
  input: unknown,
): { ok: true; data: T } | { ok: false; error: string } {
  const r = schema.safeParse(input);
  if (r.success) return { ok: true, data: r.data };
  const first = r.error.issues[0];
  const path = first?.path.join(".");
  return {
    ok: false,
    error: path ? `${path}: ${first.message}` : (first?.message ?? "Invalid input"),
  };
}
