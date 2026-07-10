import Link from "next/link";
import { cookies } from "next/headers";
import { supabase } from "../../../lib/supabase";
import CommunityBottomNav from "../../components/CommunityBottomNav";
import AdImageGallery from "./AdImageGallery";
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
  if (status === "active") return "bg-green-600";
  if (status === "expired") return "bg-gray-500";
  if (status === "hidden") return "bg-red-500";
  return "bg-green-600";
}

function cleanPhone(phone: string) {
  return phone.replace(/[^\d+]/g, "");
}

function getDirectionUrl(ad: AdItem) {
  if (ad.lat !== null && ad.lng !== null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${ad.lat},${ad.lng}`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    ad.location || ""
  )}`;
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
      <main className="min-h-screen bg-[#F8F3EC] p-5 text-[#172033]">
        <p className="font-bold text-red-600">광고를 찾을 수 없습니다.</p>
      </main>
    );
  }

  const ad = data as AdItem;

  const cookieStore = await cookies();
  const adminRole = cookieStore.get("ktt_admin")?.value;

  const isAdmin =
    adminRole === "admin" || adminRole === "super_admin";

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isOwner = Boolean(user && ad.user_id === user.id);
  const canManage = isAdmin || isOwner;

  const cleanImages = Array.isArray(ad.images)
    ? ad.images.filter((img) => typeof img === "string" && img.trim() !== "")
    : [];

  const cleanVideoUrl =
    typeof ad.video_url === "string" && ad.video_url.trim() !== ""
      ? ad.video_url
      : null;

  const hasImage = cleanImages.length > 0;
  const hasVideo = Boolean(cleanVideoUrl);
  const hasPhone = Boolean(ad.phone && ad.phone.trim() !== "");
  const hasLocation = Boolean(
    (ad.location && ad.location.trim() !== "") ||
      (ad.lat !== null && ad.lng !== null)
  );

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-4 pb-24 text-[#172033]">
     <div className="mx-auto w-full max-w-xl">
        <div className="relative mb-5 flex h-10 items-center border-b border-[#E8DED1] pb-3">
  {/* 왼쪽 */}
  <BackButton />

  {/* 가운데 */}
  <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-lg font-black text-[#172033]">
    AD DETAILS
  </h1>

  {/* 오른쪽 */}
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
              className="w-full"
            />
          )}

          {!hasVideo && hasImage && (
            <AdImageGallery images={cleanImages} title={ad.title} />
          )}

          <div className="p-5">
            <div className="mb-2 flex items-center gap-2">
              {ad.category && (
                <span className="rounded-full bg-[#172033]/10 px-3 py-1 text-xs font-black text-[#172033]">
                  {ad.category}
                </span>
              )}

              <span
                className={`rounded-full px-3 py-1 text-xs font-black text-white ${statusClass(
                  ad.status
                )}`}
              >
                {statusLabel(ad.status)}
              </span>
            </div>

            <h1 className="text-2xl font-black">{ad.title}</h1>

            {ad.location && (
              <p className="mt-2 text-sm font-bold text-gray-500">
                📍 {ad.location}
              </p>
            )}

            {ad.description && (
              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                {ad.description}
              </p>
            )}

            {(hasPhone || hasLocation) && (
              <div className="mt-5 grid grid-cols-2 gap-2">
                {hasPhone && (
                  <a
                    href={`tel:${cleanPhone(ad.phone || "")}`}
                    className="rounded-2xl bg-green-600 py-3 text-center text-sm font-black text-white"
                  >
                    📞 Call
                  </a>
                )}

                {hasLocation && (
                  <a
                    href={getDirectionUrl(ad)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-2xl bg-orange-500 py-3 text-center text-sm font-black text-white"
                  >
                    🧭 Directions
                  </a>
                )}
              </div>
            )}

            {canManage && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link
                  href={`/ads/${ad.id}/edit`}
                  className="rounded-2xl bg-[#172033] py-3 text-center text-sm font-black text-white"
                >
                  ✏️ 수정
                </Link>

                <Link
                  href={`/ads/${ad.id}/delete`}
                  className="rounded-2xl bg-red-600 py-3 text-center text-sm font-black text-white"
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