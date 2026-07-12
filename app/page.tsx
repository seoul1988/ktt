export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import BottomNav from "./components/BottomNav";
import { supabase } from "../lib/supabase";
import ProfileButton from "./components/ProfileButton";
import AuthRefreshWrapper from "./components/AuthRefreshWrapper";
import InstallAppButton from "./components/InstallAppButton";
import FeaturedSponsorSlider from "./components/FeaturedSponsorSlider";
import InAppBrowserAlert from "./components/InAppBrowserAlert";

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
      className={`mb-4 flex items-center justify-between gap-3 rounded-2xl border px-3 py-3 shadow-sm ${bgColor}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <div className={`h-9 w-1 shrink-0 rounded-full ${color}`} />

        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-500">
            {label}
          </p>

          <h2 className="mt-0.5 break-keep text-[22px] font-black leading-tight text-[#172033]">
            {emoji} {title}
          </h2>
        </div>
      </div>

      {moreHref && (
        <Link
          href={moreHref}
          className="shrink-0 rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-black text-[#172033] shadow-sm hover:bg-gray-50"
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
        className={`${className} border-0 bg-black`}
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
        preload="metadata"
        className={`${className} bg-black`}
        style={{
          objectFit: "contain",
          objectPosition: "center",
        }}
      />
    );
  }

  return (
    <img
      src={imageUrl || "/event.png"}
      alt={alt}
      className={`${className} bg-white object-contain`}
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


function normalizeCategory(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function splitCategories(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item.trim();

        if (item && typeof item === "object") {
          return String(
            item.name ??
              item.category ??
              item.category_name ??
              ""
          ).trim();
        }

        return "";
      })
      .filter(Boolean);
  }

  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isMainVisibleBusiness(
  business: any,
  allowedCategoryIds: Set<number>,
  allowedCategoryNames: Set<string>
) {
  if (!business) return false;

  const categoryId =
    business.category_id ??
    business.business_category_id ??
    null;

  if (
    categoryId !== null &&
    categoryId !== undefined &&
    categoryId !== ""
  ) {
    return allowedCategoryIds.has(Number(categoryId));
  }

  const categoryValues = [
    ...splitCategories(business.category),
    ...splitCategories(business.category_name),
    ...splitCategories(business.categories),
  ];

  return categoryValues.some((categoryName) =>
    allowedCategoryNames.has(
      normalizeCategory(categoryName)
    )
  );
}





export default async function Home() {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  /*
   * Main App Map이 체크된 카테고리만 허용합니다.
   * show_on_main_map = false인 B2B 전용 및 Hidden 카테고리는 제외됩니다.
   */
  const { data: mainCategories, error: categoryError } = await supabase
    .from("categories")
    .select("id, name")
    .eq("show_on_main_map", true);

  if (categoryError) {
    console.error("Main category load error:", categoryError);
  }

  const allowedCategoryIds = new Set<number>(
    (mainCategories || []).map((category: any) => Number(category.id))
  );

  const allowedCategoryNames = new Set<string>(
    (mainCategories || [])
      .map((category: any) => normalizeCategory(category.name))
      .filter(Boolean)
  );

  /*
   * Main App Map 허용 비즈니스만 홈 화면 데이터에 포함합니다.
   */
  const { data: allSpots, error: spotsError } = await supabase
  .from("businesses")
  .select("*")
  .eq("hidden", false)
  .order("created_at", { ascending: false });

  if (spotsError) {
    console.error("Businesses load error:", spotsError);
  }

  const spots = (allSpots || []).filter((business: any) =>
    isMainVisibleBusiness(
      business,
      allowedCategoryIds,
      allowedCategoryNames
    )
  );

  const visibleBusinessIds = new Set(
    spots
      .map((business: any) => business.id)
      .filter((id: any) => id !== null && id !== undefined)
      .map((id: any) => String(id))
  );

  /*
   * Grand Openings:
   * business_id가 있으면 Main 허용 비즈니스만 표시합니다.
   * business_id가 없는 독립 게시물은 기존처럼 표시합니다.
   */
  const { data: allGrandOpenings, error: grandOpeningError } = await supabase
    .from("grand_openings")
    .select("*")
    .order("created_at", { ascending: false });

  if (grandOpeningError) {
    console.error("Grand openings load error:", grandOpeningError);
  }

  const grandOpenings = (allGrandOpenings || []).filter((opening: any) => {
    if (opening.business_id === null || opening.business_id === undefined) {
      return true;
    }

    return visibleBusinessIds.has(String(opening.business_id));
  });

  /*
   * Business Events:
   * B2B 또는 Hidden 비즈니스에 연결된 이벤트는 제외합니다.
   */
  const { data: allBusinessEvents, error: eventError } = await supabase
    .from("business_events")
    .select("*")
    .eq("status", "approved")
    .eq("active", true)
    .gte("event_date", today)
    .order("event_date", { ascending: true });

  if (eventError) {
    console.error("Business events load error:", eventError);
  }

  const businessEvents = (allBusinessEvents || []).filter((event: any) => {
    if (event.business_id === null || event.business_id === undefined) {
      return true;
    }

    return visibleBusinessIds.has(String(event.business_id));
  });

  /*
   * Active Deals:
   * 연결된 비즈니스가 Main 허용 대상일 때만 표시합니다.
   */
  const { data: allActiveDeals, error: dealsError } = await supabase
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
    .order("created_at", { ascending: false });

  if (dealsError) {
    console.error("Deals load error:", dealsError);
  }

  const deals = (allActiveDeals || [])
    .filter((deal: any) => {
      const business = Array.isArray(deal.businesses)
        ? deal.businesses[0]
        : deal.businesses;

      if (!business?.id) return false;

      return visibleBusinessIds.has(String(business.id));
    })
    .slice(0, 3);

  /*
   * Deal badge용 데이터도 Main 허용 비즈니스만 남깁니다.
   */
  const { data: allDealBusinesses, error: dealBusinessesError } =
    await supabase
      .from("deals")
      .select("id, business_id")
      .eq("status", "approved")
      .eq("active", true)
      .or("deal_scope.is.null,deal_scope.neq.community")
      .lte("start_date", today)
      .or(`end_date.is.null,end_date.gte.${today}`);

  if (dealBusinessesError) {
    console.error("Deal businesses load error:", dealBusinessesError);
  }

  const dealBusinesses = (allDealBusinesses || []).filter(
    (deal: any) =>
      deal.business_id !== null &&
      deal.business_id !== undefined &&
      visibleBusinessIds.has(String(deal.business_id))
  );

  /*
   * Coupon badge용 데이터도 Main 허용 비즈니스만 남깁니다.
   */
  const { data: allCouponBusinesses, error: couponError } = await supabase
    .from("coupons")
    .select("business_id, usage_limit, used_count")
    .eq("active", true)
    .lte("start_date", now)
    .or(`end_date.is.null,end_date.gte.${now}`);

  if (couponError) {
    console.error("Coupons load error:", couponError);
  }

  const couponBusinesses = (allCouponBusinesses || []).filter(
    (coupon: any) =>
      coupon.business_id !== null &&
      coupon.business_id !== undefined &&
      visibleBusinessIds.has(String(coupon.business_id))
  );

  const dealBusinessMap = new Map(
    dealBusinesses
      .filter((deal: any) => deal.business_id && deal.id)
      .map((deal: any) => [deal.business_id, deal.id])
  );

  const couponBusinessIds = new Set(
    couponBusinesses
      .filter((coupon: any) => {
        const usageLimit = Number(coupon.usage_limit || 0);
        const usedCount = Number(coupon.used_count || 0);

        if (usageLimit > 0 && usedCount >= usageLimit) {
          return false;
        }

        return true;
      })
      .map((coupon: any) => coupon.business_id)
      .filter(Boolean)
  );

  /*
   * spots에는 Main 허용 비즈니스만 있으므로
   * Featured Sponsor와 Trending에도 B2B/Hidden이 나타나지 않습니다.
   */
  const featuredSponsors = spots
    .filter((spot: any) => spot.featured_sponsor === true)
    .sort((a: any, b: any) => {
      const orderDiff =
        Number(a.display_order || 0) - Number(b.display_order || 0);

      if (orderDiff !== 0) return orderDiff;

      return Number(a.id || 0) - Number(b.id || 0);
    });

  const trending = spots;

  const mainEvent = businessEvents[0];
  const mainGrandOpening = grandOpenings[0];

  const grandOpeningImage =
    mainGrandOpening?.images?.[0] ||
    mainGrandOpening?.image_url ||
    "/event.png";

  return (
    <>
          <InstallAppButton />
         <InAppBrowserAlert />

      <main className="min-h-[100dvh] w-full max-w-[100vw] overflow-x-hidden bg-[#F8F3EC] px-4 pb-40 pt-6 text-[#172033]">
        <div className="mx-auto mb-8 flex max-w-xl items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#C4483A]">KTT</p>
            <h1 className="text-[30px] font-black leading-tight">KTown Triangle</h1>
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
       <div className="aspect-video w-full overflow-hidden bg-black">
  <VideoFirstMedia
    videoUrl={mainGrandOpening.video_url}
    imageUrl={grandOpeningImage}
    alt={mainGrandOpening.title || "Grand Opening"}
    className="block h-full w-full"
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
                <div className="h-24 w-32 shrink-0 overflow-hidden rounded-2xl bg-white">
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

				{(deal.businesses?.rating || deal.businesses?.review_count) && (
				  <div className="mt-1 flex items-center gap-1 text-sm">
					<span className="text-yellow-500">⭐</span>

					<span className="font-bold text-gray-900">
					  {Number(deal.businesses?.rating || 0).toFixed(1)}
					</span>

					{deal.businesses?.review_count ? (
					  <span className="text-gray-500">
						({Number(deal.businesses.review_count).toLocaleString()} Reviews)
					  </span>
					) : (
					  <span className="text-gray-400">No Reviews</span>
					)}
				  </div>
				)}

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

              <p className="mt-1 line-clamp-1 text-sm text-gray-600">
                {spot.category} · {spot.city}
              </p>

              {(spot.rating || spot.review_count) && (
                <div className="mt-2 flex items-center gap-1 text-sm">
                  <span className="text-yellow-500">⭐</span>

                  <span className="font-bold text-gray-900">
                    {Number(spot.rating || 0).toFixed(1)}
                  </span>

                  {spot.review_count ? (
                    <span className="text-gray-500">
                      ({Number(spot.review_count).toLocaleString()} Reviews)
                    </span>
                  ) : (
                    <span className="text-gray-400">
                      No Reviews
                    </span>
                  )}
                </div>
              )}
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