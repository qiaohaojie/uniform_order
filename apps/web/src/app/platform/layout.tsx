import { redirect, notFound } from "next/navigation";
import { getSessionUser, isPlatformAdminEmail } from "@/lib/auth/authorization";
import { PlatformShell } from "@/components/platform-shell";

export const dynamic = "force-dynamic";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) {
    redirect(`/auth/sign-in?callbackURL=${encodeURIComponent("/platform")}`);
  }
  if (!isPlatformAdminEmail(user.email)) {
    notFound();
  }

  return (
    <PlatformShell userName={user.name} userEmail={user.email}>
      {children}
    </PlatformShell>
  );
}
