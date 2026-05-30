"use client";

import { useState } from "react";
import { supabase } from "../../../lib/supabase";
import { useRouter } from "next/navigation";

export default function NewMarketItemPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("가구");
  const [condition, setCondition] = useState("중고");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  async function submitItem() {
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      alert("로그인이 필요합니다.");
      return;
    }

    if (!title.trim()) {
      alert("제목을 입력하세요.");
      return;
    }

    const { error } = await supabase.from("market_items").insert({
      seller_id: userData.user.id,
      title,
      price: Number(price || 0),
      category,
      condition,
      location,
      phone,
      description,
      images: imageUrl ? [imageUrl] : [],
      status: "available",
    });

    if (error) {
      alert("등록 실패: " + error.message);
      return;
    }

    router.push("/market");
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-4">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-5 shadow">
        <h1 className="mb-4 text-2xl font-black text-[#172033]">
          상품 등록
        </h1>

        <input className="mb-3 w-full rounded-xl border p-3" placeholder="제목" value={title} onChange={(e) => setTitle(e.target.value)} />

        <input className="mb-3 w-full rounded-xl border p-3" placeholder="가격" value={price} onChange={(e) => setPrice(e.target.value)} />

        <select className="mb-3 w-full rounded-xl border p-3" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option>가구</option>
          <option>전자제품</option>
          <option>자동차</option>
          <option>아기용품</option>
          <option>의류</option>
          <option>무료나눔</option>
          <option>기타</option>
        </select>

        <select className="mb-3 w-full rounded-xl border p-3" value={condition} onChange={(e) => setCondition(e.target.value)}>
          <option>새것</option>
          <option>거의 새것</option>
          <option>중고</option>
          <option>고장/수리필요</option>
        </select>

        <input className="mb-3 w-full rounded-xl border p-3" placeholder="지역 예: Raleigh, Cary" value={location} onChange={(e) => setLocation(e.target.value)} />

        <input className="mb-3 w-full rounded-xl border p-3" placeholder="연락처" value={phone} onChange={(e) => setPhone(e.target.value)} />

        <input className="mb-3 w-full rounded-xl border p-3" placeholder="이미지 URL" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />

        <textarea className="mb-4 h-32 w-full rounded-xl border p-3" placeholder="설명" value={description} onChange={(e) => setDescription(e.target.value)} />

        <button
          onClick={submitItem}
          className="w-full rounded-full bg-[#172033] py-4 font-black text-white"
        >
          등록하기
        </button>
      </div>
    </main>
  );
}