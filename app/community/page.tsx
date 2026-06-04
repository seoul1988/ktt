// app/community/page.tsx

import Link from "next/link";
import { supabase } from "../../lib/supabase";
import CommunityBottomNav from "../components/CommunityBottomNav";
import ProfileButton from "../components/ProfileButton";

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

  const eventCount = events?.length || 0;

  return (
    <main className="min-h-screen bg-[#F8F3EC] text-[#172033]">
      <section className="mx-auto max-w-md px-5 pb-28 pt-6">
      <div className="mb-6 flex items-start justify-between">
		  <div>
			<p className="text-sm font-black text-[#C4483A]">
			  COMMUNITY
			</p>

			<h1 className="text-3xl font-black tracking-tight">
			  KTown Triangle
			</h1>

			<p className="mt-2 text-sm font-semibold text-[#6B6257]">
			  Events, new places, and local highlights.
			</p>
		  </div>

		  <ProfileButton />
		</div>

        {/* Upcoming Events */}
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-black">Upcoming Events</h2>
          </div>

          <div
            className={
              eventCount === 1
                ? "grid grid-cols-1 gap-4"
                : "flex gap-4 overflow-x-auto pb-2"
            }
          >
            {events?.map((event) => (
              <Link
                key={event.id}
                href={`/community/events/${event.id}`}
                className={
                  eventCount === 1
                    ? "overflow-hidden rounded-3xl bg-white shadow-sm"
                    : "min-w-[260px] overflow-hidden rounded-3xl bg-white shadow-sm"
                }
              >
                {eventCount === 1 ? (
                  <div className="flex min-h-[210px]">
                    <div className="flex w-[42%] items-center justify-center bg-white p-3">
                      {event.image_url ? (
                        <img
                          src={event.image_url}
                          alt={event.title}
                          className="max-h-[190px] max-w-full rounded-2xl object-contain"
                        />
                      ) : (
                        <div className="flex h-[170px] w-full items-center justify-center rounded-2xl bg-[#E8DED1] text-xs font-black text-[#6B6257]">
                          No Photo
                        </div>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col justify-center p-5">
                      <span className="w-fit rounded-full bg-[#172033] px-3 py-1 text-[10px] font-black text-white">
                        {event.category || "EVENT"}
                      </span>

                      <h3 className="mt-4 line-clamp-3 text-2xl font-black leading-tight">
                        {event.title}
                      </h3>

                      <p className="mt-3 text-sm font-bold text-[#6B6257]">
                        {event.event_date
                          ? new Date(event.event_date).toLocaleDateString()
                          : "Date TBA"}
                      </p>

                      <p className="mt-1 line-clamp-2 text-sm font-semibold text-[#6B6257]">
                        {event.address || "Location TBA"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
<div className="h-44 bg-white flex items-center justify-center p-2">
  {event.image_url ? (
    <img
      src={event.image_url}
      alt={event.title}
      className="max-h-full max-w-full object-contain"
    />
  ) : (
    <div className="flex h-full w-full items-center justify-center bg-[#E8DED1] text-xs font-black text-[#6B6257]">
      No Photo
    </div>
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
					  {event.entry_fee && (
					  <p className="mt-1 text-xs font-black text-[#C4483A]">
						🎟 {event.entry_fee}
					  </p>
					)}
					  {event.description && (
					  <p className="mt-2 text-xs font-semibold leading-5 text-[#6B6257]">
						{event.description.length > 60
						  ? `${event.description.slice(0, 60)}...`
						  : event.description}
					  </p>
					)}
										  
					  
                    </div>
                  </>
                )}
              </Link>
            ))}

            {!eventCount && (
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
                <div className="flex h-28 w-full items-center justify-center bg-white p-2">
                  {biz.image_url ? (
                    <img
                      src={biz.image_url}
                      alt={biz.name}
                      className="block max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-2xl bg-[#E8DED1] text-xs font-black text-[#6B6257]">
                      No Photo
                    </div>
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

      <CommunityBottomNav activeNav="community"/>
    </main>
  );
}
