// app/community/page.tsx

import Link from "next/link";
import { supabase } from "../../lib/supabase";
import CommunityBottomNav from "../components/CommunityBottomNav";

export default async function CommunityPage() {
  const { data: events } = await supabase
    .from("community_events")
    .select("*")
    .order("event_date", { ascending: true })
    .limit(6);

  const { data: newBusinesses } = await supabase
    .from("businesses")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(6);

  const { data: featured } = await supabase
    .from("featured_businesses")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(3);

  return (
    <main className="min-h-screen bg-[#F8F3EC] text-[#172033]">
      <section className="mx-auto max-w-md px-5 pb-28 pt-6">
        <div className="mb-6">
          <p className="text-sm font-black text-[#C4483A]">COMMUNITY</p>
          <h1 className="text-3xl font-black tracking-tight">
            KTown Triangle
          </h1>
          <p className="mt-2 text-sm font-semibold text-[#6B6257]">
            Events, new places, and local highlights.
          </p>
        </div>

        {/* Upcoming Events */}
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-black">Upcoming Events</h2>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-2">
            {events?.map((event) => (
              <div
                key={event.id}
                className="min-w-[260px] overflow-hidden rounded-3xl bg-white shadow-sm"
              >
                <div className="h-36 bg-[#E8DED1]">
                  {event.image_url && (
                    <img
                      src={event.image_url}
                      alt={event.title}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>

                <div className="p-4">
                  <span className="rounded-full bg-[#172033] px-3 py-1 text-[10px] font-black text-white">
                    {event.category || "EVENT"}
                  </span>

                  <h3 className="mt-3 line-clamp-2 text-lg font-black">
                    {event.title}
                  </h3>

                  <p className="mt-1 text-xs font-bold text-[#6B6257]">
                    {event.event_date
                      ? new Date(event.event_date).toLocaleDateString()
                      : "Date TBA"}
                  </p>

                  <p className="mt-1 line-clamp-1 text-xs font-semibold text-[#6B6257]">
                    {event.address || "Location TBA"}
                  </p>
                </div>
              </div>
            ))}

            {!events?.length && (
              <div className="rounded-3xl bg-white p-6 text-sm font-bold text-[#6B6257] shadow-sm">
                No events yet.
              </div>
            )}
          </div>
        </section>

        {/* New in Raleigh */}
        <section className="mb-8">
          <h2 className="mb-3 text-xl font-black">New in Raleigh</h2>

          <div className="grid grid-cols-2 gap-4">
            {newBusinesses?.map((biz) => (
              <Link
                key={biz.id}
                href={`/business/${biz.id}`}
                className="overflow-hidden rounded-3xl bg-white shadow-sm"
              >
                <div className="h-28 bg-[#E8DED1]">
                  {biz.image_url && (
                    <img
                      src={biz.image_url}
                      alt={biz.name}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>

                <div className="p-3">
                  <span className="rounded-full bg-[#C4483A] px-2 py-1 text-[9px] font-black text-white">
                    NEW
                  </span>
                  <h3 className="mt-2 line-clamp-1 text-sm font-black">
                    {biz.name}
                  </h3>
                  <p className="line-clamp-1 text-xs font-semibold text-[#6B6257]">
                    {biz.category || "Business"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Featured Business */}
        <section>
          <h2 className="mb-3 text-xl font-black">Featured Business</h2>

          <div className="space-y-4">
            {featured?.map((item) => (
              <div
                key={item.id}
                className="overflow-hidden rounded-3xl bg-[#172033] text-white shadow-sm"
              >
                <div className="h-36 bg-[#2A3448]">
                  {item.banner_image && (
                    <img
                      src={item.banner_image}
                      alt={item.title || "Featured Business"}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>

                <div className="p-4">
                  <p className="text-[10px] font-black text-[#F4C95D]">
                    FEATURED
                  </p>
                  <h3 className="mt-1 text-lg font-black">
                    {item.title || "Featured Business"}
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-white/75">
                    {item.subtitle || "Sponsored local highlight"}
                  </p>
                </div>
              </div>
            ))}

            {!featured?.length && (
              <div className="rounded-3xl bg-white p-6 text-sm font-bold text-[#6B6257] shadow-sm">
                No featured businesses yet.
              </div>
            )}
          </div>
        </section>
      </section>
	  <CommunityBottomNav />
    </main>
  );
}