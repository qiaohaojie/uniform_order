import { AuthPageClient } from "./page-client";

export const dynamic = "force-dynamic";

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path = [] } = await params;
  const authPath = path.join("/") || "sign-in";

  return <AuthPageClient path={authPath} />;
}
