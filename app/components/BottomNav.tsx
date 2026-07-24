"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { supabase } from "../../lib/supabase";

type BottomNavProps = {
  activeNav?:
    | "home"
    | "map"
    | "search"
    | "community"
    | "market"
    | "profile"
    | "admin";
};

export default function BottomNav({
  activeNav = "home",
}: BottomNavProps) {
  const router = useRouter();

  const [role, setRole] = useState<string | null>(null);
  const [isIOS, setIsIOS] = useState(false);

  const isAdmin = role === "admin";

  const activeClass = "text-[#F7A928]";
  const normalClass = "text-[#172033]";

  const navButtonClass =
    "group flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1 transition-all duration-150 active:scale-90 active:opacity-70";

  useEffect(() => {
    let mounted = true;

    async function loadRole() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!mounted) {
          return;
        }

        if (!user) {
          setRole(null);
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (!mounted) {
          return;
        }

        if (error) {
          console.error("Profile role load error:", error);
          setRole(null);
          return;
        }

        setRole(data?.role ?? null);
      } catch (error) {
        console.error(
          "Bottom navigation role load error:",
          error,
        );

        if (mounted) {
          setRole(null);
        }
      }
    }

    loadRole();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const userAgent = window.navigator.userAgent;
    const platform = window.navigator.platform;
    const touchPoints = window.navigator.maxTouchPoints;

    const iphoneOrIPad =
      /iPhone|iPad|iPod/i.test(userAgent) ||
      (platform === "MacIntel" && touchPoints > 1);

    setIsIOS(iphoneOrIPad);
  }, []);

  function triggerHaptic() {
    if (typeof window === "undefined") {
      return;
    }

    if (!("vibrate" in window.navigator)) {
      return;
    }

    try {
      window.navigator.vibrate(35);
    } catch {
      // 진동을 지원하지 않는 브라우저에서는 무시
    }
  }

  function handleBack() {
    triggerHaptic();

    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/");
  }

  const profileIsActive =
    (isAdmin && activeNav === "admin") ||
    (!isAdmin && activeNav === "profile");

  return (
    <>
      {/* 하단 네비게이션에 콘텐츠가 가리지 않도록 여백 확보 */}
      <div className="h-[calc(76px+env(safe-area-inset-bottom,0px))] shrink-0" />

      <nav
        className="
          fixed bottom-0 left-0 right-0 z-[1000]
          border-t border-gray-200
          bg-white
          pb-[env(safe-area-inset-bottom,0px)]
          shadow-[0_-3px_14px_rgba(0,0,0,0.08)]
        "
      >
        <div className="relative mx-auto h-[64px] w-full max-w-md px-2">
          {/*
           * 모든 일반 메뉴를 기존 위치보다 6px 위로 올립니다.
           * 하단 safe-area는 nav의 padding-bottom으로 별도 유지됩니다.
           */}
          <div className="absolute -top-[6px] bottom-[6px] left-2 right-2 flex">
            {/* 왼쪽 메뉴 영역 */}
            <div className="flex w-1/2 items-center justify-evenly pr-8">
              {isIOS && (
                <button
                  type="button"
                  onClick={handleBack}
                  aria-label="Go back"
                  className="
                    flex min-w-0 flex-1 flex-col
                    items-center justify-center
                    text-[#172033]
                    transition-all duration-150
                    active:scale-90 active:opacity-70
                  "
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-5 w-5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M15 18l-6-6 6-6" />
                  </svg>

                  <span className="mt-0.5 text-[10px] leading-none">
                    Back
                  </span>
                </button>
              )}

              {/* Home */}
              <Link
                href="/"
                onClick={triggerHaptic}
                aria-current={
                  activeNav === "home" ? "page" : undefined
                }
                className={`${navButtonClass} ${
                  activeNav === "home"
                    ? activeClass
                    : normalClass
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-6 w-6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 10.5L12 3l9 7.5" />
                  <path d="M5 9.5V21h14V9.5" />
                  <path d="M9.5 21v-7h5v7" />
                </svg>

                <span className="text-[11px] font-medium leading-none">
                  Home
                </span>
              </Link>

              {/* Map */}
              <Link
                href="/map"
                onClick={triggerHaptic}
                aria-current={
                  activeNav === "map" ? "page" : undefined
                }
                className={`${navButtonClass} ${
                  activeNav === "map"
                    ? activeClass
                    : normalClass
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-6 w-6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1116 0z" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>

                <span className="text-[11px] font-medium leading-none">
                  Map
                </span>
              </Link>
            </div>

            {/* 오른쪽 메뉴 영역 */}
            <div className="flex w-1/2 items-center justify-evenly pl-8">
              {/* Community */}
              <Link
                href="/community"
                onClick={triggerHaptic}
                aria-current={
                  activeNav === "community"
                    ? "page"
                    : undefined
                }
                className={`${navButtonClass} ${
                  activeNav === "community"
                    ? activeClass
                    : normalClass
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-6 w-6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="8" cy="8" r="3" />
                  <circle cx="17" cy="8" r="3" />
                  <path d="M2.5 20v-1.5A5.5 5.5 0 018 13h1" />
                  <path d="M21.5 20v-1.5A5.5 5.5 0 0016 13h-1" />
                  <path d="M9 20v-1a3 3 0 016 0v1" />
                </svg>

                <span className="text-[11px] font-medium leading-none">
                  Community
                </span>
              </Link>

              {/* 관리자는 Admin, 일반 사용자는 Profile */}
              <Link
                href={isAdmin ? "/admin" : "/profile"}
                onClick={triggerHaptic}
                aria-current={
                  profileIsActive ? "page" : undefined
                }
                className={`${navButtonClass} ${
                  profileIsActive
                    ? activeClass
                    : normalClass
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-6 w-6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="7" r="4" />
                  <path d="M4.5 21a7.5 7.5 0 0115 0" />

                  {isAdmin && (
                    <path d="M17.5 4.5l.8 1.4 1.6.3-1.1 1.2.2 1.6-1.5-.7-1.5.7.2-1.6-1.1-1.2 1.6-.3.8-1.4z" />
                  )}
                </svg>

                <span className="text-[11px] font-medium leading-none">
                  {isAdmin ? "Admin" : "Profile"}
                </span>
              </Link>
            </div>
          </div>

          {/* 가운데 검색 버튼도 기존 위치보다 6px 위로 이동 */}
          <div
            className="
              pointer-events-none
              absolute left-1/2 top-0 z-20
              h-full -translate-x-1/2
            "
          >
            <Link
              href="/search"
              onClick={triggerHaptic}
              aria-label="Search businesses"
              aria-current={
                activeNav === "search" ? "page" : undefined
              }
              className={`
                pointer-events-auto
                absolute left-1/2 -top-[6px]
                -translate-x-1/2
                flex h-[60px] w-[60px]
                items-center justify-center
                rounded-full
                border-4 border-[#172033]
                bg-white
                text-[#172033]
                shadow-[0_8px_20px_rgba(23,32,51,0.18)]
                transition-all duration-150
                active:scale-90
                hover:scale-105
                ${
                  activeNav === "search"
                    ? "ring-4 ring-[#F7A928]/30"
                    : ""
                }
              `}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-7 w-7 text-[#172033]"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="6.5" />
                <path d="M16 16l4.5 4.5" />
              </svg>
            </Link>
          </div>
        </div>
      </nav>
    </>
  );
}