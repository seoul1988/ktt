"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type FeaturedSponsorSliderProps = {
  sponsors: any[];
  dealBusinessEntries?: [number | string, number | string][];
  couponBusinessIds?: (number | string)[];
};

export default function FeaturedSponsorSlider({
  sponsors,
  dealBusinessEntries = [],
  couponBusinessIds = [],
}: FeaturedSponsorSliderProps) {
  const [index, setIndex] = useState(0);

  const dealBusinessMap = useMemo(
    () => new Map<number | string, number | string>(dealBusinessEntries),
    [dealBusinessEntries],
  );

  const couponBusinessSet = useMemo(
    () => new Set<number | string>(couponBusinessIds),
    [couponBusinessIds],
  );

  useEffect(() => {
    if (!sponsors || sponsors.length === 0) return;

    setIndex(Math.floor(Math.random() * sponsors.length));
  }, [sponsors]);

  useEffect(() => {
    if (!sponsors || sponsors.length <= 1) return;

    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % sponsors.length);
    }, 6500);

    return () => clearInterval(timer);
  }, [sponsors]);

  if (!sponsors || sponsors.length === 0) return null;

  return (
    <section className="mx-auto mb-8 max-w-xl">
      <h2 className="mb-3 text-xl font-bold">⭐ Featured Sponsor</h2>

      <div className="overflow-hidden rounded-3xl">
        <div
          className="flex transition-transform duration-[1500ms] ease-in-out"
          style={{
            transform: `translateX(-${index * 100}%)`,
          }}
        >
          {sponsors.map((spot) => {
            const dealId = dealBusinessMap.get(spot.id);
            const hasDeal = Boolean(dealId);
            const hasCoupon = couponBusinessSet.has(spot.id);

            return (
              <div key={spot.id} className="w-full shrink-0">
                <div className="overflow-hidden rounded-3xl bg-white shadow-xl">
                  <Link href={`/business/${spot.id}`} className="block">
                    <div className="h-56 w-full overflow-hidden bg-white">
                      <img
                        src={spot.image_url || "/event.png"}
                        alt={spot.name || "Business"}
                        className="h-full w-full object-contain"
                      />
                    </div>
                  </Link>

                  <div className="p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/business/${spot.id}`}>
                        <h3 className="text-2xl font-bold">{spot.name}</h3>
                      </Link>

                      {hasDeal && dealId && (
                        <Link
                          href={`/deals/${dealId}`}
                          className="rounded-full bg-yellow-400 px-2.5 py-1 text-xs font-black text-black shadow-sm"
                        >
                          🔥 DEAL
                        </Link>
                      )}

                      {hasCoupon && (
                        <Link
                          href={`/business/${spot.id}`}
                          className="rounded-full bg-purple-600 px-2.5 py-1 text-xs font-black text-white shadow-sm"
                        >
                          🎟 COUPON
                        </Link>
                      )}
                    </div>

                    <p className="mt-2 text-sm text-gray-600">
                      {spot.category} · {spot.city}
                    </p>

                    <p className="mt-3 line-clamp-2 text-sm text-gray-700">
                      {spot.description || spot.tags || spot.tag}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {sponsors.length > 1 && (
        <div className="mt-3 flex justify-center gap-2">
          {sponsors.map((spot, dotIndex) => (
            <button
              key={spot.id}
              type="button"
              onClick={() => setIndex(dotIndex)}
              className={`h-2 rounded-full transition-all duration-500 ${
                dotIndex === index ? "w-6 bg-[#C4483A]" : "w-2 bg-gray-300"
              }`}
              aria-label={`Go to sponsor ${dotIndex + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}