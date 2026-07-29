import WebsiteEditor from "./WebsiteEditor";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function WebsiteBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <WebsiteEditor businessId={id} />;
}
