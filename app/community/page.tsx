import Link from "next/link";
import { supabase } from "../../lib/supabase";
import CommunityBottomNav from "../components/CommunityBottomNav";
import ProfileButton from "../components/ProfileButton";


import CommunityFeaturedBusinessSlider from "../components/CommunityFeaturedBusinessSlider";
import InstagramAutoCarousel from "../components/InstagramAutoCarousel";


export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CommunityPage() {
  const today = new Date().toISOString().slice(0, 10);
  /**
   * Instagram 게시물은 최초 저장된 posted_at 기준으로
   * 최근 72시간 이내의 게시물만 Community에 표시합니다.
   *
   * Sync를 다시 실행해도 같은 게시물이라면 posted_at은 유지되고
   * fetched_at만 갱신되므로, 3일이 지나면 자동으로 숨겨집니다.
   */
  const instagramCutoff = new Date(
    Date.now() - 3 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: events, error: eventsError } = await supabase
    .from("community_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);

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

  const { data: instagramPosts, error: instagramError } = await supabase
    .from("business_instagram_posts")
    .select(`
      id,
      stored_image_url,
      instagram_post_url,
      posted_at,
      fetched_at,
      business:businesses(
        id,
        name
      )
    `)
    .eq("status", "active")
    .not("stored_image_url", "is", null)
    .not("instagram_post_url", "is", null)
    .not("posted_at", "is", null)
    .gte("posted_at", instagramCutoff)
    .order("posted_at", { ascending: false, nullsFirst: false })
    .limit(100);

  if (instagramError) {
    console.error("community instagram error:", instagramError);
  }

  const latestInstagramPosts = Array.from(
    new Map(
      (instagramPosts ?? []).map((post: any) => {
        const business = Array.isArray(post.business)
          ? post.business[0]
          : post.business;

        return [business?.id ?? post.id, post];
      }),
    ).values(),
  ).slice(0, 12);

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
      <section className="mx-auto max-w-xl px-5 pb-28 pt-6">
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

        {/* Today's Instagram */}
        <InstagramAutoCarousel posts={latestInstagramPosts as any[]} />

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

        {/* Community Deals */}
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

            {!dealCount && (
              <div className="min-w-full rounded-3xl bg-white p-6 text-sm font-bold text-[#6B6257] shadow-sm">
                No community deals yet.
              </div>
            )}
          </div>
        </section>










        <CommunityFeaturedBusinessSlider businesses={featuredBusinesses} />


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
  {biz.image_url ? (
    <img
      src={biz.image_url}
      alt={biz.name || "Business"}
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

      </section>


      <CommunityBottomNav activeNav="community" />
    </main>
	 </>
  );
}