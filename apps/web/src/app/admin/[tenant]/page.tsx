import { redirect } from "next/navigation";

export default async function AdminRootPage({ params }: PageProps<"/admin/[tenant]">) {
  const { tenant } = await params;
  redirect(`/admin/${tenant}/dashboard`);
}
