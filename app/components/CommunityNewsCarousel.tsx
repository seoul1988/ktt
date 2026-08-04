"use client";

import { useMemo, useState } from "react";

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

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function NewsFallback({ region }: { region: "korea" | "us" }) {
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

  const activeNews = useMemo(
    () => (activeRegion === "korea" ? koreaNews : usNews),
    [activeRegion, koreaNews, usNews],
  );

  return (
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
            onClick={() => setActiveRegion("korea")}
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
            onClick={() => setActiveRegion("us")}
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
            WebkitOverflowScrolling: "touch",
          }}
        >
          {activeNews.map((news) => {
            const articleUrl = news.article_url || "#";
            const title = String(news.title || "Latest News");

            const source = String(
              news.source ||
                (activeRegion === "korea"
                  ? "Korea News"
                  : "US News"),
            );

            return (
              <a
                key={`${activeRegion}-${news.id}-${articleUrl}`}
                href={articleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block snap-start overflow-hidden rounded-2xl border border-[#E2E7EE] bg-white text-[#172033] shadow-sm transition active:scale-[0.98]"
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
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                      onError={(event) => {
                        event.currentTarget.style.display = "none";

                        const fallback =
                          event.currentTarget
                            .nextElementSibling as HTMLElement | null;

                        if (fallback) {
                          fallback.style.display = "flex";
                        }
                      }}
                    />
                  ) : null}

                  <div
                    className="absolute inset-0 h-full w-full items-center justify-center"
                    style={{
                      display: news.image_url ? "none" : "flex",
                    }}
                  >
                    <NewsFallback region={activeRegion} />
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
                      {formatDate(news.published_at)}
                    </p>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      ) : (
        <div className="flex min-h-[210px] items-center justify-center rounded-2xl bg-[#F4F6F8] px-6 text-center">
          <div>
            <div className="text-4xl">
              {activeRegion === "korea" ? "🇰🇷" : "🇺🇸"}
            </div>

            <p className="mt-3 text-sm font-black text-[#596273]">
              아직 표시할 뉴스가 없습니다.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}