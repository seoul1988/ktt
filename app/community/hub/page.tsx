"use client";

import type { SVGProps } from "react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import CommunityBottomNav from "../../components/CommunityBottomNav";
import ProfileButton from "@/app/components/ProfileButton";
import { supabase } from "../../../lib/supabase";

type IconName =
  | "marketplace"
  | "ads"
  | "deals"
  | "inquiries"
  | "news"
  | "events"
  | "adbook";

type BadgeKey =
  | "marketplace"
  | "ads"
  | "deals"
  | "inquiries"
  | "news"
  | "events"
  | "adbook";

type HubItem = {
  title: string;
  subtitle: string;
  href: string;
  icon: IconName;
  badgeKey: BadgeKey;
  wide?: boolean;
};

type RecentBadgeState = Record<BadgeKey, boolean>;

const initialRecentBadgeState: RecentBadgeState = {
  marketplace: false,
  ads: false,
  deals: false,
  inquiries: false,
  news: false,
  events: false,
  adbook: false,
};

/*
 * 프로젝트마다 실제 테이블 이름이 다를 수 있으므로
 * 가능한 테이블 이름을 앞에서부터 순서대로 확인합니다.
 *
 * 실제 사용하는 테이블 이름을 알고 있다면 해당 이름만 남겨도 됩니다.
 */
const hubItems: HubItem[] = [
  {
    title: "사고/팔기",
    subtitle: "Marketplace",
    href: "/market",
    icon: "marketplace",
    badgeKey: "marketplace",
  },
  {
    title: "광고",
    subtitle: "Ads",
    href: "https://www.ktowntriangle.com/ads",
    icon: "ads",
    badgeKey: "ads",
  },
  {
    title: "할인 & 쿠폰",
    subtitle: "Deals",
    href: "/community/deals",
    icon: "deals",
    badgeKey: "deals",
  },
  {
    title: "문의하기",
    subtitle: "Inquiries",
    href: "/community/inquiries",
    icon: "inquiries",
    badgeKey: "inquiries",
  },
  {
    title: "뉴스/공연/문화",
    subtitle: "News",
    href: "/community/news",
    icon: "news",
    badgeKey: "news",
    wide: true,
  },
  {
    title: "이벤트",
    subtitle: "Events",
    href: "/community/events",
    icon: "events",
    badgeKey: "events",
    wide: true,
  },
];

/*
 * 테이블마다 날짜 컬럼 이름이 다를 가능성을 고려해
 * created_at → published_at → inserted_at 순서로 확인합니다.
 */
type HubBadgeRow = {
  menu_key: string;
  has_new: boolean;
};

function isBadgeKey(value: string): value is BadgeKey {
  return [
    "marketplace",
    "ads",
    "deals",
    "inquiries",
    "news",
    "events",
    "adbook",
  ].includes(value);
}

