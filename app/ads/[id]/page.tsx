import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import CommunityBottomNav from "../../components/CommunityBottomNav";

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
};

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

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-4 pb-24 text-[#172033]">
      <div className="mx-auto max-w-md">
        <Link href="/ads" className="mb-4 inline-block text-sm font-bold">
          ← 광고 목록
        </Link>

        <div className="overflow-hidden rounded-3xl bg-white shadow">
          <div className="bg-gray-200">
            {ad.images?.[0] ? (
              <img
                src={ad.images[0]}
                alt={ad.title}
                className="max-h-[420px] w-full object-contain"
              />
            ) : (
              <div className="flex h-64 items-center justify-center text-sm font-bold text-gray-400">
                이미지 없음
              </div>
            )}
          </div>

          {Array.isArray(ad.images) && ad.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto p-3">
              {ad.images.map((img, index) => (
                <img
                  key={index}
                  src={img}
                  alt={`${ad.title}-${index}`}
                  className="h-20 w-20 shrink-0 rounded-2xl object-cover"
                />
              ))}
            </div>
          )}

          {ad.video_url && (
            <div className="p-3">
              <video
                src={ad.video_url}
                controls
                className="w-full rounded-2xl"
              />
            </div>
          )}

          <div className="p-5">
            <div className="mb-2 flex items-center gap-2">
              {ad.category && (
                <span className="rounded-full bg-[#172033]/10 px-3 py-1 text-xs font-black text-[#172033]">
                  {ad.category}
                </span>
              )}

              {ad.status && (
                <span className="rounded-full bg-green-600 px-3 py-1 text-xs font-black text-white">
                  {ad.status}
                </span>
              )}
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

            {ad.phone && (
              <div className="mt-5 grid grid-cols-2 gap-2">
                <a
                  href={`tel:${ad.phone}`}
                  className="rounded-2xl bg-[#172033] py-3 text-center text-sm font-black text-white"
                >
                  전화
                </a>

                <a
                  href={`sms:${ad.phone}`}
                  className="rounded-2xl border border-[#172033] py-3 text-center text-sm font-black text-[#172033]"
                >
                  문자
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      <CommunityBottomNav activeNav="ads" />
    </main>
  );
}