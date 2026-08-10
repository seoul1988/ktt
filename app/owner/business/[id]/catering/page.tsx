import { notFound } from "next/navigation";
import CateringManager from "./CateringManager";
import { requireBusinessManagementAccess } from "@/lib/requireBusinessManagementAccess";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CateringPage({ params }: PageProps) {
  const { id } = await params;
  const businessId = Number(id);

  if (!Number.isInteger(businessId) || businessId <= 0) {
    notFound();
  }

  await requireBusinessManagementAccess(businessId);

  return <CateringManager businessId={businessId} />;
}
