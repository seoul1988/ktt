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

    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % sponsors.length);
    }, 6500);

    return () => window.clearInterval(timer);
  }, [sponsors]);

  if (!sponsors || sponsors.length === 0) return null;

  return (
    <section className="mx-auto mb-8 max-w-xl">
      <h2 className="mb-3 text-xl font-bold text-[#172033]">
        ⭐ Featured Sponsor
      </h2>

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
                <div className="flex flex-col overflow-hidden rounded-3xl bg-white shadow-xl">
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
                    <div className="flex items-start gap-2">
                      <Link
                        href={`/business/${spot.id}`}
                        className="min-w-0 flex-1"
                      >
                        <h3 className="line-clamp-2 text-2xl font-black leading-tight text-[#172033]">
                          {spot.name}
                        </h3>
                      </Link>

                      <div className="flex shrink-0 flex-col gap-1">
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
                    </div>

                    <p className="mt-2 line-clamp-1 text-sm text-gray-600">
                      {[spot.category, spot.city].filter(Boolean).join(" · ") ||
                        "Sponsored local business"}
                    </p>

                    {(spot.rating || spot.review_count) && (
                      <div className="mt-2 flex items-center gap-1 text-sm">
                        <span className="text-yellow-500">⭐</span>

                        <span className="font-bold text-gray-900">
                          {Number(spot.rating || 0).toFixed(1)}
                        </span>

                        {spot.review_count ? (
                          <span className="text-gray-500">
                            (
                            {Number(
                              spot.review_count,
                            ).toLocaleString()}{" "}
                            Reviews)
                          </span>
                        ) : (
                          <span className="text-gray-400">No Reviews</span>
                        )}
                      </div>
                    )}
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
                dotIndex === index
                  ? "w-6 bg-[#C4483A]"
                  : "w-2 bg-gray-300"
              }`}
              aria-label={`Go to sponsor ${dotIndex + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}