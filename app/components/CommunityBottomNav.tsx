"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type CommunityBottomNavProps = {
  activeNav?: "home" | "map" | "market" | "ads" | "community" | "admin";
};

export default function CommunityBottomNav({
  activeNav = "community",
}: CommunityBottomNavProps) {
  const [isAdmin, setIsAdmin] = useState(false);

  const activeClass = "text-[#F7B955]";
  const normalClass = "text-white";

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

      if (data?.role === "admin") {
        setIsAdmin(true);
      }
    }

    loadProfile();
  }, []);

  return (
    <nav className="fixed bottom-4 left-1/2 z-[9999] flex w-[98%] max-w-md -translate-x-1/2 items-center justify-around rounded-3xl bg-[#172033] px-3 py-3 text-[10px] font-semibold text-white shadow-2xl">
      <Link
        href="/"
        className={`flex flex-col items-center ${
          activeNav === "home" ? activeClass : normalClass
        }`}
      >
        <span>HOME</span>
      </Link>

      <Link
        href="/community/map"
        className={`flex flex-col items-center ${
          activeNav === "map" ? activeClass : normalClass
        }`}
      >
        <span>MAP</span>
      </Link>

      <Link
        href="/market"
        className={`flex flex-col items-center ${
          activeNav === "market" ? activeClass : normalClass
        }`}
      >
        <span>MARKET</span>
      </Link>

      <Link
        href="/ads"
        className={`flex flex-col items-center ${
          activeNav === "ads" ? activeClass : normalClass
        }`}
      >
        <span>ADS</span>
      </Link>

      <Link
        href="/community"
        className={`flex flex-col items-center ${
          activeNav === "community" ? activeClass : normalClass
        }`}
      >
        <span>COMMUNITY</span>
      </Link>

      {isAdmin && (
        <Link
          href="/admin"
          className={`flex flex-col items-center ${
            activeNav === "admin" ? activeClass : normalClass
          }`}
        >
          <span>ADMIN</span>
        </Link>
      )}
    </nav>
  );
}