import Link from "next/link";
import { supabase } from "../../lib/supabase";
import CommunityBottomNav from "../components/CommunityBottomNav";
import ProfileButton from "../components/ProfileButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CommunityPage() {
  const today = new Date().toISOString().slice(0, 10);

  const { data: events, error: eventsError } = await supabase
    .from("community_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  if (eventsError) {
    console.error("community events error:", eventsError);
  }

  const { data: deals, error: dealsError } = await supabase
    .from("deals")
    .select("*")
    .eq("status", "approved")
    .eq("active", true)
    .eq("deal_scope", "community")
    .or(`end_date.is.null,end_date.gte.${today}`)
    .order("created_at", { ascending: false })
    .limit(6);

  if (dealsError) {
    console.error("community deals error:", dealsError);
  }

  const { data: allBusinesses } = await supabase
    .from("businesses")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: categories } = await supabase
    .from("categories")
    .select("name, show_on_community_map");

  const communityCategoryNames = new Set(
    (categories || [])
      .filter((cat) => cat.show_on_community_map === true)
      .map((cat) => String(cat.name).trim().toLowerCase())
  );

  const newBusinesses =
    allBusinesses
      ?.filter((biz) => {
        const bizCategories = String(biz.category || "")
          .split(",")
          .map((cat) => cat.trim().toLowerCase())
          .filter(Boolean);

        return bizCategories.some((cat) => communityCategoryNames.has(cat));
      })
      .slice(0, 6) || [];

  const { data: featured } = await supabase
    .from("featured_businesses")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(3);

  const eventCount = events?.length || 0;
  const dealCount = deals?.length || 0;

  return (
    <main className="min-h-screen bg-[#F8F3EC] text-[#172033]">
      <section className="mx-auto max-w-xl px-5 pb-28 pt-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black text-[#C4483A]">COMMUNITY</p>

            <h1 className="text-3xl font-black tracking-tight">
              KTown Triangle
            </h1>

            <p className="mt-2 text-sm font-semibold text-[#6B6257]">
              Events, deals, new places, and local highlights.
            </p>

          </div>

          <ProfileButton />
        </div>

        {/* Upcoming Events */}
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-black">Upcoming Events</h2>

            <Link
              href="/community/events"
              className="text-xs font-black text-[#C4483A]"
            >
              View all
            </Link>
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
                    : "min-w-[260px] overflow-hidden rounded-3xl bg-[#2A3448] text-white shadow-sm"
                }
              >
                <div
                  className={
                    eventCount === 1
                      ? "relative h-64 w-full overflow-hidden bg-white"
                      : "relative h-52 w-full overflow-hidden bg-white"
                  }
                >
                  {event.image_url ? (
                    <img
                      src={event.image_url}
                      alt={event.title || "Event"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[#E8DED1] text-xs font-black text-[#6B6257]">
                      No Photo
                    </div>
                  )}

                  <div className="absolute left-3 top-3 rounded-full bg-[#172033]/90 px-3 py-1 text-[10px] font-black text-white backdrop-blur-sm">
                    {event.category || "EVENT"}
                  </div>
                </div>

                <div className={eventCount === 1 ? "p-5" : "p-4"}>
                  <h3
                    className={
                      eventCount === 1
                        ? "line-clamp-3 text-2xl font-black leading-tight"
                        : "line-clamp-2 text-lg font-black"
                    }
                  >
                    {event.title}
                  </h3>

                  <p
                    className={
                      eventCount === 1
                        ? "mt-3 text-sm font-bold text-[#6B6257]"
                        : "mt-1 text-xs font-bold text-white/70"
                    }
                  >
                    {event.event_date
                      ? new Date(event.event_date).toLocaleDateString()
                      : "Date TBA"}
                  </p>

                  <p
                    className={
                      eventCount === 1
                        ? "mt-1 line-clamp-2 text-sm font-semibold text-[#6B6257]"
                        : "mt-1 line-clamp-1 text-xs font-semibold text-white/70"
                    }
                  >
                    {event.location || event.address || "Location TBA"}
                  </p>

                  {event.entry_fee && (
                    <p className="mt-2 text-sm font-black text-[#C4483A]">
                      🎟 {event.entry_fee}
                    </p>
                  )}

                  {event.description && (
                    <p
                      className={
                        eventCount === 1
                          ? "mt-3 line-clamp-3 text-sm font-semibold leading-6 text-[#6B6257]"
                          : "mt-2 line-clamp-2 text-xs font-semibold leading-5 text-white/70"
                      }
                    >
                      {event.description}
                    </p>
                  )}
                </div>
              </Link>
            ))}

            {!eventCount && (
              <div className="rounded-3xl bg-white p-6 text-sm font-bold text-[#6B6257] shadow-sm">
                No events yet.
              </div>
            )}
          </div>
        </section>

        {/* Community Deals */}
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-black">Community Deals</h2>

            <Link
              href="/community/deals"
              className="text-xs font-black text-[#C4483A]"
            >
              View all
            </Link>
          </div>

          <div
            className={
              dealCount === 1
                ? "grid grid-cols-1 gap-4"
                : "flex gap-4 overflow-x-auto pb-2"
            }
          >
            {deals?.map((deal) => (
              <Link
                key={deal.id}
                href={`/community/deals/${deal.id}`}
                className={
                  dealCount === 1
                    ? "overflow-hidden rounded-3xl bg-white shadow-sm"
                    : "min-w-[260px] overflow-hidden rounded-3xl bg-white shadow-sm"
                }
              >
                <div
                  className={
                    dealCount === 1
                      ? "relative h-64 w-full overflow-hidden bg-[#E8DED1]"
                      : "relative h-44 w-full overflow-hidden bg-[#E8DED1]"
                  }
                >
                  {deal.image_url ? (
                    <img
                      src={deal.image_url}
                      alt={deal.title || "Deal"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-black text-[#6B6257]">
                      No Photo
                    </div>
                  )}

                  <div className="absolute left-3 top-3 rounded-full bg-[#F4C95D] px-3 py-1 text-[10px] font-black text-[#172033] shadow-lg">
                    DEAL
                  </div>

                  {(deal.discount_text || deal.discount) && (
                    <div className="absolute bottom-3 left-3 rounded-full bg-[#C4483A] px-4 py-2 text-sm font-black text-white shadow-lg">
                      {deal.discount_text || deal.discount}
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <h3 className="line-clamp-2 text-lg font-black text-[#172033]">
                    {deal.title || "Community Deal"}
                  </h3>

                  <p className="mt-1 line-clamp-1 text-sm font-bold text-[#6B6257]">
                    {deal.business_name ||
                      deal.business ||
                      deal.store_name ||
                      "Local Business"}
                  </p>

                  {deal.description && (
                    <p className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-[#6B6257]">
                      {deal.description}
                    </p>
                  )}

                  {deal.end_date && (
                    <p className="mt-3 text-xs font-black text-[#C4483A]">
                      Ends {new Date(deal.end_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </Link>
            ))}

            {!dealCount && (
              <div className="min-w-full rounded-3xl bg-white p-6 text-sm font-bold text-[#6B6257] shadow-sm">
                No community deals yet.
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
                href={`/business/${biz.id}?from=community`}
                className="overflow-hidden rounded-3xl bg-[#2A3448] text-white shadow-sm"
              >
                <div className="relative h-44 w-full overflow-hidden bg-white">
                  {biz.image_url ? (
                    <img
                      src={biz.image_url}
                      alt={biz.name || "Business"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[#E8DED1] text-xs font-black text-[#6B6257]">
                      No Photo
                    </div>
                  )}

                  <div className="absolute left-3 top-3 rounded-full bg-[#C4483A] px-3 py-1 text-[10px] font-black text-white shadow-lg">
                    NEW
                  </div>
                </div>

                <div className="p-3">
                  <h3 className="line-clamp-1 text-sm font-black">
                    {biz.name}
                  </h3>

                  <p className="line-clamp-1 text-xs font-semibold text-white/70">
                    {biz.category || "Business"}
                  </p>

                  <p className="mt-1 text-xs">
                    <span className="font-black text-[#F4C95D]">
                      ★ {biz.rating || "New"}
                    </span>

                    {biz.review_count ? (
                      <span className="ml-1 text-gray-400">
                        ({biz.review_count})
                      </span>
                    ) : null}
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
                <div className="h-44 w-full overflow-hidden bg-[#2A3448]">
                  {item.banner_image ? (
                    <img
                      src={item.banner_image}
                      alt={item.title || "Featured Business"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[#2A3448] text-xs font-black text-white/60">
                      No Photo
                    </div>
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

      <CommunityBottomNav activeNav="community" />
    </main>
  );
}