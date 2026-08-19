"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type AdItem = {
  id: string | number;
  title?: string | null;
  name?: string | null;
  image_url?: string | null;
  image?: string | null;
  banner_url?: string | null;
  thumbnail_url?: string | null;
  link_url?: string | null;
  url?: string | null;
  website_url?: string | null;
  target_url?: string | null;
};

export default function CommunityAdsSlider({ ads }: { ads: AdItem[] }) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const items = useMemo(
    () =>
      (ads || [])
        .map((ad) => ({
          ...ad,
          imageUrl:
            ad.image_url ||
            ad.image ||
            ad.banner_url ||
            ad.thumbnail_url ||
            "",
        }))
        .filter((ad) => Boolean(ad.imageUrl))
        .slice(0, 5),
    [ads],
  );

  function scrollToIndex(index: number) {
    const scroller = scrollerRef.current;
    if (!scroller || items.length === 0) return;

    const children = Array.from(scroller.children) as HTMLElement[];
    const target = children[index];
    if (!target) return;

    scroller.scrollTo({
      left: target.offsetLeft - scroller.offsetLeft,
      behavior: "smooth",
    });

    setActiveIndex(index);
  }

  useEffect(() => {
    if (items.length <= 1 || paused) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => {
        const next = (current + 1) % items.length;

        const scroller = scrollerRef.current;
        if (scroller) {
          const children = Array.from(scroller.children) as HTMLElement[];
          const target = children[next];

          if (target) {
            scroller.scrollTo({
              left: target.offsetLeft - scroller.offsetLeft,
              behavior: "smooth",
            });
          }
        }

        return next;
      });
    }, 4000);

    return () => window.clearInterval(timer);
  }, [items.length, paused]);

  function handleScroll() {
    const scroller = scrollerRef.current;
    if (!scroller || items.length === 0) return;

    const children = Array.from(scroller.children) as HTMLElement[];
    const center = scroller.scrollLeft + scroller.clientWidth / 2;

    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    children.forEach((child, index) => {
      const childCenter = child.offsetLeft + child.offsetWidth / 2;
      const distance = Math.abs(childCenter - center);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    setActiveIndex(closestIndex);
  }

  if (items.length === 0) return null;

  return (
    <section
      className="mb-8"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => {
        window.setTimeout(() => setPaused(false), 1800);
      }}
    >
      <div className="mb-3 flex items-end justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#8A8176]">
            Sponsored
          </p>
          <h2 className="mt-0.5 text-lg font-black text-[#172033]">
            Local Ads
          </h2>
        </div>

        <p className="text-[10px] font-bold text-[#8A8176]">
          Swipe to view
        </p>
      </div>

      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="flex w-full snap-x snap-mandatory gap-3 overflow-x-auto pb-2 pr-[12%] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((ad, index) => {
          const card = (
            <div className="relative aspect-[16/7] w-full overflow-hidden rounded-2xl border border-[#E8DED1] bg-white shadow-sm">
              <img
                src={ad.imageUrl}
                alt={ad.title || ad.name || "Advertisement"}
                loading={index === 0 ? "eager" : "lazy"}
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
              />

              <span className="absolute left-2 top-2 rounded-full bg-black/45 px-2 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-white backdrop-blur-sm">
                Sponsored
              </span>
            </div>
          );

          return (
            <Link
              key={ad.id}
              href={`/ads/${ad.id}`}
              className="w-[88%] shrink-0 snap-start"
              aria-label={`${ad.title || ad.name || "Advertisement"} 자세히 보기`}
            >
              {card}
            </Link>
          );
        })}
      </div>

      {items.length > 1 && (
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {items.map((ad, index) => (
            <button
              key={`dot-${ad.id}`}
              type="button"
              onClick={() => scrollToIndex(index)}
              aria-label={`광고 ${index + 1} 보기`}
              className={`h-1.5 rounded-full transition-all ${
                activeIndex === index
                  ? "w-5 bg-[#C4483A]"
                  : "w-1.5 bg-[#D8D0C5]"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}