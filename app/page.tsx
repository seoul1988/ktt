export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import BottomNav from "./components/BottomNav";
import { supabase } from "../lib/supabase";
import ProfileButton from "./components/ProfileButton";
import AuthRefreshWrapper from "./components/AuthRefreshWrapper";
import InstallAppButton from "./components/InstallAppButton";

function getFirstVideoUrl(spot: any) {
  if (Array.isArray(spot.video_urls) && spot.video_urls.length > 0) {
    return spot.video_urls.find((url: string) => url && url.trim()) || "";
  }

  return "";
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

export default async function Home() {
  const { data: spots } = await supabase
    .from("businesses")
    .select("*")
    .order("id", { ascending: true });

  // business_id가 없는 이벤트도 보여야 하므로 businesses 조인을 사용하지 않습니다.
  const { data: businessEvents } = await supabase
    .from("business_events")
    .select("*")
    .eq("status", "approved")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1);

  const featured = spots?.[0];
  const deals = spots?.slice(0, 3) || [];
  const trending = spots || [];
  const mainEvent = businessEvents?.[0];

  return (
    <>
      <InstallAppButton />

      <main className="min-h-screen bg-[#F8F3EC] px-5 pb-40 pt-8 text-[#172033]">
        <div className="mb-8 flex items-center justify-between gap-4">
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
  <section className="mb-8">
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-xl font-bold">🎉 Business Events</h2>

      <Link
        href="/business-events"
        className="rounded-full bg-white px-4 py-2 text-sm font-black text-[#172033] shadow"
      >
        More
      </Link>
    </div>

    <Link
      href="/business-events"
      className="block overflow-hidden rounded-3xl bg-white shadow-xl"
    >
     <div className="h-64 w-full bg-white">
  <img
    src={mainEvent.image_url || "/event.png"}
    alt={mainEvent.title || "Business Event"}
    className="h-full w-full object-contain"
  />
</div>

      <div className="p-3">
        <p className="text-xs font-bold text-[#C4483A]">
          {mainEvent.event_date || "Coming Soon"}
        </p>

        <h3 className="mt-1 text-lg font-bold">
          {mainEvent.title}
        </h3>

        <p className="mt-1 line-clamp-1 text-xs text-gray-600">
          {mainEvent.description}
        </p>
      </div>
    </Link>
  </section>
)}

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-bold">🔥 Deals Near You</h2>

          <div className="space-y-4">
            {deals.map((spot) => (
              <a
                key={spot.id}
                href={`/business/${spot.id}`}
                className="flex gap-4 rounded-3xl bg-white p-4 shadow-sm"
              >
                <div className="aspect-[9/16] h-32 shrink-0 overflow-hidden rounded-2xl bg-black">
                  <BusinessMedia
                    spot={spot}
                    reel
                    className="h-full w-full"
                  />
                </div>

                <div className="flex-1">
                  <p className="text-xs font-bold text-[#C4483A]">
                    Special Deal
                  </p>

                  <h4 className="mt-1 font-bold">{spot.name}</h4>

                  <p className="text-sm text-gray-600">
                    {spot.category} · {spot.city}
                  </p>

                  <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                    {spot.tags || spot.tag || "Tap to view details"}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </section>

        {featured && (
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-bold">⭐ Featured Sponsor</h2>

            <a
              href={`/business/${featured.id}`}
              className="block overflow-hidden rounded-3xl bg-white shadow-xl"
            >
              <div className="mx-auto aspect-[9/16] max-h-[65vh] w-full overflow-hidden bg-black sm:max-w-sm">
                <BusinessMedia
                  spot={featured}
                  reel
                  className="h-full w-full"
                />
              </div>

              <div className="p-5">
                <h3 className="text-2xl font-bold">{featured.name}</h3>

                <p className="mt-2 text-sm text-gray-600">
                  {featured.category} · {featured.city}
                </p>

                <p className="mt-3 line-clamp-2 text-sm text-gray-700">
                  {featured.description || featured.tags || featured.tag}
                </p>
              </div>
            </a>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-xl font-bold">📈 Trending Now</h2>

          <div className="space-y-4">
            {trending.map((spot) => (
              <a
                key={spot.id}
                href={`/business/${spot.id}`}
                className="block rounded-3xl bg-white p-4 shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className="aspect-[9/16] h-28 shrink-0 overflow-hidden rounded-2xl bg-black">
                    <BusinessMedia
                      spot={spot}
                      reel
                      className="h-full w-full"
                    />
                  </div>

                  <div className="flex-1">
                    <h4 className="font-bold">{spot.name}</h4>

                    <p className="text-sm text-gray-600">
                      {spot.category} · {spot.city}
                    </p>

                    <p className="mt-1 text-sm font-medium text-[#C4483A]">
                      {spot.tags || spot.tag}
                    </p>
                  </div>

                  <div className="rounded-full bg-[#F8F3EC] px-3 py-1 text-sm font-bold">
                    ★ {spot.rating || "New"}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>

        <BottomNav />
      </main>
    </>
  );
}
