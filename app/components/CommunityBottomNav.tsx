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
    | "deals"
    | "ads"
    | "community"
    | "admin";
};

export default function CommunityBottomNav({
  activeNav = "community",
}: CommunityBottomNavProps) {
  const router = useRouter();

  const [isAdmin, setIsAdmin] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  // touch와 click이 연속으로 실행될 때 진동이 두 번 발생하는 것을 방지
  const lastHapticTimeRef = useRef(0);

  const activeClass =
    "text-[#F7B955] scale-110 drop-shadow-[0_0_8px_rgba(247,185,85,0.65)]";

  const normalClass = "text-white";

  const itemClass =
    "group flex min-w-[38px] flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 leading-none transition-all duration-100 active:scale-90 active:bg-white/20 active:shadow-inner active:opacity-80";

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsAdmin(false);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      setIsAdmin(data?.role === "admin");
    }

    loadProfile();
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

    // onTouchStart와 onClick이 거의 동시에 발생할 때 중복 진동 방지
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

  return (
    <nav className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] left-1/2 z-[9999] flex w-[98%] max-w-md -translate-x-1/2 items-center justify-around rounded-3xl bg-[#172033] px-2 py-3 text-[8px] font-bold text-white shadow-2xl backdrop-blur-sm">
      {isIOS && (
        <button
          type="button"
          onTouchStart={triggerHaptic}
          onClick={handleBack}
          aria-label="Go back"
          className={`${itemClass} ${normalClass}`}
        >
          <span className="text-lg leading-none transition-transform duration-100 group-active:scale-125">
            ⬅️
          </span>
          <span>BACK</span>
        </button>
      )}

      <Link
        href="/"
        onTouchStart={triggerHaptic}
        onClick={triggerHaptic}
        aria-current={activeNav === "home" ? "page" : undefined}
        className={`${itemClass} ${
          activeNav === "home" ? activeClass : normalClass
        }`}
      >
        <span className="text-lg leading-none transition-transform duration-100 group-active:scale-125">
          🏠
        </span>
        <span>HOME</span>
      </Link>

      <Link
        href="/community/map"
        onTouchStart={triggerHaptic}
        onClick={triggerHaptic}
        aria-current={activeNav === "map" ? "page" : undefined}
        className={`${itemClass} ${
          activeNav === "map" ? activeClass : normalClass
        }`}
      >
        <span className="text-lg leading-none transition-transform duration-100 group-active:scale-125">
          🗺️
        </span>
        <span>MAP</span>
      </Link>

      <Link
        href="/market"
        onTouchStart={triggerHaptic}
        onClick={triggerHaptic}
        aria-current={activeNav === "market" ? "page" : undefined}
        className={`${itemClass} ${
          activeNav === "market" ? activeClass : normalClass
        }`}
      >
        <span className="text-lg leading-none transition-transform duration-100 group-active:scale-125">
          🛍️
        </span>
        <span>MARKET</span>
      </Link>

      <Link
        href="/community/deals"
        onTouchStart={triggerHaptic}
        onClick={triggerHaptic}
        aria-current={activeNav === "deals" ? "page" : undefined}
        className={`${itemClass} ${
          activeNav === "deals" ? activeClass : normalClass
        }`}
      >
        <span className="text-lg leading-none transition-transform duration-100 group-active:scale-125">
          🔥
        </span>
        <span>DEALS</span>
      </Link>

      <Link
        href="/ads"
        onTouchStart={triggerHaptic}
        onClick={triggerHaptic}
        aria-current={activeNav === "ads" ? "page" : undefined}
        className={`${itemClass} ${
          activeNav === "ads" ? activeClass : normalClass
        }`}
      >
        <span className="text-lg leading-none transition-transform duration-100 group-active:scale-125">
          📢
        </span>
        <span>ADS</span>
      </Link>

      <Link
        href="/community"
        onTouchStart={triggerHaptic}
        onClick={triggerHaptic}
        aria-current={activeNav === "community" ? "page" : undefined}
        className={`${itemClass} ${
          activeNav === "community" ? activeClass : normalClass
        }`}
      >
        <span className="text-lg leading-none transition-transform duration-100 group-active:scale-125">
          👥
        </span>
        <span>SOCIAL</span>
      </Link>

      {isAdmin && (
        <Link
          href="/admin"
          onTouchStart={triggerHaptic}
          onClick={triggerHaptic}
          aria-current={activeNav === "admin" ? "page" : undefined}
          className={`${itemClass} ${
            activeNav === "admin" ? activeClass : normalClass
          }`}
        >
          <span className="text-lg leading-none transition-transform duration-100 group-active:scale-125">
            ⚙️
          </span>
          <span>ADMIN</span>
        </Link>
      )}
    </nav>
  );
}