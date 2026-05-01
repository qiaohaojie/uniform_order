import { redirect } from "next/navigation";

export default async function AdminRootPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  redirect(`/admin/${tenant}/dashboard`);
}
