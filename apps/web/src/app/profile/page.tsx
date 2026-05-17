import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/authorization";
import { getChildrenForParent } from "@/db/queries";
import { ProfileClient } from "./profile-client";

export default async function ProfilePage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/auth/sign-in?callbackURL=%2Fprofile");
  }
  const children = await getChildrenForParent(user.id);
  return (
    <ProfileClient
      user={{
        name: user.name,
        email: user.email,
        image: null,
      }}
      childrenCount={children.length}
    />
  );
}
