"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type TodaysKoreaPost = {
  id: number | string;
  category: string;
  title: string;
  summary?: string | null;
  source_name?: string | null;
  source_url: string;
  image_url?: string | null;
  published_at?: string | null;
};

type Props = {
  kpopNews: TodaysKoreaPost[];
  kdramaNews: TodaysKoreaPost[];
};

type NewsType = "kpop" | "kdrama";

function formatNewsDate(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  }).format(date);
}

function categoryLabel(category: string) {
  return String(category).toLowerCase() === "kdrama"
    ? "K-DRAMA"
    : "K-POP";
}

export default function TodaysKoreaNewsModal({
  kpopNews,
  kdramaNews,
}: Props) {
  const [activeType, setActiveType] = useState<NewsType>("kpop");
  const [selectedId, setSelectedId] = useState<
    string | number | null
  >(null);
  const [activeSlide, setActiveSlide] = useState(0);

  const sliderRef = useRef<HTMLDivElement | null>(null);

  const activePosts =
    activeType === "kpop" ? kpopNews : kdramaNews;

  const allPosts = useMemo(
    () => [...kpopNews, ...kdramaNews],
    [kpopNews, kdramaNews],
  );

  const selectedIndex = allPosts.findIndex(
    (post) => post.id === selectedId,
  );

  const selectedPost =
    selectedIndex >= 0 ? allPosts[selectedIndex] : null;

  function closeModal() {
    setSelectedId(null);
  }

  function moveModal(direction: -1 | 1) {
    if (selectedIndex < 0 || allPosts.length < 2) {
      return;
    }

    const nextIndex =
      (selectedIndex + direction + allPosts.length) %
      allPosts.length;

    setSelectedId(allPosts[nextIndex].id);
  }

  function scrollSlider(direction: -1 | 1) {
    const slider = sliderRef.current;

    if (!slider) {
      return;
    }

    const card =
      slider.querySelector<HTMLElement>("[data-news-card]");

    const amount = card
      ? card.offsetWidth + 12
      : slider.clientWidth * 0.8;

    slider.scrollBy({
      left: direction * amount,
      behavior: "smooth",
    });
  }

  function handleSliderScroll() {
    const slider = sliderRef.current;

    if (!slider) {
      return;
    }

    const card =
      slider.querySelector<HTMLElement>("[data-news-card]");

    if (!card) {
      return;
    }

    const step = card.offsetWidth + 12;
    const nextIndex = Math.round(slider.scrollLeft / step);

    setActiveSlide(
      Math.max(
        0,
        Math.min(nextIndex, activePosts.length - 1),
      ),
    );
  }

  useEffect(() => {
    setActiveSlide(0);

    if (sliderRef.current) {
      sliderRef.current.scrollTo({
        left: 0,
        behavior: "smooth",
      });
    }
  }, [activeType]);

  useEffect(() => {
    if (!selectedPost) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeModal();
      }

      if (event.key === "ArrowLeft") {
        moveModal(-1);
      }

      if (event.key === "ArrowRight") {
        moveModal(1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedPost, selectedIndex, allPosts.length]);

  return (
    <>
      <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 bg-gradient-to-r from-violet-50 via-white to-pink-50 px-4 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[18px] font-bold leading-none text-[#172033]">
                🌸 Today&apos;s Korea
              </h3>

              <p className="mt-1 text-[10px] font-medium text-gray-500">
                Daily K-POP &amp; K-Drama Updates
              </p>
            </div>

            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                onClick={() => setActiveType("kpop")}
                className={`rounded-md px-3 py-1.5 text-[10px] font-bold transition ${
                  activeType === "kpop"
                    ? "bg-violet-600 text-white shadow-sm"
                    : "border border-gray-200 bg-white text-gray-700"
                }`}
              >
                🎵 K-POP
              </button>

              <button
                type="button"
                onClick={() => setActiveType("kdrama")}
                className={`rounded-md px-3 py-1.5 text-[10px] font-bold transition ${
                  activeType === "kdrama"
                    ? "bg-violet-600 text-white shadow-sm"
                    : "border border-gray-200 bg-white text-gray-700"
                }`}
              >
                🎬 K-DRAMA
              </button>
            </div>
          </div>
        </div>

        <div className="px-4 pb-3 pt-3">
          <div className="relative">
            {activePosts.length > 0 ? (
              <>
                <div
                  ref={sliderRef}
                  onScroll={handleSliderScroll}
                  className="flex snap-x snap-mandatory items-stretch gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {activePosts.map((post) => (
                    <button
                      key={post.id}
                      type="button"
                      data-news-card
                      onClick={() => setSelectedId(post.id)}
                      className="flex w-[calc((100%_-_12px)/2)] min-w-[calc((100%_-_12px)/2)] shrink-0 snap-start flex-col text-left sm:w-[calc((100%_-_24px)/3)] sm:min-w-[calc((100%_-_24px)/3)]"
                    >
                      <div className="relative h-[120px] w-full shrink-0 overflow-hidden rounded-xl bg-gray-100">
                        <img
                          src={post.image_url || "/event.png"}
                          alt={post.title}
                          loading="lazy"
                          decoding="async"
                          className="absolute inset-0 block h-full w-full max-w-none object-cover object-center transition duration-300 hover:scale-105"
                          style={{
                            width: "100%",
                            height: "100%",
                            minWidth: "100%",
                            minHeight: "100%",
                            maxWidth: "none",
                            objectFit: "cover",
                            objectPosition: "center",
                          }}
                          onError={(event) => {
                            event.currentTarget.src = "/event.png";
                          }}
                        />

                        <span className="absolute left-1.5 top-1.5 rounded bg-violet-600 px-1.5 py-0.5 text-[7px] font-bold text-white">
                          NEW
                        </span>
                      </div>

                      <h5
                        className="mt-2 min-h-[54px] overflow-hidden break-words text-[12px] font-medium leading-[1.5] tracking-[-0.01em] text-slate-800"
                        style={{
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {post.title}
                      </h5>

                    </button>
                  ))}
                </div>

                {activePosts.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => scrollSlider(-1)}
                      aria-label="이전 뉴스"
                      className="absolute left-1 top-[42px] z-10 hidden h-8 w-8 items-center justify-center rounded-full bg-white/95 text-lg font-bold text-gray-700 shadow-md sm:flex"
                    >
                      ‹
                    </button>

                    <button
                      type="button"
                      onClick={() => scrollSlider(1)}
                      aria-label="다음 뉴스"
                      className="absolute right-0 top-[42px] z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-lg font-bold text-gray-700 shadow-md"
                    >
                      ›
                    </button>
                  </>
                )}

                <div className="mt-1 flex items-center justify-center gap-1">
                  {activePosts.map((post, index) => (
                    <button
                      key={post.id}
                      type="button"
                      aria-label={`${index + 1}번째 뉴스`}
                      onClick={() => {
                        const slider = sliderRef.current;

                        const card =
                          slider?.querySelector<HTMLElement>(
                            "[data-news-card]",
                          );

                        if (!slider || !card) {
                          return;
                        }

                        slider.scrollTo({
                          left:
                            index * (card.offsetWidth + 12),
                          behavior: "smooth",
                        });
                      }}
                      className={`h-1.5 rounded-full transition-all ${
                        activeSlide === index
                          ? "w-4 bg-violet-600"
                          : "w-1.5 bg-gray-300"
                      }`}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-2xl bg-gray-50 px-4 py-10 text-center">
                <p className="text-sm font-medium text-gray-400">
                  {activeType === "kpop"
                    ? "New K-POP stories are coming soon."
                    : "New K-Drama stories are coming soon."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedPost && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-3 py-4 backdrop-blur-sm sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label="Today’s Korea 기사 자세히 보기"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div className="relative max-h-[88dvh] w-full overflow-y-auto rounded-[28px] bg-white shadow-2xl sm:max-w-[500px]">
            <button
              type="button"
              onClick={closeModal}
              aria-label="닫기"
              className="absolute right-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-black/65 text-2xl font-bold leading-none text-white shadow-lg backdrop-blur"
            >
              ×
            </button>

            <div className="relative aspect-video w-full overflow-hidden rounded-t-[28px] bg-gray-100">
              <img
                src={selectedPost.image_url || "/event.png"}
                alt={selectedPost.title}
                className="h-full w-full object-cover object-center"
                onError={(event) => {
                  event.currentTarget.src = "/event.png";
                }}
              />

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-5 pb-4 pt-14">
                <span className="rounded-full bg-white/95 px-3 py-1 text-[11px] font-bold text-[#172033]">
                  {categoryLabel(selectedPost.category)}
                </span>
              </div>

              {allPosts.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => moveModal(-1)}
                    aria-label="이전 기사"
                    className="absolute left-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-2xl font-bold text-white shadow-lg"
                  >
                    ‹
                  </button>

                  <button
                    type="button"
                    onClick={() => moveModal(1)}
                    aria-label="다음 기사"
                    className="absolute right-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-2xl font-bold text-white shadow-lg"
                  >
                    ›
                  </button>
                </>
              )}
            </div>

            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-gray-500">
                <span>
                  {selectedPost.source_name || "Source"}
                </span>

                {formatNewsDate(
                  selectedPost.published_at,
                ) && (
                  <>
                    <span>•</span>

                    <span>
                      {formatNewsDate(
                        selectedPost.published_at,
                      )}
                    </span>
                  </>
                )}

                {allPosts.length > 1 && (
                  <>
                    <span>•</span>

                    <span>
                      {selectedIndex + 1} / {allPosts.length}
                    </span>
                  </>
                )}
              </div>

              <h3 className="mt-3 break-words text-[22px] font-semibold leading-[1.35] tracking-[-0.015em] text-[#172033]">
                {selectedPost.title}
              </h3>

              <p className="mt-4 whitespace-pre-line text-[15px] font-normal leading-7 text-gray-600">
                {selectedPost.summary ||
                  "Read the complete story from the original news source."}
              </p>

              <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-5">
                <button
                  type="button"
                  onClick={closeModal}
                  aria-label="모달 닫기"
                  title="닫기"
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-gray-300 bg-white text-2xl font-bold text-[#172033] shadow-sm transition active:scale-95"
                >
                  ×
                </button>

                <a
                  href={selectedPost.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="기사 원문 열기"
                  title="기사 원문 열기"
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-[#5B4BFF] text-white shadow-md transition hover:scale-105 active:scale-95"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-6 w-6"
                  >
                    <path d="M7 17L17 7" />
                    <path d="M8 7h9v9" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}