"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import CommunityBottomNav from "../../components/CommunityBottomNav";
import ProfileButton from "@/app/components/ProfileButton";
import { supabase } from "../../../lib/supabase";

type ManualVideo = {
  id: number;
  title: string;
  subtitle: string | null;
  description: string | null;
  youtube_url: string;
  display_order: number;
  active: boolean;
};

function getYoutubeEmbedUrl(url: string) {
  const value = String(url || "").trim();
  if (!value) return "";

  try {
    const parsed = new URL(value);

    if (parsed.hostname === "youtu.be" || parsed.hostname.endsWith(".youtu.be")) {
      const id = parsed.pathname.replace(/^\/+/, "").split("/")[0];
      return id ? `https://www.youtube.com/embed/${id}` : "";
    }

    if (
      parsed.hostname.includes("youtube.com") ||
      parsed.hostname.includes("youtube-nocookie.com")
    ) {
      if (parsed.pathname.startsWith("/shorts/")) {
        const id = parsed.pathname.split("/shorts/")[1]?.split("/")[0];
        return id ? `https://www.youtube.com/embed/${id}` : "";
      }

      if (parsed.pathname.startsWith("/embed/")) {
        const id = parsed.pathname.split("/embed/")[1]?.split("/")[0];
        return id ? `https://www.youtube.com/embed/${id}` : "";
      }

      const id = parsed.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : "";
    }
  } catch {
    return "";
  }

  return "";
}

export default function CommunityManualPage() {
  const router = useRouter();
  const [videos, setVideos] = useState<ManualVideo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadVideos() {
      setLoading(true);

      const { data, error } = await supabase
        .from("manual_videos")
        .select(
          "id, title, subtitle, description, youtube_url, display_order, active"
        )
        .eq("active", true)
        .order("display_order", { ascending: true })
        .order("id", { ascending: true });

      if (cancelled) return;

      if (error) {
        console.error("Manual videos load error:", error.message);
        setVideos([]);
      } else {
        setVideos((data || []) as ManualVideo[]);
      }

      setLoading(false);
    }

    loadVideos();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-[100dvh] bg-[#F7F7F7] pb-24 text-[#172033]">
      <section className="mx-auto w-full max-w-xl px-4 pt-4">
        <header className="border-b border-gray-200 bg-white/95 backdrop-blur">
          <div className="flex h-14 w-full items-center justify-between px-1">
            <button
              type="button"
              onClick={() => router.push("/community/hub")}
              aria-label="Go back"
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#172033] transition active:scale-90 active:bg-gray-100"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-5 w-5"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>

            <div className="text-center">
              <h1 className="text-[15px] font-extrabold leading-none">
                이용 매뉴얼
              </h1>
              <p className="mt-1 text-[9px] font-medium text-gray-500">
                KTown Triangle 사용 방법
              </p>
            </div>

            <div className="flex h-9 w-9 items-center justify-center">
              <ProfileButton />
            </div>
          </div>
        </header>

        <section className="mt-4 overflow-hidden rounded-3xl bg-[#172033] px-5 py-5 text-white shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">
            Video Guide
          </p>
          <h2 className="mt-1 text-[22px] font-black leading-tight">
            동영상 이용 안내
          </h2>
          <p className="mt-2 text-[12px] font-medium leading-relaxed text-slate-300">
            회원가입, 비즈니스 오너 신청, 사이트 관리 방법을 영상으로 확인하세요.
          </p>
        </section>

        <div className="mt-4 space-y-4">
          {loading && (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm font-bold text-gray-400">
              불러오는 중...
            </div>
          )}

          {!loading && videos.length === 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
              <p className="text-sm font-extrabold text-gray-500">
                등록된 매뉴얼 영상이 없습니다.
              </p>
            </div>
          )}

          {videos.map((video, index) => {
            const embedUrl = getYoutubeEmbedUrl(video.youtube_url);

            return (
              <article
                key={video.id}
                className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-[0_2px_10px_rgba(23,32,51,0.06)]"
              >
                <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#172033] text-[13px] font-black text-white">
                    {index + 1}
                  </div>

                  <div className="min-w-0">
                    <h3 className="text-[14px] font-extrabold leading-tight text-[#172033]">
                      {video.title}
                    </h3>
                    {video.subtitle && (
                      <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-gray-400">
                        {video.subtitle}
                      </p>
                    )}
                  </div>
                </div>

                {embedUrl ? (
                  <div className="aspect-video w-full overflow-hidden bg-black">
                    <iframe
                      src={embedUrl}
                      title={video.title}
                      className="h-full w-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <div className="flex aspect-video items-center justify-center bg-gray-100 text-sm font-bold text-gray-400">
                    올바른 YouTube 링크가 아닙니다.
                  </div>
                )}

                <div className="p-4">
                  {video.description && (
                    <p className="text-[12px] font-medium leading-relaxed text-gray-600">
                      {video.description}
                    </p>
                  )}

                  <a
                    href={video.youtube_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-[12px] font-black text-white transition hover:bg-red-700 active:scale-[0.98]"
                  >
                    ▶ YouTube에서 보기
                  </a>
                </div>
              </article>
            );
          })}
        </div>

        <section className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <h3 className="text-[13px] font-extrabold text-[#172033]">
            도움이 더 필요하신가요?
          </h3>
          <Link
            href="/community/inquiries"
            className="mt-3 inline-flex items-center text-[11px] font-extrabold text-blue-700"
          >
            문의하기 →
          </Link>
        </section>
      </section>

      <CommunityBottomNav activeNav="hub" />
    </main>
  );
}