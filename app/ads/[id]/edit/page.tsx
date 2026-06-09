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

  const [images, setImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const [newImageFiles, setNewImageFiles] = useState<FileList | null>(null);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
  const [newVideoFile, setNewVideoFile] = useState<File | null>(null);
  const [newVideoPreview, setNewVideoPreview] = useState<string | null>(null);

  function getStoragePathFromPublicUrl(url: string) {
    const marker = "/storage/v1/object/public/ads/";
    const index = url.indexOf(marker);

    if (index === -1) return null;

    return decodeURIComponent(url.substring(index + marker.length));
  }

  async function deleteFileFromBucket(url: string) {
    const path = getStoragePathFromPublicUrl(url);

    if (!path) {
      console.warn("Storage path를 찾을 수 없음:", url);
      return;
    }

    const { error } = await supabase.storage.from("ads").remove([path]);

    if (error) {
      console.error("Storage 삭제 실패:", error.message);
      alert("버킷 파일 삭제 실패: " + error.message);
      throw error;
    }
  }

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
      setImages(Array.isArray(data.images) ? data.images : []);
      setVideoUrl(data.video_url || null);
      setLoading(false);
    }

    loadAd();
  }, [id, router]);

  function handleNewImageChange(files: FileList | null) {
    setNewImageFiles(files);

    if (!files || files.length === 0) {
      setNewImagePreviews([]);
      return;
    }

    const previews = Array.from(files).map((file) =>
      URL.createObjectURL(file)
    );

    setNewImagePreviews(previews);
  }

  function handleNewVideoChange(file: File | null) {
    setNewVideoFile(file);

    if (!file) {
      setNewVideoPreview(null);
      return;
    }

    setNewVideoPreview(URL.createObjectURL(file));
  }

  async function removeExistingImage(url: string) {
    if (!confirm("이 이미지를 삭제하시겠습니까?")) return;

    try {
      await deleteFileFromBucket(url);
      setImages((prev) => prev.filter((img) => img !== url));
    } catch {
      return;
    }
  }

  async function removeExistingVideo() {
    if (!confirm("동영상을 삭제하시겠습니까?")) return;

    try {
      if (videoUrl) {
        await deleteFileFromBucket(videoUrl);
      }

      setVideoUrl(null);
    } catch {
      return;
    }
  }

  async function uploadImages(userId: string) {
    if (!newImageFiles || newImageFiles.length === 0) return [];

    const urls: string[] = [];

    for (const file of Array.from(newImageFiles)) {
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
    if (!newVideoFile) return null;

    const ext = newVideoFile.name.split(".").pop();
    const path = `${userId}/videos/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;

    const { error } = await supabase.storage
      .from("ads")
      .upload(path, newVideoFile);

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

      if (newVideoFile && videoUrl) {
        await deleteFileFromBucket(videoUrl);
      }

      const addedImages = await uploadImages(user.id);
      const uploadedVideoUrl = await uploadVideo(user.id);

      const finalImages = [...images, ...addedImages];
      const finalVideoUrl = uploadedVideoUrl || videoUrl;

      const { error } = await supabase
        .from("ads")
        .update({
          title,
          description,
          category,
          location,
          phone,
          status,
          images: finalImages,
          video_url: finalVideoUrl,
        })
        .eq("id", id)
        .eq("owner_id", user.id);

      if (error) throw error;

      router.push("/ads/my");
      router.refresh();
    } catch (err: any) {
      alert(err.message || "수정 실패");
    } finally {
      setSaving(false);
    }
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

          <div>
            <p className="mb-2 text-sm font-black">현재 이미지</p>

            {images.length === 0 ? (
              <p className="rounded-2xl border p-3 text-sm text-gray-500">
                등록된 이미지 없음
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {images.map((img) => (
                  <div key={img} className="relative">
                    <img
                      src={img}
                      alt="광고 이미지"
                      className="h-24 w-full rounded-xl border object-cover"
                    />

                    <button
                      type="button"
                      onClick={() => removeExistingImage(img)}
                      className="absolute right-1 top-1 rounded-full bg-red-600 px-2 py-1 text-[10px] font-black text-white"
                    >
                      X
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-black">이미지 추가</p>

            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-2xl border p-3 text-sm text-gray-500">
                {newImageFiles && newImageFiles.length > 0
                  ? `${newImageFiles.length}개 선택됨`
                  : "선택된 이미지 없음"}
              </div>

              <label className="cursor-pointer rounded-2xl bg-[#172033] px-4 py-3 text-sm font-black text-white">
                첨부
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleNewImageChange(e.target.files)}
                  className="hidden"
                />
              </label>
            </div>

            {newImagePreviews.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {newImagePreviews.map((src, index) => (
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
            <p className="mb-2 text-sm font-black">현재 동영상</p>

            {videoUrl ? (
              <div className="space-y-2">
                <video src={videoUrl} controls className="w-full rounded-2xl" />

                <button
                  type="button"
                  onClick={removeExistingVideo}
                  className="w-full rounded-2xl bg-red-600 py-2 text-xs font-black text-white"
                >
                  동영상 삭제
                </button>
              </div>
            ) : (
              <p className="rounded-2xl border p-3 text-sm text-gray-500">
                등록된 동영상 없음
              </p>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-black">동영상 새로 첨부</p>

            <div className="flex items-center gap-2">
              <div className="flex-1 truncate rounded-2xl border p-3 text-sm text-gray-500">
                {newVideoFile ? newVideoFile.name : "선택된 동영상 없음"}
              </div>

              <label className="cursor-pointer rounded-2xl bg-[#172033] px-4 py-3 text-sm font-black text-white">
                첨부
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) =>
                    handleNewVideoChange(e.target.files?.[0] || null)
                  }
                  className="hidden"
                />
              </label>
            </div>

            {newVideoPreview && (
              <div className="mt-3 overflow-hidden rounded-2xl border">
                <video src={newVideoPreview} controls className="w-full" />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-2xl bg-[#172033] py-3 text-sm font-black text-white disabled:opacity-50"
          >
            {saving ? "저장 중..." : "수정 저장"}
          </button>
        </form>
      </div>

      <CommunityBottomNav />
    </main>
  );
}