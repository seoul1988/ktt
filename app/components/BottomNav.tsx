"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type BottomNavProps = {
  activeNav?: "home" | "map" | "deals" | "community" | "market" | "admin";
};

export default function BottomNav({ activeNav = "home" }: BottomNavProps) {
  const [role, setRole] = useState<string | null>(null);

  const activeClass = "text-[#F7B955]";
  const normalClass = "text-white";

  useEffect(() => {
    async function loadRole() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      setRole(data?.role || null);
    }

    loadRole();
  }, []);

  return (
    <nav className="fixed bottom-4 left-1/2 z-[1000] flex w-[90%] max-w-md -translate-x-1/2 justify-around rounded-3xl bg-[#172033] px-4 py-3 text-xs font-semibold text-white shadow-2xl">
      <Link
        href="/"
        className={activeNav === "home" ? activeClass : normalClass}
      >
        Home
      </Link>

      <Link
        href="/map"
        className={activeNav === "map" ? activeClass : normalClass}
      >
        Map
      </Link>

      <Link
        href="/deals"
        className={activeNav === "deals" ? activeClass : normalClass}
      >
        Deals
      </Link>

      <Link
        href="/community"
        className={activeNav === "community" ? activeClass : normalClass}
      >
        Community
      </Link>

      {role === "admin" && (
        <Link
          href="/admin"
          className={activeNav === "admin" ? activeClass : normalClass}
        >
          Admin
        </Link>
      )}
    </nav>
  );
}