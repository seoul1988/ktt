"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import CommunityBottomNav from "../../components/CommunityBottomNav";

export default function NewAdPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [findingGps, setFindingGps] = useState(false);

  const [imageFiles, setImageFiles] = useState<FileList | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);

  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);

  function handleImageChange(files: FileList | null) {
    setImageFiles(files);

    if (!files || files.length === 0) {
      setImagePreviews([]);
      return;
    }

    const previews = Array.from(files).map((file) =>
      URL.createObjectURL(file)
    );

    setImagePreviews(previews);
  }

  function handleVideoChange(file: File | null) {
    setVideoFile(file);

    if (!file) {
      setVideoPreview(null);
      return;
    }

    setVideoPreview(URL.createObjectURL(file));
  }

  async function geocodeAddress(address: string) {
    if (!address.trim()) {
      return { lat: null, lng: null };
    }

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          address
        )}&limit=1`
      );

      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        return { lat: null, lng: null };
      }

      return {
        lat: Number(data[0].lat),
        lng: Number(data[0].lon),
      };
    } catch {
      return { lat: null, lng: null };
    }
  }

  async function handleFindGps() {
    if (!location.trim()) {
      alert("주소 또는 지역을 입력하세요.");
      return;
    }

    setFindingGps(true);

    const coords = await geocodeAddress(location);

    setFindingGps(false);

    if (coords.lat === null || coords.lng === null) {
      alert("위도/경도를 찾을 수 없습니다. 주소를 더 정확히 입력하세요.");
      return;
    }

    setLat(coords.lat);
    setLng(coords.lng);
    alert("위도/경도가 입력되었습니다.");
  }

  async function uploadImages(userId: string) {
    if (!imageFiles || imageFiles.length === 0) return [];

    const urls: string[] = [];

    for (const file of Array.from(imageFiles)) {
      const ext = file.name.split(".").pop();
      const path = `${userId}/images/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;

      const { error } = await supabase.storage.from("ads").upload(path, file);

      if (error) throw error;

      const { data } = supabase.storage.from("ads").getPublicUrl(path);
      urls.push(data.publicUrl);
    }

    return urls;
  }

  async function uploadVideo(userId: string) {
    if (!videoFile) return null;

    const ext = videoFile.name.split(".").pop();
    const path = `${userId}/videos/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;

    const { error } = await supabase.storage.from("ads").upload(path, videoFile);

    if (error) throw error;

    const { data } = supabase.storage.from("ads").getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim()) {
      alert("제목을 입력하세요.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("로그인이 필요합니다.");
        router.push("/login");
        return;
      }

      let finalLat = lat;
      let finalLng = lng;

      if (location.trim() && (finalLat === null || finalLng === null)) {
        const coords = await geocodeAddress(location);
        finalLat = coords.lat;
        finalLng = coords.lng;
      }

      const imageUrls = await uploadImages(user.id);
      const videoUrl = await uploadVideo(user.id);

      const { error } = await supabase.from("ads").insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        category: category.trim() || null,
        location: location.trim() || null,
        phone: phone.trim() || null,
        lat: finalLat,
        lng: finalLng,
        images: imageUrls,
        video_url: videoUrl,
        status: "active",
        display_order: 999,
      });

      if (error) throw error;

      router.push("/ads");
      router.refresh();
    } catch (err: any) {
      alert(err.message || "광고 등록 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-4 pb-24 text-[#172033]">
      <div className="mx-auto max-w-md">
        <h1 className="mb-4 text-2xl font-black">광고 등록</h1>

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
            placeholder="카테고리 예: 식당, 청소, 구인, 부동산"
            className="w-full rounded-2xl border p-3 text-sm"
          />

          <div>
            <div className="flex gap-2">
              <input
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  setLat(null);
                  setLng(null);
                }}
                placeholder="주소 예: 123 Main St, Cary, NC"
                className="flex-1 rounded-2xl border p-3 text-sm"
              />

              <button
                type="button"
                onClick={handleFindGps}
                disabled={findingGps}
                className="rounded-2xl bg-[#172033] px-4 text-xs font-black text-white disabled:opacity-50"
              >
                {findingGps ? "찾는 중" : "GPS"}
              </button>
            </div>

            {(lat !== null && lng !== null) && (
              <div className="mt-2 rounded-2xl bg-green-50 p-3 text-xs font-bold text-green-700">
                Latitude: {lat}
                <br />
                Longitude: {lng}
              </div>
            )}
          </div>

          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="전화번호"
            className="w-full rounded-2xl border p-3 text-sm"
          />

          <div>
            <p className="mb-2 text-sm font-black">이미지</p>

            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-2xl border p-3 text-sm text-gray-500">
                {imageFiles && imageFiles.length > 0
                  ? `${imageFiles.length}개 선택됨`
                  : "선택된 이미지 없음"}
              </div>

              <label className="cursor-pointer rounded-2xl bg-[#172033] px-4 py-3 text-sm font-black text-white">
                첨부
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleImageChange(e.target.files)}
                  className="hidden"
                />
              </label>
            </div>

            {imagePreviews.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {imagePreviews.map((src, index) => (
                  <img
                    key={index}
                    src={src}
                    alt={`preview-${index}`}
                    className="h-24 w-full rounded-xl border object-cover"
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-black">동영상</p>

            <div className="flex items-center gap-2">
              <div className="flex-1 truncate rounded-2xl border p-3 text-sm text-gray-500">
                {videoFile ? videoFile.name : "선택된 동영상 없음"}
              </div>

              <label className="cursor-pointer rounded-2xl bg-[#172033] px-4 py-3 text-sm font-black text-white">
                첨부
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) =>
                    handleVideoChange(e.target.files?.[0] || null)
                  }
                  className="hidden"
                />
              </label>
            </div>

            {videoPreview && (
              <div className="mt-3 overflow-hidden rounded-2xl border">
                <video src={videoPreview} controls className="w-full" />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-2xl bg-[#172033] py-3 text-sm font-black text-white disabled:opacity-50"
          >
            {saving ? "등록 중..." : "광고 등록"}
          </button>
        </form>
      </div>

      <CommunityBottomNav activeNav="ads" />
    </main>
  );
}