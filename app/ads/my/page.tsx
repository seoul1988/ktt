"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import CommunityBottomNav from "../../components/CommunityBottomNav";

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

export default function MyAdsPage() {
  const [ads, setAds] = useState<AdItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadAds() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("ads")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    setAds((data || []) as AdItem[]);
    setLoading(false);
  }

  async function hideAd(id: number) {
    if (!confirm("이 광고를 숨기시겠습니까?")) return;

    const { error } = await supabase
      .from("ads")
      .update({ status: "hidden" })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    loadAds();
  }

  useEffect(() => {
    loadAds();
  }, []);

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-4 pb-24 text-[#172033]">
      <div className="mx-auto max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-black">내 광고</h1>

          <Link
            href="/ads/new"
            className="rounded-full bg-[#172033] px-4 py-2 text-sm font-bold text-white"
          >
            + 등록
          </Link>
        </div>

        {loading ? (
          <p className="text-sm font-bold text-gray-500">불러오는 중...</p>
        ) : ads.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-center shadow">
            <p className="text-sm font-bold text-gray-500">
              등록한 광고가 없습니다.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {ads.map((ad) => (
              <div key={ad.id} className="rounded-3xl bg-white p-3 shadow">
                <Link href={`/ads/${ad.id}`} className="flex gap-3">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-gray-200">
                    {ad.images?.[0] ? (
                      <img
                        src={ad.images[0]}
                        alt={ad.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] font-bold text-gray-400">
                        이미지 없음
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="line-clamp-1 text-sm font-black">
                      {ad.title}
                    </h2>
                    <p className="mt-1 text-xs font-bold text-gray-500">
                      {ad.category || "카테고리 없음"} · {ad.status || "active"}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-gray-600">
                      {ad.description || ""}
                    </p>
                  </div>
                </Link>

                <button
                  onClick={() => hideAd(ad.id)}
                  className="mt-3 w-full rounded-2xl bg-red-600 py-2 text-xs font-black text-white"
                >
                  숨기기
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <CommunityBottomNav activeNav="ads" />
    </main>
  );
}