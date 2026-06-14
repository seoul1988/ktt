"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
  const [isAdmin, setIsAdmin] = useState(false);

  const activeClass =
    "text-[#F7B955] scale-110 drop-shadow-[0_0_8px_rgba(247,185,85,0.65)]";
  const normalClass = "text-white";

  const itemClass =
    "flex min-w-[38px] flex-col items-center justify-center gap-0.5 leading-none transition-all duration-150 active:scale-90 active:opacity-70";

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      setIsAdmin(data?.role === "admin");
    }

    loadProfile();
  }, []);

  return (
    <nav className="fixed bottom-4 left-1/2 z-[9999] flex w-[98%] max-w-md -translate-x-1/2 items-center justify-around rounded-3xl bg-[#172033] px-2 py-3 text-[8px] font-bold text-white shadow-2xl backdrop-blur-sm">
      <Link
        href="/"
        className={`${itemClass} ${
          activeNav === "home" ? activeClass : normalClass
        }`}
      >
        <span className="text-lg leading-none">🏠</span>
        <span>HOME</span>
      </Link>

      <Link
        href="/community/map"
        className={`${itemClass} ${
          activeNav === "map" ? activeClass : normalClass
        }`}
      >
        <span className="text-lg leading-none">🗺️</span>
        <span>MAP</span>
      </Link>

      <Link
        href="/market"
        className={`${itemClass} ${
          activeNav === "market" ? activeClass : normalClass
        }`}
      >
        <span className="text-lg leading-none">🛍️</span>
        <span>MARKET</span>
      </Link>

      <Link
        href="/community/deals"
        className={`${itemClass} ${
          activeNav === "deals" ? activeClass : normalClass
        }`}
      >
        <span className="text-lg leading-none">🔥</span>
        <span>DEALS</span>
      </Link>

      <Link
        href="/ads"
        className={`${itemClass} ${
          activeNav === "ads" ? activeClass : normalClass
        }`}
      >
        <span className="text-lg leading-none">📢</span>
        <span>ADS</span>
      </Link>

      <Link
        href="/community"
        className={`${itemClass} ${
          activeNav === "community" ? activeClass : normalClass
        }`}
      >
        <span className="text-lg leading-none">👥</span>
        <span>SOCIAL</span>
      </Link>

      {isAdmin && (
        <Link
          href="/admin"
          className={`${itemClass} ${
            activeNav === "admin" ? activeClass : normalClass
          }`}
        >
          <span className="text-lg leading-none">⚙️</span>
          <span>ADMIN</span>
        </Link>
      )}
    </nav>
  );
}