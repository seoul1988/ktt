"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import BottomNav from "../components/BottomNav";
import PdfFirstPagePreview from "../components/PdfFirstPagePreview";

type EventItem = {
  id: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  event_date: string | null;
  category: string | null;
  address: string | null;
  pdf_url: string | null;
  pdf_name: string | null;
};

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);

  useEffect(() => {
    void loadPage();
  }, []);

  async function loadPage() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role,is_admin")
        .eq("id", user.id)
        .maybeSingle();

      setIsAdmin(profile?.role === "admin" || profile?.is_admin === true);
    }

    const { data, error } = await supabase
      .from("community_events")
      .select(
        "id,title,description,image_url,event_date,category,address,pdf_url,pdf_name",
      )
      .order("event_date", { ascending: true });

    if (error) {
      console.error("community events load error:", error);
    } else {
      setEvents((data || []) as EventItem[]);
    }

    setLoading(false);
  }

  async function deleteEvent(id: string) {
    if (!confirm("이 이벤트를 삭제할까요?")) return;

    const { error } = await supabase
      .from("community_events")
      .delete()
      .eq("id", id);

    if (error) {
      alert("삭제 실패: " + error.message);
      return;
    }

    void loadPage();
  }

  async function downloadPdf(event: EventItem) {
    if (!event.pdf_url) return;

    setDownloadingPdfId(event.id);

    try {
      const response = await fetch(event.pdf_url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = objectUrl;
      anchor.download = event.pdf_name || `${event.title || "event"}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 1000);
    } catch (error) {
      console.error("PDF download error:", error);
      alert("PDF 다운로드에 실패했습니다. 원본 보기로 열어주세요.");
    } finally {
      setDownloadingPdfId(null);
    }
  }

  if (loading) {
    return <div className="p-6">불러오는 중...</div>;
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-4 pb-28 text-[#172033]">
      <div className="mx-auto max-w-md">
        <div className="relative mb-4 flex items-center justify-center">
          <Link
            href="/"
            className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl font-black shadow"
          >
            ←
          </Link>

          <h1 className="text-2xl font-black">Events</h1>

          {isAdmin && (
            <Link
              href="/admin/community/events"
              className="absolute right-0 rounded-full bg-[#172033] px-4 py-2 text-xs font-black text-white"
            >
              관리
            </Link>
          )}
        </div>

        {events.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-center shadow">
            <p className="text-sm font-bold text-gray-500">
              등록된 이벤트가 없습니다.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <article
                key={event.id}
                className="overflow-hidden rounded-3xl bg-white shadow"
              >
                {event.pdf_url ? (
                  <PdfFirstPagePreview
                    url={event.pdf_url}
                    title={event.pdf_name || event.title || "Event PDF"}
                    className="max-h-[520px] w-full"
                  />
                ) : (
                  <img
                    src={event.image_url || "/event.png"}
                    alt={event.title || "Event"}
                    className="h-44 w-full object-cover"
                  />
                )}

                <div className="p-5">
                  <p className="text-sm font-black text-[#C4483A]">
                    {event.event_date
                      ? new Date(event.event_date).toLocaleString()
                      : "Coming Soon"}
                  </p>

                  <h2 className="mt-2 text-xl font-black">
                    {event.title}
                  </h2>

                  {event.category && (
                    <p className="mt-1 text-xs font-bold text-gray-500">
                      {event.category}
                    </p>
                  )}

                  {event.address && (
                    <p className="mt-1 text-xs font-bold text-gray-500">
                      {event.address}
                    </p>
                  )}

                  {event.description && (
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-600">
                      {event.description}
                    </p>
                  )}

                  {event.pdf_url && (
                    <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-3">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="text-2xl">📄</span>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-[#172033]">
                            {event.pdf_name || "Event PDF"}
                          </p>
                          <p className="text-[11px] font-bold text-gray-500">
                            PDF document
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <a
                          href={event.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-xl bg-[#172033] px-3 py-3 text-center text-xs font-black text-white"
                        >
                          원본으로 보기
                        </a>

                        <button
                          type="button"
                          disabled={downloadingPdfId === event.id}
                          onClick={() => void downloadPdf(event)}
                          className="rounded-xl bg-[#C4483A] px-3 py-3 text-xs font-black text-white disabled:bg-gray-400"
                        >
                          {downloadingPdfId === event.id
                            ? "다운로드 중..."
                            : "PDF 다운로드"}
                        </button>
                      </div>
                    </div>
                  )}

                  {isAdmin && (
                    <div className="mt-4 grid grid-cols-2 gap-2 text-sm font-black">
                      <Link
                        href={`/admin/community/events/${event.id}/edit`}
                        className="rounded-full bg-blue-100 py-2 text-center text-blue-700"
                      >
                        수정
                      </Link>

                      <button
                        type="button"
                        onClick={() => deleteEvent(event.id)}
                        className="rounded-full bg-red-100 py-2 text-red-600"
                      >
                        삭제
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}