function HubIcon({
  name,
  className = "h-10 w-10",
}: {
  name: IconName;
  className?: string;
}) {
  const commonProps: SVGProps<SVGSVGElement> = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    "aria-hidden": true,
  };

  if (name === "marketplace") {
    return (
      <svg {...commonProps}>
        <path d="M6 8V6a4 4 0 0 1 8 0v2" />
        <path d="M3.8 8h12.4l-1 11H4.8l-1-11Z" />
        <path d="M15.5 10.5h4l.7 8.5h-5.4" />
        <path d="M16.8 10.5v-1a2 2 0 0 1 4 0v1" />
      </svg>
    );
  }

  if (name === "ads") {
    return (
      <svg {...commonProps}>
        <path d="m3 11 12-5v12L3 13v-2Z" />
        <path d="M15 9h2.5a2.5 2.5 0 0 1 0 5H15" />
        <path d="M6 14.5 7.5 20h3L9 15.7" />
        <path d="M19 5.5 21 4" />
        <path d="M19.5 18.5 22 20" />
        <path d="M21 12h2" />
      </svg>
    );
  }

  if (name === "deals") {
    return (
      <svg {...commonProps}>
        <path d="M3 11.5 11.5 3H19v7.5L10.5 19 3 11.5Z" />
        <circle cx="15.5" cy="6.5" r="1.2" />
        <path d="m8.5 13.5 5-5" />
        <circle cx="9" cy="9" r="1" />
        <circle cx="13" cy="13" r="1" />
      </svg>
    );
  }

  if (name === "inquiries") {
    return (
      <svg {...commonProps}>
        <path d="M21 11.5a8.5 8.5 0 1 1-3.2-6.7A8.4 8.4 0 0 1 21 11.5Z" />
        <path d="m7 19-3 1 1-3" />
        <path d="M9.8 9a2.4 2.4 0 1 1 3.7 2c-.9.6-1.5 1-1.5 2" />
        <path d="M12 16h.01" />
      </svg>
    );
  }

  if (name === "news") {
    return (
      <svg {...commonProps}>
        <rect x="4" y="3.5" width="15" height="17" rx="1.5" />
        <path d="M7.5 7h8" />
        <path d="M7.5 10h8" />
        <rect x="7.5" y="13" width="3.5" height="3.5" rx=".5" />
        <path d="M13 13h2.5" />
        <path d="M13 16h2.5" />
      </svg>
    );
  }

  if (name === "events") {
    return (
      <svg {...commonProps}>
        <rect x="3.5" y="5.5" width="17" height="15" rx="2" />
        <path d="M7 3.5v4" />
        <path d="M17 3.5v4" />
        <path d="M3.5 9.5h17" />
        <path d="M7.5 13h2" />
        <path d="M12 13h2" />
        <path d="M16.5 13h.5" />
        <path d="M7.5 17h2" />
        <path d="M12 17h2" />
        <path d="M16.5 17h.5" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" />
      <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5v-16Z" />
      <path d="M7 7h2" />
      <path d="M15 7h2" />
      <path d="M7 10h2" />
      <path d="M15 10h2" />
    </svg>
  );
}

