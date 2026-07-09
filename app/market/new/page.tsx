"use client";

import { useState } from "react";
import { supabase } from "../../../lib/supabase";
import CommunityBottomNav from "../../components/CommunityBottomNav";
import { useRouter } from "next/navigation";

const MARKET_CATEGORIES = [
  "가구",
  "전자제품",
  "골프용품",
  "자동차",
  "아기용품",
  "의류",
  "생활용품",
  "식품",
  "무료나눔",
  "구인구직",
  "기타",
];

const CONDITIONS = ["새것", "거의 새것", "중고", "고장/수리필요"];

export default function NewMarketItemPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState(MARKET_CATEGORIES[0]);
  const [condition, setCondition] = useState(CONDITIONS[2]);
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function uploadMarketFile(
    userId: string,
    file: File,
    folder: "images" | "videos"
  ) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${userId}/${folder}/${Date.now()}-${safeName}`;

    const { error } = await supabase.storage
      .from("market")
      .upload(filePath, file);

    if (error) {
      throw error;
    }

    const { data } = supabase.storage.from("market").getPublicUrl(filePath);
    return data.publicUrl;
  }

  function addImageFiles(files: File[]) {
    const onlyImages = files.filter((file) => file.type.startsWith("image/"));

    setImageFiles((prev) => {
      const merged = [...prev, ...onlyImages];
      return merged.slice(0, 5);
    });
  }

  function removeImage(index: number) {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function submitItem() {
    if (uploading) return;

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      alert("로그인이 필요합니다.");
      return;
    }

    if (!title.trim()) {
      alert("제목을 입력하세요.");
      return;
    }

    if (imageFiles.length > 5) {
      alert("이미지는 최대 5장까지 가능합니다.");
      return;
    }

    setUploading(true);

    try {
      const uploadedImageUrls: string[] = [];

      for (const file of imageFiles.slice(0, 5)) {
        const url = await uploadMarketFile(userData.user.id, file, "images");
        uploadedImageUrls.push(url);
      }

      let uploadedVideoUrl: string | null = null;

      if (videoFile) {
        uploadedVideoUrl = await uploadMarketFile(
          userData.user.id,
          videoFile,
          "videos"
        );
      }

      const { error } = await supabase.from("market_items").insert({
        seller_id: userData.user.id,
        title: title.trim(),
        price: Number(price || 0),
        category,
        condition,
        location: location.trim(),
        phone: phone.trim(),
        description: description.trim(),
        images: uploadedImageUrls,
        video_url: uploadedVideoUrl,
        status: "available",
      });

      if (error) {
        alert("등록 실패: " + error.message);
        setUploading(false);
        return;
      }

      router.push("/market");
    } catch (error: any) {
      alert("업로드 실패: " + error.message);
      setUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-4 pb-24">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-5 shadow">
       
<div className="relative mb-5 flex items-center justify-center">
  <button
    type="button"
    onClick={() => router.back()}
    className="absolute left-0 text-sm font-bold text-[#172033]"
  >
    ← BACK
  </button>

  <h1 className="text-2xl font-black text-[#172033]">
    상품 등록
  </h1>
</div>

        <input
          className="mb-3 w-full rounded-xl border p-3"
          placeholder="제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <input
          className="mb-3 w-full rounded-xl border p-3"
          placeholder="가격"
          inputMode="numeric"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />

        <select
          className="mb-3 w-full rounded-xl border p-3"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {MARKET_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <select
          className="mb-3 w-full rounded-xl border p-3"
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
        >
          {CONDITIONS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <input
          className="mb-3 w-full rounded-xl border p-3"
          placeholder="지역 예: Raleigh, Cary"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />

        <input
          className="mb-3 w-full rounded-xl border p-3"
          placeholder="연락처"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        <div className="mb-3 rounded-2xl bg-gray-50 p-3">
          <p className="mb-2 text-sm font-black text-[#172033]">
            이미지 첨부 최대 5장
          </p>

          <div className="flex items-center gap-2">
            <label
              htmlFor="market-images"
              className="cursor-pointer rounded-xl bg-[#172033] px-4 py-3 text-sm font-black text-white"
            >
              이미지 선택
            </label>

            <span className="text-sm text-gray-500">
              {imageFiles.length > 0
                ? `${imageFiles.length}장 선택됨`
                : "최대 5장"}
            </span>

            <input
              id="market-images"
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                addImageFiles(Array.from(e.target.files || []));
                e.target.value = "";
              }}
            />
          </div>

          {imageFiles.length > 0 && (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {imageFiles.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="relative h-16 overflow-hidden rounded-xl border bg-white"
                >
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`preview-${index + 1}`}
                    className="h-full w-full object-cover"
                  />

                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-xs font-black text-white"
                  >
                    ×
                  </button>

                  <div className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {index + 1}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mb-3 rounded-2xl bg-gray-50 p-3">
          <p className="mb-2 text-sm font-black text-[#172033]">
            동영상 첨부 1개
          </p>

          <div className="flex items-center gap-2">
            <label
              htmlFor="market-video"
              className="cursor-pointer rounded-xl bg-[#C2410C] px-4 py-3 text-sm font-black text-white"
            >
              동영상 선택
            </label>

            <span className="line-clamp-1 text-sm text-gray-500">
              {videoFile ? videoFile.name : "1개 첨부"}
            </span>

            <input
              id="market-video"
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                setVideoFile(e.target.files?.[0] || null);
                e.target.value = "";
              }}
            />
          </div>

          {videoFile && (
            <div className="mt-3 flex items-center justify-between rounded-xl border bg-white p-3">
              <div className="min-w-0">
                <p className="line-clamp-1 text-sm font-bold text-[#172033]">
                  {videoFile.name}
                </p>
                <p className="text-xs text-gray-500">동영상 1개 선택됨</p>
              </div>

              <button
                type="button"
                onClick={() => setVideoFile(null)}
                className="ml-2 rounded-full bg-red-100 px-3 py-2 text-xs font-black text-red-600"
              >
                삭제
              </button>
            </div>
          )}
        </div>

        <textarea
          className="mb-4 h-32 w-full rounded-xl border p-3"
          placeholder="설명"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <button
          disabled={uploading}
          onClick={submitItem}
          className="w-full rounded-full bg-[#172033] py-4 font-black text-white disabled:opacity-50"
        >
          {uploading ? "업로드 중..." : "등록하기"}
        </button>
      </div>
	        <CommunityBottomNav activeNav="market" />
    </main>
  );
}