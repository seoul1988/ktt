import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import CommunityBottomNav from "../../components/CommunityBottomNav";
import ProfileButton from "../../components/ProfileButton";


export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CommunityEventsPage() {
  const { data: events } = await supabase
    .from("community_events")
    .select("*")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-[#F8F3EC] text-[#172033]">
      <section className="mx-auto max-w-xl px-5 pb-28 pt-5">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
  <Link
    href="/community"
    className="rounded-full bg-white px-4 py-2 text-xs font-black text-[#172033] shadow-sm"
  >
    Back
  </Link>

  <div className="text-center">
    <h1 className="text-lg font-black">
      <span className="text-[#C4483A]">COMMUNITY</span>{" "}
      <span className="text-[#172033]">Events</span>
    </h1>
  </div>

  <ProfileButton />
</div>

        <div className="space-y-4">
          {events?.map((event) => (
            <Link
              key={event.id}
              href={`/community/events/${event.id}`}
              className="block overflow-hidden rounded-3xl bg-white shadow-sm"
            >
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

              <div className="p-4">
                <h2 className="line-clamp-2 text-lg font-black">
                  {event.title}
                </h2>

                <p className="mt-2 text-sm font-bold text-[#6B6257]">
                  {event.event_date
                    ? new Date(event.event_date).toLocaleDateString()
                    : "Date TBA"}
                </p>

                <p className="mt-1 line-clamp-1 text-sm font-semibold text-[#6B6257]">
                  {event.location || event.address || "Location TBA"}
                </p>

                {event.description && (
                  <p className="mt-3 line-clamp-2 text-sm font-semibold leading-5 text-[#6B6257]">
                    {event.description}
                  </p>
                )}
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