export default function CommunityHubPage() {
  const router = useRouter();

  const [recentBadges, setRecentBadges] =
    useState<RecentBadgeState>(
      initialRecentBadgeState,
    );

  const [latestNewsTitle, setLatestNewsTitle] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadRecentBadges() {
      const { data, error } = await supabase.rpc(
        "get_hub_new_badges",
        {
          days_back: 3,
        },
      );

      if (cancelled) {
        return;
      }

      if (error) {
        console.error(
          "Hub NEW badge load error:",
          error.message,
        );

        setRecentBadges(
          initialRecentBadgeState,
        );
        return;
      }

      const nextBadges: RecentBadgeState = {
        ...initialRecentBadgeState,
      };

      for (const row of (data || []) as HubBadgeRow[]) {
        if (isBadgeKey(row.menu_key)) {
          nextBadges[row.menu_key] =
            Boolean(row.has_new);
        }
      }

      setRecentBadges(nextBadges);
    }

    loadRecentBadges();

    /*
     * 브라우저에서는 Supabase RPC 한 번만 호출합니다.
     * 페이지를 계속 열어둔 경우 10분마다 다시 확인합니다.
     */
    const intervalId = window.setInterval(
      loadRecentBadges,
      10 * 60 * 1000,
    );

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadLatestNewsTitle() {
      /*
       * business_news 테이블에서 가장 최근에 등록된
       * 뉴스 제목 1개를 가져옵니다.
       *
       * 현재 프로젝트에서 created_at을 사용하지 않는 경우
       * 아래 order 컬럼을 published_at 또는 id로 변경하면 됩니다.
       */
      const { data, error } = await supabase
        .from("business_news")
        .select("title")
        .not("title", "is", null)
        .order("created_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      if (cancelled) {
        return;
      }

      if (error) {
        console.error(
          "Latest news title load error:",
          error.message,
        );

        setLatestNewsTitle("");
        return;
      }

      setLatestNewsTitle(
        String(data?.title || "").trim(),
      );
    }

    loadLatestNewsTitle();

    /*
     * 페이지를 계속 열어둔 경우 10분마다
     * 최신 뉴스 제목을 다시 확인합니다.
     */
    const intervalId = window.setInterval(
      loadLatestNewsTitle,
      10 * 60 * 1000,
    );

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const handleBack = () => {
    router.push("/community/hub");
  };

  return (
    <main className="min-h-[100dvh] bg-[#F7F7F7] pb-24 text-[#172033]">
      {/*
       * layout.tsx의 app-safe-area가 아이폰 상태바 여백을 처리하므로
       * 이 페이지에서는 위쪽에 8px만 추가합니다.
       *
       * 헤더를 sticky/fixed로 두지 않고 본문과 같은 흐름에 넣어
       * 스크롤하면 헤더와 카드가 함께 위로 사라지게 합니다.
       */}
     <section className="mx-auto w-full max-w-xl px-4 pt-4">
        <header className="border-b border-gray-200 bg-white/95 backdrop-blur">
          <div className="flex h-14 w-full items-center justify-between px-1">
            <button
            type="button"
            onClick={handleBack}
            aria-label="Go to Hub"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#172033] transition active:scale-90 active:bg-gray-100"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-5 w-5"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
            </button>

            <div className="text-center">
            <h1 className="text-[15px] font-extrabold leading-none">
              Hub
            </h1>

            <p className="mt-1 text-[9px] font-medium text-gray-500">
              필요한 메뉴를 한곳에서 이용하세요
            </p>
            </div>

            <div className="flex h-9 w-9 items-center justify-center">
              <ProfileButton />
            </div>
          </div>
        </header>

        <div className="pt-4">
          <div className="grid grid-cols-2 gap-2.5">
          {hubItems.map((item) => {
            const isExternal =
              item.href.startsWith("http");

            const showNewBadge =
              recentBadges[item.badgeKey];

            const cardClassName = `
              relative flex min-h-[112px] items-center justify-center
              overflow-hidden rounded-2xl border border-gray-200
              bg-white px-3 py-4 text-center
              shadow-[0_2px_10px_rgba(23,32,51,0.06)]
              transition duration-150
              hover:-translate-y-0.5
              hover:shadow-[0_6px_18px_rgba(23,32,51,0.10)]
              active:scale-[0.97] active:bg-gray-50
              ${item.wide ? "col-span-2 min-h-[82px]" : ""}
            `;

            const cardContent = (
              <>
                {showNewBadge && (
                  <span className="absolute right-2 top-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[8px] font-extrabold text-white shadow-sm">
                    NEW
                  </span>
                )}

                <div
                  className={
                    item.wide
                      ? "flex w-full items-center justify-center gap-4"
                      : "flex flex-col items-center"
                  }
                >
                  <div
                    className={`flex items-center justify-center text-[#172033] ${
                      item.wide
                        ? "h-10 w-10"
                        : "h-12 w-12"
                    }`}
                  >
                    <HubIcon
                      name={item.icon}
                      className={
                        item.wide
                          ? "h-9 w-9"
                          : "h-11 w-11"
                      }
                    />
                  </div>

                  <div
                    className={
                      item.wide
                        ? "text-left"
                        : "mt-2"
                    }
                  >
                    <h2 className="text-[13px] font-extrabold leading-tight text-[#172033]">
                      {item.title}
                    </h2>

                    <p className="mt-1 text-[10px] font-semibold text-gray-500">
                      {item.subtitle}
                    </p>

                    {item.badgeKey === "news" && latestNewsTitle && (
  <p
    title={latestNewsTitle}
    className="
      mt-2
      max-w-[320px]
      truncate
      text-[13px]
      font-extrabold
      leading-5
      text-[#1B365D]
    "
  >
    📰 {latestNewsTitle}
  </p>
)}
                  </div>
                </div>
              </>
            );

            if (isExternal) {
              return (
                <a
                  key={item.title}
                  href={item.href}
                  className={cardClassName}
                >
                  {cardContent}
                </a>
              );
            }

            return (
              <Link
                key={item.title}
                href={item.href}
                className={cardClassName}
              >
                {cardContent}
              </Link>
            );
          })}
        </div>

          <section className="mt-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_2px_10px_rgba(23,32,51,0.06)]">
            <Link
              href="/community/ads"
              className="relative flex items-center justify-center gap-3 rounded-xl transition hover:opacity-80 active:scale-95"
            >
              {recentBadges.adbook && (
                <span className="absolute right-0 top-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[8px] font-extrabold text-white shadow-sm">
                  NEW
                </span>
              )}

              <div className="flex h-10 w-10 items-center justify-center text-[#172033]">
                <HubIcon
                  name="adbook"
                  className="h-9 w-9"
                />
              </div>

              <div className="text-left">
                <h2 className="text-[14px] font-extrabold text-[#172033]">
                  광고북
                </h2>

                <p className="mt-0.5 text-[10px] font-semibold text-gray-500">
                  Ad Book
                </p>
              </div>
            </Link>
          </section>
        </div>
      </section>

      <CommunityBottomNav activeNav="hub" />
    </main>
  );
}