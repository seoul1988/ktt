"use client";

import Link from "next/link";
import {
  ChangeEvent,
  DragEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type GalleryImage = {
  id: number;
  image_url: string;
  thumbnail_url: string;
  storage_path: string;
  thumbnail_storage_path: string;
  file_name: string | null;
  alt_text: string | null;
  display_order: number;
  is_visible: boolean;
  created_at: string;
};


const DETAIL_MAX_SIZE = 1600;
const THUMBNAIL_MAX_SIZE = 420;
const WEBP_QUALITY = 0.84;

async function resizeImageFile(
  file: File,
  maxSize: number,
  suffix: "detail" | "thumb",
): Promise<File> {
  const bitmap = await createImageBitmap(file);

  try {
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("이미지를 축소할 수 없습니다.");

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => value ? resolve(value) : reject(new Error("이미지 변환에 실패했습니다.")),
        "image/webp",
        WEBP_QUALITY,
      );
    });

    const baseName = file.name.replace(/\.[^.]+$/, "") || "gallery-image";
    return new File([blob], `${baseName}-${suffix}.webp`, { type: "image/webp" });
  } finally {
    bitmap.close();
  }
}

type ApiResult = {
  images?: GalleryImage[];
  image?: GalleryImage;
  error?: string;
  message?: string;
};

async function readApiResponse(response: Response): Promise<ApiResult> {
  const text = await response.text();
  if (!text.trim()) return {};

  try {
    return JSON.parse(text) as ApiResult;
  } catch {
    throw new Error(`서버 응답이 JSON 형식이 아닙니다. HTTP ${response.status}`);
  }
}

