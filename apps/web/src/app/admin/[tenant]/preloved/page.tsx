import { redirect } from "next/navigation";

export default async function AdminPrelovedIndexPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  redirect(`/admin/${tenant}/preloved/intake`);
}
