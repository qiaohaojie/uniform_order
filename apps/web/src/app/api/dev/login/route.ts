import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { safeInternalPath } from "@/lib/auth/safe-redirect";

export async function GET(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email")?.trim().toLowerCase();
  const rawCallback = searchParams.get("callbackURL") || searchParams.get("redirectTo");
  const target = safeInternalPath(rawCallback) || "/";

  if (!email) {
    return new Response("Missing ?email= parameter", { status: 400 });
  }

  const cookieStore = await cookies();
  cookieStore.set("uo_dev_email", email, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  redirect(target);
}
