"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function CommunityBottomNav() {
  const [isAdmin, setIsAdmin] = useState(false);

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
        .single();

      if (data?.role === "admin") {
        setIsAdmin(true);
      }
    }

    loadProfile();
  }, []);

  return (
    <nav className="fixed bottom-4 left-1/2 z-[9999] flex w-[90%] max-w-md -translate-x-1/2 justify-around rounded-3xl bg-[#172033] px-4 py-3 text-[11px] font-semibold text-white shadow-2xl">
      <Link href="/">HOME</Link>

      <Link href="/community/map" className="text-[#F7B955]">
        MAP
      </Link>

      <Link href="/community">COMMUNITY</Link>

      {isAdmin && <Link href="/admin">ADMIN</Link>}
    </nav>
  );
}