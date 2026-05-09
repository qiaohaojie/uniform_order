import { redirect } from "next/navigation";

export default function PlatformIndex() {
  redirect("/platform/tenants");
}
