export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import BottomNav from "./components/BottomNav";
import { supabase } from "../lib/supabase";
import ProfileButton from "./components/ProfileButton";
import AuthRefreshWrapper from "./components/AuthRefreshWrapper";
import InstallAppButton from "./components/InstallAppButton";

function OfferBadges({
  hasDeal,
  hasCoupon,
  size = "sm",
}: {
  hasDeal: boolean;
  hasCoupon: boolean;
  size?: "sm" | "md";
}) {
  if (!hasDeal && !hasCoupon) return null;

  const badgeClass =
    size === "md"
      ? "rounded-full px-2.5 py-1 text-xs font-black shadow-sm"
      : "rounded-full px-2 py-0.5 text-[10px] font-black shadow-sm";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {hasDeal && (
        <span className={`${badgeClass} bg-yellow-400 text-black`}>
          🔥 DEAL
        </span>
      )}

      {hasCoupon && (
        <span className={`${badgeClass} bg-purple-600 text-white`}>
          🎟 COUPON
        </span>
      )}
    </div>
  );
}

function BusinessMedia({
  spot,
  className,
}: {
  spot: any;
  className: string;
}) {
  return (
    <img
      src={spot.image_url || "/event.png"}
      alt={spot.name || "Business"}
      className={`${className} object-cover`}
    />
  );
}

function DealMedia({
  deal,
  className,
}: {
  deal: any;
  className: string;
}) {
  return (
    <img
      src={deal.image_url || deal.businesses?.image_url || "/event.png"}
      alt={deal.title || deal.businesses?.name || "Deal"}
      className={`${className} object-cover`}
    />
  );
}

