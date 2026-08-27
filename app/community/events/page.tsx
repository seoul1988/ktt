import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import CommunityBottomNav from "../../components/CommunityBottomNav";
import ProfileButton from "../../components/ProfileButton";
import BackButton from "@/app/components/BackButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatEventDate(value: string | null | undefined) {
  if (!value) return "Date TBA";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function CommunityEventsPage() {
  const { data: events, error } = await supabase
    .from("community_events")
    .select("*")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Community events load error:", error);
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] text-[#172033]">
      <section className="mx-auto w-full max-w-2xl px-4 pb-28 pt-5">
        {/* HEADER */}
        <div className="relative mb-5 flex min-h-10 items-center justify-center">
          <div className="absolute left-0">
            <BackButton />
          </div>

          <h1 className="text-xl font-black text-[#172033]">
            EVENTS
          </h1>

          <div className="absolute right-0">
            <ProfileButton />
          </div>
        </div>

        {/* EVENT LIST */}
        <div className="space-y-4">
          {events?.map((event) => (
            <Link
              key={event.id}
              href={`/community/events/${event.id}`}
              className="block overflow-hidden rounded-3xl bg-white shadow-sm transition active:scale-[0.99]"
            >
              {/* IMAGE */}
              <div className="relative h-56 bg-[#E8DED1]">
                {event.image_url ? (
                  <img
                    src={event.image_url}
                    alt={event.title || "Event"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm font-black text-[#6B6257]">
                    No Photo
                  </div>
                )}

                <span className="absolute left-3 top-3 rounded-full bg-[#C4483A] px-3 py-1 text-[10px] font-black text-white">
                  EVENT
                </span>
              </div>

              {/* CONTENT */}
              <div className="p-4">
                <h2 className="line-clamp-2 text-lg font-black text-[#172033]">
                  {event.title}
                </h2>

                <p className="mt-2 text-sm font-bold text-[#6B6257]">
                  {formatEventDate(event.event_date)}
                </p>

                <p className="mt-1 line-clamp-1 text-sm font-semibold text-[#6B6257]">
                  {event.location ||
                    event.address ||
                    "Location TBA"}
                </p>

                {event.description && (
                  <p className="mt-3 line-clamp-2 text-sm font-semibold leading-5 text-[#6B6257]">
                    {event.description}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {event.raffle_enabled === true && (
                    <span className="inline-flex rounded-full bg-yellow-100 px-3 py-1.5 text-[11px] font-black text-yellow-800">
                      🎁 Prize Drawing
                    </span>
                  )}

                  {event.collect_attendees === true &&
                    event.raffle_enabled !== true && (
                      <span className="inline-flex rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-black text-blue-700">
                        Registration Open
                      </span>
                    )}
                </div>
              </div>
            </Link>
          ))}

          {!events?.length && (
            <div className="rounded-3xl bg-white p-6 text-center text-sm font-bold text-[#6B6257] shadow-sm">
              등록된 이벤트가 없습니다.
            </div>
          )}
        </div>
      </section>

      <CommunityBottomNav activeNav="community" />
    </main>
  );
}