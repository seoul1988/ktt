"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

type MarketItem = {
  id: number;
  title: string;
  price: number;
  status: string;
  location: string | null;
  images: string[] | null;
};

export default function MyMarketItemsPage() {
  const [items, setItems] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("market_items")
      .select("*")
      .eq("seller_id", userData.user.id)
      .order("created_at", { ascending: false });

    setItems((data || []) as MarketItem[]);
    setLoading(false);
  }

  async function updateStatus(id: number, status: string) {
    const { error } = await supabase
      .from("market_items")
      .update({ status })
      .eq("id", id);

    if (error) {
      alert("변경 실패: " + error.message);
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
    return <div className="p-6">Loading...</div>;
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-4 pb-24">
      <div className="mx-auto max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-black text-[#172033]">내 상품 관리</h1>

          <Link
            href="/market/new"
            className="rounded-full bg-[#172033] px-4 py-2 text-sm font-bold text-white"
          >
            + 등록
          </Link>
        </div>

        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl bg-white p-3 shadow">
              <div className="flex gap-3">
                <div className="h-24 w-24 overflow-hidden rounded-xl bg-gray-200">
                  {item.images?.[0] && (
                    <img
                      src={item.images[0]}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>

                <div className="flex-1">
                  <Link
                    href={`/market/${item.id}`}
                    className="font-black text-[#172033]"
                  >
                    {item.title}
                  </Link>

                  <p className="text-sm font-bold text-[#C2410C]">
                    ${item.price}
                  </p>

                  <p className="text-xs text-gray-500">{item.location}</p>

                  <p className="mt-1 text-xs font-bold">
                    상태: {item.status}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2 text-xs font-bold">
                <button
                  onClick={() => updateStatus(item.id, "available")}
                  className="rounded-full bg-green-100 py-2"
                >
                  판매중
                </button>

                <button
                  onClick={() => updateStatus(item.id, "reserved")}
                  className="rounded-full bg-yellow-100 py-2"
                >
                  예약
                </button>

                <button
                  onClick={() => updateStatus(item.id, "sold")}
                  className="rounded-full bg-gray-200 py-2"
                >
                  완료
                </button>

                <button
                  onClick={() => deleteItem(item.id)}
                  className="rounded-full bg-red-100 py-2 text-red-600"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}

          {items.length === 0 && (
            <div className="rounded-2xl bg-white p-6 text-center text-sm font-bold text-gray-500">
              등록한 상품이 없습니다.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}