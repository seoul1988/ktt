import Link from "next/link";
import { cookies } from "next/headers";

import { supabase } from "../../../lib/supabase";
import CommunityBottomNav from "../../components/CommunityBottomNav";
import AdImageGallery from "./AdImageGallery";
import AdActionButtons from "./AdActionButtons";
import ProfileButton from "@/app/components/ProfileButton";
import BackButton from "@/app/components/BackButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AdItem = {
  id: number;
  title: string;
  description: string | null;
  category: string | null;
  location: string | null;
  phone: string | null;
  website_url: string | null;
  images: string[] | null;
  video_url: string | null;
  status: string | null;
  lat: number | null;
  lng: number | null;
  user_id: string | null;
};

function statusLabel(status: string | null) {
  if (status === "active") return "광고중";
  if (status === "expired") return "만료";
  if (status === "hidden") return "숨김";

  return "광고중";
}

function statusClass(status: string | null) {
  if (status === "active") {
    return "bg-green-600";
  }

  if (status === "expired") {
    return "bg-gray-500";
  }

  if (status === "hidden") {
    return "bg-red-500";
  }

  return "bg-green-600";
}

function normalizeWebsiteUrl(url: string) {
  const trimmedUrl = url.trim();

  if (/^https?:\/\//i.test(trimmedUrl)) {
    return trimmedUrl;
  }

  return `https://${trimmedUrl}`;
}

function getDirectionUrl(ad: AdItem) {
  if (
    ad.lat !== null &&
    ad.lng !== null
  ) {
    return `https://www.google.com/maps/dir/?api=1&destination=${ad.lat},${ad.lng}`;
  }

  if (
    typeof ad.location === "string" &&
    ad.location.trim() !== ""
  ) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      ad.location.trim(),
    )}`;
  }

  return null;
}

export default async function AdDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("ads")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return (
      <main className="min-h-screen bg-[#F8F3EC] p-5 pb-24 text-[#172033]">
        <div className="mx-auto w-full max-w-xl">
          <p className="rounded-2xl bg-white p-5 font-bold text-red-600 shadow-sm">
            광고를 찾을 수 없습니다.
          </p>
        </div>

        <CommunityBottomNav activeNav="ads" />
      </main>
    );
  }

  const ad = data as AdItem;

  const cookieStore = await cookies();

  const adminRole =
    cookieStore.get("ktt_admin")?.value;

  const isAdmin =
    adminRole === "admin" ||
    adminRole === "super_admin";

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isOwner = Boolean(
    user &&
      ad.user_id &&
      ad.user_id === user.id,
  );

  const canManage =
    isAdmin || isOwner;

  const cleanImages = Array.isArray(ad.images)
    ? ad.images.filter(
        (image): image is string =>
          typeof image === "string" &&
          image.trim() !== "",
      )
    : [];

  const cleanVideoUrl =
    typeof ad.video_url === "string" &&
    ad.video_url.trim() !== ""
      ? ad.video_url.trim()
      : null;

  const cleanWebsiteUrl =
    typeof ad.website_url === "string" &&
    ad.website_url.trim() !== ""
      ? normalizeWebsiteUrl(
          ad.website_url,
        )
      : null;

  const cleanPhone =
    typeof ad.phone === "string" &&
    ad.phone.trim() !== ""
      ? ad.phone.trim()
      : null;

  const cleanLocation =
    typeof ad.location === "string" &&
    ad.location.trim() !== ""
      ? ad.location.trim()
      : null;

  const cleanCategory =
    typeof ad.category === "string" &&
    ad.category.trim() !== ""
      ? ad.category.trim()
      : null;

  const cleanDescription =
    typeof ad.description === "string" &&
    ad.description.trim() !== ""
      ? ad.description.trim()
      : null;

  const directionUrl =
    getDirectionUrl(ad);

  const hasImage =
    cleanImages.length > 0;

  const hasVideo =
    Boolean(cleanVideoUrl);

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-4 pb-24 text-[#172033]">
      <div className="mx-auto w-full max-w-xl">
        <div className="relative mb-5 flex h-10 items-center border-b border-[#E8DED1] pb-3">
          <BackButton />

          <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-lg font-black text-[#172033]">
            AD DETAILS
          </h1>

          <div className="ml-auto">
            <ProfileButton />
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl bg-white shadow">
          {hasVideo && (
            <video
              src={cleanVideoUrl || ""}
              controls
              playsInline
              preload="metadata"
              className="aspect-video w-full bg-black object-contain"
            />
          )}

          {!hasVideo && hasImage && (
            <AdImageGallery
              images={cleanImages}
              title={ad.title}
            />
          )}

          {!hasVideo && !hasImage && (
            <div className="flex aspect-[4/3] w-full items-center justify-center bg-[#EEE7DE] px-6 text-center">
              <div>
                <div
                  className="text-5xl"
                  aria-hidden="true"
                >
                  📢
                </div>

                <p className="mt-3 text-sm font-black text-gray-500">
                  등록된 이미지가 없습니다.
                </p>
              </div>
            </div>
          )}

          <div className="p-5">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {cleanCategory && (
                <span className="rounded-full bg-[#172033]/10 px-3 py-1 text-xs font-black text-[#172033]">
                  {cleanCategory}
                </span>
              )}

              <span
                className={`rounded-full px-3 py-1 text-xs font-black text-white ${statusClass(
                  ad.status,
                )}`}
              >
                {statusLabel(ad.status)}
              </span>
            </div>

            <h1 className="text-2xl font-black leading-tight">
              {ad.title}
            </h1>

            {cleanLocation && (
              <p className="mt-3 flex items-start gap-2 text-sm font-bold text-gray-500">
                <span
                  className="shrink-0"
                  aria-hidden="true"
                >
                  📍
                </span>

                <span>
                  {cleanLocation}
                </span>
              </p>
            )}

            {cleanPhone && (
              <p className="mt-2 flex items-center gap-2 text-sm font-bold text-gray-500">
                <span aria-hidden="true">
                  📞
                </span>

                <span>
                  {cleanPhone}
                </span>
              </p>
            )}

            {cleanWebsiteUrl && (
              <a
                href={cleanWebsiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex items-start gap-2 break-all text-sm font-bold text-blue-600"
              >
                <span
                  className="shrink-0"
                  aria-hidden="true"
                >
                  🌐
                </span>

                <span>
                  {ad.website_url}
                </span>
              </a>
            )}

            {cleanDescription && (
              <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-gray-700">
                {cleanDescription}
              </p>
            )}

            <AdActionButtons
              title={ad.title}
              phone={cleanPhone}
              directionUrl={directionUrl}
              websiteUrl={cleanWebsiteUrl}
            />

            {canManage && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link
                  href={`/ads/${ad.id}/edit`}
                  className="flex h-10 items-center justify-center rounded-xl bg-[#172033] px-3 text-center text-sm font-bold text-white transition active:scale-[0.98]"
                >
                  ✏️ 수정
                </Link>

                <Link
                  href={`/ads/${ad.id}/delete`}
                  className="flex h-10 items-center justify-center rounded-xl bg-red-600 px-3 text-center text-sm font-bold text-white transition active:scale-[0.98]"
                >
                  🗑 삭제
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <CommunityBottomNav activeNav="ads" />
    </main>
  );
}