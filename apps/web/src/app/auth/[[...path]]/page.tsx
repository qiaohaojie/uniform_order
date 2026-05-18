import { AuthPageClient } from "./page-client";

export const dynamic = "force-dynamic";

export default async function AuthPage({
  params,
  searchParams,
}: {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<{ callbackURL?: string | string[] }>;
}) {
  const { path = [] } = await params;
  const sp = await searchParams;
  const authPath = path.join("/") || "sign-in";
  const rawCallback = Array.isArray(sp.callbackURL) ? sp.callbackURL[0] : sp.callbackURL;

  return <AuthPageClient path={authPath} callbackURL={rawCallback ?? null} />;
}
