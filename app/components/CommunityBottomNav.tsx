"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

type CommunityBottomNavProps = {
  activeNav?:
    | "home"
    | "map"
    | "market"
    | "search"
    | "deals"
    | "ads"
    | "hub"
    | "community"
    | "admin";
};

export default function CommunityBottomNav({
  activeNav = "community",
}: CommunityBottomNavProps) {
  const router = useRouter();

  const [isAdmin, setIsAdmin] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // touch와 click이 연속 실행될 때 진동 중복 방지
  const lastHapticTimeRef = useRef(0);

  const activeClass = "text-[#F7A928]";
  const normalClass = "text-[#172033]";

  const navButtonClass =
    "group flex min-w-0 flex-col items-center justify-center gap-0.5 py-1 transition-all duration-150 active:scale-90 active:opacity-70";

  /*
   * 기존 페이지에서 activeNav="market", "ads", "deals"를 사용해도
   * Hub 버튼이 활성화되도록 호환성을 유지합니다.
   */
  const isHubActive =
    activeNav === "hub" ||
    activeNav === "market" ||
    activeNav === "ads" ||
    activeNav === "deals";

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!mounted) {
          return;
        }

        if (!user) {
          setIsAdmin(false);
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
          console.error("Community navigation role load error:", error);
          setIsAdmin(false);
          return;
        }

        setIsAdmin(data?.role === "admin");
      } catch (error) {
        console.error("Community navigation load error:", error);

        if (mounted) {
          setIsAdmin(false);
        }
      }
    }

    loadProfile();

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

    const now = Date.now();

    if (now - lastHapticTimeRef.current < 200) {
      return;
    }

    lastHapticTimeRef.current = now;

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

    router.push("/community");
  }

  if (!isMounted) {
    return <div className="h-[78px] shrink-0" />;
  }

  return (
    <>
      {/* 하단 네비게이션에 페이지 내용이 가리지 않도록 여백 */}
      <div className="h-[78px] shrink-0" />

      <nav className="fixed bottom-0 left-0 right-0 z-[9999] border-t border-gray-200 bg-white shadow-[0_-3px_14px_rgba(0,0,0,0.08)]">
        <div
          className="
            relative mx-auto h-[64px] w-full max-w-md
            px-1 pb-[env(safe-area-inset-bottom,0px)]
          "
        >
          {/*
           * 가운데 검색 버튼은 화면 중앙에 고정합니다.
           *
           * iPhone 일반 사용자:
           * Back / Home / Map | Search | Hub / Social
           *
           * iPhone 관리자:
           * Back / Home / Map | Search | Hub / Social / Admin
           *
           * Android 일반 사용자:
           * Home / Map | Search | Hub / Social
           */}
          <div className="absolute inset-y-0 left-1 right-1 flex">
            <div className="flex w-1/2 items-center justify-evenly pr-8">
          {/* iPhone 뒤로가기 */}
          {isIOS && (
            <button
              type="button"
              onClick={handleBack}
              aria-label="Go back"
              className="flex w-[42px] shrink-0 flex-col items-center justify-center text-[#172033] transition-all duration-150 active:scale-90 active:opacity-70"
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

              <span className="mt-0.5 text-[9px] font-medium leading-none">
                Back
              </span>
            </button>
          )}

          {/* Home */}
          <Link
            href="/"
            onClick={triggerHaptic}
            aria-current={activeNav === "home" ? "page" : undefined}
            className={`${navButtonClass} w-[42px] ${
              activeNav === "home" ? activeClass : normalClass
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

            <span className="text-[10px] font-medium leading-none">
              Home
            </span>
          </Link>

          {/* Map */}
          <Link
            href="/community/map"
            onClick={triggerHaptic}
            aria-current={activeNav === "map" ? "page" : undefined}
            className={`${navButtonClass} w-[42px] ${
              activeNav === "map" ? activeClass : normalClass
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

            <span className="text-[10px] font-medium leading-none">
              Map
            </span>
          </Link>


            </div>

            {/* 오른쪽 메뉴 영역 */}
            <div className="flex w-1/2 items-center justify-evenly pl-8">
          {/* Hub: Market, Ads, Deals, Business News 통합 */}
          <Link
            href="/community/hub"
            onClick={triggerHaptic}
            aria-current={isHubActive ? "page" : undefined}
            className={`${navButtonClass} flex-1 ${
              isHubActive ? activeClass : normalClass
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
              <path d="M4 9h16v11H4V9z" />
              <path d="M3 9l2-5h14l2 5" />
              <path d="M8 20v-6h4v6" />
              <path d="M15 13h2" />
              <path d="M4 9c0 1.3 1 2.3 2.3 2.3S8.7 10.3 8.7 9" />
              <path d="M8.7 9c0 1.3 1 2.3 2.3 2.3s2.3-1 2.3-2.3" />
              <path d="M13.3 9c0 1.3 1 2.3 2.3 2.3S18 10.3 18 9" />
            </svg>

            <span className="text-[10px] font-medium leading-none">
              Hub
            </span>
          </Link>

          {/* Social */}
          <Link
            href="/community"
            onClick={triggerHaptic}
            aria-current={
              activeNav === "community" ? "page" : undefined
            }
            className={`${navButtonClass} flex-1 ${
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

            <span className="text-[10px] font-medium leading-none">
              Social
            </span>
          </Link>

          {/* 관리자만 Admin 표시 */}
          {isAdmin && (
            <Link
              href="/admin"
              onClick={triggerHaptic}
              aria-current={activeNav === "admin" ? "page" : undefined}
              className={`${navButtonClass} flex-1 ${
                activeNav === "admin" ? activeClass : normalClass
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
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.6v.2h-4V21a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 00.3-1.9A1.7 1.7 0 003 14H2.8v-4H3a1.7 1.7 0 001.6-1 1.7 1.7 0 00-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 001.9.3A1.7 1.7 0 0010 3V2.8h4V3a1.7 1.7 0 001 1.6 1.7 1.7 0 001.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 00-.3 1.9 1.7 1.7 0 001.6 1h.2v4H21a1.7 1.7 0 00-1.6 1z" />
              </svg>

              <span className="text-[10px] font-medium leading-none">
                Admin
              </span>
            </Link>
          )}
            </div>
          </div>

          {/* 가운데 검색 버튼: 좌우 버튼 수와 무관하게 정확히 중앙 고정 */}
          <div className="pointer-events-none absolute left-1/2 top-0 z-20 h-full -translate-x-1/2">
            <Link
              href="/community/search"
              onClick={triggerHaptic}
              aria-label="Search community directory"
              aria-current={activeNav === "search" ? "page" : undefined}
              className={`
                pointer-events-auto absolute left-1/2 -top-0 -translate-x-1/2
                flex h-[60px] w-[60px]
                items-center justify-center
                rounded-full
                border-4 border-white
                bg-[#1B365D]
                text-white
                shadow-[0_8px_20px_rgba(23,32,51,0.35)]
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
                className="h-7 w-7 text-white"
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