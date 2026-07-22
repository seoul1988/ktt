"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import CommunityBottomNav from "../../components/CommunityBottomNav";
import ProfileButton from "@/app/components/ProfileButton";
import BackButton from "@/app/components/BackButton";


declare global {
  interface Window {
    google: any;
  }
}


async function optimizeImage(
  file: File,
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.78,
): Promise<File> {
  // Keep animated GIFs and SVG files unchanged.
  if (file.type === "image/gif" || file.type === "image/svg+xml") {
    return file;
  }

  let source: ImageBitmap | HTMLImageElement | null = null;
  let objectUrl = "";

  try {
    if ("createImageBitmap" in window) {
      source = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
    } else {
      objectUrl = URL.createObjectURL(file);
      source = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("이미지를 읽을 수 없습니다."));
        image.src = objectUrl;
      });
    }

    const originalWidth = source.width;
    const originalHeight = source.height;
    const scale = Math.min(
      1,
      maxWidth / originalWidth,
      maxHeight / originalHeight,
    );

    const targetWidth = Math.max(1, Math.round(originalWidth * scale));
    const targetHeight = Math.max(1, Math.round(originalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("이미지 변환을 시작할 수 없습니다.");

    context.drawImage(source, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", quality);
    });

    if (!blob) throw new Error("WebP 이미지 변환에 실패했습니다.");

    const baseName = file.name.replace(/\.[^/.]+$/, "") || "ad-image";

    return new File([blob], `${baseName}.webp`, {
      type: "image/webp",
      lastModified: Date.now(),
    });
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);

    if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) {
      source.close();
    }
  }
}

export default function NewAdPage() {
  const router = useRouter();
  const addressRef = useRef<HTMLInputElement | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("business");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  const [imageFiles, setImageFiles] = useState<File[]>([]);
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

  async function handleImageChange(files: FileList | null) {
    imagePreviews.forEach((preview) => URL.revokeObjectURL(preview));

    if (!files || files.length === 0) {
      setImageFiles([]);
      setImagePreviews([]);
      return;
    }

    try {
      const selectedFiles = Array.from(files).filter((file) =>
        file.type.startsWith("image/"),
      );

      // Resize large images and convert JPG/PNG/HEIC-capable browser images
      // to WebP before uploading to Supabase.
      const optimizedFiles = await Promise.all(
        selectedFiles.map((file) => optimizeImage(file, 1600, 1600, 0.78)),
      );

      setImageFiles(optimizedFiles);
      setImagePreviews(
        optimizedFiles.map((file) => URL.createObjectURL(file)),
      );
    } catch (error) {
      console.error("Image optimization error:", error);
      alert("이미지 크기 조정 중 오류가 발생했습니다.");
      setImageFiles([]);
      setImagePreviews([]);
    }
  }

  function handleVideoChange(file: File | null) {
    setVideoFile(file);
    setVideoPreview(file ? URL.createObjectURL(file) : null);
  }

  async function uploadImages(userId: string) {
    if (imageFiles.length === 0) return [];

    const urls: string[] = [];

    for (const file of imageFiles) {
      const ext = file.name.split(".").pop() || "webp";
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
        category,
        location: location.trim() || null,
        phone: phone.trim() || null,
        website_url: websiteUrl.trim() || null,
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
      <div className="mx-auto w-full max-w-xl">
        <div className="relative mb-5 flex h-10 items-center border-b border-[#E8DED1] pb-3">
  {/* 왼쪽 */}
  <BackButton />

  {/* 가운데 */}
  <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-2xl font-black text-[#172033]">
    광고 등록
  </h1>

  {/* 오른쪽 */}
  <div className="ml-auto">
    <ProfileButton />
  </div>
</div>

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

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-2xl border bg-white p-3 text-sm font-bold"
          >
            <option value="business">🏢 비즈니스 홍보</option>
			<option value="job">💼 구인·구직</option>
			<option value="housing">🏠 부동산·렌트</option>
			<option value="auto">🚗 자동차</option>
	
			<option value="service">🛠 생활서비스</option>
            <option value="group">👥 모임 모집</option>
			
          </select>

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

          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="전화번호"
            className="w-full rounded-2xl border p-3 text-sm"
          />

          <input
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="링크 주소 (https://...)"
            type="url"
            inputMode="url"
            className="w-full rounded-2xl border p-3 text-sm"
          />

          <div>
            <p className="mb-2 text-sm font-black">이미지</p>

            <label className="flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-5 text-sm font-black text-gray-600">
              🖼 이미지 선택
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleImageChange(e.target.files)}
                className="hidden"
              />
            </label>

            {imageFiles.length > 0 && (
              <p className="mt-2 text-xs font-bold text-gray-500">
                {imageFiles.length}개 이미지 선택됨
              </p>
            )}

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

            <label className="flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-5 text-sm font-black text-gray-600">
              🎬 동영상 선택
              <input
                type="file"
                accept="video/*"
                onChange={(e) =>
                  handleVideoChange(e.target.files?.[0] || null)
                }
                className="hidden"
              />
            </label>

            {videoFile && (
              <p className="mt-2 truncate text-xs font-bold text-gray-500">
                {videoFile.name}
              </p>
            )}

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