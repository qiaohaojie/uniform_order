import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { safeInternalPath } from "@/lib/auth/safe-redirect";

export async function GET(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { searchParams } = new URL(req.url);
  const rawCallback = searchParams.get("callbackURL") || searchParams.get("redirectTo");
  const target = safeInternalPath(rawCallback) || "/";

  const cookieStore = await cookies();
  cookieStore.delete("uo_dev_email");

  redirect(target);
}
