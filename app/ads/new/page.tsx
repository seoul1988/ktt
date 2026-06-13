"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import CommunityBottomNav from "../../components/CommunityBottomNav";

declare global {
  interface Window {
    google: any;
  }
}

export default function NewAdPage() {
  const router = useRouter();
  const addressRef = useRef<HTMLInputElement | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  const [imageFiles, setImageFiles] = useState<FileList | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadGooglePlaces();
  }, []);

  function loadGooglePlaces() {
    if (window.google?.maps?.places) {
      initAutocomplete();
      return;
    }

    const existingScript = document.getElementById("google-maps-script");
    if (existingScript) {
      existingScript.addEventListener("load", initAutocomplete);
      return;
    }

    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.onload = initAutocomplete;
    document.body.appendChild(script);
  }

  function initAutocomplete() {
    if (!addressRef.current || !window.google?.maps?.places) return;

    const autocomplete = new window.google.maps.places.Autocomplete(
      addressRef.current,
      {
        fields: ["formatted_address", "geometry", "name"],
        componentRestrictions: { country: "us" },
      }
    );

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();

      if (!place.geometry?.location) {
        alert("주소의 위치 정보를 찾을 수 없습니다.");
        return;
      }

      const selectedAddress =
        place.formatted_address || place.name || addressRef.current?.value || "";

      setLocation(selectedAddress);
      setLat(place.geometry.location.lat());
      setLng(place.geometry.location.lng());
    });
  }

  function handleImageChange(files: FileList | null) {
    setImageFiles(files);

    if (!files || files.length === 0) {
      setImagePreviews([]);
      return;
    }

    setImagePreviews(Array.from(files).map((file) => URL.createObjectURL(file)));
  }

  function handleVideoChange(file: File | null) {
    setVideoFile(file);
    setVideoPreview(file ? URL.createObjectURL(file) : null);
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

      const imageUrls = await uploadImages(user.id);
      const videoUrl = await uploadVideo(user.id);

      const { error } = await supabase.from("ads").insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        category: category.trim() || null,
        location: location.trim() || null,
        phone: phone.trim() || null,
        lat,
        lng,
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

        <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl bg-white p-5 shadow">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="광고 제목" className="w-full rounded-2xl border p-3 text-sm font-bold" />

          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="광고 설명" className="min-h-28 w-full rounded-2xl border p-3 text-sm" />

          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="카테고리 예: 식당, 청소, 구인, 부동산" className="w-full rounded-2xl border p-3 text-sm" />

          <input
            ref={addressRef}
            value={location}
            onChange={(e) => {
              setLocation(e.target.value);
              setLat(null);
              setLng(null);
            }}
            placeholder="주소를 입력하고 아래 추천 주소를 선택하세요"
            className="w-full rounded-2xl border p-3 text-sm"
          />

          {lat !== null && lng !== null && (
            <div className="rounded-2xl bg-green-50 p-3 text-xs font-bold text-green-700">
              GPS saved: {lat}, {lng}
            </div>
          )}

          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="전화번호" className="w-full rounded-2xl border p-3 text-sm" />

          <input type="file" accept="image/*" multiple onChange={(e) => handleImageChange(e.target.files)} className="w-full rounded-2xl border p-3 text-sm" />

          {imagePreviews.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {imagePreviews.map((src, index) => (
                <img key={index} src={src} className="h-24 w-full rounded-xl object-cover" />
              ))}
            </div>
          )}

          <input type="file" accept="video/*" onChange={(e) => handleVideoChange(e.target.files?.[0] || null)} className="w-full rounded-2xl border p-3 text-sm" />

          {videoPreview && <video src={videoPreview} controls className="w-full rounded-2xl" />}

          <button type="submit" disabled={saving} className="w-full rounded-2xl bg-[#172033] py-3 text-sm font-black text-white disabled:opacity-50">
            {saving ? "등록 중..." : "광고 등록"}
          </button>
        </form>
      </div>

      <CommunityBottomNav activeNav="ads" />
    </main>
  );
}