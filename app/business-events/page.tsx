// app/business-events/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import BottomNav from "../components/BottomNav";
import ProfileButton from "../components/ProfileButton";
export const dynamic = "force-dynamic";

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
  businesses?: {
    name: string | null;
    phone: string | null;
  } | null;
};

export default function BusinessEventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const { data, error } = await supabase
      .from("business_events")
      .select(`
        *,
        businesses (
          name,
          phone
        )
      `)
      .eq("status", "approved")
      .eq("active", true)
      .order("event_date", { ascending: true });

    if (!error && data) {
      setEvents(data as EventItem[]);
    }

    setLoading(false);
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

          <h1 className="text-2xl font-black">🎉 Events</h1>

          <div className="absolute right-0 flex items-center gap-2">
            <Link
		  href="/map?view=events&filter=upcoming"
		  className="rounded-full bg-blue-700 px-3 py-2 text-xs font-black text-white shadow"
		>
		  MAP
		</Link>

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
              const business = Array.isArray(event.businesses)
                ? event.businesses[0]
                : event.businesses;

              return (
                <Link
                  key={event.id}
                  href={`/business-events/${event.id}`}
                  className="block overflow-hidden rounded-3xl bg-white shadow"
                >
                  <div className="relative flex h-44 w-full items-center justify-center bg-white">
                    <img
                      src={event.image_url || "/event.png"}
                      alt={event.title || "Event"}
                      className="h-full w-full object-contain"
                    />

                    <div className="absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1 text-xs font-black text-white">
                      1/1
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="mb-3 rounded-2xl bg-[#F8F3EC] p-3">
                      <p className="text-base font-black">
                        {business?.name || "Business"}
                      </p>

                      {business?.phone && (
                        <p className="mt-1 text-sm font-bold text-blue-600">
                          📞 {business.phone}
                        </p>
                      )}
                    </div>

                    <p className="text-sm font-black text-[#C4483A]">
                      {event.event_date || "Coming Soon"}
                    </p>

                    <h2 className="mt-2 text-xl font-black">
                      {event.title}
                    </h2>

                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-600">
                      {event.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
