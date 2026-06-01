"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";

const ADMIN_EMAILS = ["mbsproinc@gmail.com"];

export default function EditBusinessEventPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [canManage, setCanManage] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");

  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");

  useEffect(() => {
    loadEvent();
  }, []);

  function handleImage(file: File | null) {
    if (!file) return;

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function removeImage() {
    setImageFile(null);
    setImagePreview("");
    setImageUrl("");
  }

  async function uploadFile(file: File) {
    const ext = file.name.split(".").pop();
    const fileName = `images/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;

    const { error } = await supabase.storage
      .from("event-images")
      .upload(fileName, file);

    if (error) throw error;

    const { data } = supabase.storage
      .from("event-images")
      .getPublicUrl(fileName);

    return data.publicUrl;
  }

  async function loadEvent() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: event, error } = await supabase
      .from("business_events")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !event) {
      alert("이벤트를 찾을 수 없습니다.");
      router.push("/business-events");
      return;
    }

    const isOwner = user?.id === event.owner_id;
    const isAdmin = ADMIN_EMAILS.includes(user?.email || "");

    if (!user || (!isOwner && !isAdmin)) {
      alert("수정 권한이 없습니다.");
      router.push(`/business-events/${id}`);
      return;
    }

    setCanManage(true);
    setTitle(event.title || "");
    setDescription(event.description || "");
    setEventDate(event.event_date || "");
    setLocation(event.location || event.address || "");
    setImageUrl(event.image_url || "");
    setLoading(false);
  }

  async function saveEvent() {
    if (!canManage) return;

    if (!title.trim()) {
      alert("제목을 입력하세요.");
      return;
    }

    setSaving(true);

    try {
      let finalImageUrl = imageUrl;

      if (imageFile) {
        finalImageUrl = await uploadFile(imageFile);
      }

      const { error } = await supabase
        .from("business_events")
        .update({
          title: title.trim(),
          description: description.trim() || null,
          event_date: eventDate || null,
          location: location.trim() || null,
          image_url: finalImageUrl || null,
        })
        .eq("id", id);

      if (error) {
        alert("수정 실패: " + error.message);
        setSaving(false);
        return;
      }

      alert("수정되었습니다.");
      router.push(`/business-events/${id}`);
      router.refresh();
    } catch (err: any) {
      alert("저장 실패: " + err.message);
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F8F3EC] p-5">
        Loading...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-5 pb-28 text-[#172033]">
      <div className="mb-5 flex items-center justify-between">
        <Link
          href={`/business-events/${id}`}
          className="rounded-full bg-white px-4 py-2 text-sm font-black shadow"
        >
          ← Back
        </Link>

        <button
          type="button"
          disabled={saving}
          onClick={saveEvent}
          className="rounded-full bg-[#172033] px-5 py-2 text-sm font-black text-white shadow disabled:bg-gray-400"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      <div className="space-y-5 rounded-3xl bg-white p-5 shadow">
        <div>
          <label className="mb-2 block text-sm font-black text-[#172033]">
            제목
          </label>
          <input
            type="text"
            placeholder="이벤트 제목"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-black text-[#172033]">
            날짜
          </label>
          <input
            type="date"
            value={eventDate || ""}
            onChange={(e) => setEventDate(e.target.value)}
            className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-black text-[#172033]">
            주소
          </label>
          <input
            type="text"
            placeholder="주소"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-sm font-black text-[#172033]">
              이미지
            </label>

            <label className="cursor-pointer rounded-full bg-[#172033] px-4 py-2 text-xs font-black text-white shadow">
              첨부

              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImage(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
          </div>

          {(imagePreview || imageUrl) && (
            <div className="relative mt-3 overflow-hidden rounded-2xl bg-white">
              <button
                type="button"
                onClick={removeImage}
                className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-lg font-black text-white shadow"
              >
                ×
              </button>

              <img
                src={imagePreview || imageUrl}
                alt="Preview"
                className="h-56 w-full object-contain"
              />
            </div>
          )}
        </div>

        <div>
          <label className="mb-2 block text-sm font-black text-[#172033]">
            설명
          </label>
          <textarea
            placeholder="이벤트 설명"
            rows={8}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
          />
        </div>
      </div>
    </main>
  );
}