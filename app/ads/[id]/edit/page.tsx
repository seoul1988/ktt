"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import CommunityBottomNav from "../../../components/CommunityBottomNav";

export default function EditAdPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("active");

  useEffect(() => {
    async function loadAd() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("로그인이 필요합니다.");
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("ads")
        .select("*")
        .eq("id", id)
        .eq("owner_id", user.id)
        .maybeSingle();

      if (error || !data) {
        alert("광고를 찾을 수 없습니다.");
        router.push("/ads/my");
        return;
      }

      setTitle(data.title || "");
      setDescription(data.description || "");
      setCategory(data.category || "");
      setLocation(data.location || "");
      setPhone(data.phone || "");
      setStatus(data.status || "active");
      setLoading(false);
    }

    loadAd();
  }, [id, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim()) {
      alert("제목을 입력하세요.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("ads")
      .update({
        title,
        description,
        category,
        location,
        phone,
        status,
      })
      .eq("id", id);

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    router.push("/ads/my");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F8F3EC] p-4 text-[#172033]">
        <p className="text-sm font-bold text-gray-500">불러오는 중...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-4 pb-24 text-[#172033]">
      <div className="mx-auto max-w-md">
        <h1 className="mb-4 text-2xl font-black">광고 수정</h1>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-3xl bg-white p-5 shadow"
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="광고 제목"
            className="w-full rounded-2xl border p-3 text-sm font-bold"
          />

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="광고 설명"
            className="min-h-28 w-full rounded-2xl border p-3 text-sm"
          />

          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="카테고리"
            className="w-full rounded-2xl border p-3 text-sm"
          />

          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="지역"
            className="w-full rounded-2xl border p-3 text-sm"
          />

          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="전화번호"
            className="w-full rounded-2xl border p-3 text-sm"
          />

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-2xl border p-3 text-sm font-bold"
          >
            <option value="active">광고중</option>
            <option value="expired">만료</option>
            <option value="hidden">숨김</option>
          </select>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-2xl bg-[#172033] py-3 text-sm font-black text-white disabled:opacity-50"
          >
            {saving ? "저장 중..." : "수정 저장"}
          </button>
        </form>
      </div>

      <CommunityBottomNav activeNav="ads" />
    </main>
  );
}