"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import CommunityBottomNav from "../../components/CommunityBottomNav";
import ProfileButton from "../../components/ProfileButton";
type MarketItem = {
  id: number;
  title: string;
  price: number | null;
  status: string | null;
  location: string | null;
  category: string | null;
  images: string[] | null;
  created_at: string;
};

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

  async function deleteItem(id: number) {
    if (!confirm("정말 삭제할까요?")) return;

    const { error } = await supabase.from("market_items").delete().eq("id", id);

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
      <div className="mx-auto max-w-md">
<div className="relative mb-4 flex items-center justify-center">
  <Link
    href="/market"
    className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl font-black text-[#172033] shadow"
  >
    ←
  </Link>

  <h1 className="text-2xl font-black text-[#172033]">
    내가 올린 물품
  </h1>

  <div className="absolute right-0 flex items-center gap-2">
    <Link
      href="/market/new"
      className="rounded-full bg-[#172033] px-4 py-2 text-sm font-black text-white"
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
              className="mt-4 inline-block rounded-full bg-[#172033] px-5 py-3 text-sm font-black text-white"
            >
              첫 물품 등록하기
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-3xl bg-white p-3 shadow">
                <div className="flex gap-3">
                  <Link
                    href={`/market/${item.id}`}
                    className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-gray-200"
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

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/market/${item.id}`}
                        className="line-clamp-1 font-black text-[#172033]"
                      >
                        {item.title}
                      </Link>

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
                    className="rounded-full bg-blue-100 py-2 text-center text-blue-700"
                  >
                    수정
                  </Link>

                  <button
                    type="button"
                    onClick={() => updateStatus(item.id, "available")}
                    className="rounded-full bg-green-100 py-2 text-green-700"
                  >
                    판매중
                  </button>

                  <button
                    type="button"
                    onClick={() => updateStatus(item.id, "reserved")}
                    className="rounded-full bg-yellow-100 py-2 text-yellow-700"
                  >
                    예약
                  </button>

                  <button
                    type="button"
                    onClick={() => updateStatus(item.id, "sold")}
                    className="rounded-full bg-gray-200 py-2 text-gray-700"
                  >
                    완료
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteItem(item.id)}
                    className="rounded-full bg-red-100 py-2 text-red-600"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
	   <CommunityBottomNav />
    </main>
  );
}