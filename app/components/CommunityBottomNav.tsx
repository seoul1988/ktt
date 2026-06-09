"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function CommunityBottomNav() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  const getClass = (active: boolean) =>
    active
      ? "flex flex-col items-center text-[#F7B955]"
      : "flex flex-col items-center text-white";

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
    <nav className="fixed bottom-4 left-1/2 z-[9999] flex w-[94%] max-w-md -translate-x-1/2 items-center justify-around rounded-3xl bg-[#8B2635] px-2 py-3 text-[10px] font-semibold shadow-2xl">
      <Link href="/" className={getClass(pathname === "/")}>
        <span>HOME</span>
      </Link>

      <Link
        href="/community/map"
        className={getClass(pathname.startsWith("/community/map"))}
      >
        <span>MAP</span>
      </Link>

      <Link
        href="/market"
        className={getClass(pathname.startsWith("/market"))}
      >
        <span>MARKET</span>
      </Link>

      <Link
        href="/ads"
        className={getClass(pathname.startsWith("/ads"))}
      >
        <span>ADS</span>
      </Link>

      <Link
        href="/community"
        className={getClass(
          pathname === "/community" ||
            pathname.startsWith("/community/events")
        )}
      >
        <span>COMMUNITY</span>
      </Link>

      {isAdmin && (
        <Link
          href="/admin"
          className={getClass(pathname.startsWith("/admin"))}
        >
          <span>ADMIN</span>
        </Link>
      )}
    </nav>
  );
}