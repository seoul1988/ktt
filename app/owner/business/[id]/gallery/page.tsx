import "server-only";

import { notFound } from "next/navigation";

import { requireBusinessManagementAccess } from "@/lib/requireBusinessManagementAccess";

import GalleryManager from "./GalleryManager";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function BusinessGalleryPage({ params }: PageProps) {
  const { id } = await params;
  const businessId = Number(id);

  if (!Number.isInteger(businessId) || businessId <= 0) {
    notFound();
  }

  await requireBusinessManagementAccess(businessId);

  return <GalleryManager businessId={businessId} />;
}
