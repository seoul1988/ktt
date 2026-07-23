"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import CommunityBottomNav from "../../components/CommunityBottomNav";
import ProfileButton from "@/app/components/ProfileButton";
import { supabase } from "../../../lib/supabase";

const LOGIN_REDIRECT_KEY = "ktown_login_redirect";

type NewsItem = {
  id: number;
  title: string | null;
  summary: string | null;
  content: string | null;
  category: string | null;
  image_url: string | null;
  source_url: string | null;
  published_at: string | null;
  published: boolean | null;
};

const categories = [
  "All",
  "Local Business News",
  "Chamber News",
  "공연/문화",
];

function normalizeCategory(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isCultureCategory(value: unknown) {
  const category = normalizeCategory(value);

  return [
    "공연/문화",
    "공연 문화",
    "공연",
    "문화",
    "문화/공연",
    "문화 공연",
    "arts & culture",
    "arts and culture",
    "culture",
    "performance & culture",
    "performance and culture",
    "performance",
    "concert",
    "show",
  ].includes(category);
}

function categoryMatches(
  itemCategory: string | null,
  activeCategory: string,
) {
  const item = normalizeCategory(itemCategory);
  const active = normalizeCategory(activeCategory);

  if (activeCategory === "All") {
    return true;
  }

  if (activeCategory === "공연/문화") {
    return isCultureCategory(itemCategory);
  }

  if (activeCategory === "Local Business News") {
    return [
      "local business news",
      "local business",
      "business news",
      "local news",
      "비즈니스 뉴스",
      "비즈니스뉴스",
      "지역 비즈니스 뉴스",
      "지역비즈니스뉴스",
      "지역 뉴스",
      "지역뉴스",
    ].includes(item);
  }

  if (activeCategory === "Chamber News") {
    return [
      "chamber news",
      "chamber",
      "kacc news",
      "kacc",
      "상공인뉴스",
      "상공인 뉴스",
      "상공회의소뉴스",
      "상공회의소 뉴스",
      "상공회뉴스",
      "상공회 뉴스",
      "협회뉴스",
      "협회 뉴스",
    ].includes(item);
  }

  return item === active;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Date unavailable";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isSafeInternalPath(path: string) {
  return (
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.startsWith("/login") &&
    !path.startsWith("/auth/")
  );
}

export default function CommunityNewsPage() {
  const router = useRouter();

  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [selectedPrivateNews, setSelectedPrivateNews] =
    useState<NewsItem | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        setIsLoggedIn(Boolean(session?.user));
      } catch (error) {
        console.error("Session load error:", error);

        if (mounted) {
          setIsLoggedIn(false);
        }
      } finally {
        if (mounted) {
          setAuthLoading(false);
        }
      }
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      setIsLoggedIn(Boolean(session?.user));
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadNews() {
      setLoading(true);

      try {
        const { data, error } = await supabase
          .from("business_news")
          .select(`
            id,
            title,
            summary,
            content,
            category,
            image_url,
            source_url,
            published_at,
            published
          `)
          .order("id", {
            ascending: false,
          });

        if (!mounted) return;

        if (error) {
          console.error("Business news load error:", error);
          setNewsItems([]);
          return;
        }

        setNewsItems((data ?? []) as NewsItem[]);
      } catch (error) {
        console.error(
          "Business news unexpected load error:",
          error,
        );

        if (mounted) {
          setNewsItems([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadNews();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!showLoginModal) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowLoginModal(false);
        setSelectedPrivateNews(null);
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [showLoginModal]);

  const filteredNews = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return newsItems.filter((item) => {
      const categoryMatch = categoryMatches(
        item.category,
        activeCategory,
      );

      const searchMatch =
        !keyword ||
        String(item.title ?? "")
          .toLowerCase()
          .includes(keyword) ||
        String(item.summary ?? "")
          .toLowerCase()
          .includes(keyword) ||
        String(item.category ?? "")
          .toLowerCase()
          .includes(keyword);

      return categoryMatch && searchMatch;
    });
  }, [newsItems, activeCategory, search]);

  const featuredNews = filteredNews[0] ?? null;
  const regularNews = filteredNews.slice(1);

  function isPrivateNews(item: NewsItem) {
    return item.published !== true;
  }

  function isLocked(item: NewsItem) {
    return isPrivateNews(item) && !isLoggedIn;
  }

  function getNewsHref(item: NewsItem) {
    if (isLocked(item)) {
      return "#";
    }

    return (
      item.source_url?.trim() ||
      `/community/news/${item.id}`
    );
  }

  function saveLoginRedirect(path: string) {
    if (
      typeof window === "undefined" ||
      !isSafeInternalPath(path)
    ) {
      return;
    }

    sessionStorage.setItem(LOGIN_REDIRECT_KEY, path);
  }

  function moveToLogin(path: string) {
    const safePath = isSafeInternalPath(path)
      ? path
      : "/community/news";

    saveLoginRedirect(safePath);

    router.push(
      `/login?redirect=${encodeURIComponent(safePath)}`,
    );
  }

  function openLoginModal(item: NewsItem) {
    setSelectedPrivateNews(item);
    setShowLoginModal(true);
  }

  function closeLoginModal() {
    setShowLoginModal(false);
    setSelectedPrivateNews(null);
  }

  function handleNewsClick(
    event: React.MouseEvent<HTMLAnchorElement>,
    item: NewsItem,
  ) {
    if (!isLocked(item)) {
      return;
    }

    event.preventDefault();
    openLoginModal(item);
  }

  function goToLogin() {
    const redirectPath = selectedPrivateNews
      ? `/community/news/${selectedPrivateNews.id}`
      : "/community/news";

    closeLoginModal();
    moveToLogin(redirectPath);
  }

  async function handleCreateNews() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        const currentPath =
          window.location.pathname +
          window.location.search;

        moveToLogin(currentPath);
        return;
      }

      router.push("/admin/news");
    } catch (error) {
      console.error("News create auth error:", error);

      const currentPath =
        window.location.pathname +
        window.location.search;

      moveToLogin(currentPath);
    }
  }

  const pageLoading = loading || authLoading;

  return (
    <main className="min-h-screen bg-[#F7F7F7] pb-24 text-[#172033]">
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

        <div className="mt-2.5 flex items-center gap-1.5">
          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`
                  shrink-0 rounded-full px-2.5 py-1.5
                  text-[10px] font-semibold leading-none
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

          <button
            type="button"
            aria-label="뉴스 등록"
            title="뉴스 등록"
            onClick={handleCreateNews}
            className="
              flex h-7 w-7 shrink-0 items-center justify-center
              rounded-full bg-[#172033] text-white
              shadow-sm transition active:scale-90
            "
          >
            <span className="-mt-px text-[19px] font-light leading-none">
              +
            </span>
          </button>
        </div>

        {pageLoading && (
          <div className="mt-4 rounded-2xl bg-white px-4 py-12 text-center text-sm font-bold text-gray-500">
            뉴스 불러오는 중...
          </div>
        )}

        {!pageLoading && featuredNews && (
          <Link
            href={getNewsHref(featuredNews)}
            onClick={(event) =>
              handleNewsClick(event, featuredNews)
            }
            target={
              featuredNews.source_url &&
              !isLocked(featuredNews)
                ? "_blank"
                : undefined
            }
            rel={
              featuredNews.source_url &&
              !isLocked(featuredNews)
                ? "noopener noreferrer"
                : undefined
            }
            className="mt-3 block overflow-hidden rounded-2xl bg-white shadow-[0_3px_14px_rgba(23,32,51,0.09)] transition active:scale-[0.98]"
          >
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-gray-100">
              <img
                src={featuredNews.image_url || "/event.png"}
                alt={featuredNews.title || "Business News"}
                className={`h-full w-full object-cover transition duration-300 ${
                  isLocked(featuredNews)
                    ? "scale-[1.005] blur-[0.25px] brightness-[0.98]"
                    : ""
                }`}
                onError={(event) => {
                  event.currentTarget.src = "/event.png";
                }}
              />

              <div
                className={`absolute inset-0 bg-gradient-to-t ${
                  isLocked(featuredNews)
                    ? "from-black/55 via-black/0 to-transparent"
                    : "from-black/80 via-black/15 to-transparent"
                }`}
              />

              <span className="absolute left-3 top-3 rounded-full bg-[#F7A928] px-2.5 py-1 text-[9px] font-semibold text-[#172033]">
                LATEST
              </span>

              {isPrivateNews(featuredNews) && (
                <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[9px] font-bold text-white shadow-sm backdrop-blur-[1px]">
                  {isLoggedIn
                    ? "회원 전용"
                    : "🔒 로그인 후 보기"}
                </span>
              )}

              <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                <p className="text-[10px] font-medium text-white/85">
                  {featuredNews.category || "News"} ·{" "}
                  {formatDate(featuredNews.published_at)}
                </p>

                <h2 className="mt-1 text-[18px] font-bold leading-tight">
                  {featuredNews.title || "Business News"}
                </h2>

                <p className="mt-1 line-clamp-2 text-[11px] font-normal leading-relaxed text-white/90">
                  {featuredNews.summary || ""}
                </p>
              </div>
            </div>
          </Link>
        )}

        {!pageLoading && filteredNews.length > 0 && (
          <>
            <div className="mt-4 flex items-center justify-between">
              <h2 className="text-[14px] font-semibold">
                Latest News
              </h2>

              <span className="text-[10px] font-medium text-gray-500">
                {filteredNews.length} articles
              </span>
            </div>

            <div className="mt-2 space-y-2.5">
              {regularNews.map((item) => {
                const locked = isLocked(item);
                const privateNews = isPrivateNews(item);

                return (
                  <Link
                    key={item.id}
                    href={getNewsHref(item)}
                    onClick={(event) =>
                      handleNewsClick(event, item)
                    }
                    target={
                      item.source_url && !locked
                        ? "_blank"
                        : undefined
                    }
                    rel={
                      item.source_url && !locked
                        ? "noopener noreferrer"
                        : undefined
                    }
                    className="relative flex gap-3 overflow-hidden rounded-2xl border border-gray-200 bg-white p-2.5 shadow-[0_2px_8px_rgba(23,32,51,0.05)] transition active:scale-[0.98]"
                  >
                    <div className="relative h-[82px] w-[104px] shrink-0 overflow-hidden rounded-xl bg-gray-100">
                      <img
                        src={item.image_url || "/event.png"}
                        alt={item.title || "Business News"}
                        className={`h-full w-full object-cover transition duration-300 ${
                          locked
                            ? "scale-[1.005] blur-[0.25px] brightness-[0.98]"
                            : ""
                        }`}
                        onError={(event) => {
                          event.currentTarget.src =
                            "/event.png";
                        }}
                      />

                      {locked && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/[0.03]">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-[12px] text-white shadow-sm backdrop-blur-[1px]">
                            🔒
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1 py-0.5">
                      <div className="flex w-full items-center gap-1.5">
						  <span className="shrink-0 rounded-full bg-[#F8F3EC] px-2 py-0.5 text-[8px] font-medium text-[#8B5A13]">
							{item.category || "News"}
						  </span>

						  <span className="shrink-0 text-[9px] font-normal text-gray-400">
							{formatDate(item.published_at)}
						  </span>

						  {privateNews && (
							<span className="ml-auto shrink-0 rounded-full bg-[#172033] px-2 py-0.5 text-[8px] font-bold text-white">
							  {isLoggedIn
								? "회원 전용"
								: "로그인 후 보기"}
							</span>
						  )}
						</div>

                      <h3 className="mt-1.5 line-clamp-2 text-[13px] font-semibold leading-snug">
                        {item.title || "Business News"}
                      </h3>

                      <p className="mt-1 line-clamp-2 text-[10px] font-normal leading-relaxed text-gray-500">
                        {item.summary || ""}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        {!pageLoading && filteredNews.length === 0 && (
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

      {showLoginModal && (
        <div
          role="presentation"
          onClick={closeLoginModal}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 px-5 backdrop-blur-[2px]"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-required-title"
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-[330px] rounded-[24px] bg-white p-5 text-center shadow-2xl"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#F8F3EC] text-[25px]">
              🔒
            </div>

            <h2
              id="login-required-title"
              className="mt-4 text-[18px] font-extrabold text-[#172033]"
            >
              로그인이 필요합니다
            </h2>

            <p className="mt-2 text-[12px] font-medium leading-relaxed text-gray-500">
              이 뉴스는 로그인한 회원만 볼 수 있습니다.
              <br />
              로그인 후 전체 내용을 확인해 주세요.
            </p>

            <button
              type="button"
              onClick={goToLogin}
              className="mt-5 h-12 w-full rounded-xl bg-[#172033] text-[14px] font-bold text-white shadow-sm transition active:scale-[0.98]"
            >
              로그인하기
            </button>

            <p className="mt-3 text-[10px] font-medium text-gray-400">
              창 바깥을 누르면 닫힙니다
            </p>
          </div>
        </div>
      )}
    </main>
  );
}