"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabase";
import { useRouter, useParams } from "next/navigation";

export default function EditMarketItemPage() {
  const router = useRouter();
  const params = useParams();

  const id = params.id as string;

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [status, setStatus] = useState("available");

  useEffect(() => {
    loadItem();
  }, []);

  async function loadItem() {
    const { data, error } = await supabase
      .from("market_items")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      alert("상품을 찾을 수 없습니다.");
      router.push("/market/my");
      return;
    }

    setTitle(data.title || "");
    setPrice(String(data.price || ""));
    setCategory(data.category || "");
    setCondition(data.condition || "");
    setLocation(data.location || "");
    setPhone(data.phone || "");
    setDescription(data.description || "");
    setImageUrl(data.images?.[0] || "");
    setStatus(data.status || "available");
  }

  async function updateItem() {
    const { error } = await supabase
      .from("market_items")
      .update({
        title,
        price: Number(price || 0),
        category,
        condition,
        location,
        phone,
        description,
        images: imageUrl ? [imageUrl] : [],
        status,
      })
      .eq("id", id);

    if (error) {
      alert("수정 실패: " + error.message);
      return;
    }

    router.push("/market/my");
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-4">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-5 shadow">
        <h1 className="mb-4 text-2xl font-black text-[#172033]">
          상품 수정
        </h1>

        <input className="mb-3 w-full rounded-xl border p-3" value={title} onChange={(e) => setTitle(e.target.value)} />

        <input className="mb-3 w-full rounded-xl border p-3" value={price} onChange={(e) => setPrice(e.target.value)} />

        <input className="mb-3 w-full rounded-xl border p-3" value={category} onChange={(e) => setCategory(e.target.value)} />

        <input className="mb-3 w-full rounded-xl border p-3" value={condition} onChange={(e) => setCondition(e.target.value)} />

        <input className="mb-3 w-full rounded-xl border p-3" value={location} onChange={(e) => setLocation(e.target.value)} />

        <input className="mb-3 w-full rounded-xl border p-3" value={phone} onChange={(e) => setPhone(e.target.value)} />

        <input className="mb-3 w-full rounded-xl border p-3" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />

        <select className="mb-3 w-full rounded-xl border p-3" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="available">판매중</option>
          <option value="reserved">예약중</option>
          <option value="sold">판매완료</option>
          <option value="hidden">숨김</option>
        </select>

        <textarea className="mb-4 h-32 w-full rounded-xl border p-3" value={description} onChange={(e) => setDescription(e.target.value)} />

        <button
          onClick={updateItem}
          className="w-full rounded-full bg-[#172033] py-4 font-black text-white"
        >
          수정 저장
        </button>
      </div>
    </main>
  );
}