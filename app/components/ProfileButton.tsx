// app/components/ProfileButton.tsx
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

type Profile = {
  role: string | null;
};

export default function ProfileButton() {
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(true);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const isAdmin = role === "admin" || role === "owner";

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      setChecking(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user || null;

      if (!mounted) return;

      if (!user) {
        setUserId(null);
        setRole(null);
        setOpen(false);
        setChecking(false);
        return;
      }

      setUserId(user.id);

      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle<Profile>();

      if (!mounted) return;

      setRole(data?.role || null);
      setChecking(false);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadUser();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  async function logout() {
    await supabase.auth.signOut();

    setUserId(null);
    setRole(null);
    setOpen(false);

    window.location.href = "/";
  }

  if (checking) {
    return (
      <div className="h-10 w-20 rounded-full bg-white/70 shadow" />
    );
  }

 if (!userId) {
  return (
    <Link
      href="/login"
      className="relative z-[9999] inline-flex items-center justify-center rounded-full bg-[#172033] px-4 py-2 text-sm font-black text-white shadow cursor-pointer"
    >
      Login
    </Link>
  );
}

  return (
    <div ref={menuRef} className="relative z-50">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl font-black shadow"
        aria-label="Open profile menu"
      >
        ⋯
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-52 overflow-hidden rounded-2xl bg-white shadow-2xl">
          <Link
            href="/profile"
            className="block px-4 py-3 text-sm font-bold text-[#172033]"
            onClick={() => setOpen(false)}
          >
            My Profile
          </Link>

          <Link
            href="/my-businesses"
            className="block px-4 py-3 text-sm font-bold text-[#172033]"
            onClick={() => setOpen(false)}
          >
            My Businesses
          </Link>

          <Link
            href="/business-events"
            className="block px-4 py-3 text-sm font-bold text-[#172033]"
            onClick={() => setOpen(false)}
          >
            Business Events
          </Link>

          {isAdmin && (
            <Link
              href="/admin"
              className="block px-4 py-3 text-sm font-black text-[#C4483A]"
              onClick={() => setOpen(false)}
            >
              Admin
            </Link>
          )}

          <button
            type="button"
            onClick={logout}
            className="block w-full px-4 py-3 text-left text-sm font-black text-red-600"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}