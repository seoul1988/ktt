"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../../lib/supabase";
import CommunityBottomNav from "../../../../components/CommunityBottomNav";

export default function NewBusinessEventPage() {
  const params = useParams();
  const router = useRouter();
  const businessId = params.id as string;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);

  async function submitEvent() {
    if (!title.trim()) {
      alert("이벤트 제목을 입력하세요.");
      return;
    }

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("로그인이 필요합니다.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("business_events").insert({
      business_id: Number(businessId),
      owner_id: user.id,
      title: title.trim(),
      description: description.trim(),
      image_url: imageUrl.trim(),
      event_date: eventDate || null,
      location: location.trim(),
      status: "pending",
      active: true,
    });

    if (error) {
      alert("이벤트 등록 실패: " + error.message);
      setSaving(false);
      return;
    }

    alert("이벤트가 등록되었습니다. 관리자 승인 후 노출됩니다.");
    router.push(`/business/${businessId}`);
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-4 pb-28 text-[#172033]">
      <div className="mx-auto max-w-md">
        <div className="relative mb-4 flex items-center justify-center">
          <Link
            href={`/business/${businessId}`}
            className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl font-black shadow"
          >
            ←
          </Link>

          <h1 className="text-2xl font-black">이벤트 등록</h1>
        </div>

        <div className="space-y-4 rounded-3xl bg-white p-5 shadow">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="이벤트 제목"
            className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
          />

          <input
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            type="date"
            className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
          />

          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="장소"
            className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
          />

          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="이미지 URL"
            className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
          />

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="이벤트 설명"
            rows={5}
            className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
          />

          <button
            type="button"
            onClick={submitEvent}
            disabled={saving}
            className="w-full rounded-full bg-[#172033] py-4 text-sm font-black text-white"
          >
            {saving ? "등록 중..." : "승인 요청하기"}
          </button>
        </div>
      </div>

      <CommunityBottomNav />
    </main>
  );
}