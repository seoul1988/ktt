"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import BusinessMediaViewer from "../../components/BusinessMediaViewer";
import ProfileButton from "../../components/ProfileButton";
import BottomNav from "../../components/BottomNav";

type GrandOpening = {
  id: string;
  title: string | null;
  business_name: string | null;
  description: string | null;
  address: string | null;
  location: string | null;
  phone: string | null;
  phone_number?: string | null;
  contact_phone?: string | null;
  images: string[] | null;
  video_url: string | null;
  link_url: string | null;
};

function getStoragePath(url: string) {
  const marker = "/storage/v1/object/public/grand-openings/";
  const index = url.indexOf(marker);

  if (index === -1) return null;

  return decodeURIComponent(url.slice(index + marker.length).split("?")[0]);
}

export default function GrandOpeningDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id);

  const [item, setItem] = useState<GrandOpening | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    loadItem();
  }, [id]);

  async function loadItem() {
    setLoading(true);
    setShowVideo(false);

    const { data, error } = await supabase
      .from("grand_openings")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      window.location.href = "/";
      return;
    }

    setItem(data);
    setLoading(false);
  }

  async function handleDelete() {
    if (deleting) return;

    const ok = confirm("정말 삭제하시겠습니까?");
    if (!ok) return;

    setDeleting(true);

    try {
      const { data } = await supabase
        .from("grand_openings")
        .select("images, video_url")
        .eq("id", id)
        .single();

      const paths: string[] = [];

      if (Array.isArray(data?.images)) {
        data.images.forEach((url: string) => {
          const path = getStoragePath(url);
          if (path) paths.push(path);
        });
      }

      if (data?.video_url) {
        const path = getStoragePath(data.video_url);
        if (path) paths.push(path);
      }

      if (paths.length > 0) {
        await supabase.storage.from("grand-openings").remove(paths);
      }

      const { error } = await supabase
        .from("grand_openings")
        .delete()
        .eq("id", id);

      if (error) throw error;

      window.location.href = "/";
    } catch (err: any) {
      console.error("DELETE ERROR:", err);
      alert(err?.message || "삭제 실패");
      setDeleting(false);
    }
  }

  if (loading || !item) {
    return (
      <main className="min-h-screen bg-[#F8F3EC] px-5 py-8 text-[#172033]">
        <p className="font-bold">Loading...</p>
        <BottomNav activeNav="map" />
      </main>
    );
  }

  const images = Array.isArray(item.images)
    ? item.images.filter(Boolean)
    : [];

  const hasVideo = Boolean(item.video_url);
  const videos =
    showVideo && item.video_url ? [item.video_url] : [];

  const title = item.title || item.business_name || "Grand Opening";
  const mapQuery = item.address || item.location || title;
  const phone =
    item.phone || item.phone_number || item.contact_phone || "";

  return (
    <main className="min-h-screen bg-[#F8F3EC] pb-28 text-[#172033]">
      <div className="mx-auto max-w-xl">
        <header className="sticky top-0 z-50 bg-[#F8F3EC]/95 shadow-sm backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-3 px-4">
            <Link
              href="/grand-openings"
              className="shrink-0 text-sm font-extrabold text-[#172033]"
            >
              ← Back
            </Link>

            <h1 className="min-w-0 flex-1 truncate text-center text-lg font-extrabold">
              GRAND OPENING
            </h1>

            <div className="flex h-10 w-10 shrink-0 items-center justify-center">
              <ProfileButton />
            </div>
          </div>
        </header>

        <BusinessMediaViewer
          images={images}
          videos={videos}
          name={title}
        />

        {hasVideo && (
          <div className="px-5 pt-3">
            <button
              type="button"
              onClick={() => setShowVideo((current) => !current)}
              className="w-full rounded-2xl bg-[#172033] px-4 py-3 text-sm font-black text-white"
            >
              {showVideo ? "🖼 이미지 보기" : "▶ 동영상 보기"}
            </button>

            {!showVideo && (
              <p className="mt-2 text-center text-xs font-bold text-gray-500">
                동영상은 버튼을 누를 때만 불러옵니다.
              </p>
            )}
          </div>
        )}

        <section className="px-5 pb-32 pt-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-black leading-tight">{title}</h2>

              {item.business_name && (
                <p className="mt-2 text-base font-bold text-[#8A5A20]">
                  {item.business_name}
                </p>
              )}
            </div>

            <div className="flex shrink-0 gap-2 pt-1">
              <Link
                href={`/grand-openings/${id}/edit`}
                className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-700"
              >
                수정
              </Link>

              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 disabled:opacity-50"
              >
                {deleting ? "삭제중" : "삭제"}
              </button>
            </div>
          </div>

          {item.description && (
            <>
              <hr className="my-5 border-gray-200" />

              <p className="whitespace-pre-line text-[15px] leading-7 text-gray-700">
                {item.description}
              </p>
            </>
          )}

          <hr className="my-5 border-gray-200" />

          {item.link_url && (
            <div className="space-y-3 text-[15px] leading-6">
              <p>
                <span className="font-semibold">Website: </span>
                <a
                  href={item.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-words text-[#2453A6] underline"
                >
                  {item.link_url}
                </a>
              </p>
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-3">
            <a
              href={phone ? `tel:${phone}` : "#"}
              onClick={(e) => {
                if (!phone) {
                  e.preventDefault();
                  alert("전화번호가 등록되어 있지 않습니다.");
                }
              }}
              className="rounded-2xl bg-black px-4 py-3 text-center text-sm font-extrabold text-white"
            >
              ☎ Call
            </a>

            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                mapQuery,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl bg-[#8A5A20] px-4 py-3 text-center text-sm font-extrabold text-white"
            >
              ↱ Directions
            </a>
          </div>
        </section>
      </div>

      <BottomNav activeNav="map" />
    </main>
  );
}