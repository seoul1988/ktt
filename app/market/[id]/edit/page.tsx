"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabase";
import { useRouter, useParams } from "next/navigation";
import ProfileButton from "@/app/components/ProfileButton";
import BackButton from "@/app/components/BackButton";
import CommunityBottomNav from "@/app/components/CommunityBottomNav";

export default function EditMarketItemPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [loadedPrice, setLoadedPrice] = useState<number>(0);
  const [previousPrice, setPreviousPrice] = useState<number | null>(null);
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState("");
  
const [location, setLocation] = useState("");
const [phone, setPhone] = useState("");
const [email, setEmail] = useState("");
const [description, setDescription] = useState("");
  
  const [status, setStatus] = useState("available");

  const [images, setImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
  const [newVideoFile, setNewVideoFile] = useState<File | null>(null);
  const [newVideoPreview, setNewVideoPreview] = useState<string | null>(null);

  const MAX_IMAGES = 6;
  const MAX_IMAGE_SIZE = 1600;
  const IMAGE_QUALITY = 0.82;

  const THUMBNAIL_WIDTH = 480;
  const THUMBNAIL_HEIGHT = 360;
  const THUMBNAIL_QUALITY = 0.76;

  async function resizeImage(file: File): Promise<File> {
    if (!file.type.startsWith("image/")) {
      return file;
    }

    const objectUrl = URL.createObjectURL(file);

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();

        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("이미지를 불러올 수 없습니다."));
        img.src = objectUrl;
      });

      const originalWidth = image.naturalWidth;
      const originalHeight = image.naturalHeight;

      if (!originalWidth || !originalHeight) {
        return file;
      }

      const scale = Math.min(
        1,
        MAX_IMAGE_SIZE / Math.max(originalWidth, originalHeight),
      );

      const width = Math.max(1, Math.round(originalWidth * scale));
      const height = Math.max(1, Math.round(originalHeight * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");

      if (!context) {
        return file;
      }

      context.drawImage(image, 0, 0, width, height);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/webp", IMAGE_QUALITY);
      });

      if (!blob) {
        return file;
      }

      const originalBaseName =
        file.name.replace(/\.[^/.]+$/, "").trim() || "market-image";

      return new File([blob], `${originalBaseName}.webp`, {
        type: "image/webp",
        lastModified: Date.now(),
      });
    } catch (error) {
      console.warn("이미지 축소 실패, 원본으로 업로드합니다.", error);
      return file;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function createThumbnailBlobFromFile(
    file: File,
  ): Promise<Blob> {
    const objectUrl = URL.createObjectURL(file);

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();

        img.onload = () => resolve(img);
        img.onerror = () =>
          reject(new Error(`이미지를 불러올 수 없습니다: ${file.name}`));
        img.src = objectUrl;
      });

      return createThumbnailBlobFromImage(image);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function createThumbnailBlobFromUrl(
    imageUrl: string,
  ): Promise<Blob> {
    const response = await fetch(imageUrl, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(
        `대표 이미지를 불러오지 못했습니다. (${response.status})`,
      );
    }

    const imageBlob = await response.blob();
    const objectUrl = URL.createObjectURL(imageBlob);

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();

        img.onload = () => resolve(img);
        img.onerror = () =>
          reject(new Error("대표 이미지를 불러올 수 없습니다."));
        img.src = objectUrl;
      });

      return createThumbnailBlobFromImage(image);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function createThumbnailBlobFromImage(
    image: HTMLImageElement,
  ): Promise<Blob> {
    const sourceWidth = image.naturalWidth;
    const sourceHeight = image.naturalHeight;

    if (!sourceWidth || !sourceHeight) {
      throw new Error("대표 이미지 크기를 확인할 수 없습니다.");
    }

    const sourceRatio = sourceWidth / sourceHeight;
    const targetRatio = THUMBNAIL_WIDTH / THUMBNAIL_HEIGHT;

    let sourceX = 0;
    let sourceY = 0;
    let cropWidth = sourceWidth;
    let cropHeight = sourceHeight;

    if (sourceRatio > targetRatio) {
      cropWidth = sourceHeight * targetRatio;
      sourceX = (sourceWidth - cropWidth) / 2;
    } else {
      cropHeight = sourceWidth / targetRatio;
      sourceY = (sourceHeight - cropHeight) / 2;
    }

    const canvas = document.createElement("canvas");
    canvas.width = THUMBNAIL_WIDTH;
    canvas.height = THUMBNAIL_HEIGHT;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("썸네일 Canvas를 만들 수 없습니다.");
    }

    context.drawImage(
      image,
      sourceX,
      sourceY,
      cropWidth,
      cropHeight,
      0,
      0,
      THUMBNAIL_WIDTH,
      THUMBNAIL_HEIGHT,
    );

    const thumbnailBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        resolve,
        "image/webp",
        THUMBNAIL_QUALITY,
      );
    });

    if (!thumbnailBlob) {
      throw new Error("썸네일 생성에 실패했습니다.");
    }

    return thumbnailBlob;
  }

  async function uploadMarketThumbnail(
    marketItemId: string,
    source: File | string,
  ) {
    const thumbnailBlob =
      typeof source === "string"
        ? await createThumbnailBlobFromUrl(source)
        : await createThumbnailBlobFromFile(source);

    const filePath = `market-${marketItemId}/thumbnail.webp`;

    const { error: uploadError } = await supabase.storage
      .from("market-thumbnails")
      .upload(filePath, thumbnailBlob, {
        cacheControl: "31536000",
        contentType: "image/webp",
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from("market-thumbnails")
      .getPublicUrl(filePath);

    return `${data.publicUrl}?v=${Date.now()}`;
  }

  async function deleteMarketThumbnail(marketItemId: string) {
    const filePath = `market-${marketItemId}/thumbnail.webp`;

    const { error } = await supabase.storage
      .from("market-thumbnails")
      .remove([filePath]);

    if (error) {
      console.warn("기존 마켓 썸네일 삭제 실패:", error.message);
    }
  }

  function getStoragePathFromPublicUrl(url: string) {
    const marker = "/storage/v1/object/public/market/";
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

    const { error } = await supabase.storage.from("market").remove([path]);

    if (error) {
      alert("버킷 파일 삭제 실패: " + error.message);
      throw error;
    }
  }

  useEffect(() => {
    loadItem();
  }, []);

  async function loadItem() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("로그인이 필요합니다.");
      router.push("/login");
      return;
    }

    const { data, error } = await supabase
      .from("market_items")
      .select("*")
      .eq("id", id)
      .eq("seller_id", user.id)
      .maybeSingle();

    if (error || !data) {
      alert("상품을 찾을 수 없습니다.");
      router.push("/market/my");
      return;
    }

    setTitle(data.title || "");
    setPrice(String(data.price || ""));
    setLoadedPrice(Number(data.price || 0));
    setPreviousPrice(
      typeof data.previous_price === "number" ? data.previous_price : null,
    );
    setCategory(data.category || "");
    setCondition(data.condition || "");
  setLocation(data.location || "");
setPhone(data.phone || "");
setEmail(data.email || "");
setDescription(data.description || "");
	
	
    setImages(Array.isArray(data.images) ? data.images : []);
    setVideoUrl(data.video_url || null);
    setThumbnailUrl(data.thumbnail_url || null);
    setStatus(data.status || "available");
    setLoading(false);
  }

  function handleNewImageChange(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }

    const selectedImages = Array.from(files).filter((file) =>
      file.type.startsWith("image/"),
    );

    if (selectedImages.length === 0) {
      alert("이미지 파일만 선택할 수 있습니다.");
      return;
    }

    const currentTotal = images.length + newImageFiles.length;
    const remaining = MAX_IMAGES - currentTotal;

    if (remaining <= 0) {
      alert(`상품 사진은 최대 ${MAX_IMAGES}장까지 등록할 수 있습니다.`);
      return;
    }

    const filesToAdd = selectedImages.slice(0, remaining);
    const previewsToAdd = filesToAdd.map((file) =>
      URL.createObjectURL(file),
    );

    setNewImageFiles((prev) => [...prev, ...filesToAdd]);
    setNewImagePreviews((prev) => [...prev, ...previewsToAdd]);

    if (selectedImages.length > remaining) {
      alert(
        `상품 사진은 최대 ${MAX_IMAGES}장까지 가능합니다. 초과한 사진은 추가되지 않았습니다.`,
      );
    }
  }

  function removeNewImage(imageIndex: number) {
    if (saving) return;

    setNewImagePreviews((prev) => {
      const previewUrl = prev[imageIndex];

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }

      return prev.filter((_, index) => index !== imageIndex);
    });

    setNewImageFiles((prev) =>
      prev.filter((_, index) => index !== imageIndex),
    );
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
    if (newImageFiles.length === 0) return [];

    const urls: string[] = [];

    for (const originalFile of newImageFiles) {
      const resizedFile = await resizeImage(originalFile);
      const ext =
        resizedFile.type === "image/webp"
          ? "webp"
          : resizedFile.name.split(".").pop()?.toLowerCase() || "jpg";

      const path = `${userId}/images/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;

      const { error } = await supabase.storage
        .from("market")
        .upload(path, resizedFile, {
          contentType: resizedFile.type || undefined,
          cacheControl: "31536000",
          upsert: false,
        });

      if (error) throw error;

      const { data } = supabase.storage.from("market").getPublicUrl(path);
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
      .from("market")
      .upload(path, newVideoFile);

    if (error) throw error;

    const { data } = supabase.storage.from("market").getPublicUrl(path);
    return data.publicUrl;
  }

  async function updateItem() {
	  
	  if (!phone.trim() && !email.trim()) {
		  alert("전화번호 또는 이메일 중 하나는 입력해주세요.");
		  return;
		}
    if (!title.trim()) {
      alert("제목을 입력하세요.");
      return;
    }

    if (images.length + newImageFiles.length > MAX_IMAGES) {
      alert(`상품 사진은 최대 ${MAX_IMAGES}장까지 등록할 수 있습니다.`);
      return;
    }

    const nextPrice = Number(price || 0);

    if (Number.isNaN(nextPrice) || nextPrice < 0) {
      alert("가격을 올바르게 입력하세요.");
      return;
    }

    // 현재 저장된 가격보다 낮아졌을 때만 직전 가격을 보관합니다.
    // 예: 350 -> 300 이면 previous_price = 350
    const nextPreviousPrice =
      nextPrice < loadedPrice
        ? loadedPrice
        : previousPrice;

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

      let finalThumbnailUrl: string | null = thumbnailUrl;

      if (finalImages.length === 0) {
        await deleteMarketThumbnail(id);
        finalThumbnailUrl = null;
      } else {
        const firstExistingImageStillUsed =
          images.length > 0 &&
          finalImages[0] === images[0];

        const shouldRebuildThumbnail =
          !thumbnailUrl ||
          !firstExistingImageStillUsed;

        if (shouldRebuildThumbnail) {
          const firstImageSource =
            images.length > 0
              ? finalImages[0]
              : newImageFiles[0] || finalImages[0];

          finalThumbnailUrl = await uploadMarketThumbnail(
            id,
            firstImageSource,
          );
        }
      }

      const { error } = await supabase
        .from("market_items")
        .update({
          title: title.trim(),
          price: nextPrice,
          previous_price: nextPreviousPrice,
          category,
          condition,
          location: location.trim(),
          phone: phone.trim() || null,
          email: email.trim().toLowerCase() || null,
          description: description.trim() || null,
          images: finalImages,
          thumbnail_url: finalThumbnailUrl,
          video_url: finalVideoUrl,
          status,
        })
        .eq("id", id)
        .eq("seller_id", user.id);

      if (error) throw error;

      router.push("/market/my");
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
    <main className="min-h-screen bg-[#F8F3EC] p-4 pb-24">
      <div className="mx-auto w-full max-w-2xl">
        <div className="relative mb-5 flex h-10 items-center border-b border-[#E8DED1] pb-3">
          <BackButton />

          <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-xl font-black text-[#172033]">
            상품 수정
          </h1>

          <div className="ml-auto">
            <ProfileButton />
          </div>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow">

        <input
          className="mb-3 w-full rounded-xl border p-3"
          placeholder="상품 제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <input
          className="mb-3 w-full rounded-xl border p-3"
          placeholder="가격"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />

        <input
          className="mb-3 w-full rounded-xl border p-3"
          placeholder="카테고리"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />

        <input
          className="mb-3 w-full rounded-xl border p-3"
          placeholder="상태 예: 새상품, 중고"
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
        />

        <input
          className="mb-3 w-full rounded-xl border p-3"
          placeholder="지역"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />

        <input
          className="mb-3 w-full rounded-xl border p-3"
          placeholder="전화번호"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
<input
  className="mb-3 w-full rounded-xl border p-3"
  placeholder="이메일 주소"
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
/>
        <select
          className="mb-3 w-full rounded-xl border p-3"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="available">판매중</option>
          <option value="reserved">예약중</option>
          <option value="sold">판매완료</option>
          <option value="hidden">숨김</option>
        </select>

        <textarea
          className="mb-4 h-32 w-full rounded-xl border p-3"
          placeholder="상품 설명"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm font-black text-[#172033]">현재 이미지</p>

            <span className="text-xs font-bold text-gray-500">
              기존 {images.length}장
            </span>
          </div>

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
                    alt="상품 이미지"
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

        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between gap-3">
            <p className="text-sm font-black text-[#172033]">이미지 추가</p>

            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-black text-[#172033]">
              {images.length + newImageFiles.length}/{MAX_IMAGES}
            </span>
          </div>

          <p className="mb-2 text-xs font-semibold leading-5 text-gray-500">
            상품 사진은 최대 {MAX_IMAGES}장까지 등록할 수 있습니다.
            <br />
            새 이미지는 최대 1600px WebP로 자동 축소됩니다.
          </p>

          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-2xl border p-3 text-sm text-gray-500">
              {newImageFiles.length > 0
                ? `새 이미지 ${newImageFiles.length}개 선택됨`
                : "선택된 새 이미지 없음"}
            </div>

            <label
              className={`rounded-2xl px-4 py-3 text-sm font-black text-white ${
                images.length + newImageFiles.length >= MAX_IMAGES || saving
                  ? "cursor-not-allowed bg-gray-400"
                  : "cursor-pointer bg-[#172033]"
              }`}
            >
              첨부

              <input
                type="file"
                accept="image/*"
                multiple
                disabled={
                  images.length + newImageFiles.length >= MAX_IMAGES || saving
                }
                onChange={(e) => {
                  handleNewImageChange(e.target.files);
                  e.target.value = "";
                }}
                className="hidden"
              />
            </label>
          </div>

          {newImagePreviews.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {newImagePreviews.map((src, index) => (
                <div
                  key={`${src}-${index}`}
                  className="relative overflow-hidden rounded-xl border"
                >
                  <img
                    src={src}
                    alt={`새 상품 이미지 ${index + 1}`}
                    className="h-24 w-full object-cover"
                  />

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => removeNewImage(index)}
                    className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/75 text-sm font-black text-white disabled:opacity-50"
                    aria-label="새 이미지 삭제"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mb-4">
          <p className="mb-2 text-sm font-black text-[#172033]">현재 동영상</p>

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

        <div className="mb-4">
          <p className="mb-2 text-sm font-black text-[#172033]">
            동영상 새로 첨부
          </p>

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
          type="button"
          onClick={updateItem}
          disabled={saving}
          className="w-full rounded-full bg-[#172033] py-4 font-black text-white disabled:opacity-50"
        >
          {saving ? "저장 중..." : "수정 저장"}
        </button>
        </div>
      </div>

      <CommunityBottomNav activeNav="market" />
    </main>
  );
}