// app/business-events/page.tsx

import Link from "next/link";
import { supabase } from "../../lib/supabase";
import BottomNav from "../components/BottomNav";
import ProfileButton from "../components/ProfileButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BusinessEventsPage() {
  const { data: events } = await supabase
    .from("business_events")
    .select("*")
    .eq("status", "approved")
    .eq("active", true)
    .order("event_date", { ascending: true });

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

      {!events || events.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-center shadow">
          <p className="font-bold text-gray-500">
            등록된 이벤트가 없습니다.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/business-events/${event.id}`}
              className="block overflow-hidden rounded-3xl bg-white shadow-xl"
            >
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
          ))}
        </div>
      )}

      <BottomNav />
    </main>
  );
}