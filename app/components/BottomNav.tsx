"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function BottomNav() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    async function loadRole() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      console.log("USER:", user);

      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      console.log("PROFILE ROLE:", data, error);

      setRole(data?.role || null);
    }

    loadRole();
  }, []);

  return (
    <nav className="fixed bottom-4 left-1/2 z-[1000] flex w-[90%] max-w-md -translate-x-1/2 justify-around rounded-3xl bg-[#172033] px-4 py-3 text-xs font-semibold text-white shadow-2xl">
      <Link href="/">Home</Link>
      <Link href="/map">Map</Link>
      <Link href="/deals">Deals</Link>
      <Link href="/community">Community</Link>

      {role === "admin" && (
        <Link href="/admin" className="text-[#F7B955]">
          Admin
        </Link>
      )}
    </nav>
  );
}