import { redirect } from 'next/navigation';

export default async function WorkspaceHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/workspaces/${slug}/members`);
}
