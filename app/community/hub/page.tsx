"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import CommunityBottomNav from "../../components/CommunityBottomNav";
import ProfileButton from "@/app/components/ProfileButton";

type HubItem = {
  title: string;
  subtitle: string;
  href: string;
  emoji: string;
  badge?: string;
  wide?: boolean;
};

const hubItems: HubItem[] = [
  {
    title: "사고/팔기",
    subtitle: "Marketplace",
    href: "/market",
    emoji: "🛍️",
  },
  {
    title: "광고",
    subtitle: "Ads",
    href: "https://www.ktowntriangle.com/ads",
    emoji: "📣",
  },
  {
    title: "할인 & 쿠폰",
    subtitle: "Deals",
	
    href: "/deals",
    emoji: "🏷️",
  },
  {
    title: "문의하기",
    subtitle: "Inquiries",

    href: "/community/inquiries",
    emoji: "🙋",
  },
  {
    title: "뉴스/공연/문화",
    subtitle: "News",
    href: "/community/news",
    emoji: "📰",
    badge: "NEW",
    wide: true,
  },
  {
    title: "이벤트",
    subtitle: "Events",
    href: "/community/events",
    emoji: "🎉",
    wide: true,
  },
];

export default function CommunityHubPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[#F7F7F7] pb-4 text-[#172033]">
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-md items-center justify-between px-4">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#172033] transition active:scale-90 active:bg-gray-100"
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

          <div className="text-center">
            <h1 className="text-[15px] font-extrabold leading-none">Hub</h1>
            <p className="mt-1 text-[9px] font-medium text-gray-500">
              필요한 메뉴를 한곳에서 이용하세요
            </p>
          </div>

          <div className="flex h-9 w-9 items-center justify-center">
            <ProfileButton />
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-md px-3 pt-3">
        <div className="grid grid-cols-2 gap-2.5">
          {hubItems.map((item) => {
            const isExternal = item.href.startsWith("http");

            const cardClassName = `
              relative flex min-h-[112px] items-center justify-center
              overflow-hidden rounded-2xl border border-gray-200
              bg-white px-3 py-4 text-center
              shadow-[0_2px_10px_rgba(23,32,51,0.06)]
              transition duration-150
              active:scale-[0.97] active:bg-gray-50
              ${item.wide ? "col-span-2 min-h-[82px]" : ""}
            `;

            const cardContent = (
              <>
                {item.badge && (
                  <span className="absolute right-2 top-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[8px] font-extrabold text-white shadow-sm">
                    {item.badge}
                  </span>
                )}

                <div
                  className={
                    item.wide
                      ? "flex w-full items-center justify-center gap-4"
                      : "flex flex-col items-center"
                  }
                >
                  <span
                    className={`flex items-center justify-center ${
                      item.wide ? "text-[30px]" : "text-[38px]"
                    }`}
                    aria-hidden="true"
                  >
                    {item.emoji}
                  </span>

                  <div className={item.wide ? "text-left" : "mt-2"}>
                    <h2 className="text-[13px] font-extrabold leading-tight text-[#172033]">
                      {item.title}
                    </h2>
                    <p className="mt-1 text-[10px] font-semibold text-gray-500">
                      {item.subtitle}
                    </p>
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
      </section>

      <CommunityBottomNav activeNav="hub" />
    </main>
  );
}