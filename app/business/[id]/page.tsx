import Link from "next/link";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { supabase } from "../../../lib/supabase";
import BottomNav from "../../components/BottomNav";
import CommunityBottomNav from "../../components/CommunityBottomNav";
import BusinessMediaViewer from "../../components/BusinessMediaViewer";
import ProfileButton from "../../components/ProfileButton";
import BusinessCouponPopup from "../../components/BusinessCouponPopup";


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

function getTodayHours(hours?: string | null) {
  if (!hours) return "Hours not available";

  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "America/New_York",
  }).format(new Date());

  return (
    hours
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.startsWith(today)) ||
    "Hours not available"
  );
}

type SearchParams = Promise<{
  from?: string;
}>;

function normalizeCategory(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/s$/, "");
}

async function createAuthenticatedSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },

        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[],
        ) {
          try {
            cookiesToSet.forEach(
              ({ name, value, options }) => {
                cookieStore.set(
                  name,
                  value,
                  options,
                );
              },
            );
          } catch {
            /*
              Server Component 렌더링 중에는
              쿠키 변경이 허용되지 않을 수 있습니다.
            */
          }
        },
      },
    },
  );
}

export default async function BusinessPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { from } = await searchParams;

  /*
   * 로그인 사용자 확인용 Supabase 클라이언트
   */
  const authSupabase =
    await createAuthenticatedSupabaseClient();

  const {
    data: { user },
  } = await authSupabase.auth.getUser();

  /*
   * 비즈니스 정보
   */
  const { data: spot, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", id)
    .single();

  if (!spot || error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8F3EC]">
        <div className="text-center">
          <p className="text-lg font-extrabold text-[#172033]">
            Business not found
          </p>

          <Link
            href="/map"
            className="mt-4 inline-block rounded-full bg-[#172033] px-5 py-2 text-sm font-bold text-white"
          >
            Back to Map
          </Link>
        </div>
      </main>
    );
  }

  /*
   * 관리자 권한 확인
   */
  let userRole: string | null = null;

  if (user) {
    const { data: profile } = await authSupabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    userRole = profile?.role || null;
  }

  const isAdmin =
    userRole === "admin" ||
    userRole === "super_admin";

  /*
   * 비즈니스 오너 확인
   *
   * businesses 테이블에 owner_id 또는 user_id 중
   * 실제 사용하는 컬럼과 로그인 user.id를 비교합니다.
   */
  const isOwner =
    Boolean(user?.id) &&
    (spot.owner_id === user?.id ||
      spot.user_id === user?.id);

  const canManage = isOwner || isAdmin;

  /*
   * Community Map 카테고리
   */
  const { data: communityCategories } =
    await supabase
      .from("categories")
      .select("name")
      .eq("show_on_community_map", true);

  const spotCategories = String(
    spot.category || "",
  )
    .split(",")
    .map((item) => normalizeCategory(item))
    .filter(Boolean);

  const communityCategoryNames = (
    communityCategories || []
  ).map((category) =>
    normalizeCategory(category.name || ""),
  );

  const categoryMatchesCommunity =
    spotCategories.some((category) =>
      communityCategoryNames.includes(category),
    );

  const isCommunityBusiness =
    from === "community" ||
    from === "community-map" ||
    categoryMatchesCommunity;

  /*
   * Back 버튼 경로
   */
  const backHref =
    from === "community-map"
      ? "/community/map"
      : from === "community"
        ? "/community"
        : "/map";

  /*
   * 쿠폰
   */
  const now = new Date().toISOString();

  const { data: coupons } = await supabase
    .from("coupons")
    .select("*")
    .eq("business_id", id)
    .eq("active", true)
    .eq("status", "approved")
    .or(`end_date.is.null,end_date.gte.${now}`)
    .order("id", { ascending: false });

  const availableCoupons = (
    coupons || []
  ).filter((coupon) => {
    const usageLimit = Number(
      coupon.usage_limit || 0,
    );

    const usedCount = Number(
      coupon.used_count || 0,
    );

    if (
      usageLimit > 0 &&
      usedCount >= usageLimit
    ) {
      return false;
    }

    return true;
  });

  /*
   * 이미지
   */
  const images =
    spot.image_urls &&
    Array.isArray(spot.image_urls) &&
    spot.image_urls.length > 0
      ? spot.image_urls
      : [
          spot.image_url,
          spot.image_url_2,
          spot.image_url_3,
        ].filter(Boolean);

  /*
   * 비디오
   */
  const uploadedVideos =
    spot.video_urls &&
    Array.isArray(spot.video_urls) &&
    spot.video_urls.length > 0
      ? spot.video_urls
      : [];

  const videos = [
    ...uploadedVideos,
    ...(spot.external_video_url
      ? [spot.external_video_url]
      : []),
  ].filter(Boolean);

  const status = getOpenStatus(spot.hours);
  const todayHours = getTodayHours(spot.hours);

  return (
    <main className="min-h-screen bg-[#F8F3EC] pb-28 text-[#172033]">
      <div className="mx-auto max-w-xl">
        <header className="sticky top-0 z-50 bg-[#F8F3EC]/95 shadow-sm backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-3 px-4">
            <Link
              href={backHref}
              className="shrink-0 text-sm font-extrabold text-[#172033]"
            >
              ← Back
            </Link>

            <h1 className="min-w-0 flex-1 truncate text-center text-lg font-extrabold">
              {spot.name}
            </h1>

            <div className="flex h-10 w-10 shrink-0 items-center justify-center">
              <ProfileButton />
            </div>
          </div>
        </header>

        <BusinessMediaViewer
          images={images}
          videos={videos}
          name={spot.name}
        />

        <section className="px-5 pb-32 pt-5">
          {/* 카테고리, 도시, 영업 상태, 관리 버튼 */}
          <div className="flex w-full items-center gap-3">
            <p className="min-w-0 flex-1 text-sm text-gray-600">
              {spot.category} · {spot.city || "Triangle"} ·{" "}
              <span
                className={
                  status.open
                    ? "font-bold text-green-600"
                    : "font-bold text-red-500"
                }
              >
                {status.text}
              </span>
            </p>

            {canManage && (
              <div className="ml-auto flex shrink-0 gap-2">
                <Link
                  href={`/business/${spot.id}/edit`}
                  className="rounded bg-blue-600 px-3 py-1 text-xs font-bold text-white"
                >
                  Edit
                </Link>

                <button
                  type="button"
                  className="rounded bg-red-600 px-3 py-1 text-xs font-bold text-white"
                >
                  Delete
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 grid grid-cols-4 text-center text-xs font-semibold text-gray-700">
            <a
              href={
                spot.phone
                  ? `tel:${spot.phone}`
                  : "#"
              }
            >
              <div className="text-3xl">☎</div>
              Call
            </a>

            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                spot.address ||
                  `${spot.name} ${
                    spot.city || ""
                  } NC`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="text-3xl">↱</div>
              Directions
            </a>

            <a
              href={`sms:?&body=${encodeURIComponent(
                `${spot.name} - ${
                  spot.address ||
                  spot.city ||
                  "Triangle Area"
                } ${spot.website_url || ""}`,
              )}`}
            >
              <div className="text-3xl">⌲</div>
              Share
            </a>

            <div className="text-center">
              <div className="text-3xl">⭐</div>

              <div className="font-bold">
                {spot.rating
                  ? Number(
                      spot.rating,
                    ).toFixed(1)
                  : "-"}
              </div>

              <div className="text-[10px] text-gray-500">
                {spot.review_count
                  ? `(${spot.review_count})`
                  : ""}
              </div>
            </div>
          </div>

          <hr className="my-5 border-gray-200" />

          <div className="space-y-2 text-[15px] leading-5">
            <p>
              <span className="font-semibold">
                Address:{" "}
              </span>

              {spot.address ||
                "Address not available"}
            </p>

            <div>
              <span className="font-semibold">Hours:</span>

              <div className="mt-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
                <p className="font-semibold text-[#172033]">
                  {todayHours}
                </p>

                {spot.hours && spot.hours.trim() !== todayHours.trim() && (
                  <details className="group mt-2">
                    <summary className="cursor-pointer list-none text-sm font-black text-[#C4483A]">
                      <span className="group-open:hidden">View All Hours ▼</span>
                      <span className="hidden group-open:inline">Hide Hours ▲</span>
                    </summary>

                    <div className="mt-3 whitespace-pre-wrap border-t border-gray-200 pt-3 font-sans text-sm leading-6 text-gray-700">
                      {spot.hours}
                    </div>
                  </details>
                )}
              </div>
            </div>

            {spot.break_start &&
              spot.break_end && (
                <p>
                  <span className="font-semibold">
                    Break Time:{" "}
                  </span>

                  {spot.break_start} –{" "}
                  {spot.break_end}
                </p>
              )}

            {spot.closed_days && (
              <p>
                <span className="font-semibold">
                  Closed:{" "}
                </span>

                Every {spot.closed_days}
              </p>
            )}

            <p>
              <span className="font-semibold">
                Phone:{" "}
              </span>

              {spot.phone || "Not available"}
            </p>

            {spot.website_url && (
              <p>
                <span className="font-semibold">
                  Website:{" "}
                </span>

                <a
                  href={spot.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-words text-[#2453A6] underline"
                >
                  {spot.website_url}
                </a>
              </p>
            )}

            {spot.instagram_url && (
              <p>
                <span className="font-semibold">
                  Instagram:{" "}
                </span>

                <a
                  href={spot.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-words text-[#2453A6] underline"
                >
                  {spot.instagram_url}
                </a>
              </p>
            )}
          </div>

          <hr className="my-5 border-gray-200" />

          <section>
            <h2 className="mb-3 text-xl font-extrabold">
              Menu
            </h2>

            <div className="space-y-1 text-[15px] leading-6">
              {spot.menu_item_1 && (
                <p>
                  {spot.menu_item_1} -{" "}
                  {spot.menu_price_1 ||
                    "Price not listed"}
                </p>
              )}

              {spot.menu_item_2 && (
                <p>
                  {spot.menu_item_2} -{" "}
                  {spot.menu_price_2 ||
                    "Price not listed"}
                </p>
              )}

              {spot.menu_item_3 && (
                <p>
                  {spot.menu_item_3} -{" "}
                  {spot.menu_price_3 ||
                    "Price not listed"}
                </p>
              )}

              {!spot.menu_item_1 &&
                !spot.menu_item_2 &&
                !spot.menu_item_3 && (
                  <p className="text-gray-600">
                    Menu information is not
                    available yet.
                  </p>
                )}
            </div>

            {spot.menu_url && (
              <a
                href={spot.menu_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block font-bold text-[#C4483A] underline"
              >
                View Full Menu
              </a>
            )}
          </section>

          <hr className="my-5 border-gray-200" />

          <section>
            <h2 className="mb-3 text-xl font-extrabold">
              About
            </h2>

            <p className="leading-7 text-gray-700">
              {spot.description ||
                "No description yet."}
            </p>
          </section>

          {availableCoupons.length > 0 && (
            <BusinessCouponPopup
              coupons={availableCoupons}
            />
          )}
        </section>
      </div>

      {isCommunityBusiness ? (
        <CommunityBottomNav activeNav="community" />
      ) : (
        <BottomNav activeNav="map" />
      )}
    </main>
  );
}