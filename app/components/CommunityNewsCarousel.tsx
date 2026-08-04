"use client";

import { useMemo, useState } from "react";

type NewsItem = {
  id: number;
  region: "korea" | "us";
  source: string;
  title: string;
  summary: string | null;
  article_url: string;
  image_url: string | null;
  published_at: string | null;
};

type Props = {
  koreaNews: NewsItem[];
  usNews: NewsItem[];
};

function formatDate(value: string | null, locale: string) {
  if (!value) return "Latest";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Latest";

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function CommunityNewsCarousel({ koreaNews, usNews }: Props) {
  const [activeRegion, setActiveRegion] = useState<"korea" | "us">("korea");

  const articles = useMemo(
    () => (activeRegion === "korea" ? koreaNews : usNews),
    [activeRegion, koreaNews, usNews],
  );

  const isKorea = activeRegion === "korea";

  return (
    <section className="mb-8 overflow-hidden rounded-3xl border border-[#D8DDE8] bg-white p-3 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3 px-2 pt-1">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#C4483A]">
            Latest News
          </p>
          <h2 className="text-xl font-black text-[#172033]">
            {isKorea ? "한국 최신 뉴스" : "미국 최신 뉴스"}
          </h2>
        </div>

        <div className="flex rounded-full bg-[#EEF1F6] p-1">
          <button
            type="button"
            onClick={() => setActiveRegion("korea")}
            className={`rounded-full px-3 py-2 text-xs font-black transition ${
              isKorea
                ? "bg-[#172033] text-white shadow-sm"
                : "text-[#647087]"
            }`}
          >
            🇰🇷 한국
          </button>
          <button
            type="button"
            onClick={() => setActiveRegion("us")}
            className={`rounded-full px-3 py-2 text-xs font-black transition ${
              !isKorea
                ? "bg-[#172033] text-white shadow-sm"
                : "text-[#647087]"
            }`}
          >
            🇺🇸 미국
          </button>
        </div>
      </div>

      {articles.length > 0 ? (
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
          {articles.map((article) => (
            <a
              key={article.id}
              href={article.article_url}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-[270px] max-w-[270px] snap-start overflow-hidden rounded-3xl border border-[#E4E8F0] bg-white shadow-sm transition active:scale-[0.98]"
            >
              <div className="relative aspect-[16/9] overflow-hidden bg-[#E8DED1]">
                {article.image_url ? (
                  <img
                    src={article.image_url}
                    alt={article.title}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="relative z-10 h-full w-full object-cover"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                ) : null}

                <div className="absolute inset-0 -z-0 flex items-center justify-center text-5xl">
                  {isKorea ? "🇰🇷" : "🇺🇸"}
                </div>

                <div className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-[10px] font-black text-white backdrop-blur-sm">
                  {article.source}
                </div>
              </div>

              <div className="relative bg-white p-4">
                <h3 className="line-clamp-3 min-h-[66px] text-base font-black leading-snug text-[#172033]">
                  {article.title}
                </h3>

                {article.summary ? (
                  <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-[#6B7280]">
                    {article.summary}
                  </p>
                ) : null}

                <div className="mt-3 flex items-center justify-between gap-2 text-[11px] font-bold text-[#7B8497]">
                  <span>
                    {formatDate(
                      article.published_at,
                      isKorea ? "ko-KR" : "en-US",
                    )}
                  </span>
                  <span className="font-black text-[#C4483A]">원문 →</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl bg-[#F4F6F9] p-6 text-center text-sm font-bold text-[#6B7280]">
          아직 저장된 뉴스가 없습니다. 뉴스 크론을 한 번 실행해 주세요.
        </div>
      )}
    </section>
  );
}
