"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import BottomNav from "../components/BottomNav";

type EventItem = {
  id: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  event_date: string | null;
  category: string | null;
  address: string | null;
};

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPage();
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
      .select("*")
      .order("event_date", { ascending: true });

    if (!error) {
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

    loadPage();
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
              <div
                key={event.id}
                className="overflow-hidden rounded-3xl bg-white shadow"
              >
                <img
                  src={event.image_url || "/event.png"}
                  alt={event.title || "Event"}
                  className="h-44 w-full object-cover"
                />

                <div className="p-5">
                  <p className="text-sm font-black text-[#C4483A]">
                    {event.event_date || "Coming Soon"}
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

                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    {event.description}
                  </p>

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
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}