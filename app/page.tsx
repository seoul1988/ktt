export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import BottomNav from "./components/BottomNav";
import { supabase } from "../lib/supabase";
import ProfileButton from "./components/ProfileButton";
import AuthRefreshWrapper from "./components/AuthRefreshWrapper";
import InstallAppButton from "./components/InstallAppButton";
import FeaturedSponsorSlider from "./components/FeaturedSponsorSlider";

function getYoutubeEmbedUrl(url: string | null | undefined) {
  if (!url) return null;

  const value = String(url);

  if (value.includes("youtube.com/watch?v=")) {
    const id = value.split("v=")[1]?.split("&")[0];
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }

  if (value.includes("youtu.be/")) {
    const id = value.split("youtu.be/")[1]?.split("?")[0];
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }

  return null;
}

function SectionTitle({
  label,
  title,
  emoji,
  color,
  bgColor,
  moreHref,
}: {
  label: string;
  title: string;
  emoji: string;
  color: string;
  bgColor: string;
  moreHref?: string;
}) {
  return (
    <div
      className={`mb-5 flex items-center justify-between rounded-2xl border px-4 py-3 shadow-sm ${bgColor}`}
    >
      <div className="flex items-center gap-3">
        <div className={`h-10 w-1 rounded-full ${color}`} />

        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-gray-500">
            {label}
          </p>

          <h2 className="mt-0.5 text-2xl font-black leading-tight text-[#172033]">
            {emoji} {title}
          </h2>
        </div>
      </div>

      {moreHref && (
        <Link
          href={moreHref}
          className="rounded-full border border-gray-200 bg-white px-5 py-2 text-sm font-black text-[#172033] shadow-sm hover:bg-gray-50"
        >
          More
        </Link>
      )}
    </div>
  );
}

