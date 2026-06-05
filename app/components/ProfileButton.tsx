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

const isOwner = role === "owner";
const isAdmin = role === "admin";

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
    return <div className="h-10 w-20 rounded-full bg-white/70 shadow" />;
  }

  if (!userId) {
    return (
      <Link
        href="/login"
        className="relative z-[9999] inline-flex items-center justify-center rounded-full bg-[#172033] px-4 py-2 text-sm font-black text-white shadow"
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
  className="relative z-[99999] flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-black/10 transition-all duration-150 active:scale-95"
  aria-label="Open profile menu"
>
  <span className="flex flex-col items-center justify-center gap-[3px]">
    <span className="h-[5px] w-[5px] rounded-full bg-[#172033]" />
    <span className="h-[5px] w-[5px] rounded-full bg-[#172033]" />
    <span className="h-[5px] w-[5px] rounded-full bg-[#172033]" />
  </span>
</button>

  {open && (
    <div className="absolute right-0 top-12 z-[99999] w-56 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 text-sm font-bold text-[#172033] shadow-2xl">
      <Link
        href="/profile"
        className="block px-4 py-3 transition-all duration-150 hover:bg-gray-100 active:scale-[0.98] active:bg-gray-200"
        onClick={() => setOpen(false)}
      >
        Edit Profile
      </Link>

      <Link
        href="/my-coupons"
        className="block px-4 py-3 transition-all duration-150 hover:bg-gray-100 active:scale-[0.98] active:bg-gray-200"
        onClick={() => setOpen(false)}
      >
        My Coupons
      </Link>

      {(isOwner || isAdmin) && (
        <>
          <Link
            href="/owner"
            className="block px-4 py-3 transition-all duration-150 hover:bg-gray-100 active:scale-[0.98] active:bg-gray-200"
            onClick={() => setOpen(false)}
          >
            My Business
          </Link>

          <Link
            href="/business/new"
            className="block px-4 py-3 transition-all duration-150 hover:bg-gray-100 active:scale-[0.98] active:bg-gray-200"
            onClick={() => setOpen(false)}
          >
            Register Business
          </Link>

          <Link
            href="/events/new"
            className="block px-4 py-3 transition-all duration-150 hover:bg-gray-100 active:scale-[0.98] active:bg-gray-200"
            onClick={() => setOpen(false)}
          >
            Create Event
          </Link>

          <Link
            href="/deals/new"
            className="block px-4 py-3 transition-all duration-150 hover:bg-gray-100 active:scale-[0.98] active:bg-gray-200"
            onClick={() => setOpen(false)}
          >
            Create Deal
          </Link>

          <Link
            href="/coupons/new"
            className="block px-4 py-3 transition-all duration-150 hover:bg-gray-100 active:scale-[0.98] active:bg-gray-200"
            onClick={() => setOpen(false)}
          >
            Register Coupon
          </Link>
        </>
      )}

      {isAdmin && (
        <>
          <Link
            href="/admin/owner-requests"
            className="block px-4 py-3 transition-all duration-150 hover:bg-gray-100 active:scale-[0.98] active:bg-gray-200"
            onClick={() => setOpen(false)}
          >
            Owner Requests
          </Link>

          <Link
            href="/admin/categories"
            className="block px-4 py-3 transition-all duration-150 hover:bg-gray-100 active:scale-[0.98] active:bg-gray-200"
            onClick={() => setOpen(false)}
          >
            Categories
          </Link>

          <Link
            href="/admin/event-requests"
            className="block px-4 py-3 transition-all duration-150 hover:bg-gray-100 active:scale-[0.98] active:bg-gray-200"
            onClick={() => setOpen(false)}
          >
            Event Requests
          </Link>
        </>
      )}

      <button
        type="button"
        onClick={logout}
        className="block w-full px-4 py-3 text-left text-red-600 transition-all duration-150 hover:bg-red-50 active:scale-[0.98] active:bg-red-100"
      >
        Logout
      </button>
    </div>
  )}
</div>
  );
}