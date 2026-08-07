"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";

type ImageType = "hero" | "slider" | "scroll" | "gallery";

type WebsiteImage = {
  id: number;
  business_id: number;
  image_type: ImageType;
  image_url: string;
  thumbnail_url?: string | null;
  storage_path?: string | null;
  title?: string | null;
  display_order: number;
  is_active: boolean;
};

const TABS: Array<{
  type: ImageType;
  label: string;
  icon: string;
  description: string;
  max: number;
}> = [
  { type: "hero", label: "HERO", icon: "🖼️", description: "메인 HERO/배경 이미지용", max: 10 },
  { type: "slider", label: "슬라이드", icon: "🎞️", description: "자동 이미지 슬라이드용", max: 10 },
  { type: "scroll", label: "흐르는 이미지", icon: "↔️", description: "옆으로 흐르는 이미지용", max: 10 },
  { type: "gallery", label: "갤러리", icon: "📸", description: "이미지 갤러리 전용", max: 12 },
];

async function readJson(response: Response) {
  const raw = await response.text();
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return { error: raw }; }
}

export default function WebsiteImageManagerPage() {
  const params = useParams<{ id: string }>();
  const businessId = String(params?.id || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeType, setActiveType] = useState<ImageType>("hero");
  const [images, setImages] = useState<WebsiteImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [draggingId, setDraggingId] = useState<number | null>(null);

  const activeTab = useMemo(
    () => TABS.find((tab) => tab.type === activeType) || TABS[0],
    [activeType],
  );

  const loadImages = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/owner/businesses/${encodeURIComponent(businessId)}/website-images?type=${activeType}`,
        { cache: "no-store", credentials: "include" },
      );
      const result = await readJson(response);
      if (!response.ok) throw new Error(result?.error || "이미지를 불러오지 못했습니다.");
      setImages(Array.isArray(result?.images) ? result.images : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "이미지를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [businessId, activeType]);

  useEffect(() => { void loadImages(); }, [loadImages]);

  async function uploadFiles(files: FileList | null) {
    const selected = Array.from(files || []);
    if (!selected.length) return;

    const available = Math.max(0, activeTab.max - images.length);
    if (available <= 0) {
      setMessage(`${activeTab.label} 이미지는 최대 ${activeTab.max}장입니다.`);
      return;
    }

    setUploading(true);
    setMessage("");

    try {
      const targets = selected.slice(0, available);
      for (const file of targets) {
        if (!file.type.startsWith("image/")) throw new Error("이미지 파일만 등록할 수 있습니다.");
        if (file.size > 10 * 1024 * 1024) throw new Error("이미지는 한 장당 10MB 이하여야 합니다.");

        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", activeType);

        const response = await fetch(
          `/api/owner/businesses/${encodeURIComponent(businessId)}/website-images`,
          { method: "POST", credentials: "include", body: formData },
        );
        const result = await readJson(response);
        if (!response.ok) throw new Error(result?.error || "이미지 등록에 실패했습니다.");
      }
      await loadImages();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "이미지 등록에 실패했습니다.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeImage(image: WebsiteImage) {
    if (!window.confirm("이 이미지를 삭제할까요?")) return;
    const response = await fetch(
      `/api/owner/businesses/${encodeURIComponent(businessId)}/website-images?id=${image.id}`,
      { method: "DELETE", credentials: "include" },
    );
    const result = await readJson(response);
    if (!response.ok) {
      setMessage(result?.error || "삭제하지 못했습니다.");
      return;
    }
    setImages((current) => current.filter((item) => item.id !== image.id));
  }

  async function saveOrder(next: WebsiteImage[]) {
    setImages(next);
    await fetch(
      `/api/owner/businesses/${encodeURIComponent(businessId)}/website-images`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reorder",
          type: activeType,
          ids: next.map((item) => item.id),
        }),
      },
    );
  }

  function moveImage(id: number, delta: -1 | 1) {
    const index = images.findIndex((item) => item.id === id);
    const nextIndex = index + delta;
    if (index < 0 || nextIndex < 0 || nextIndex >= images.length) return;
    const next = [...images];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    void saveOrder(next);
  }

  function dropOn(targetId: number) {
    if (draggingId == null || draggingId === targetId) return setDraggingId(null);
    const from = images.findIndex((item) => item.id === draggingId);
    const to = images.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setDraggingId(null);
    void saveOrder(next);
  }

  async function saveTitle(imageId: number, title: string) {
    await fetch(
      `/api/owner/businesses/${encodeURIComponent(businessId)}/website-images`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", id: imageId, title }),
      },
    );
  }

  return (
    <main className="min-h-screen bg-[#F7F3ED] px-4 py-7 sm:px-8 lg:px-14">
      <div className="mx-auto max-w-[1200px]">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href={`/owner/business/${businessId}/manage`} className="text-sm font-black text-[#B64032] no-underline">
              ← 사이트 관리
            </Link>
            <h1 className="mt-4 text-3xl font-black text-[#172033] sm:text-4xl">웹사이트 이미지 관리</h1>
            <p className="mt-2 text-sm font-semibold text-[#667085]">
              HERO, 슬라이드, 흐르는 이미지, 갤러리를 여기서 바로 등록합니다. 에디터에서는 자동으로 사용합니다.
            </p>
          </div>
          <Link href={`/admin/businesses/${businessId}/website`} className="inline-flex h-11 items-center justify-center rounded-xl bg-[#172033] px-5 text-sm font-black text-white no-underline">
            웹사이트 디자인 열기
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-2 rounded-2xl border border-[#E6D9C9] bg-white p-2 shadow-sm sm:grid-cols-4">
          {TABS.map((tab) => (
            <button key={tab.type} type="button" onClick={() => setActiveType(tab.type)}
              className={`rounded-xl px-3 py-3 text-left ${activeType === tab.type ? "bg-[#172033] text-white" : "bg-white text-[#172033] hover:bg-[#FFF8EE]"}`}>
              <span className="block text-xl">{tab.icon}</span>
              <span className="mt-1 block text-sm font-black">{tab.label}</span>
              <span className={`mt-1 block text-[10px] font-bold ${activeType === tab.type ? "text-white/70" : "text-[#667085]"}`}>{tab.description}</span>
            </button>
          ))}
        </div>

        <section className="mt-6 rounded-3xl border border-[#E6D9C9] bg-white p-6 shadow-sm">
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void uploadFiles(e.target.files)} />
          <button type="button" disabled={uploading || images.length >= activeTab.max} onClick={() => fileInputRef.current?.click()}
            className="flex min-h-[190px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#D9C7B5] bg-[#FFFCF8] px-5 text-center disabled:opacity-50">
            <span className="text-4xl">{activeTab.icon}</span>
            <span className="mt-3 text-lg font-black text-[#172033]">{activeTab.label} 이미지 등록</span>
            <span className="mt-2 text-xs font-semibold text-[#667085]">여러 장 동시 선택 가능 · 최대 {activeTab.max}장</span>
            <span className="mt-4 rounded-xl bg-[#B64032] px-5 py-3 text-sm font-black text-white">{uploading ? "등록 중..." : "+ 이미지 선택"}</span>
          </button>
          {message ? <div className="mt-4 rounded-xl bg-[#FFF3DF] px-4 py-3 text-sm font-bold text-[#8A3A2E]">{message}</div> : null}
        </section>

        <section className="mt-6 rounded-3xl border border-[#E6D9C9] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-[#172033]">{activeTab.icon} {activeTab.label} 이미지</h2>
              <p className="mt-1 text-sm font-bold text-[#667085]">총 {images.length}장 · 드래그 또는 ↑ ↓로 순서 변경</p>
            </div>
            <button type="button" onClick={() => void loadImages()} className="rounded-xl border border-[#D9C7B5] bg-white px-4 py-2 text-sm font-black">새로고침</button>
          </div>

          {loading ? (
            <div className="mt-5 flex min-h-[220px] items-center justify-center rounded-2xl bg-[#FFF8EE] text-sm font-black text-[#667085]">불러오는 중...</div>
          ) : images.length === 0 ? (
            <div className="mt-5 flex min-h-[220px] items-center justify-center rounded-2xl bg-[#FFF8EE] text-center">
              <div><div className="text-4xl">{activeTab.icon}</div><p className="mt-3 text-sm font-black">아직 {activeTab.label} 이미지가 없습니다.</p></div>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {images.map((image, index) => (
                <article key={image.id} draggable onDragStart={() => setDraggingId(image.id)} onDragEnd={() => setDraggingId(null)}
                  onDragOver={(e) => e.preventDefault()} onDrop={() => dropOn(image.id)}
                  className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${draggingId === image.id ? "border-blue-500 opacity-60" : "border-[#E6D9C9]"}`}>
                  <div className="relative aspect-[16/10] bg-gray-100">
                    <img src={image.thumbnail_url || image.image_url} alt={image.title || `${activeTab.label} ${index + 1}`} className="h-full w-full object-cover" />
                    <span className="absolute left-2 top-2 rounded-full bg-black/75 px-2.5 py-1 text-[10px] font-black text-white">{index + 1}</span>
                  </div>
                  <div className="p-3">
                    {activeType === "gallery" ? (
                      <input defaultValue={image.title || ""} onBlur={(e) => void saveTitle(image.id, e.target.value)} placeholder="이미지 제목 (선택)"
                        className="w-full rounded-xl border border-[#D9CFC2] px-3 py-2 text-sm font-bold outline-none" />
                    ) : null}
                    <div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2">
                      <button type="button" disabled={index === 0} onClick={() => moveImage(image.id, -1)} className="rounded-lg border px-3 py-2 text-xs font-black disabled:opacity-30">↑ 앞으로</button>
                      <button type="button" disabled={index === images.length - 1} onClick={() => moveImage(image.id, 1)} className="rounded-lg border px-3 py-2 text-xs font-black disabled:opacity-30">↓ 뒤로</button>
                      <button type="button" onClick={() => void removeImage(image)} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-black text-red-700">삭제</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}