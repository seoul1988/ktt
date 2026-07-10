"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import CommunityBottomNav from "../../components/CommunityBottomNav";
import ProfileButton from "../../components/ProfileButton";
export const dynamic = "force-dynamic";

type MarketItem = {
  id: number;
  title: string;
  price: number | null;
  status: string | null;
  location: string | null;
  category: string | null;
  images: string[] | null;
  video_url: string | null;
  created_at: string;
};

function getStoragePathFromUrl(url: string, bucket: string) {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = url.indexOf(marker);

  if (index === -1) return null;

  return decodeURIComponent(url.slice(index + marker.length));
}

export default function MyMarketItemsPage() {
  const [items, setItems] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("market_items")
      .select("*")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      alert("상품 불러오기 실패: " + error.message);
      setLoading(false);
      return;
    }

    setItems((data || []) as MarketItem[]);
    setLoading(false);
  }

  async function updateStatus(id: number, status: string) {
    const { error } = await supabase
      .from("market_items")
      .update({ status })
      .eq("id", id);

    if (error) {
      alert("상태 변경 실패: " + error.message);
      return;
    }

    loadItems();
  }

  async function deleteItem(item: MarketItem) {
  if (!confirm("정말 삭제할까요?")) return;

  const pathsToDelete: string[] = [];

  if (Array.isArray(item.images)) {
    item.images.forEach((url) => {
      const path = getStoragePathFromUrl(url, "market");
      if (path) pathsToDelete.push(path);
    });
  }

  if (item.video_url) {
    const videoPath = getStoragePathFromUrl(item.video_url, "market");
    if (videoPath) pathsToDelete.push(videoPath);
  }

  console.log("삭제할 파일 경로:", pathsToDelete);

  if (pathsToDelete.length > 0) {
    const { error: storageError } = await supabase.storage
      .from("market")
      .remove(pathsToDelete);

    if (storageError) {
      alert("파일 삭제 실패: " + storageError.message);
      return;
    }
  }

  const { error } = await supabase
    .from("market_items")
    .delete()
    .eq("id", item.id);

  if (error) {
    alert("삭제 실패: " + error.message);
    return;
  }

  loadItems();
}

  if (loading) {
    return <div className="p-6">불러오는 중...</div>;
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-4 pb-28">
      <div className="mx-auto w-full max-w-xl">
        <div className="relative mb-4 flex items-center justify-center">
          <Link
            href="/market"
            className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl font-black text-[#172033] shadow transition-transform active:scale-95"
          >
            ←
          </Link>

          <h1 className="text-2xl font-black text-[#172033]">
            내가 올린 물품
          </h1>

          <div className="absolute right-0 flex items-center gap-2">
            <Link
              href="/market/new"
              className="rounded-full bg-[#172033] px-4 py-2 text-sm font-black text-white transition-transform active:scale-95"
            >
              + 등록
            </Link>

            <ProfileButton />
          </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-center shadow">
            <p className="text-sm font-bold text-gray-500">
              아직 등록한 물품이 없습니다.
            </p>

            <Link
              href="/market/new"
              className="mt-4 inline-block rounded-full bg-[#172033] px-5 py-3 text-sm font-black text-white transition-transform active:scale-95"
            >
              첫 물품 등록하기
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const isSold = item.status === "sold";

              return (
                <div key={item.id} className="rounded-3xl bg-white p-3 shadow">
                  <div className="flex gap-3">
                    {isSold ? (
                      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-gray-200 opacity-70">
                        {item.images?.[0] ? (
                          <img
                            src={item.images[0]}
                            alt={item.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-bold text-gray-400">
                            이미지 없음
                          </div>
                        )}

                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <span className="rounded-lg bg-white px-2 py-1 text-[10px] font-black text-red-600">
                            판매완료
                          </span>
                        </div>
                      </div>
                    ) : (
                      <Link
                        href={`/market/${item.id}`}
                        className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-gray-200 transition-transform active:scale-95"
                      >
                        {item.images?.[0] ? (
                          <img
                            src={item.images[0]}
                            alt={item.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-bold text-gray-400">
                            이미지 없음
                          </div>
                        )}
                      </Link>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        {isSold ? (
                          <span className="line-clamp-1 font-black text-gray-500">
                            {item.title}
                          </span>
                        ) : (
                          <Link
                            href={`/market/${item.id}`}
                            className="line-clamp-1 font-black text-[#172033]"
                          >
                            {item.title}
                          </Link>
                        )}

                        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-[10px] font-black text-gray-600">
                          {item.status === "available"
                            ? "판매중"
                            : item.status === "reserved"
                            ? "예약중"
                            : item.status === "sold"
                            ? "판매완료"
                            : item.status}
                        </span>
                      </div>

                      <p className="mt-1 text-sm font-black text-[#C2410C]">
                        ${item.price || 0}
                      </p>

                      <p className="mt-1 line-clamp-1 text-xs text-gray-500">
                        {item.category} · {item.location}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-5 gap-1 text-xs font-black">
                    <Link
                      href={`/market/${item.id}/edit`}
                      className="rounded-full bg-blue-100 py-2 text-center text-blue-700 transition-transform active:scale-95"
                    >
                      수정
                    </Link>

                    <button
                      type="button"
                      onClick={() => updateStatus(item.id, "available")}
                      className="rounded-full bg-green-100 py-2 text-green-700 transition-transform active:scale-95"
                    >
                      판매중
                    </button>

                    <button
                      type="button"
                      onClick={() => updateStatus(item.id, "reserved")}
                      className="rounded-full bg-yellow-100 py-2 text-yellow-700 transition-transform active:scale-95"
                    >
                      예약
                    </button>

                    <button
                      type="button"
                      onClick={() => updateStatus(item.id, "sold")}
                      className="rounded-full bg-gray-200 py-2 text-gray-700 transition-transform active:scale-95"
                    >
                      완료
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteItem(item)}
                      className="rounded-full bg-red-100 py-2 text-red-600 transition-transform active:scale-95"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CommunityBottomNav />
    </main>
  );
}