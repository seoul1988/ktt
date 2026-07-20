"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type BottomNavProps = {
  activeNav?: "home" | "map" | "deals" | "community" | "market" | "admin";
};

export default function BottomNav({
  activeNav = "home",
}: BottomNavProps) {
  const router = useRouter();

  const [role, setRole] = useState<string | null>(null);
  const [isIOS, setIsIOS] = useState(false);

  const activeClass = "text-[#F7B955]";
  const normalClass = "text-white";

  const navButtonClass =
    "group flex min-w-0 flex-col items-center justify-center rounded-xl px-3 py-2 transition-all duration-100 active:scale-90 active:bg-white/20 active:shadow-inner";

  useEffect(() => {
    async function loadRole() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setRole(null);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      setRole(data?.role || null);
    }

    loadRole();
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
      // 10ms는 너무 약할 수 있으므로 35ms로 설정
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

  return (
    <nav className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] left-1/2 z-[1000] flex w-[94%] max-w-md -translate-x-1/2 items-center justify-around rounded-3xl bg-[#172033] px-3 py-3 text-xs font-semibold text-white shadow-2xl">
      {isIOS && (
        <button
          type="button"
          onClick={handleBack}
          aria-label="Go back"
          className={`${navButtonClass} text-white`}
        >
          <span className="text-lg leading-none transition-transform duration-100 group-active:scale-125">
            ←
          </span>
        </button>
      )}

      <Link
        href="/"
        onTouchStart={triggerHaptic}
        onClick={triggerHaptic}
        aria-current={activeNav === "home" ? "page" : undefined}
        className={`${navButtonClass} ${
          activeNav === "home" ? activeClass : normalClass
        }`}
      >
        <span className="transition-transform duration-100 group-active:scale-110">
          Home
        </span>
      </Link>

      <Link
        href="/map"
        onTouchStart={triggerHaptic}
        onClick={triggerHaptic}
        aria-current={activeNav === "map" ? "page" : undefined}
        className={`${navButtonClass} ${
          activeNav === "map" ? activeClass : normalClass
        }`}
      >
        <span className="transition-transform duration-100 group-active:scale-110">
          Map
        </span>
      </Link>

      <Link
        href="/deals"
        onTouchStart={triggerHaptic}
        onClick={triggerHaptic}
        aria-current={activeNav === "deals" ? "page" : undefined}
        className={`${navButtonClass} ${
          activeNav === "deals" ? activeClass : normalClass
        }`}
      >
        <span className="transition-transform duration-100 group-active:scale-110">
          Deals
        </span>
      </Link>

      <Link
        href="/community"
        onTouchStart={triggerHaptic}
        onClick={triggerHaptic}
        aria-current={activeNav === "community" ? "page" : undefined}
        className={`${navButtonClass} ${
          activeNav === "community" ? activeClass : normalClass
        }`}
      >
        <span className="transition-transform duration-100 group-active:scale-110">
          Community
        </span>
      </Link>

      {role === "admin" && (
        <Link
          href="/admin"
          onTouchStart={triggerHaptic}
          onClick={triggerHaptic}
          aria-current={activeNav === "admin" ? "page" : undefined}
          className={`${navButtonClass} ${
            activeNav === "admin" ? activeClass : normalClass
          }`}
        >
          <span className="transition-transform duration-100 group-active:scale-110">
            Admin
          </span>
        </Link>
      )}
    </nav>
  );
}