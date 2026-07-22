"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import CommunityBottomNav from "../../components/CommunityBottomNav";
import ProfileButton from "@/app/components/ProfileButton";
import { supabase } from "../../../lib/supabase";

type NewsItem = {
  id: number;
  title: string;
  summary: string;
  content: string;
  category: string;
  image_url: string | null;
  source_url: string | null;
  published_at: string;
};

const categories = ["All", "Local Business News", "Chamber News"];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function CommunityNewsPage() {
  const router = useRouter();

  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkAdmin() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        const user = session?.user;

        if (!user) {
          setIsAdmin(false);
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (!mounted) return;

        if (error) {
          console.error("News admin check error:", error);
          setIsAdmin(false);
          return;
        }

        setIsAdmin(data?.role === "admin");
      } catch (error) {
        console.error("News admin check failed:", error);

        if (mounted) {
          setIsAdmin(false);
        }
      }
    }

    checkAdmin();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadNews() {
      setLoading(true);

      const { data, error } = await supabase
        .from("business_news")
        .select(
          "id,title,summary,content,category,image_url,source_url,published_at",
        )
        .eq("published", true)
        .order("published_at", { ascending: false });

      if (!mounted) return;

      if (error) {
        console.error("Business news load error:", error);
        setNewsItems([]);
      } else {
        setNewsItems((data ?? []) as NewsItem[]);
      }

      setLoading(false);
    }

    loadNews();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredNews = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return newsItems.filter((item) => {
      const categoryMatch =
        activeCategory === "All" || item.category === activeCategory;

      const searchMatch =
        !keyword ||
        item.title.toLowerCase().includes(keyword) ||
        item.summary.toLowerCase().includes(keyword) ||
        item.category.toLowerCase().includes(keyword);

      return categoryMatch && searchMatch;
    });
  }, [newsItems, activeCategory, search]);

  const featuredNews = filteredNews[0] ?? null;
  const regularNews = filteredNews.slice(1);

  function getNewsHref(item: NewsItem) {
    return item.source_url?.trim() || `/community/news/${item.id}`;
  }

  return (
    <main className="min-h-screen bg-[#F7F7F7] text-[#172033]">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-md items-center px-3">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-90 active:bg-gray-100"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-5 w-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          <div className="flex-1 text-center">
            <h1 className="text-[16px] font-extrabold leading-none">
              Business News
            </h1>
            <p className="mt-1 text-[9px] font-semibold text-gray-500">
              Triangle 지역 비즈니스 뉴스
            </p>
          </div>

          <div className="flex h-9 w-9 shrink-0 items-center justify-center">
            <ProfileButton />
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-md px-3 pt-3">
        <div className="relative">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16 16l4.5 4.5" />
          </svg>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="뉴스 검색"
            className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-[13px] font-medium outline-none focus:border-[#F7A928] focus:ring-2 focus:ring-[#F7A928]/20"
          />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`
                  shrink-0 rounded-full px-4 py-2
                  text-[12px] font-medium
                  transition-all duration-150 active:scale-95
                  ${
                    activeCategory === category
                      ? "bg-[#172033] text-white shadow-sm"
                      : "border border-gray-200 bg-white text-[#172033] hover:bg-gray-50"
                  }
                `}
              >
                {category}
              </button>
            ))}
          </div>

          {isAdmin && (
            <Link
              href="/admin/news"
              aria-label="Register news"
              title="뉴스 등록"
              className="
                flex h-9 w-9 shrink-0 items-center justify-center
                rounded-full bg-[#172033] text-white
                shadow-sm transition active:scale-90
              "
            >
              <span className="-mt-0.5 text-[24px] font-light leading-none">
                +
              </span>
            </Link>
          )}
        </div>

        {loading && (
          <div className="mt-4 rounded-2xl bg-white px-4 py-12 text-center text-sm font-bold text-gray-500">
            뉴스 불러오는 중...
          </div>
        )}

        {!loading && featuredNews && (
          <Link
            href={getNewsHref(featuredNews)}
            target={featuredNews.source_url ? "_blank" : undefined}
            rel={featuredNews.source_url ? "noopener noreferrer" : undefined}
            className="mt-3 block overflow-hidden rounded-2xl bg-white shadow-[0_3px_14px_rgba(23,32,51,0.09)] transition active:scale-[0.98]"
          >
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-gray-100">
              <img
                src={featuredNews.image_url || "/event.png"}
                alt={featuredNews.title}
                className="h-full w-full object-cover"
                onError={(event) => {
                  event.currentTarget.src = "/event.png";
                }}
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

              <span className="absolute left-3 top-3 rounded-full bg-[#F7A928] px-2.5 py-1 text-[9px] font-semibold text-[#172033]">
                LATEST
              </span>

              <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                <p className="text-[10px] font-medium text-white/80">
                  {featuredNews.category} ·{" "}
                  {formatDate(featuredNews.published_at)}
                </p>

                <h2 className="mt-1 text-[18px] font-bold leading-tight">
                  {featuredNews.title}
                </h2>

                <p className="mt-1 line-clamp-2 text-[11px] font-normal leading-relaxed text-white/85">
                  {featuredNews.summary}
                </p>
              </div>
            </div>
          </Link>
        )}

        {!loading && filteredNews.length > 0 && (
          <>
            <div className="mt-4 flex items-center justify-between">
              <h2 className="text-[14px] font-semibold">Latest News</h2>
              <span className="text-[10px] font-medium text-gray-500">
                {filteredNews.length} articles
              </span>
            </div>

            <div className="mt-2 space-y-2.5">
              {regularNews.map((item) => (
                <Link
                  key={item.id}
                  href={getNewsHref(item)}
                  target={item.source_url ? "_blank" : undefined}
                  rel={item.source_url ? "noopener noreferrer" : undefined}
                  className="flex gap-3 rounded-2xl border border-gray-200 bg-white p-2.5 shadow-[0_2px_8px_rgba(23,32,51,0.05)] transition active:scale-[0.98]"
                >
                  <div className="h-[82px] w-[104px] shrink-0 overflow-hidden rounded-xl bg-gray-100">
                    <img
                      src={item.image_url || "/event.png"}
                      alt={item.title}
                      className="h-full w-full object-cover"
                      onError={(event) => {
                        event.currentTarget.src = "/event.png";
                      }}
                    />
                  </div>

                  <div className="min-w-0 flex-1 py-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-full bg-[#F8F3EC] px-2 py-0.5 text-[8px] font-medium text-[#8B5A13]">
                        {item.category}
                      </span>
                      <span className="text-[9px] font-normal text-gray-400">
                        {formatDate(item.published_at)}
                      </span>
                    </div>

                    <h3 className="mt-1.5 line-clamp-2 text-[13px] font-semibold leading-snug">
                      {item.title}
                    </h3>

                    <p className="mt-1 line-clamp-2 text-[10px] font-normal leading-relaxed text-gray-500">
                      {item.summary}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        {!loading && filteredNews.length === 0 && (
          <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-12 text-center">
            <div className="text-4xl" aria-hidden="true">
              📰
            </div>
            <h2 className="mt-3 text-[14px] font-semibold">
              등록된 뉴스가 없습니다
            </h2>
          </div>
        )}
      </section>

      <CommunityBottomNav activeNav="hub" />
    </main>
  );
}