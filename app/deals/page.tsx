// app/deals/page.tsx

import Link from "next/link";
import { supabase } from "../../lib/supabase";
import BottomNav from "../components/BottomNav";
import ProfileButton from "../components/ProfileButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DealsPage() {
  const nowDate = new Date();

  // Raleigh / Triangle 기준 날짜
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(nowDate);

  const { data: deals, error } = await supabase
    .from("deals")
    .select(`
      *,
      businesses (
        name,
        phone
      ),
      deal_items (
        id
      )
    `)
    .eq("status", "approved")
    .eq("active", true)

    // 커뮤니티 딜 제외
    .or("deal_scope.is.null,deal_scope.neq.community")

    // 만료된 Deal도 가져와서 EXPIRED 표시
    .order("created_at", { ascending: false });

  return (
    <>
      <main className="min-h-screen bg-[#F8F3EC] px-2 pb-28 text-[#172033]">
        <div className="mx-auto w-full max-w-2xl">
          <div className="relative mb-4 flex items-center justify-center">
            <Link
              href="/"
              className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl font-black shadow"
            >
              ←
            </Link>

            <h1 className="text-2xl font-black">🔥 Deals</h1>

            <div className="absolute right-0 flex items-center gap-2">
              <Link
                href="/map?view=deals"
                className="rounded-full bg-blue-700 px-3 py-2 text-xs font-black text-white shadow"
              >
                MAP
              </Link>

              <ProfileButton />
            </div>
          </div>

          {error ? (
            <div className="rounded-3xl bg-white p-8 text-center shadow">
              <p className="font-bold text-red-600">
                Deal 불러오기 실패: {error.message}
              </p>
            </div>
          ) : !deals || deals.length === 0 ? (
            <div className="rounded-3xl bg-white p-8 text-center shadow">
              <p className="font-bold text-gray-500">
                등록된 Deal이 없습니다.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {deals.map((deal) => {
                const business = Array.isArray(deal.businesses)
                  ? deal.businesses[0]
                  : deal.businesses;

                const itemCount =
                  1 +
                  (Array.isArray(deal.deal_items)
                    ? deal.deal_items.length
                    : 0);

                // 종료일이 오늘보다 이전이면 만료
                const isExpired =
                  Boolean(deal.end_date) &&
                  String(deal.end_date) < today;

                // 시작일이 아직 안 됐으면 Upcoming
                const isUpcoming =
                  Boolean(deal.start_date) &&
                  String(deal.start_date) > today;

                return (
                  <Link
                    key={deal.id}
                    href={`/deals/${deal.id}`}
                    className={`relative block overflow-hidden rounded-3xl bg-white shadow ${
                      isExpired ? "opacity-70" : ""
                    }`}
                  >
                    {/* EXPIRED 표시 */}
                    {isExpired && (
                      <div className="absolute left-3 top-3 z-20 rounded-full bg-red-600 px-4 py-2 text-xs font-black tracking-wide text-white shadow-lg">
                        EXPIRED
                      </div>
                    )}

                    {/* UPCOMING 표시 */}
                    {!isExpired && isUpcoming && (
                      <div className="absolute left-3 top-3 z-20 rounded-full bg-blue-600 px-4 py-2 text-xs font-black tracking-wide text-white shadow-lg">
                        UPCOMING
                      </div>
                    )}

                    <div
                      className={`relative flex h-44 w-full items-center justify-center bg-white ${
                        isExpired ? "grayscale" : ""
                      }`}
                    >
                      <img
                        src={deal.image_url || "/event.png"}
                        alt={deal.title || "Deal"}
                        className="h-full w-full object-contain"
                      />

                      <div className="absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1 text-xs font-black text-white">
                        1/{itemCount}
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="mb-3 rounded-2xl bg-[#F8F3EC] p-3">
                        <p className="text-base font-black">
                          {business?.name ||
                            deal.business_name ||
                            "Business"}
                        </p>

                        {(business?.phone || deal.phone) && (
                          <p className="mt-1 text-sm font-bold text-blue-600">
                            📞 {business?.phone || deal.phone}
                          </p>
                        )}
                      </div>

                      {isExpired ? (
                        <p className="text-sm font-black text-red-600">
                          EXPIRED · Ended {deal.end_date}
                        </p>
                      ) : isUpcoming ? (
                        <p className="text-sm font-black text-blue-600">
                          Starts {deal.start_date}
                          {deal.end_date
                            ? ` ~ ${deal.end_date}`
                            : ""}
                        </p>
                      ) : (
                        <p className="text-sm font-black text-[#C4483A]">
                          {deal.start_date || "Available Now"}
                          {deal.end_date
                            ? ` ~ ${deal.end_date}`
                            : ""}
                        </p>
                      )}

                      <h2 className="mt-2 text-xl font-black">
                        {deal.title}
                      </h2>

                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-600">
                        {deal.description}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <BottomNav />
      </main>
    </>
  );
}