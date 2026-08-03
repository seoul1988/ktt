import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function NewCategoryPage({
  params,
}: PageProps) {
  const { id } = await params;

  redirect(
    `/owner/business/${id}/categories`,
  );
}
