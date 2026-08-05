"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type NewsItem = {
  id: number | string;
  region: "korea" | "us" | string;
  source?: string | null;
  title?: string | null;
  summary?: string | null;
  article_url?: string | null;
  image_url?: string | null;
  published_at?: string | null;
};

type CommunityNewsCarouselProps = {
  koreaNews?: NewsItem[];
  usNews?: NewsItem[];
};

function formatDate(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatModalDate(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function NewsFallback({
  region,
}: {
  region: "korea" | "us";
}) {
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ background: "#E9EDF3" }}
    >
      <div className="text-center">
        <div className="text-4xl">
          {region === "korea" ? "🇰🇷" : "🇺🇸"}
        </div>

        <p className="mt-2 text-[11px] font-bold text-[#596273]">
          {region === "korea" ? "KOREA NEWS" : "US NEWS"}
        </p>
      </div>
    </div>
  );
}

export default function CommunityNewsCarousel({
  koreaNews = [],
  usNews = [],
}: CommunityNewsCarouselProps) {
  const [activeRegion, setActiveRegion] =
    useState<"korea" | "us">("korea");

  const [selectedNews, setSelectedNews] =
    useState<NewsItem | null>(null);

  const [activeIndex, setActiveIndex] =
    useState(0);

  const [isAutoScrollPaused, setIsAutoScrollPaused] =
    useState(false);

  const scrollerRef =
    useRef<HTMLDivElement | null>(null);

  const activeNews = useMemo(
    () =>
      activeRegion === "korea"
        ? koreaNews
        : usNews,
    [activeRegion, koreaNews, usNews],
  );

  useEffect(() => {
    setActiveIndex(0);

    if (scrollerRef.current) {
      scrollerRef.current.scrollLeft = 0;
    }
  }, [activeRegion]);

  useEffect(() => {
    if (
      activeNews.length <= 1 ||
      selectedNews ||
      isAutoScrollPaused
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      const node = scrollerRef.current;
      if (!node) return;

      const card =
        node.querySelector<HTMLElement>(
          "[data-news-card]",
        );

      if (!card) return;

      const step = card.offsetWidth + 12;

      const nextIndex =
        activeIndex >= activeNews.length - 1
          ? 0
          : activeIndex + 1;

      node.scrollTo({
        left: nextIndex * step,
        behavior: "smooth",
      });

      setActiveIndex(nextIndex);
    }, 3000);

    return () => {
      window.clearInterval(timer);
    };
  }, [
    activeIndex,
    activeNews.length,
    selectedNews,
    isAutoScrollPaused,
  ]);

  useEffect(() => {
    if (!selectedNews) return;

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key === "Escape") {
        setSelectedNews(null);
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [selectedNews]);

  function updateActiveIndex() {
    const node = scrollerRef.current;
    if (!node) return;

    const firstCard =
      node.querySelector<HTMLElement>(
        "[data-news-card]",
      );

    if (!firstCard) return;

    const gap = 12;
    const step =
      firstCard.offsetWidth + gap;

    const index = Math.round(
      node.scrollLeft / step,
    );

    setActiveIndex(
      Math.max(
        0,
        Math.min(
          index,
          Math.max(
            activeNews.length - 1,
            0,
          ),
        ),
      ),
    );
  }

  function scrollCards(
    direction: "left" | "right",
  ) {
    setIsAutoScrollPaused(true);

    window.setTimeout(
      () => setIsAutoScrollPaused(false),
      1500,
    );

    const node = scrollerRef.current;
    if (!node) return;

    const firstCard =
      node.querySelector<HTMLElement>(
        "[data-news-card]",
      );

    const amount =
      (firstCard?.offsetWidth ?? 174) + 12;

    node.scrollBy({
      left:
        direction === "right"
          ? amount
          : -amount,
      behavior: "smooth",
    });
  }

  return (
    <>
      <section
        className="mb-8 rounded-[26px] border border-[#D6DEE9] bg-white px-3 pb-3 pt-4 shadow-sm"
        style={{
          width: "100%",
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        <div className="mb-4 flex items-center justify-between gap-3 px-1">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#C4483A]">
              Latest News
            </p>

            <h2 className="mt-1 text-[21px] font-black leading-none text-[#172033]">
              {activeRegion === "korea"
                ? "한국 최신 뉴스"
                : "미국 최신 뉴스"}
            </h2>
          </div>

          <div className="flex shrink-0 rounded-full bg-[#EEF1F5] p-1">
            <button
              type="button"
              onClick={() =>
                setActiveRegion("korea")
              }
              className={`rounded-full px-3 py-2 text-[11px] font-black transition ${
                activeRegion === "korea"
                  ? "bg-[#172033] text-white shadow-sm"
                  : "text-[#667085]"
              }`}
            >
              KR 한국
            </button>

            <button
              type="button"
              onClick={() =>
                setActiveRegion("us")
              }
              className={`rounded-full px-3 py-2 text-[11px] font-black transition ${
                activeRegion === "us"
                  ? "bg-[#172033] text-white shadow-sm"
                  : "text-[#667085]"
              }`}
            >
              US 미국
            </button>
          </div>
        </div>

        {activeNews.length > 0 ? (
          <div className="relative">
            <div
              ref={scrollerRef}
              onScroll={updateActiveIndex}
              onMouseEnter={() =>
                setIsAutoScrollPaused(true)
              }
              onMouseLeave={() =>
                setIsAutoScrollPaused(false)
              }
              onTouchStart={() =>
                setIsAutoScrollPaused(true)
              }
              onTouchEnd={() => {
                window.setTimeout(
                  () =>
                    setIsAutoScrollPaused(false),
                  1500,
                );
              }}
              className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3"
              style={{
                display: "flex",
                width: "100%",
                minWidth: 0,
                overflowX: "auto",
                overflowY: "hidden",
                WebkitOverflowScrolling:
                  "touch",
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                touchAction: "pan-x",
                scrollBehavior: "smooth",
              }}
            >
              {activeNews.map(
                (news, index) => {
                  const title = String(
                    news.title ||
                      "Latest News",
                  );

                  const source = String(
                    news.source ||
                      (activeRegion ===
                      "korea"
                        ? "Korea News"
                        : "US News"),
                  );

                  return (
                    <button
                      key={`${activeRegion}-${news.id}-${news.article_url ?? ""}`}
                      type="button"
                      data-news-card
                      onClick={() =>
                        setSelectedNews(news)
                      }
                      className="block snap-start overflow-hidden rounded-[16px] border border-[#E0E4EA] bg-white text-left text-[#172033] shadow-sm transition active:scale-[0.98]"
                      style={{
                        width: "174px",
                        minWidth: "174px",
                        maxWidth: "174px",
                        flex: "0 0 174px",
                      }}
                    >
                      <div
                        className="relative overflow-hidden"
                        style={{
                          width: "174px",
                          height: "120px",
                          background:
                            "#E9EDF3",
                        }}
                      >
                        {news.image_url ? (
                          <img
                            src={
                              news.image_url
                            }
                            alt={title}
                            loading="lazy"
                            decoding="async"
                            className="absolute inset-0 block"
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit:
                                "cover",
                              objectPosition:
                                "center",
                            }}
                            onError={(
                              event,
                            ) => {
                              event.currentTarget.style.display =
                                "none";

                              const fallback =
                                event.currentTarget
                                  .nextElementSibling as HTMLElement | null;

                              if (
                                fallback
                              ) {
                                fallback.style.display =
                                  "flex";
                              }
                            }}
                          />
                        ) : null}

                        <div
                          className="absolute inset-0 h-full w-full items-center justify-center"
                          style={{
                            display:
                              news.image_url
                                ? "none"
                                : "flex",
                          }}
                        >
                          <NewsFallback
                            region={
                              activeRegion
                            }
                          />
                        </div>

                        <div className="absolute left-2 top-2 max-w-[145px] truncate rounded-full bg-black/70 px-2 py-1 text-[9px] font-black text-white backdrop-blur-sm">
                          {source}
                        </div>

                        {index === 0 ? (
                          <div className="absolute bottom-2 left-2 rounded bg-[#8B20FF] px-1.5 py-0.5 text-[8px] font-black text-white">
                            NEW
                          </div>
                        ) : null}
                      </div>

                      <div
                        className="flex flex-col px-3 pb-3 pt-3"
                        style={{
                          width: "174px",
                          minHeight: "112px",
                        }}
                      >
                        <h3 className="line-clamp-3 text-[13px] font-medium leading-[1.35] text-[#111827]">
                          {title}
                        </h3>

                        <p className="mt-auto pt-4 text-[10px] font-normal text-[#8A93A3]">
                          {formatDate(
                            news.published_at,
                          )}
                        </p>
                      </div>
                    </button>
                  );
                },
              )}
            </div>

            {activeNews.length > 3 ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    scrollCards("left")
                  }
                  className="absolute left-1 top-[44px] z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-xl font-bold text-[#172033] shadow-md"
                  aria-label="이전 뉴스"
                >
                  ‹
                </button>

                <button
                  type="button"
                  onClick={() =>
                    scrollCards("right")
                  }
                  className="absolute right-1 top-[44px] z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-xl font-bold text-[#172033] shadow-md"
                  aria-label="다음 뉴스"
                >
                  ›
                </button>
              </>
            ) : null}

            {activeNews.length > 1 ? (
              <div className="mt-1 flex justify-center gap-1.5">
                {activeNews.map(
                  (news, index) => (
                    <button
                      key={`dot-${news.id}-${index}`}
                      type="button"
                      onClick={() => {
                        setIsAutoScrollPaused(true);

                        window.setTimeout(
                          () =>
                            setIsAutoScrollPaused(false),
                          1500,
                        );

                        const node =
                          scrollerRef.current;

                        const card =
                          node?.querySelector<HTMLElement>(
                            "[data-news-card]",
                          );

                        if (
                          !node ||
                          !card
                        ) {
                          return;
                        }

                        node.scrollTo({
                          left:
                            index *
                            (card.offsetWidth +
                              12),
                          behavior:
                            "smooth",
                        });
                      }}
                      className={
                        index ===
                        activeIndex
                          ? "h-1.5 w-4 rounded-full bg-[#8B20FF]"
                          : "h-1.5 w-1.5 rounded-full bg-[#D2D6DE]"
                      }
                      aria-label={`뉴스 ${
                        index + 1
                      }번`}
                    />
                  ),
                )}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex min-h-[210px] items-center justify-center rounded-2xl bg-[#F4F6F8] px-6 text-center">
            <div>
              <div className="text-4xl">
                {activeRegion ===
                "korea"
                  ? "🇰🇷"
                  : "🇺🇸"}
              </div>

              <p className="mt-3 text-sm font-black text-[#596273]">
                아직 표시할 뉴스가
                없습니다.
              </p>
            </div>
          </div>
        )}
      </section>

      {selectedNews ? (
        <div
          className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/65 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label={
            selectedNews.title ||
            "뉴스 상세"
          }
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedNews(null);
            }
          }}
        >
          <div className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-[28px] bg-white shadow-2xl sm:max-w-lg sm:rounded-[28px]">
            <button
              type="button"
              onClick={() =>
                setSelectedNews(null)
              }
              className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-xl font-black text-white shadow-lg"
              aria-label="닫기"
            >
              ×
            </button>

            <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#E9EDF3]">
              {selectedNews.image_url ? (
                <img
                  src={
                    selectedNews.image_url
                  }
                  alt={
                    selectedNews.title ||
                    "News"
                  }
                  className="absolute inset-0 block"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition:
                      "center",
                  }}
                  onError={(event) => {
                    event.currentTarget.style.display =
                      "none";

                    const fallback =
                      event.currentTarget
                        .nextElementSibling as HTMLElement | null;

                    if (fallback) {
                      fallback.style.display =
                        "flex";
                    }
                  }}
                />
              ) : null}

              <div
                className="absolute inset-0 h-full w-full items-center justify-center"
                style={{
                  display:
                    selectedNews.image_url
                      ? "none"
                      : "flex",
                }}
              >
                <NewsFallback
                  region={
                    selectedNews.region ===
                    "us"
                      ? "us"
                      : "korea"
                  }
                />
              </div>

              <div className="absolute bottom-3 left-3 rounded-full bg-black/75 px-3 py-1.5 text-[11px] font-black text-white">
                {selectedNews.source ||
                  "News"}
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <p className="text-xs font-normal text-[#8A93A3]">
                {formatModalDate(
                  selectedNews.published_at,
                )}
              </p>

              <h3 className="mt-2 text-[22px] font-bold leading-[1.35] text-[#172033]">
                {selectedNews.title ||
                  "Latest News"}
              </h3>

              {selectedNews.summary ? (
                <p className="mt-4 whitespace-pre-line text-[15px] font-normal leading-7 text-[#4E5968]">
                  {selectedNews.summary}
                </p>
              ) : (
                <p className="mt-4 text-sm font-medium leading-6 text-[#7A8493]">
                  요약 내용이 없습니다.
                  원문에서 자세한 내용을
                  확인해 주세요.
                </p>
              )}

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedNews(null)
                  }
                  className="flex-1 rounded-2xl border border-[#D6DEE9] bg-white px-4 py-3 text-sm font-bold text-[#172033]"
                >
                  닫기
                </button>

                {selectedNews.article_url ? (
                  <a
                    href={
                      selectedNews.article_url
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center rounded-2xl bg-[#172033] px-4 py-3 text-sm font-bold text-white shadow-sm"
                  >
                    원문 보기 →
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