export default function GalleryManager({ businessId }: { businessId: number }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const endpoint = `/api/owner/businesses/${businessId}/gallery`;

  const loadImages = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(endpoint, {
        credentials: "include",
        cache: "no-store",
      });
      const result = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(
          result.error || result.message || `갤러리를 불러오지 못했습니다. HTTP ${response.status}`,
        );
      }

      setImages(Array.isArray(result.images) ? result.images : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "갤러리를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    void loadImages();
  }, [loadImages]);

  async function uploadFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((file) => file.type.startsWith("image/"));

    if (!files.length) {
      setError("이미지 파일을 선택해주세요.");
      return;
    }

    const oversized = files.find((file) => file.size > 8 * 1024 * 1024);
    if (oversized) {
      setError(`${oversized.name}: 이미지 크기는 8MB 이하여야 합니다.`);
      return;
    }

    setUploading(true);
    setError("");
    setMessage("");

    let completed = 0;

    try {
      for (const file of files) {
        const [detailFile, thumbnailFile] = await Promise.all([
          resizeImageFile(file, DETAIL_MAX_SIZE, "detail"),
          resizeImageFile(file, THUMBNAIL_MAX_SIZE, "thumb"),
        ]);

        const formData = new FormData();
        formData.append("image", detailFile);
        formData.append("thumbnail", thumbnailFile);
        formData.append("originalName", file.name);

        const response = await fetch(endpoint, {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        const result = await readApiResponse(response);

        if (!response.ok) {
          throw new Error(
            result.error || result.message || `${file.name} 업로드에 실패했습니다.`,
          );
        }

        completed += 1;
      }

      setMessage(`${completed}장의 갤러리 전용 이미지가 등록되었습니다.`);
      await loadImages();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "이미지 업로드에 실패했습니다.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function deleteImage(image: GalleryImage) {
    if (!window.confirm("이 갤러리 이미지를 삭제할까요?")) return;

    setError("");
    setMessage("");

    try {
      const response = await fetch(`${endpoint}?imageId=${image.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const result = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(result.error || result.message || "이미지를 삭제하지 못했습니다.");
      }

      setImages((current) => current.filter((item) => item.id !== image.id));
      setMessage("갤러리 이미지가 삭제되었습니다.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "이미지를 삭제하지 못했습니다.");
    }
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) void uploadFiles(event.target.files);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length) void uploadFiles(event.dataTransfer.files);
  }

  return (
    <main className="min-h-screen bg-[#F8F5F0] px-4 pb-24 pt-6 sm:px-6 sm:pt-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href={`/owner/business/${businessId}/manage`}
              className="text-sm font-black text-[#B64032]"
            >
              ← 사이트 관리
            </Link>
            <h1 className="mt-3 text-3xl font-black text-[#172033]">
              이미지 갤러리 관리
            </h1>
            <p className="mt-2 text-sm font-medium leading-6 text-[#667085]">
              이곳은 갤러리 전용입니다. 대표이미지와 자동 슬라이드 이미지는 가져오지 않습니다.
            </p>
          </div>

          <Link
            href={`/admin/businesses/${businessId}/website`}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-[#172033] px-5 text-sm font-black text-white"
          >
            웹사이트 디자인 열기
          </Link>
        </div>

        <section className="mt-7 rounded-3xl border border-[#E9DED0] bg-white p-5 shadow-sm sm:p-7">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleInput}
            className="hidden"
          />

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`flex min-h-[210px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 text-center transition ${
              dragging
                ? "border-[#B64032] bg-[#FFF4E5]"
                : "border-[#D9CFC2] bg-[#FFFDF9]"
            }`}
          >
            <div className="text-5xl">🖼️</div>
            <p className="mt-4 text-lg font-black text-[#172033]">
              {uploading ? "갤러리 이미지를 등록하는 중입니다..." : "갤러리용 이미지를 선택하세요"}
            </p>
            <p className="mt-2 text-sm font-medium text-[#667085]">
              원본은 저장하지 않습니다. 상세 이미지는 최대 1600px, 썸네일은 최대 420px WebP로 축소해 등록합니다.
            </p>
            <button
              type="button"
              disabled={uploading}
              className="mt-5 rounded-xl bg-[#B64032] px-5 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              {uploading ? "등록 중..." : "갤러리 이미지 등록"}
            </button>
          </div>

          {message ? (
            <p className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-bold text-green-700">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </p>
          ) : null}
        </section>

        <section className="mt-6 rounded-3xl border border-[#E9DED0] bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-[#172033]">갤러리 전용 이미지</h2>
              <p className="mt-1 text-sm font-medium text-[#667085]">총 {images.length}장</p>
            </div>
            <button
              type="button"
              onClick={() => void loadImages()}
              disabled={loading}
              className="rounded-xl border border-[#D9CFC2] bg-white px-4 py-2 text-sm font-black text-[#172033] disabled:opacity-50"
            >
              새로고침
            </button>
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm font-bold text-[#667085]">
              이미지를 불러오는 중입니다...
            </div>
          ) : images.length ? (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {images.map((image, index) => (
                <article
                  key={`${image.id}-${image.thumbnail_storage_path || image.storage_path}`}
                  className="overflow-hidden rounded-2xl border border-[#E9DED0] bg-[#FFFDF9]"
                >
                  <a
                    href={image.image_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block aspect-square bg-gray-100"
                  >
                    <img
                      src={image.thumbnail_url || image.image_url}
                      alt={image.alt_text || image.file_name || `갤러리 이미지 ${index + 1}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </a>
                  <div className="flex items-center justify-between gap-2 px-3 py-3">
                    <p className="min-w-0 truncate text-xs font-black text-[#172033]">
                      {image.file_name || `이미지 ${index + 1}`}
                    </p>
                    <button
                      type="button"
                      onClick={() => void deleteImage(image)}
                      className="shrink-0 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-black text-red-700"
                    >
                      삭제
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl bg-[#FFF9F1] px-5 py-14 text-center">
              <div className="text-4xl">📷</div>
              <p className="mt-3 text-sm font-black text-[#172033]">
                아직 갤러리 전용 이미지가 없습니다.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
