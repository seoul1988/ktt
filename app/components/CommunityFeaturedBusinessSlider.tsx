"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type FeaturedBusiness = {
  id: number | string;
  name?: string | null;
  category?: string | null;
  image_url?: string | null;
  city?: string | null;
  rating?: number | string | null;
  review_count?: number | null;
  description?: string | null;
};

export default function CommunityFeaturedBusinessSlider({
  businesses,
}: {
  businesses: FeaturedBusiness[];
}) {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const goToSlide = (index: number) => {
    const slider = sliderRef.current;
    if (!slider) return;

    slider.scrollTo({
      left: slider.clientWidth * index,
      behavior: "smooth",
    });

    setActiveIndex(index);
  };

  useEffect(() => {
    if (businesses.length <= 1) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => {
        const next = (current + 1) % businesses.length;
        const slider = sliderRef.current;

        slider?.scrollTo({
          left: slider.clientWidth * next,
          behavior: "smooth",
        });

        return next;
      });
    }, 4000);

    return () => window.clearInterval(timer);
  }, [businesses.length]);

  const handleScroll = () => {
    const slider = sliderRef.current;
    if (!slider || slider.clientWidth === 0) return;

    const index = Math.round(slider.scrollLeft / slider.clientWidth);
    setActiveIndex(Math.max(0, Math.min(index, businesses.length - 1)));
  };

  if (!businesses.length) return null;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className="text-2xl">⭐</span>
        <h2 className="text-xl font-black text-[#172033]">
          Featured Sponsor
        </h2>
      </div>

      <div
        ref={sliderRef}
        onScroll={handleScroll}
        className="flex w-full snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {businesses.map((business) => (
          <div
            key={business.id}
            className="w-full min-w-full shrink-0 snap-start px-0.5"
          >
            <Link
              href={`/business/${business.id}?from=community`}
              className="block overflow-hidden rounded-3xl bg-white text-[#172033] shadow-sm"
            >
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#E8DED1]">
                {business.image_url ? (
                  <img
                    src={business.image_url}
                    alt={business.name || "Featured Sponsor"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-black text-[#6B6257]">
                    No Photo
                  </div>
                )}

               <div className="absolute right-4 top-4 rounded-full bg-yellow-400 px-4 py-1.5 text-[11px] font-black text-[#172033] shadow-lg">
  SPONSOR
</div>
              </div>


            </Link>
          </div>
        ))}
      </div>

      {businesses.length > 1 && (
        <div className="mt-3 flex justify-center gap-2">
          {businesses.map((business, index) => (
            <button
              key={business.id}
              type="button"
              aria-label={`Featured sponsor ${index + 1}`}
              onClick={() => goToSlide(index)}
              className={`h-2 rounded-full transition-all ${
                activeIndex === index
                  ? "w-6 bg-[#C4483A]"
                  : "w-2 bg-[#CBD2DE]"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}