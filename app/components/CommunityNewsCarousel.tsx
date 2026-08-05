"use client";

import { useEffect, useMemo, useState } from "react";

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
    <div className="flex h-full w-full items-center justify-center bg-[#E9EDF3]">
      <div className="text-center">
        <div className="text-4xl">
          {region === "korea" ? "🇰🇷" : "🇺🇸"}
        </div>

        <p className="mt-2 text-[11px] font-black text-[#596273]">
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

  const activeNews = useMemo(
    () =>
      activeRegion === "korea"
        ? koreaNews
        : usNews,
    [activeRegion, koreaNews, usNews],
  );

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

  return (
    <>
      <section
        className="mb-8 rounded-3xl border border-[#D6DEE9] bg-white p-3 shadow-sm"
        style={{
          width: "100%",
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        <div className="mb-3 flex items-center justify-between gap-3 px-1 pt-1">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-[#C4483A]">
              Latest News
            </p>

            <h2 className="mt-0.5 text-xl font-black text-[#172033]">
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
          <div
            className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 pt-1"
            style={{
              display: "flex",
              width: "100%",
              minWidth: 0,
              overflowX: "auto",
              overflowY: "hidden",
              scrollbarWidth: "none",
              WebkitOverflowScrolling:
                "touch",
            }}
          >
            {activeNews.map((news) => {
              const title = String(
                news.title || "Latest News",
              );

              const source = String(
                news.source ||
                  (activeRegion === "korea"
                    ? "Korea News"
                    : "US News"),
              );

              return (
                <button
                  key={`${activeRegion}-${news.id}-${news.article_url ?? ""}`}
                  type="button"
                  onClick={() =>
                    setSelectedNews(news)
                  }
                  className="block snap-start overflow-hidden rounded-2xl border border-[#E2E7EE] bg-white text-left text-[#172033] shadow-sm transition active:scale-[0.98]"
                  style={{
                    width: "168px",
                    minWidth: "168px",
                    maxWidth: "168px",
                    flexBasis: "168px",
                    flexGrow: 0,
                    flexShrink: 0,
                  }}
                >
                  <div
                    className="relative w-full overflow-hidden bg-[#E9EDF3]"
                    style={{
                      width: "168px",
                      height: "145px",
                    }}
                  >
                    {news.image_url ? (
                      <img
                        src={news.image_url}
                        alt={title}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 block h-full w-full object-cover"
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
                        display: news.image_url
                          ? "none"
                          : "flex",
                      }}
                    >
                      <NewsFallback
                        region={activeRegion}
                      />
                    </div>

                    <div className="absolute left-2 top-2 max-w-[145px] truncate rounded-full bg-black/70 px-2 py-1 text-[9px] font-black text-white backdrop-blur-sm">
                      {source}
                    </div>
                  </div>

                  <div
                    className="flex flex-col p-3"
                    style={{
                      width: "168px",
                      minHeight: "112px",
                    }}
                  >
                    <h3 className="line-clamp-3 text-[13px] font-black leading-[1.35]">
                      {title}
                    </h3>

                    <div className="mt-auto pt-3">
                      <p className="line-clamp-1 text-[10px] font-bold text-[#7A8493]">
                        {formatDate(
                          news.published_at,
                        )}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-[210px] items-center justify-center rounded-2xl bg-[#F4F6F8] px-6 text-center">
            <div>
              <div className="text-4xl">
                {activeRegion === "korea"
                  ? "🇰🇷"
                  : "🇺🇸"}
              </div>

              <p className="mt-3 text-sm font-black text-[#596273]">
                아직 표시할 뉴스가 없습니다.
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
              className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-xl font-black text-white shadow-lg backdrop-blur-sm"
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
                  className="absolute inset-0 h-full w-full object-cover"
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

              <div className="absolute bottom-3 left-3 rounded-full bg-black/75 px-3 py-1.5 text-[11px] font-black text-white backdrop-blur-sm">
                {selectedNews.source ||
                  "News"}
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <p className="text-xs font-bold text-[#7A8493]">
                {formatDate(
                  selectedNews.published_at,
                )}
              </p>

              <h3 className="mt-2 text-[22px] font-black leading-[1.35] text-[#172033]">
                {selectedNews.title ||
                  "Latest News"}
              </h3>

              {selectedNews.summary ? (
                <p className="mt-4 whitespace-pre-line text-[15px] font-medium leading-7 text-[#4E5968]">
                  {selectedNews.summary}
                </p>
              ) : (
                <p className="mt-4 text-sm font-semibold leading-6 text-[#7A8493]">
                  요약 내용이 없습니다. 원문에서
                  자세한 내용을 확인해 주세요.
                </p>
              )}

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedNews(null)
                  }
                  className="flex-1 rounded-2xl border border-[#D6DEE9] bg-white px-4 py-3 text-sm font-black text-[#172033]"
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
                    className="flex flex-1 items-center justify-center rounded-2xl bg-[#172033] px-4 py-3 text-sm font-black text-white shadow-sm"
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
