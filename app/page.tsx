export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import BottomNav from "./components/BottomNav";
import { supabase } from "../lib/supabase";
import ProfileButton from "./components/ProfileButton";
import AuthRefreshWrapper from "./components/AuthRefreshWrapper";
import InstallAppButton from "./components/InstallAppButton";
import FeaturedSponsorSlider from "./components/FeaturedSponsorSlider";

import TodaysKoreaNewsModal from "./components/TodaysKoreaNewsModal";


import ScrollToTopButton from "./components/ScrollToTopButton";

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


function timeTextToMinutes(timeText?: string | null) {
  if (!timeText) return null;

  const match = timeText.match(
    /^(\d{1,2}):(\d{2})\s?(AM|PM)$/i,
  );

  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);

  if (
    match[3].toUpperCase() === "PM" &&
    hour !== 12
  ) {
    hour += 12;
  }

  if (
    match[3].toUpperCase() === "AM" &&
    hour === 12
  ) {
    hour = 0;
  }

  return hour * 60 + minute;
}

function getOpenStatus(hours?: string | null) {
  if (!hours) {
    return {
      open: false,
      text: "Hours not available",
    };
  }

  const now = new Date();

  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "America/New_York",
  }).format(now);

  const currentMinutes = now
    .toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/New_York",
    })
    .split(":")
    .map(Number)
    .reduce((a, b) => a * 60 + b);

  const line = hours
    .split("\n")
    .find((value) => value.trim().startsWith(today));

  if (!line) {
    return {
      open: false,
      text: "Closed",
    };
  }

  if (line.toLowerCase().includes("closed")) {
    return {
      open: false,
      text: "Closed Today",
    };
  }

  const main = line
    .split("/ Break")[0]
    .replace(today, "")
    .trim();

  const [openText, closeText] = main.split(" - ");

  const open = timeTextToMinutes(openText);
  const close = timeTextToMinutes(closeText);

  const isOpen =
    open !== null &&
    close !== null &&
    currentMinutes >= open &&
    currentMinutes < close;

  return {
    open: isOpen,
    text: isOpen ? "Open" : "Closed",
  };
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
      className={`mb-2 flex items-center justify-between gap-3 rounded-xl border px-3 py-2 shadow-sm ${bgColor}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <div className={`h-9 w-1 shrink-0 rounded-full ${color}`} />

        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-500">
            {label}
          </p>

          <h2 className="mt-0.5 break-keep text-[17px] font-black leading-tight text-[#172033]">
            {emoji} {title}
          </h2>
        </div>
      </div>

      {moreHref && (
        <Link
  href={moreHref}
  aria-label="More"
  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-lg font-black text-[#172033] shadow-sm transition hover:bg-gray-50 hover:scale-105"
>
  →
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
      className={`${className} block h-full w-full object-cover object-center`}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: "center",
      }}
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
  const thumbnailUrl =
    typeof spot?.thumbnail_url === "string" &&
    spot.thumbnail_url.trim() !== ""
      ? spot.thumbnail_url
      : null;

  return (
    <img
      src={thumbnailUrl || spot?.image_url || "/event.png"}
      alt={spot?.name || "Business"}
      loading="lazy"
      decoding="async"
      className={`${className} block !h-full !w-full !max-w-none !object-cover !object-center`}
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        minWidth: "100%",
        minHeight: "100%",
        maxWidth: "none",
        objectFit: "cover",
        objectPosition: "center",
      }}
    />
  );
}

function DealMedia({ deal, className }: { deal: any; className: string }) {
  const business = Array.isArray(deal?.businesses)
    ? deal.businesses[0]
    : deal?.businesses;

  const businessThumbnailUrl =
    typeof business?.thumbnail_url === "string" &&
    business.thumbnail_url.trim() !== ""
      ? business.thumbnail_url
      : null;

  const imageUrl =
    deal?.image_url ||
    businessThumbnailUrl ||
    business?.image_url ||
    "/event.png";

  return (
    <img
      src={imageUrl}
      alt={deal?.title || business?.name || "Deal"}
      loading="lazy"
      decoding="async"
      className={`${className} block !h-full !w-full !max-w-none !object-cover !object-center`}
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        maxWidth: "none",
        objectFit: "cover",
        objectPosition: "center",
      }}
    />
  );
}



function formatNewsDate(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  }).format(date);
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

function isFeaturedSponsorFoodCategory(business: any) {
  const categoryValues = [
    ...splitCategories(business?.category),
    ...splitCategories(business?.category_name),
    ...splitCategories(business?.categories),
  ].map((value) => normalizeCategory(value));

  const foodKeywords = [
    "restaurant",
    "restaurants",
    "korean restaurant",
    "bbq",
    "barbecue",
    "korean bbq",
    "bakery",
    "cafe",
    "café",
    "cafe & bakery",
    "coffee",
    "dessert",
    "bubble tea",
    "boba",
    "chicken",
    "fried chicken",
    "noodles",
    "noodle",
    "sushi",
    "food",
    "dining",
    "레스토랑",
    "식당",
    "한식",
    "고기",
    "바베큐",
    "바비큐",
    "빵",
    "베이커리",
    "카페",
    "커피",
    "디저트",
    "치킨",
    "국수",
    "스시",
    "초밥",
    "버블티",
  ];

  return categoryValues.some((category) =>
    foodKeywords.some(
      (keyword) =>
        category === keyword ||
        category.includes(keyword) ||
        keyword.includes(category)
    )
  );
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
   * 홈에서는 grand_openings 테이블에 가장 최근 등록된 항목을
   * 비즈니스 카테고리/메인맵 노출 여부와 관계없이 그대로 표시합니다.
   */
  const { data: allGrandOpenings, error: grandOpeningError } = await supabase
    .from("grand_openings")
    .select("*")
    .eq("show_on_main", true)
    .eq("show_in_list", true)
    .order("created_at", { ascending: false })
    .limit(1);

  if (grandOpeningError) {
    console.error("Grand openings load error:", grandOpeningError);
  }

  const grandOpenings = allGrandOpenings || [];

  /*
   * Business Events:
   * B2B 또는 Hidden 비즈니스에 연결된 이벤트는 제외합니다.
   */
  const { data: allBusinessEvents, error: eventError } = await supabase
    .from("business_events")
    .select("*")
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
        thumbnail_url,
        image_url,
        rating,
        review_count
      )
    `
    )
    .eq("active", true)
    .or("deal_scope.is.null,deal_scope.neq.community")
    .or(`start_date.is.null,start_date.lte.${today}`)
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

      return Boolean(business?.id);
    })
    .slice(0, 1);

  /*
   * Deal badge용 데이터도 Main 허용 비즈니스만 남깁니다.
   */
  const { data: allDealBusinesses, error: dealBusinessesError } =
    await supabase
      .from("deals")
      .select("id, business_id")
        .eq("active", true)
      .or("deal_scope.is.null,deal_scope.neq.community")
      .or(`start_date.is.null,start_date.lte.${today}`)
      .or(`end_date.is.null,end_date.gte.${today}`);

  if (dealBusinessesError) {
    console.error("Deal businesses load error:", dealBusinessesError);
  }

  const dealBusinesses = (allDealBusinesses || []).filter(
    (deal: any) =>
      deal.business_id !== null &&
      deal.business_id !== undefined
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

  const activeCouponCount = couponBusinesses.filter((coupon: any) => {
    const usageLimit = Number(coupon.usage_limit || 0);
    const usedCount = Number(coupon.used_count || 0);
    return !(usageLimit > 0 && usedCount >= usageLimit);
  }).length;

  /*
   * spots에는 Main 허용 비즈니스만 있으므로
   * Featured Sponsor와 Trending에도 B2B/Hidden이 나타나지 않습니다.
   */
  const featuredSponsors = spots
    .filter(
      (spot: any) =>
        spot.featured_sponsor === true &&
        isFeaturedSponsorFoodCategory(spot)
    )
    .sort((a: any, b: any) => {
      const orderDiff =
        Number(a.display_order || 0) - Number(b.display_order || 0);

      if (orderDiff !== 0) return orderDiff;

      return Number(a.id || 0) - Number(b.id || 0);
    });
const trending = [...spots]
  .sort(() => Math.random() - 0.5)
  .slice(0, 10);
 /* const trending = [...spots].sort((a: any, b: any) => {
  *  const aOrder =
  *    a.display_order === null || a.display_order === undefined
  *      ? Number.MAX_SAFE_INTEGER
  *      : Number(a.display_order);
*
 *   const bOrder =
 *     b.display_order === null || b.display_order === undefined
 *       ? Number.MAX_SAFE_INTEGER
 *       : Number(b.display_order);
*
 *   const orderDiff = aOrder - bOrder;
*
  *  if (orderDiff !== 0) return orderDiff;
*
  *  return (
 *     new Date(a.created_at || 0).getTime() -
  *    new Date(b.created_at || 0).getTime()
*    );
*  });  
*/


  /*
   * Today’s Korea:
   * RSS에서 자동 수집된 활성 기사만 가져옵니다.
   * 카테고리별 최신 3개가 is_active = true로 유지됩니다.
   */
  const { data: todaysKoreaPosts, error: todaysKoreaError } =
    await supabase
      .from("todays_korea_posts")
      .select(
        `
          id,
          category,
          title,
          summary,
          source_name,
          source_url,
          image_url,
          published_at
        `
      )
      .eq("is_active", true)
      .order("published_at", {
        ascending: false,
        nullsFirst: false,
      });

  if (todaysKoreaError) {
    console.error("Today’s Korea load error:", todaysKoreaError);
  }

const kpopNews = (todaysKoreaPosts || [])
  .filter((post: any) => post.category === "kpop")
  .slice(0, 12)
  .map((post: any) => ({ ...post, published_at: null }));

const kdramaNews = (todaysKoreaPosts || [])
  .filter((post: any) => post.category === "kdrama")
  .slice(0, 12)
  .map((post: any) => ({ ...post, published_at: null }));

  const mainEvent = businessEvents[0];
  const mainGrandOpening = grandOpenings[0];

  // Latest Grand Opening
  const grandOpeningImage =
    mainGrandOpening?.images?.[0] ||
    mainGrandOpening?.image_url ||
    "/event.png";

  // Keep the existing Coming Soon row (Lotte Plaza Market / business 196)
  const comingSoonBusiness = (allSpots || []).find(
    (business: any) => Number(business.id) === 196
  );

  const comingSoonImage =
    comingSoonBusiness?.thumbnail_url ||
    comingSoonBusiness?.image_url ||
    "/event.png";

  return (
    <>
          <InstallAppButton />
   

      <main className="min-h-[100dvh] w-full max-w-[100vw] overflow-x-hidden bg-[#F8F3EC] px-4 pb-40 pt-6 text-[#172033]">
       <div className="mx-auto mb-1 flex max-w-xl items-center justify-between gap-4">
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


        {(kpopNews.length > 0 || kdramaNews.length > 0) && (
          <section className="mx-auto mb-2 max-w-xl">
            

            <TodaysKoreaNewsModal
              kpopNews={kpopNews}
              kdramaNews={kdramaNews}
            />
          </section>
        )}

        <section className="mx-auto mb-4 max-w-xl">
          <Link
            href="/coupons"
            className="group relative block overflow-hidden rounded-[22px] bg-[#FFFDF8] shadow-sm transition hover:shadow-md active:scale-[0.995]"
          >
            <div className="pointer-events-none absolute inset-[6px] rounded-[16px] border-2 border-dashed border-[#E8B85E]" />

            <div className="flex items-center gap-3 px-4 pb-3 pt-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#112B58] text-[22px] text-white shadow-sm">
                🎟
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[18px] font-black tracking-[-0.02em] text-[#112B58]">
                  KTOWN COUPON BOOK
                </h2>

                <p className="mt-0.5 text-[11px] font-black text-[#C4483A]">
                  Eat · Shop · Save
                </p>

                <p className="mt-0.5 line-clamp-1 text-[10px] font-semibold text-[#6B7280]">
                  Triangle Local Deals in One Place
                </p>
              </div>

              {activeCouponCount > 0 && (
                <div className="shrink-0 rounded-full border border-[#F0D6B5] bg-[#FFF8EC] px-2.5 py-1 text-center">
                  <span className="text-[11px] font-black text-[#C4483A]">
                    {activeCouponCount}
                  </span>
                  <span className="ml-1 text-[8px] font-black uppercase tracking-wide text-[#8A8176]">
                    Coupons
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 px-3 pb-3">
              <div className="rounded-xl border border-[#EFE7DC] bg-white px-2 py-2.5 text-center">
                <p className="text-[13px] font-black text-[#C4483A]">25% OFF</p>
                <p className="mt-0.5 text-[9px] font-bold text-[#6B7280]">Cleaners</p>
              </div>

              <div className="rounded-xl border border-[#EFE7DC] bg-white px-2 py-2.5 text-center">
                <p className="text-[13px] font-black text-[#C4483A]">BOGO</p>
                <p className="mt-0.5 text-[9px] font-bold text-[#6B7280]">Coffee</p>
              </div>

              <div className="rounded-xl border border-[#EFE7DC] bg-white px-2 py-2.5 text-center">
                <p className="text-[13px] font-black text-[#C4483A]">$5 OFF</p>
                <p className="mt-0.5 text-[9px] font-bold text-[#6B7280]">Bakery</p>
              </div>
            </div>

            <div className="px-3 pb-3">
              <span className="flex w-full items-center justify-center rounded-xl bg-[#112B58] px-4 py-2.5 text-[11px] font-black tracking-wide text-white shadow-sm transition group-hover:bg-[#1A3D73]">
                VIEW ALL COUPONS →
              </span>
            </div>
          </Link>
        </section>

        <section className="mx-auto mb-5 max-w-xl">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            {/* 1. GRAND OPENING */}
            {mainGrandOpening && (
              <div className="relative flex min-h-[106px] overflow-hidden border-b border-gray-200 bg-white">
                <div className="absolute bottom-3 left-0 top-3 z-10 w-1 rounded-r-full bg-red-500" />

                <Link
                  href={`/grand-openings/${mainGrandOpening.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 transition hover:bg-red-50/30 active:bg-red-50"
                >
                  <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-[#F8F3EC]">
                    <img
                      src={grandOpeningImage}
                      alt={
                        mainGrandOpening.business_name ||
                        mainGrandOpening.title ||
                        "Grand Opening"
                      }
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover object-center"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-red-50 text-[13px]">🎉</span>
                      <p className="text-[16px] font-black text-red-600">Grand Opening</p>
                    </div>
                    <h2 className="line-clamp-1 text-[17px] font-black text-[#071A3D]">
                      {mainGrandOpening.business_name || mainGrandOpening.title || "Grand Opening"}
                    </h2>
                    <p className="mt-1 line-clamp-1 text-[11px] font-semibold text-gray-500">
                      {mainGrandOpening.title || mainGrandOpening.description || "Now Open"}
                    </p>
                  </div>
                </Link>

                <Link
                  href="/grand-openings"
                  aria-label="View all Grand Openings"
                  className="flex w-12 shrink-0 items-center justify-center border-l border-red-100 bg-red-50/70 text-xl font-black text-red-600 transition hover:bg-red-100 active:bg-red-200"
                >
                  ›
                </Link>
              </div>
            )}

            {/* 2. COMING SOON */}
            {comingSoonBusiness && (
              <div className="relative flex min-h-[106px] overflow-hidden border-b border-gray-200 bg-white">
                <div className="absolute bottom-3 left-0 top-3 z-10 w-1 rounded-r-full bg-blue-500" />

                <Link
                  href={`/business/${comingSoonBusiness.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 transition hover:bg-blue-50/30 active:bg-blue-50"
                >
                  <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-[#F8F3EC]">
                    <img
                      src={comingSoonImage}
                      alt={comingSoonBusiness.name || "Coming Soon"}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover object-center"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-[13px]">🏬</span>
                      <p className="text-[16px] font-black text-blue-600">Coming Soon</p>
                    </div>
                    <h2 className="line-clamp-1 text-[17px] font-black text-[#071A3D]">
                      {comingSoonBusiness.name || "Coming Soon"}
                    </h2>
                    <p className="mt-1 line-clamp-1 text-[11px] font-semibold text-gray-500">
                      {comingSoonBusiness.category || "COMING SOON"}
                      {comingSoonBusiness.city ? `, ${comingSoonBusiness.city}` : ""}
                    </p>
                  </div>
                </Link>

                <Link
                  href="/coming-soon"
                  aria-label="View all Coming Soon"
                  className="flex w-12 shrink-0 items-center justify-center border-l border-blue-100 bg-blue-50/70 text-xl font-black text-blue-600 transition hover:bg-blue-100 active:bg-blue-200"
                >
                  ›
                </Link>
              </div>
            )}

            {/* 3. EVENTS */}
            {mainEvent && (
              <div className="relative flex min-h-[106px] overflow-hidden border-b border-gray-200 bg-white">
                <div className="absolute bottom-3 left-0 top-3 z-10 w-1 rounded-r-full bg-purple-500" />

                <Link
                  href={`/business-events/${mainEvent.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 transition hover:bg-purple-50/30 active:bg-purple-50"
                >
                  <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                    <VideoFirstMedia
                      videoUrl={mainEvent.video_url}
                      imageUrl={mainEvent.image_url || "/event.png"}
                      alt={mainEvent.title || "Business Event"}
                      className="h-full w-full"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-50 text-[13px]">📅</span>
                      <p className="text-[16px] font-black text-purple-600">Events</p>
                    </div>
                    <h3 className="line-clamp-1 text-[17px] font-black text-[#071A3D]">{mainEvent.title}</h3>
                    <p className="mt-1 line-clamp-2 text-[11px] text-gray-500">{mainEvent.description}</p>
                  </div>
                </Link>

                <Link
                  href="/business-events"
                  aria-label="View all Events"
                  className="flex w-12 shrink-0 items-center justify-center border-l border-purple-100 bg-purple-50/70 text-xl font-black text-purple-600 transition hover:bg-purple-100 active:bg-purple-200"
                >
                  ›
                </Link>
              </div>
            )}

            {/* 4. DEALS */}
            {deals.length > 0 ? (
              deals.map((deal) => (
                <div key={deal.id} className="relative flex min-h-[106px] overflow-hidden bg-white">
                  <div className="absolute bottom-3 left-0 top-3 z-10 w-1 rounded-r-full bg-red-500" />

                  <Link
                    href={`/deals/${deal.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 transition hover:bg-red-50/30 active:bg-red-50"
                  >
                    <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-white">
                      <DealMedia deal={deal} className="block h-full w-full object-cover object-center" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-red-50 text-[13px]">🏷️</span>
                        <p className="text-[16px] font-black text-red-600">Deals</p>
                      </div>

                      <div className="flex min-w-0 items-center gap-2">
                        <h4 className="min-w-0 flex-1 line-clamp-1 text-[17px] font-black text-[#071A3D]">
                          {deal.title || deal.businesses?.name || "Deal"}
                        </h4>

                        {(deal.businesses?.rating || deal.businesses?.review_count) && (
                          <div className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px]">
                            <span className="text-yellow-500">⭐</span>
                            <span className="font-bold text-gray-900">
                              {Number(deal.businesses?.rating || 0).toFixed(1)}
                            </span>
                            {deal.businesses?.review_count ? (
                              <span className="text-gray-500">
                                ({Number(deal.businesses.review_count).toLocaleString()} Reviews)
                              </span>
                            ) : null}
                          </div>
                        )}
                      </div>

                      <p className="mt-1 line-clamp-1 text-[11px] font-semibold text-gray-500">
                        {deal.description || "Tap to view deal details"}
                      </p>
                    </div>
                  </Link>

                  <Link
                    href="/deals"
                    aria-label="View all Deals"
                    className="flex w-12 shrink-0 items-center justify-center border-l border-red-100 bg-red-50/70 text-xl font-black text-red-600 transition hover:bg-red-100 active:bg-red-200"
                  >
                    ›
                  </Link>
                </div>
              ))
            ) : (
              <div className="px-5 py-8 text-center text-sm font-bold text-gray-400">
                New deals are coming soon.
              </div>
            )}
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
      const status = getOpenStatus(spot.hours);

      return (
        <div
          key={spot.id}
          className="block rounded-3xl border border-green-100 bg-white p-4 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <Link
              href={`/business/${spot.id}`}
              className="h-28 w-40 shrink-0 overflow-hidden rounded-2xl bg-gray-100"
            >
              <BusinessMedia
                spot={spot}
                className="h-full w-full"
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

              <div className="mt-2 flex flex-wrap items-center gap-1 text-sm">
                <span className="text-yellow-500">⭐</span>

                <span className="font-bold text-gray-900">
                  {Number(spot.rating || 0).toFixed(1)}
                </span>

                {spot.review_count ? (
                  <span className="text-gray-500">
                    ({Number(spot.review_count).toLocaleString()} Reviews)
                  </span>
                ) : (
                  <span className="text-gray-400">No Reviews</span>
                )}

                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-black ${
                    status.open
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {status.text.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    })}
  </div>

  <div className="mt-6">
    <Link
      href="/search"
      className="flex w-full items-center justify-center rounded-2xl border border-[#172033] bg-[#172033] px-5 py-4 text-base font-black text-white shadow-sm transition hover:bg-[#24314d] active:scale-[0.98]"
    >
      🔍 View All Businesses →
    </Link>
  </div>
</section>

        <BottomNav activeNav="home" />
        <ScrollToTopButton />
      </main>
    </>
  );
}