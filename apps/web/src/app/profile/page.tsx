import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/authorization";
import { getChildrenForParent, getTenantsByIds } from "@/db/queries";
import { ProfileClient } from "./profile-client";

export default async function ProfilePage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/auth/sign-in?callbackURL=%2Fprofile");
  }
  const children = await getChildrenForParent(user.id);

  const uniqueTenantIds = Array.from(new Set(children.map((c) => c.tenantId)));
  const fullTenants = await getTenantsByIds(uniqueTenantIds);
  const tenants = fullTenants
    .map((t) => ({ id: t.id, short: t.short, shopEmail: t.shopEmail }))
    .sort((a, b) => a.short.localeCompare(b.short));

  return (
    <ProfileClient
      user={{
        name: user.name,
        email: user.email,
        image: null,
      }}
      childrenCount={children.length}
      tenants={tenants}
    />
  );
}
