import Link from "next/link";
import { supabase } from "../../lib/supabase";
import CommunityBottomNav from "../components/CommunityBottomNav";
import ProfileButton from "../components/ProfileButton";


import CommunityFeaturedBusinessSlider from "../components/CommunityFeaturedBusinessSlider";
import CommunityNewsCarousel from "../components/CommunityNewsCarousel";
import CommunityAdsSlider from "../components/CommunityAdsSlider";


export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CommunityPage() {
  const today = new Date().toISOString().slice(0, 10);
  const { data: events, error: eventsError } = await supabase
    .from("community_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);

  if (eventsError) {
    console.error("community events error:", eventsError);
  }

  // Community Grand Opening:
  // 커뮤니티 + 리스트에 모두 체크된 항목 중 가장 최근 1개만 표시합니다.
  const { data: grandOpeningData, error: grandOpeningError } = await supabase
    .from("grand_openings")
    .select("*")
    .eq("show_on_community", true)
    .eq("show_in_list", true)
    // Sale / Event End Date가 없으면 계속 표시,
    // 날짜가 있으면 오늘까지 포함해서 표시하고 다음 날부터 숨깁니다.
    .or(`end_date.is.null,end_date.gte.${today}`)
    .order("created_at", { ascending: false })
    .limit(1);

  if (grandOpeningError) {
    console.error("community grand opening error:", grandOpeningError);
  }

  const latestGrandOpening = grandOpeningData?.[0] ?? null;
  const grandOpeningImage =
    latestGrandOpening?.images?.[0] ||
    latestGrandOpening?.image_url ||
    "/event.png";

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

  const now = new Date().toISOString();

  const { data: communityCoupons, error: communityCouponsError } = await supabase
    .from("coupons")
    .select("id,business_id,usage_limit,used_count,active,start_date,end_date")
    .eq("active", true)
    .lte("start_date", now)
    .or(`end_date.is.null,end_date.gte.${now}`);

  if (communityCouponsError) {
    console.error("community coupons error:", communityCouponsError);
  }

  const activeCouponCount = (communityCoupons || []).filter((coupon: any) => {
    const usageLimit = Number(coupon.usage_limit || 0);
    const usedCount = Number(coupon.used_count || 0);

    return !(usageLimit > 0 && usedCount >= usageLimit);
  }).length;

  // 두 번째 소스: /community/news에 직접 등록된 뉴스/공연·문화.
  // 위의 자동 Community News(community_news)가 아니라 business_news에서
  // 가장 최근 등록된 1건을 가져옵니다.
  const { data: registeredNewsData, error: registeredNewsError } =
    await supabase
      .from("business_news")
      .select(
        "id, title, summary, category, image_url, published_at, published",
      )
      .order("id", { ascending: false })
      .limit(1);

  if (registeredNewsError) {
    console.error("registered news/culture error:", registeredNewsError);
  }

  const latestRegisteredNews = registeredNewsData?.[0] ?? null;

  const newsSelect =
    "id, region, source, title, summary, article_url, image_url, published_at";

  const [
    { data: koreaNewsData, error: koreaNewsError },
    { data: usNewsData, error: usNewsError },
  ] = await Promise.all([
    supabase
      .from("community_news")
      .select(newsSelect)
      .eq("region", "korea")
      .eq("active", true)
      .order("published_at", {
        ascending: false,
        nullsFirst: false,
      })
      .limit(12),

    supabase
      .from("community_news")
      .select(newsSelect)
      .eq("region", "us")
      .eq("active", true)
      .order("published_at", {
        ascending: false,
        nullsFirst: false,
      })
      .limit(12),
  ]);

  if (koreaNewsError) {
    console.error("community korea news error:", {
      message: koreaNewsError.message,
      details: koreaNewsError.details,
      hint: koreaNewsError.hint,
      code: koreaNewsError.code,
    });
  }

  if (usNewsError) {
    console.error("community us news error:", {
      message: usNewsError.message,
      details: usNewsError.details,
      hint: usNewsError.hint,
      code: usNewsError.code,
    });
  }

  const koreaNews = koreaNewsData ?? [];
  const usNews = usNewsData ?? [];

  // Latest 5 ads for the Community page
  const { data: latestAdsData, error: latestAdsError } = await supabase
    .from("ads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  if (latestAdsError) {
    console.error("community ads error:", latestAdsError);
  }

  const latestAds = (latestAdsData ?? []).filter((ad: any) =>
    Boolean(
      ad?.image_url ||
      ad?.image ||
      ad?.banner_url ||
      ad?.thumbnail_url
    ),
  );

  const { data: allBusinesses } = await supabase
    .from("businesses")
    .select("*")
    .order("created_at", { ascending: false });

  /*
   * categories 테이블에는 hidden 컬럼이 없으므로 조회하지 않습니다.
   * Community Map에 표시되는 카테고리만 가져옵니다.
   */
  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select("name, show_on_community_map")
    .eq("show_on_community_map", true);

  if (categoriesError) {
    console.error(
      "community categories error:",
      categoriesError.message,
      categoriesError.code,
    );
  }

  const communityCategoryNames = new Set(
    (categories ?? [])
      .map((cat) => String(cat.name ?? "").trim().toLowerCase())
      .filter(Boolean),
  );








  function getBusinessCategoryNames(biz: any): string[] {
    const values = [
      biz.category,
      biz.category_name,
      biz.categories,
    ];

    return values
      .flatMap((value) => {
        if (Array.isArray(value)) {
          return value.map((item) => {
            if (typeof item === "string") {
              return item;
            }

            if (item && typeof item === "object") {
              return (
                item.name ??
                item.category ??
                item.category_name ??
                ""
              );
            }

            return "";
          });
        }

        return String(value ?? "").split(",");
      })
      .map((category) => String(category).trim().toLowerCase())
      .filter(Boolean);
  }

  const newBusinesses =
    (allBusinesses ?? [])
      .filter((biz) =>
        getBusinessCategoryNames(biz).some((category) =>
          communityCategoryNames.has(category),
        ),
      )
      .slice(0, 6);

  const featuredBusinesses =
    (allBusinesses ?? [])
      .filter((biz) => {
        const isCommunityCategory = getBusinessCategoryNames(biz).some(
          (category) => communityCategoryNames.has(category),
        );

        return isCommunityCategory && biz.featured_sponsor === true;
      })
      .slice(0, 3);

  const eventCount = events?.length || 0;
  const dealCount = deals?.length || 0;

  return (
  <>
  
  
    <main className="min-h-screen bg-[#F8F3EC] text-[#172033]">
      <section className="mx-auto max-w-2xl px-5 pb-28 pt-6">
        <div className="mb-6 flex items-start justify-between gap-4">
  <div>
    <p className="text-sm font-black text-[#C4483A]">
      COMMUNITY
    </p>

    <h1 className="text-3xl font-black tracking-tight">
      KTown Triangle
    </h1>

    <p className="mt-2 text-sm font-semibold text-[#6B6257]">
      Discover Korean businesses.
    </p>
  </div>

<div className="flex items-center gap-3">
  <Link
  href="https://kacctriangle.org"
  target="_blank"
>
  <img
    src="/kacc-logo.png"
    alt="KACC Raleigh"
    className="h-19 w-19 rounded-full object-contain cursor-pointer"
  />
</Link>




  <ProfileButton />
</div>
</div>

        {/* Korea / US News */}
        <CommunityNewsCarousel
          koreaNews={koreaNews as any[]}
          usNews={usNews as any[]}
        />

        {/* Community Traffic Snapshot - 2026-08-14 10 PM */}
        <Link
          href="/community/traffic"
          className="mb-5 block overflow-hidden rounded-[22px] border border-[#F0DFC5] bg-[#FFF9EF] px-3 py-4 shadow-sm transition hover:shadow-md active:scale-[0.995]"
          aria-label="KTown Triangle 방문자 통계 실제 캡처 보기"
        >
          <div className="text-center">
            <h2 className="text-[15px] font-black tracking-[-0.02em] text-[#172033]">
              🔥 KTown Triangle 이용 현황
            </h2>
            <p className="mt-0.5 text-[9px] font-semibold text-[#6B6257]">
              KTown Triangle Community is Growing!
            </p>
          </div>

          <div className="mt-4 grid grid-cols-4 divide-x divide-[#E7DCCB]">
            <div className="px-1 text-center">
              <div className="text-[18px] leading-none">👥</div>
              <p className="mt-1 text-[21px] font-black leading-none text-[#6D28D9]">193</p>
              <p className="mt-2 text-[9px] font-black leading-tight text-[#172033]">오늘 방문자 수</p>
              <p className="mt-0.5 text-[8px] font-bold leading-tight text-[#6B6257]">(중복 제외)</p>
            </div>

            <div className="px-1 text-center">
              <div className="text-[18px] leading-none">👣</div>
              <p className="mt-1 text-[21px] font-black leading-none text-[#0F9F6E]">465</p>
              <p className="mt-2 text-[9px] font-black leading-tight text-[#172033]">오늘 페이지뷰</p>
            </div>

            <div className="px-1 text-center">
              <div className="text-[18px] leading-none">👥</div>
              <p className="mt-1 text-[21px] font-black leading-none text-[#1473E6]">3,743</p>
              <p className="mt-2 text-[9px] font-black leading-tight text-[#172033]">7/12 이후 방문자 수</p>
              <p className="mt-0.5 text-[8px] font-bold leading-tight text-[#6B6257]">(중복 제외)</p>
            </div>

            <div className="px-1 text-center">
              <div className="text-[18px] leading-none">📈</div>
              <p className="mt-1 text-[21px] font-black leading-none text-[#F97316]">12,749</p>
              <p className="mt-2 text-[9px] font-black leading-tight text-[#172033]">총 페이지뷰</p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 text-[11px] font-semibold text-[#7C746A] sm:text-[12px]">
            <span>2026. 07. 12 ~ 2026. 08. 14 · 10 PM 기준</span>
            <span className="font-black text-[11px] text-[#C4483A] sm:text-[12px]">
              캡처 보기 →
            </span>
          </div>
        </Link>

        {/* KTown Coupon Book */}
        <section className="mb-5">
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

        {/* Upcoming Events */}
        <section className="mb-8 overflow-hidden rounded-3xl border border-[#F3CFC7] bg-[#FCE7E2] p-3 shadow-sm">
          <div className="mb-4 flex items-center justify-between rounded-2xl px-2 py-2">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#F3CFC7] bg-white text-xl shadow-sm">
                🎉
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-wide text-[#C4483A]">
                  Events
                </p>

                <h2 className="text-xl font-black text-[#172033]">
                  Upcoming Events
                </h2>
              </div>
            </div>

            <Link
              href="/community/events"
              className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#C4483A] shadow-sm"
            >
             →
            </Link>
          </div>

          <div
            className={
              eventCount === 1
                ? "grid grid-cols-1 gap-4"
                : "flex gap-4 overflow-x-auto pb-1"
            }
          >
            {events?.map((event) => (
              <Link
                key={event.id}
                href={`/community/events/${event.id}`}
                className={
                  eventCount === 1
                    ? "overflow-hidden rounded-3xl bg-white shadow-sm"
                    : "min-w-[260px] overflow-hidden rounded-3xl bg-white text-[#172033] shadow-sm"
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

                  <div className="absolute left-3 top-3 rounded-full bg-[#C4483A] px-3 py-1 text-[10px] font-black text-white shadow-lg">
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

                  <p className="mt-2 text-xs font-bold text-[#6B6257]">
                    {event.event_date
                      ? new Date(event.event_date).toLocaleDateString()
                      : "Date TBA"}
                  </p>

                  <p className="mt-1 line-clamp-1 text-xs font-semibold text-[#6B6257]">
                    {event.location || event.address || "Location TBA"}
                  </p>

                  {event.entry_fee && (
                    <p className="mt-2 text-sm font-black text-[#C4483A]">
                      🎟 {event.entry_fee}
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

        {/* Grand Opening — latest community/list enabled item */}
        {latestGrandOpening && (
          <section className="mb-8 overflow-hidden rounded-3xl border border-[#F3CFC7] bg-[#FFF1EE] p-3 shadow-sm">
            <div className="mb-4 flex items-center justify-between rounded-2xl px-2 py-2">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#F3CFC7] bg-white text-xl shadow-sm">
                  🎉
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-wide text-[#C4483A]">
                    Grand Opening
                  </p>

                  <h2 className="text-xl font-black text-[#172033]">
                    Grand Opening
                  </h2>
                </div>
              </div>

              <Link
                href="/grand-openings"
                className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#C4483A] shadow-sm"
              >
                →
              </Link>
            </div>

            <Link
              href={`/grand-openings/${latestGrandOpening.id}`}
              className="block overflow-hidden rounded-3xl bg-white text-[#172033] shadow-sm"
            >
              <div className="relative h-64 w-full overflow-hidden bg-[#E8DED1]">
                <img
                  src={grandOpeningImage}
                  alt={
                    latestGrandOpening.business_name ||
                    latestGrandOpening.title ||
                    "Grand Opening"
                  }
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />

                <div className="absolute left-3 top-3 rounded-full bg-[#C4483A] px-3 py-1 text-[10px] font-black text-white shadow-lg">
                  GRAND OPENING
                </div>
              </div>

              <div className="p-5">
                <h3 className="line-clamp-2 text-2xl font-black leading-tight">
                  {latestGrandOpening.business_name ||
                    latestGrandOpening.title ||
                    "Grand Opening"}
                </h3>
              </div>
            </Link>
          </section>
        )}

        {/* Community Deals / fallback: latest News & Performance */}
        {dealCount > 0 ? (
          <section className="mb-8 overflow-hidden rounded-3xl border border-[#F1DEAB] bg-[#FFF4D8] p-3 shadow-sm">
            <div className="mb-4 flex items-center justify-between rounded-2xl px-2 py-2">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#F1DEAB] bg-white text-xl shadow-sm">
                  🏷️
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-wide text-[#B98000]">
                    Deals
                  </p>

                  <h2 className="text-xl font-black text-[#172033]">
                    Community Deals
                  </h2>
                </div>
              </div>

              <Link
                href="/community/deals"
                className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#B98000] shadow-sm"
              >
                →
              </Link>
            </div>

            <div
              className={
                dealCount === 1
                  ? "grid grid-cols-1 gap-4"
                  : "flex gap-4 overflow-x-auto pb-1"
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

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="line-clamp-1 text-sm font-bold text-[#6B6257]">
                        {deal.business_name ||
                          deal.business ||
                          deal.store_name ||
                          "Local Business"}
                      </p>

                      {deal.end_date && (
                        <span className="shrink-0 text-xs font-black text-[#C4483A]">
                          Ends {new Date(deal.end_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : (
          <section className="mb-8 overflow-hidden rounded-3xl border border-[#CBD7EA] bg-[#EAF0FA] p-3 shadow-sm">
            <div className="mb-4 flex items-center justify-between rounded-2xl px-2 py-2">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#CBD7EA] bg-white text-xl shadow-sm">
                  📰
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-wide text-[#465B7A]">
                    REGISTERED NEWS
                  </p>

                  <h2 className="text-xl font-black text-[#172033]">
                    {latestRegisteredNews?.category || "등록 뉴스"}
                  </h2>
                </div>
              </div>

              <Link
                href="/community/news"
                className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#465B7A] shadow-sm"
              >
                →
              </Link>
            </div>

            {latestRegisteredNews ? (
              <Link
                href={`/community/news/${latestRegisteredNews.id}`}
                className="block overflow-hidden rounded-3xl bg-white text-[#172033] shadow-sm"
              >
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#DDE5F0]">
                  {latestRegisteredNews.image_url ? (
                    <img
                      src={latestRegisteredNews.image_url}
                      alt={latestRegisteredNews.title || latestRegisteredNews.category || "등록 뉴스"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-5xl">
                      📰
                    </div>
                  )}

                  <div className="absolute left-3 top-3 rounded-full bg-[#2A3448] px-3 py-1 text-[10px] font-black text-white shadow-lg">
                    LATEST
                  </div>
                </div>

                <div className="p-4">
                  <h3 className="line-clamp-3 text-xl font-black leading-tight">
                    {latestRegisteredNews.title || latestRegisteredNews.category || "등록 뉴스"}
                  </h3>
                </div>
              </Link>
            ) : (
              <Link
                href="/community/news"
                className="flex min-h-[180px] items-center justify-center rounded-3xl bg-white p-6 text-center shadow-sm"
              >
                <div>
                  <div className="text-4xl">📰</div>
                  <p className="mt-3 text-lg font-black text-[#172033]">
                    등록 뉴스
                  </p>
                  <p className="mt-2 text-sm font-bold text-[#6B6257]">
                    새 소식이 등록되면 여기에 가장 최근 소식이 표시됩니다.
                  </p>
                </div>
              </Link>
            )}
          </section>
        )}


        {/* Featured Sponsor */}
        <div className="relative mb-8">
          <Link
            href="/community/sponsors"
            aria-label="View all featured sponsors"
            className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-[#C4483A] text-sm font-black text-white shadow-lg transition hover:bg-[#A8382D] active:scale-[0.98]"
          >
            →
          </Link>

          <CommunityFeaturedBusinessSlider businesses={featuredBusinesses} />
        </div>

        {/* Latest Ads */}
        {latestAds.length > 0 && (
          <div className="relative mb-8">
            <Link
              href="/ads"
              aria-label="View all local ads"
              className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-[#C4483A] text-sm font-black text-white shadow-lg transition hover:bg-[#A8382D] active:scale-[0.98]"
            >
              →
            </Link>

            <CommunityAdsSlider ads={latestAds as any[]} />
          </div>
        )}

        {/* New in Raleigh */}
        <section className="mb-8 overflow-hidden rounded-3xl border border-[#CBD7EA] bg-[#EAF0FA] p-3 shadow-sm">
          <div className="mb-4 flex items-center justify-between rounded-2xl px-2 py-2">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2A3448] text-sm font-black text-white shadow-sm">
                NEW
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-wide text-[#2A3448]">
                  New
                </p>

                <h2 className="text-xl font-black text-[#172033]">
                  New in Raleigh
                </h2>
              </div>
            </div>

            <Link
              href="https://www.ktowntriangle.com/community/directory"
              className="rounded-full bg-[#C4483A] px-4 py-2 text-xs font-black text-white shadow-lg transition hover:bg-[#A8382D]"
            >
              모두보기
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {newBusinesses?.map((biz) => (
              <Link
                key={biz.id}
                href={`/business/${biz.id}?from=community`}
                className="overflow-hidden rounded-3xl bg-white text-[#172033] shadow-sm"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#E8DED1]">
                  {biz.thumbnail_url || biz.image_url ? (
                    <img
                      src={biz.thumbnail_url || biz.image_url}
                      alt={biz.name || "Business"}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 block h-full w-full object-cover"
                      style={{ objectFit: "cover" }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-black text-[#6B6257]">
                      No Photo
                    </div>
                  )}

                  <div className="absolute left-3 top-3 rounded-full bg-[#2A3448] px-3 py-1 text-[10px] font-black text-white shadow-lg">
                    NEW
                  </div>
                </div>

                <div className="p-3">
                  <h3 className="line-clamp-1 text-sm font-black">
                    {biz.name}
                  </h3>

                  <div className="mt-1 flex items-center justify-between gap-2">
  <p className="line-clamp-1 text-xs font-semibold text-[#6B6257]">
    {biz.category || "Business"}
  </p>

  <div className="shrink-0 text-xs">
    <span className="font-black text-[#B98000]">
      ★ {biz.rating || "New"}
    </span>

    {biz.review_count ? (
      <span className="ml-1 text-[#6B6257]">
        ({biz.review_count})
      </span>
    ) : null}
  </div>
</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
 <div className="mt-6">
    <Link
      href="community/search"
      className="flex w-full items-center justify-center rounded-2xl border border-[#172033] bg-[#172033] px-5 py-4 text-base font-black text-white shadow-sm transition hover:bg-[#24314d] active:scale-[0.98]"
    >
      🔍 Business Search →
    </Link>
  </div>
      </section>


      <div id="community-bottom-nav-wrapper">
  <CommunityBottomNav activeNav="community" />
</div>
    </main>
	 </>
  );
}