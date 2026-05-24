export const dynamic = "force-dynamic";
export const revalidate = 0;

import { supabase } from "../lib/supabase";
import ProfileButton from "./components/ProfileButton";
import AuthRefreshWrapper from "./components/AuthRefreshWrapper";

export default async function Home() {
  const { data: spots } = await supabase
    .from("businesses")
    .select("*")
    .order("id", { ascending: true });

  const featured = spots?.[0];
  const deals = spots?.slice(0, 3) || [];
  const trending = spots || [];

  return (
    <main className="min-h-screen bg-[#F8F3EC] px-5 pb-28 pt-8 text-[#172033]">
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

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-bold">🎉 Today’s Events</h2>

        <div className="overflow-hidden rounded-3xl bg-white shadow-xl">
          <img
            src="/event.png"
            alt="Event"
            className="w-full object-cover"
          />

          <div className="p-5">
            <p className="text-sm font-bold text-[#C4483A]">This Weekend</p>

            <h3 className="mt-2 text-2xl font-bold">
              K-Culture Night in the Triangle
            </h3>

            <p className="mt-2 text-sm text-gray-600">
              Food, music, community events and local Korean favorites.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-bold">🔥 Deals Near You</h2>

        <div className="space-y-4">
          {deals.map((spot) => (
            <a
              key={spot.id}
              href={`/business/${spot.id}`}
              className="flex gap-4 rounded-3xl bg-white p-4 shadow-sm"
            >
              <img
                src={spot.image_url}
                alt={spot.name}
                className="h-24 w-24 rounded-2xl object-cover"
              />

              <div className="flex-1">
                <p className="text-xs font-bold text-[#C4483A]">
                  Special Deal
                </p>

                <h4 className="mt-1 font-bold">{spot.name}</h4>

                <p className="text-sm text-gray-600">
                  {spot.category} · {spot.city}
                </p>

                <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                  {spot.tag || "Tap to view details"}
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
            <img
              src={featured.image_url}
              alt={featured.name}
              className="h-52 w-full object-cover"
            />

            <div className="p-5">
              <h3 className="text-2xl font-bold">{featured.name}</h3>

              <p className="mt-2 text-sm text-gray-600">
                {featured.category} · {featured.city}
              </p>

              <p className="mt-3 line-clamp-2 text-sm text-gray-700">
                {featured.description || featured.tag}
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
                <img
                  src={spot.image_url}
                  alt={spot.name}
                  className="h-20 w-20 rounded-2xl object-cover"
                />

                <div className="flex-1">
                  <h4 className="font-bold">{spot.name}</h4>

                  <p className="text-sm text-gray-600">
                    {spot.category} · {spot.city}
                  </p>

                  <p className="mt-1 text-sm font-medium text-[#C4483A]">
                    {spot.tag}
                  </p>
                </div>

                <div className="rounded-full bg-[#F8F3EC] px-3 py-1 text-sm font-bold">
                  ★ {spot.rating}
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>

      <nav className="fixed bottom-4 left-1/2 z-[1000] flex w-[90%] max-w-md -translate-x-1/2 justify-around rounded-3xl bg-[#172033] px-4 py-3 text-xs font-semibold text-white shadow-2xl">
        <a className="text-[#F7B955]" href="/">
          Home
        </a>

        <a href="/map">Map</a>

        <a href="/deals">Deals</a>

        <a href="/community">Community</a>
      </nav>
    </main>
  );
}