export default async function Home() {
  const today = new Date().toISOString().slice(0, 10);

  const { data: communityCategories } = await supabase
    .from("categories")
    .select("name")
    .eq("show_on_community_map", true);

  const communityCategorySet = new Set(
    (communityCategories || []).map((c) => String(c.name).trim().toLowerCase())
  );

  const { data: allSpots } = await supabase
    .from("businesses")
    .select("*")
    .order("id", { ascending: true });

  const spots = (allSpots || []).filter((spot) => {
    const categories = String(spot.category || "")
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);

    const hasCommunityCategory = categories.some((cat) =>
      communityCategorySet.has(cat)
    );

    const hasMainCategory = categories.some(
      (cat) => !communityCategorySet.has(cat)
    );

    return !(hasCommunityCategory && !hasMainCategory);
  });

  const { data: businessEvents } = await supabase
    .from("business_events")
    .select("*")
    .eq("status", "approved")
    .eq("active", true)
    .gte("event_date", today)
    .order("event_date", { ascending: true })
    .limit(1);

  const { data: activeDeals } = await supabase
    .from("deals")
    .select(`
      *,
      businesses (
        id,
        name,
        category,
        city,
        image_url,
        rating,
        review_count
      )
    `)
    .eq("status", "approved")
    .eq("active", true)
    .or(`end_date.is.null,end_date.gte.${today}`)
    .order("created_at", { ascending: false })
    .limit(3);

  const { data: dealBusinesses } = await supabase
    .from("deals")
    .select("business_id")
    .eq("status", "approved")
    .eq("active", true)
    .or(`end_date.is.null,end_date.gte.${today}`);

  const { data: couponBusinesses } = await supabase
    .from("coupons")
    .select("business_id")
    .eq("active", true);

  const dealBusinessIds = new Set(
    (dealBusinesses || []).map((d: any) => d.business_id).filter(Boolean)
  );

  const couponBusinessIds = new Set(
    (couponBusinesses || []).map((c: any) => c.business_id).filter(Boolean)
  );

  const featured = spots?.[0];
  const deals = activeDeals || [];
  const trending = spots || [];
  const mainEvent = businessEvents?.[0];

  return (
    <>
      <InstallAppButton />

      <main className="min-h-screen bg-[#F8F3EC] px-5 pb-40 pt-8 text-[#172033]">
        <div className="mx-auto mb-8 flex max-w-xl items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#C4483A]">KTT</p>
            <h1 className="text-3xl font-bold">KTown Triangle</h1>
            <p className="mt-1 text-sm text-gray-600">
              Events, deals & Korean spots near you
            </p>
          </div>

          <div className="shrink-0">
            <AuthRefreshWrapper>
              <ProfileButton />
            </AuthRefreshWrapper>
          </div>
        </div>

        {mainEvent && (
          <section className="mx-auto mb-8 max-w-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-bold">🎉 Events</h2>

              <Link
                href="/business-events"
                className="rounded-full bg-white px-4 py-2 text-sm font-black text-[#172033] shadow"
              >
                More
              </Link>
            </div>

            <Link
              href={`/business-events/${mainEvent.id}`}
              className="block overflow-hidden rounded-3xl bg-white shadow-xl"
            >
              <div className="h-64 w-full bg-white">
                <img
                  src={mainEvent.image_url || "/event.png"}
                  alt={mainEvent.title || "Business Event"}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="p-5">
                <p className="text-xs font-bold text-[#C4483A]">
                  {mainEvent.event_date || "Coming Soon"}
                </p>

                <h3 className="mt-1 text-lg font-bold">{mainEvent.title}</h3>

                <p className="mt-1 line-clamp-2 text-sm text-gray-600">
                  {mainEvent.description}
                </p>
              </div>
            </Link>
          </section>
        )}

        <section className="mx-auto mb-8 max-w-xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-bold">🔥 Deals Near You</h2>

            <Link
              href="/deals"
              className="rounded-full bg-white px-4 py-2 text-sm font-black text-[#172033] shadow"
            >
              More
            </Link>
          </div>

          <div className="space-y-4">
            {deals.map((deal) => (
              <a
                key={deal.id}
                href={`/deals/${deal.id}`}
                className="flex gap-4 rounded-3xl bg-white p-4 shadow-sm"
              >
                <div className="h-28 w-40 shrink-0 overflow-hidden rounded-2xl bg-white">
                  <DealMedia
                    deal={deal}
                    className="h-full w-full object-contain"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[#C4483A]">
                    Special Deal
                  </p>

                  <h4 className="mt-1 line-clamp-1 font-bold">
                    {deal.title || deal.businesses?.name || "Deal"}
                  </h4>

                  <div className="mt-1 flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0 truncate text-gray-600">
                      {deal.businesses?.name || "KTT Deal"}
                      {deal.businesses?.city ? ` · ${deal.businesses.city}` : ""}
                    </div>

                    <div className="shrink-0 whitespace-nowrap font-bold text-[#C4483A]">
                      ★ {deal.businesses?.rating || "New"}
                      {deal.businesses?.review_count ? (
                        <span className="ml-1 text-gray-400">
                          ({deal.businesses.review_count})
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <p className="mt-2 line-clamp-2 text-xs font-bold text-gray-500">
                    {deal.description || "Tap to view deal details"}
                  </p>
                </div>
              </a>
            ))}

            {deals.length === 0 && (
              <div className="rounded-3xl bg-white p-5 text-sm font-semibold text-gray-500 shadow-sm">
                등록된 DEAL이 아직 없습니다.
              </div>
            )}
          </div>
        </section>

        {featured && (
          <section className="mx-auto mb-8 max-w-xl">
            <h2 className="mb-3 text-xl font-bold">⭐ Featured Sponsor</h2>

            <a
              href={`/business/${featured.id}`}
              className="block overflow-hidden rounded-3xl bg-white shadow-xl"
            >
              <div className="h-56 w-full overflow-hidden bg-white">
                <BusinessMedia
                  spot={featured}
                  className="h-full w-full object-contain"
                />
              </div>

              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-2xl font-bold">{featured.name}</h3>

                      <OfferBadges
                        hasDeal={dealBusinessIds.has(featured.id)}
                        hasCoupon={couponBusinessIds.has(featured.id)}
                        size="md"
                      />
                    </div>

                    <p className="mt-2 text-sm text-gray-600">
                      {featured.category} · {featured.city}
                    </p>
                  </div>

                  <div className="whitespace-nowrap rounded-full bg-[#F8F3EC] px-3 py-1 text-sm font-bold">
                    ★ {featured.rating || "New"}
                    {featured.review_count ? (
                      <span className="ml-1 text-gray-500">
                        ({featured.review_count})
                      </span>
                    ) : null}
                  </div>
                </div>

                <p className="mt-3 line-clamp-2 text-sm text-gray-700">
                  {featured.description || featured.tags || featured.tag}
                </p>
              </div>
            </a>
          </section>
        )}

        <section className="mx-auto max-w-xl">
          <h2 className="mb-3 text-xl font-bold">📈 Trending Now</h2>

          <div className="space-y-4">
            {trending.map((spot) => {
              const hasDeal = dealBusinessIds.has(spot.id);
              const hasCoupon = couponBusinessIds.has(spot.id);

              return (
                <a
                  key={spot.id}
                  href={`/business/${spot.id}`}
                  className="block rounded-3xl bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-28 w-40 shrink-0 overflow-hidden rounded-2xl bg-white">
                      <BusinessMedia
                        spot={spot}
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="line-clamp-1 font-bold">{spot.name}</h4>

                        <OfferBadges
                          hasDeal={hasDeal}
                          hasCoupon={hasCoupon}
                        />
                      </div>

                      <p className="line-clamp-1 text-sm text-gray-600">
                        {spot.category} · {spot.city}
                      </p>

                      <p className="mt-1 line-clamp-1 text-sm font-medium text-[#C4483A]">
                        {spot.tags || spot.tag}
                      </p>

                      <p className="mt-1 text-sm">
                        <span className="font-bold text-[#172033]">
                          ★ {spot.rating || "New"}
                        </span>

                        {spot.review_count ? (
                          <span className="ml-1 text-gray-400">
                            ({spot.review_count})
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </section>

        <BottomNav activeNav="home" />
      </main>
    </>
  );
}