function VideoFirstMedia({
  videoUrl,
  imageUrl,
  alt,
  className,
}: {
  videoUrl?: string | null;
  imageUrl?: string | null;
  alt: string;
  className: string;
}) {
  const youtubeUrl = getYoutubeEmbedUrl(videoUrl);

  if (youtubeUrl) {
    return (
      <iframe
        src={youtubeUrl}
        title={alt}
        className={className}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  if (videoUrl) {
    return (
      <video
        src={videoUrl}
        controls
        autoPlay
        muted
        playsInline
        className={`${className} bg-black object-cover`}
      />
    );
  }

  return (
    <img
      src={imageUrl || "/event.png"}
      alt={alt}
      className={`${className} object-cover`}
    />
  );
}

function OfferBadges({
  hasDeal,
  hasCoupon,
  dealId,
  businessId,
  size = "sm",
}: {
  hasDeal: boolean;
  hasCoupon: boolean;
  dealId?: string | null;
  businessId: number | string;
  size?: "sm" | "md";
}) {
  if (!hasDeal && !hasCoupon) return null;

  const badgeClass =
    size === "md"
      ? "rounded-full px-2.5 py-1 text-xs font-black shadow-sm"
      : "rounded-full px-2 py-0.5 text-[10px] font-black shadow-sm";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {hasDeal && dealId && (
        <Link
          href={`/deals/${dealId}`}
          className={`${badgeClass} bg-yellow-400 text-black`}
        >
          🔥 DEAL
        </Link>
      )}

      {hasCoupon && (
        <Link
          href={`/business/${businessId}`}
          className={`${badgeClass} bg-purple-600 text-white`}
        >
          🎟 COUPON
        </Link>
      )}
    </div>
  );
}

function BusinessMedia({ spot, className }: { spot: any; className: string }) {
  return (
    <img
      src={spot.image_url || "/event.png"}
      alt={spot.name || "Business"}
      className={`${className} object-cover`}
    />
  );
}

function DealMedia({ deal, className }: { deal: any; className: string }) {
  return (
    <img
      src={deal.image_url || deal.businesses?.image_url || "/event.png"}
      alt={deal.title || deal.businesses?.name || "Deal"}
      className={`${className} object-cover`}
    />
  );
}

export default async function Home() {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

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
    .order("created_at", { ascending: false });

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

  const { data: grandOpenings } = await supabase
    .from("grand_openings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);

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
    .select(
      `
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
    `
    )
    .eq("status", "approved")
    .eq("active", true)
    .or("deal_scope.is.null,deal_scope.neq.community")
    .lte("start_date", today)
    .or(`end_date.is.null,end_date.gte.${today}`)
    .order("created_at", { ascending: false })
    .limit(3);

  const { data: dealBusinesses } = await supabase
    .from("deals")
    .select("id, business_id")
    .eq("status", "approved")
    .eq("active", true)
    .or("deal_scope.is.null,deal_scope.neq.community")
    .lte("start_date", today)
    .or(`end_date.is.null,end_date.gte.${today}`);

  const { data: couponBusinesses } = await supabase
    .from("coupons")
    .select("business_id, usage_limit, used_count")
    .eq("active", true)
    .lte("start_date", now)
    .or(`end_date.is.null,end_date.gte.${now}`);

  const dealBusinessMap = new Map(
    (dealBusinesses || [])
      .filter((d: any) => d.business_id && d.id)
      .map((d: any) => [d.business_id, d.id])
  );

  const couponBusinessIds = new Set(
    (couponBusinesses || [])
      .filter((c: any) => {
        const usageLimit = Number(c.usage_limit || 0);
        const usedCount = Number(c.used_count || 0);
        if (usageLimit > 0 && usedCount >= usageLimit) return false;
        return true;
      })
      .map((c: any) => c.business_id)
      .filter(Boolean)
  );

 const featuredSponsors = (spots || [])
  .filter((spot) => spot.featured_sponsor === true)
  .sort((a, b) => {
    const orderDiff =
      Number(a.display_order || 0) - Number(b.display_order || 0);
    if (orderDiff !== 0) return orderDiff;
    return Number(a.id || 0) - Number(b.id || 0);
  });

const trending = spots || [];

  const mainEvent = businessEvents?.[0];
  const mainGrandOpening = grandOpenings?.[0];

  const grandOpeningImage =
    mainGrandOpening?.images?.[0] ||
    mainGrandOpening?.image_url ||
    "/event.png";

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

        {mainGrandOpening && (
          <section className="mx-auto mb-10 max-w-xl">
            <SectionTitle
              label="Featured"
              title="Grand Opening"
              emoji="🎉"
              color="bg-amber-500"
              bgColor="border-amber-200 bg-amber-50"
              moreHref="/grand-openings"
            />

            <Link
              href={`/grand-openings/${mainGrandOpening.id}`}
              className="block overflow-hidden rounded-3xl border border-amber-100 bg-white shadow-xl"
            >
              <div className="h-64 w-full bg-white">
                <VideoFirstMedia
                  videoUrl={mainGrandOpening.video_url}
                  imageUrl={grandOpeningImage}
                  alt={mainGrandOpening.title || "Grand Opening"}
                  className="h-full w-full"
                />
              </div>

              <div className="p-5">
                <p className="text-xs font-black uppercase tracking-wider text-amber-600">
                  Grand Opening · {mainGrandOpening.opening_date || "Coming Soon"}
                </p>

                <h3 className="mt-1 text-xl font-black">
                  {mainGrandOpening.business_name || "Grand Opening"}
                </h3>

                <p className="mt-1 text-sm font-bold text-gray-600">
                  {mainGrandOpening.title}
                </p>

                <p className="mt-2 line-clamp-2 text-sm text-gray-600">
                  {mainGrandOpening.description}
                </p>
              </div>
            </Link>
          </section>
        )}

        {mainEvent && (
          <section className="mx-auto mb-10 max-w-xl">
            <SectionTitle
              label="Upcoming"
              title="Events"
              emoji="📅"
              color="bg-blue-600"
              bgColor="border-blue-200 bg-blue-50"
              moreHref="/business-events"
            />

            <Link
              href={`/business-events/${mainEvent.id}`}
              className="block overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-xl"
            >
              <div className="h-64 w-full bg-white">
                <VideoFirstMedia
                  videoUrl={mainEvent.video_url}
                  imageUrl={mainEvent.image_url || "/event.png"}
                  alt={mainEvent.title || "Business Event"}
                  className="h-full w-full"
                />
              </div>

              <div className="p-5">
                <p className="text-xs font-black uppercase tracking-wider text-blue-600">
                  Event · {mainEvent.event_date || "Coming Soon"}
                </p>

                <h3 className="mt-1 text-xl font-black">{mainEvent.title}</h3>

                <p className="mt-2 line-clamp-2 text-sm text-gray-600">
                  {mainEvent.description}
                </p>
              </div>
            </Link>
          </section>
        )}

        <section className="mx-auto mb-10 max-w-xl">
          <SectionTitle
            label="Limited Time"
            title="Deals Near You"
            emoji="🔥"
            color="bg-red-500"
            bgColor="border-red-200 bg-red-50"
            moreHref="/deals"
          />

          <div className="space-y-4">
            {deals.map((deal) => (
              <Link
                key={deal.id}
                href={`/deals/${deal.id}`}
                className="flex gap-4 rounded-3xl border border-red-100 bg-white p-4 shadow-sm"
              >
                <div className="h-28 w-40 shrink-0 overflow-hidden rounded-2xl bg-white">
                  <DealMedia
                    deal={deal}
                    className="h-full w-full object-contain"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black uppercase tracking-wider text-red-500">
                    Special Deal
                  </p>

                  <h4 className="mt-1 line-clamp-1 font-black">
                    {deal.title || deal.businesses?.name || "Deal"}
                  </h4>

                  <p className="mt-2 line-clamp-2 text-xs font-bold text-gray-500">
                    {deal.description || "Tap to view deal details"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {featuredSponsors.length > 0 && (
          <FeaturedSponsorSlider
            sponsors={featuredSponsors}
            dealBusinessEntries={Array.from(dealBusinessMap.entries())}
            couponBusinessIds={Array.from(couponBusinessIds)}
          />
        )}

        <section className="mx-auto max-w-xl">
          <SectionTitle
            label="Popular"
            title="Trending Now"
            emoji="📈"
            color="bg-green-600"
            bgColor="border-green-200 bg-green-50"
          />

          <div className="space-y-4">
            {trending.map((spot) => {
              const dealId = dealBusinessMap.get(spot.id);
              const hasDeal = Boolean(dealId);
              const hasCoupon = couponBusinessIds.has(spot.id);

              return (
                <div
                  key={spot.id}
                  className="block rounded-3xl border border-green-100 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <Link
                      href={`/business/${spot.id}`}
                      className="h-28 w-40 shrink-0 overflow-hidden rounded-2xl bg-white"
                    >
                      <BusinessMedia
                        spot={spot}
                        className="h-full w-full object-cover"
                      />
                    </Link>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/business/${spot.id}`}>
                          <h4 className="line-clamp-1 font-black">
                            {spot.name}
                          </h4>
                        </Link>

                        <OfferBadges
                          businessId={spot.id}
                          dealId={dealId}
                          hasDeal={hasDeal}
                          hasCoupon={hasCoupon}
                        />
                      </div>

                      <p className="line-clamp-1 text-sm text-gray-600">
                        {spot.category} · {spot.city}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <BottomNav activeNav="home" />
      </main>
    </>
  );
}