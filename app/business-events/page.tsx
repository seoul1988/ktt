// app/business-events/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import BottomNav from "../components/BottomNav";
import ProfileButton from "../components/ProfileButton";

type EventItem = {
  id: string;
  owner_id: string | null;
  business_id: number | null;
  title: string | null;
  description: string | null;
  image_url: string | null;
  event_date: string | null;
  status: string | null;
  active: boolean | null;
};

const STORAGE_BUCKET = "business-events";

function getStoragePathFromUrl(url: string | null) {
  if (!url) return null;

  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
  const index = url.indexOf(marker);

  if (index === -1) return null;

  return decodeURIComponent(url.substring(index + marker.length));
}

export default function BusinessEventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isAdmin = role === "admin" || role === "owner";

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    setUserId(user?.id || null);

    if (user?.id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      setRole(profile?.role || null);
    }

    const { data, error } = await supabase
      .from("business_events")
      .select("*")
      .eq("status", "approved")
      .eq("active", true)
      .order("event_date", { ascending: true });

    if (!error && data) {
      setEvents(data as EventItem[]);
    }

    setLoading(false);
  }

  async function deleteEvent(event: EventItem) {
    const ok = confirm("이 이벤트를 삭제할까요? 이미지도 같이 삭제됩니다.");
    if (!ok) return;

    setDeletingId(event.id);

    const imagePath = getStoragePathFromUrl(event.image_url);

    if (imagePath) {
      await supabase.storage.from(STORAGE_BUCKET).remove([imagePath]);
    }

    const { error } = await supabase
      .from("business_events")
      .delete()
      .eq("id", event.id);

    setDeletingId(null);

    if (error) {
      alert("삭제 실패: " + error.message);
      return;
    }

    setEvents((prev) => prev.filter((item) => item.id !== event.id));
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-5 pb-28">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link
          href="/"
          className="rounded-full bg-white/90 px-4 py-2 text-sm font-bold shadow"
        >
          ← Back
        </Link>

        <h1 className="text-2xl font-black text-[#172033]">
          🎉 Business Events
        </h1>

        <div className="shrink-0">
          <ProfileButton />
        </div>
      </div>

      {loading ? (
        <div className="rounded-3xl bg-white p-8 text-center shadow">
          <p className="font-bold text-gray-500">불러오는 중...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-center shadow">
          <p className="font-bold text-gray-500">
            등록된 이벤트가 없습니다.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => {
            const canDelete = isAdmin || event.owner_id === userId;

            return (
              <div
                key={event.id}
                className="overflow-hidden rounded-3xl bg-white shadow-xl"
              >
                <Link href={`/business-events/${event.id}`} className="block">
                  <div className="h-64 w-full bg-white">
                    <img
                      src={event.image_url || "/event.png"}
                      alt={event.title || "Event"}
                      className="h-full w-full object-contain"
                    />
                  </div>

                  <div className="p-3">
                    <p className="text-xs font-bold text-[#C4483A]">
                      {event.event_date || "Coming Soon"}
                    </p>

                    <h3 className="mt-1 text-lg font-bold text-[#172033]">
                      {event.title}
                    </h3>

                    <p className="mt-1 line-clamp-2 text-xs text-gray-600">
                      {event.description}
                    </p>
                  </div>
                </Link>

                {canDelete && (
                  <div className="border-t border-gray-100 p-3">
                    <button
                      type="button"
                      onClick={() => deleteEvent(event)}
                      disabled={deletingId === event.id}
                      className="w-full rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
                    >
                      {deletingId === event.id ? "삭제 중..." : "삭제"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <BottomNav />
    </main>
  );
}