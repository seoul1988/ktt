"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type BottomNavProps = {
  activeNav?: "home" | "map" | "deals" | "community" | "market" | "admin";
};

export default function BottomNav({ activeNav = "home" }: BottomNavProps) {
  const router = useRouter();

  const [role, setRole] = useState<string | null>(null);
  const [isIOS, setIsIOS] = useState(false);

  const activeClass = "text-[#F7B955]";
  const normalClass = "text-white";

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

  function handleBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/");
  }

function haptic() {
  // Android
  if ("vibrate" in navigator) {
    navigator.vibrate(10);
  }
}

  return (
    <nav className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-[1000] flex w-[94%] max-w-md -translate-x-1/2 items-center justify-around rounded-3xl bg-[#172033] px-3 py-3 text-xs font-semibold text-white shadow-2xl">
      {isIOS && (
       <button
  type="button"
  onClick={() => {
    haptic();
    handleBack();
  }}
  aria-label="Go back"
  className="
    group
    flex min-w-0 flex-col items-center justify-center
    rounded-xl
    px-3 py-2
    text-white
    transition-all
    duration-150
    active:scale-90
    active:bg-white/15
  "
>
  <span className="text-lg leading-none transition-transform duration-150 group-active:scale-125">
    ←
  </span>
</button>
      )}

      <Link
        href="/"
        className={`flex flex-col items-center justify-center ${
          activeNav === "home" ? activeClass : normalClass
        }`}
      >
        Home
      </Link>

      <Link
        href="/map"
        className={`flex flex-col items-center justify-center ${
          activeNav === "map" ? activeClass : normalClass
        }`}
      >
        Map
      </Link>

      <Link
        href="/deals"
        className={`flex flex-col items-center justify-center ${
          activeNav === "deals" ? activeClass : normalClass
        }`}
      >
        Deals
      </Link>

      <Link
        href="/community"
        className={`flex flex-col items-center justify-center ${
          activeNav === "community" ? activeClass : normalClass
        }`}
      >
        Community
      </Link>

      {role === "admin" && (
        <Link
          href="/admin"
          className={`flex flex-col items-center justify-center ${
            activeNav === "admin" ? activeClass : normalClass
          }`}
        >
          Admin
        </Link>
      )}
    </nav>
  );
}