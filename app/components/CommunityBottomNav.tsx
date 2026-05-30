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
    <nav className="fixed bottom-4 left-1/2 z-[9999] flex w-[95%] max-w-md -translate-x-1/2 items-center justify-around rounded-3xl bg-[#172033] px-3 py-3 text-[10px] font-semibold text-white shadow-2xl">
      <Link href="/" className="flex flex-col items-center">
  
        <span>HOME</span>
      </Link>

      <Link
        href="/community/map"
        className="flex flex-col items-center text-[#F7B955]"
      >
      
        <span>MAP</span>
      </Link>

      <Link href="/market" className="flex flex-col items-center">
       
        <span>MARKET</span>
      </Link>

      <Link href="/community" className="flex flex-col items-center">
   
        <span>COMMUNITY</span>
      </Link>

      {isAdmin && (
        <Link href="/admin" className="flex flex-col items-center">
        
          <span>ADMIN</span>
        </Link>
      )}
    </nav>
  );
}